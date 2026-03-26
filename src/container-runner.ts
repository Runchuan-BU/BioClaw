/**
 * Container Runner for BioClaw
 * High-level orchestration: input/output parsing, timeouts, lifecycle.
 * Low-level container operations are in container-runtime.ts.
 */
import { ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  CONTAINER_MAX_OUTPUT_SIZE,
  CONTAINER_TIMEOUT,
  GROUPS_DIR,
  IDLE_TIMEOUT,
} from './config.js';
import { recordAgentTraceEvent } from './agent-trace.js';
import { readSecrets } from './credential-proxy.js';
import {
  buildVolumeMounts,
  buildContainerArgs,
  spawnContainer,
  stopContainer,
  makeContainerName,
} from './container-runtime.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { getWorkspaceFolder } from './workspace.js';

// Sentinel markers for robust output parsing (must match agent-runner)
const OUTPUT_START_MARKER = '---BIOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---BIOCLAW_OUTPUT_END---';

export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  agentId?: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  secrets?: Record<string, string>;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

function truncateForUser(text: string, maxChars = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars - 1).trimEnd()}…`;
}

function withSuggestions(summary: string, suggestions: string[]): string {
  return [
    summary,
    '',
    'Suggested next steps:',
    ...suggestions.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n');
}

function classifyRuntimeError(stderr: string, stdout: string): string | null {
  const combined = `${stderr}\n${stdout}`;

  const moduleNotFound =
    combined.match(/ModuleNotFoundError:\s+No module named ['"]([^'"]+)['"]/) ||
    combined.match(/ImportError:\s+No module named\s+([A-Za-z0-9._-]+)/);
  if (moduleNotFound) {
    const pkg = moduleNotFound[1];
    return withSuggestions(
      `Missing Python dependency: ${pkg}. This skill likely requires an extra Python package that is not installed in the container image yet.`,
      [
        `If this is a one-off local test, try installing ${pkg} in a supported writable Python environment and rerun the skill.`,
        `If this skill should be stable for everyone, add ${pkg} to the container image / dependency setup instead of relying on runtime installation.`,
        'If you want, inspect the skill code to confirm which import triggered the failure before changing the image.',
      ],
    );
  }

  const commandNotFound =
    combined.match(/(?:^|\n)([A-Za-z0-9._+-]+): command not found(?:\n|$)/) ||
    combined.match(/FileNotFoundError: \[Errno 2\] No such file or directory: ['"]([^'"]+)['"]/) ||
    combined.match(/\/bin\/sh: 1: ([A-Za-z0-9._+-]+): not found/);
  if (commandNotFound) {
    const tool = commandNotFound[1];
    return withSuggestions(
      `Missing system tool: ${tool}. This skill is trying to call a command that is not available in the current container.`,
      [
        `Add ${tool} to the Docker image / container build so it is available on PATH.`,
        'Do not rely on ad-hoc runtime installation for production use of system tools unless the environment is explicitly designed for it.',
        'If this command is optional, consider adding a fallback path inside the skill so users still get a partial answer.',
      ],
    );
  }

  if (/permission denied|operation not permitted|EACCES/i.test(combined)) {
    return withSuggestions(
      'Permission error while running this skill. The container likely does not have permission to install packages or modify protected system paths at runtime.',
      [
        'Do not try to fix this by repeatedly installing packages interactively inside the running container.',
        'If this dependency is required, add it during image build instead of runtime.',
        'If you expected runtime installation to work, check whether the command is writing to a protected system path or requires elevated privileges.',
      ],
    );
  }

  if (/No module named pip|pip: command not found/i.test(combined)) {
    return withSuggestions(
      'Package installation failed because pip is unavailable in the runtime environment.',
      [
        'Treat this as an environment/image issue rather than a transient skill failure.',
        'Install pip (or the needed package set) during image build if runtime package installation is part of your workflow.',
        'If runtime installs are not intended, update the skill instructions so the dependency requirement is explicit.',
      ],
    );
  }

  if (/Temporary failure in name resolution|Could not resolve host|Failed to establish a new connection|Connection timed out|Read timed out|Name or service not known/i.test(combined)) {
    return withSuggestions(
      'Network or external API access failed while running this skill.',
      [
        'Check container network access, proxy configuration, and DNS resolution.',
        'If the skill depends on an external API or package registry, verify that service is reachable from inside the container.',
        'If this environment is intentionally offline, the skill may need an offline fallback or pre-bundled resources.',
      ],
    );
  }

  return null;
}

function formatUserFacingContainerError(code: number | null, stderr: string, stdout: string): string {
  const classified = classifyRuntimeError(stderr, stdout);
  if (classified) return classified;

  const rawTail = truncateForUser(stderr || stdout || 'Unknown container error');
  const codeLabel = code == null ? 'unknown' : String(code);
  return `Container exited with code ${codeLabel}. Last error output: ${rawTail}`;
}

export async function runContainerAgent(
  group: RegisteredGroup,
  input: ContainerInput,
  onProcess: (proc: ChildProcess, containerName: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<ContainerOutput> {
  const startTime = Date.now();
  const workspaceFolder = getWorkspaceFolder(group);
  const agentId = input.agentId || workspaceFolder;

  const mounts = buildVolumeMounts(group, input.isMain, agentId);
  const containerName = makeContainerName(agentId);
  const containerArgs = buildContainerArgs(mounts, containerName);

  logger.debug(
    {
      group: group.name,
      agentId,
      containerName,
      mounts: mounts.map(
        (m) =>
          `${m.hostPath} -> ${m.containerPath}${m.readonly ? ' (ro)' : ''}`,
      ),
      containerArgs: containerArgs.join(' '),
    },
    'Container mount configuration',
  );

  logger.info(
    {
      group: group.name,
      agentId,
      containerName,
      mountCount: mounts.length,
      isMain: input.isMain,
    },
    'Spawning container agent',
  );

  recordAgentTraceEvent({
    group_folder: workspaceFolder,
    chat_jid: input.chatJid,
    session_id: input.sessionId ?? null,
    type: 'container_spawn',
    payload: {
      containerName,
      agentId,
      isMain: input.isMain,
      isScheduledTask: Boolean(input.isScheduledTask),
    },
  });

  const logsDir = path.join(GROUPS_DIR, workspaceFolder, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  return new Promise((resolve) => {
    const container = spawnContainer(containerArgs);

    onProcess(container, containerName);

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;

    // Pass secrets via stdin (never written to disk or mounted as files)
    input.secrets = readSecrets();
    container.stdin!.write(JSON.stringify(input));
    container.stdin!.end();
    // Remove secrets from input so they don't appear in logs
    delete input.secrets;

    // Streaming output: parse OUTPUT_START/END marker pairs as they arrive
    let parseBuffer = '';
    let newSessionId: string | undefined;
    let outputChain = Promise.resolve();

    container.stdout!.on('data', (data) => {
      const chunk = data.toString();

      // Always accumulate for logging
      if (!stdoutTruncated) {
        const remaining = CONTAINER_MAX_OUTPUT_SIZE - stdout.length;
        if (chunk.length > remaining) {
          stdout += chunk.slice(0, remaining);
          stdoutTruncated = true;
          logger.warn(
            { group: group.name, size: stdout.length },
            'Container stdout truncated due to size limit',
          );
        } else {
          stdout += chunk;
        }
      }

      // Stream-parse for output markers
      if (onOutput) {
        parseBuffer += chunk;
        let startIdx: number;
        while ((startIdx = parseBuffer.indexOf(OUTPUT_START_MARKER)) !== -1) {
          const endIdx = parseBuffer.indexOf(OUTPUT_END_MARKER, startIdx);
          if (endIdx === -1) break;

          const jsonStr = parseBuffer
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
          parseBuffer = parseBuffer.slice(endIdx + OUTPUT_END_MARKER.length);

          try {
            const parsed: ContainerOutput = JSON.parse(jsonStr);
            if (parsed.newSessionId) {
              newSessionId = parsed.newSessionId;
            }
            hadStreamingOutput = true;
            resetTimeout();
            outputChain = outputChain.then(() => onOutput(parsed));
          } catch (err) {
            logger.warn(
              { group: group.name, workspaceFolder, error: err },
              'Failed to parse streamed output chunk',
            );
          }
        }
      }
    });

    container.stderr!.on('data', (data) => {
      const chunk = data.toString();
      const lines = chunk.trim().split('\n');
      for (const line of lines) {
        if (line) logger.debug({ container: workspaceFolder }, line);
      }
      if (stderrTruncated) return;
      const remaining = CONTAINER_MAX_OUTPUT_SIZE - stderr.length;
      if (chunk.length > remaining) {
        stderr += chunk.slice(0, remaining);
        stderrTruncated = true;
        logger.warn(
          { group: group.name, size: stderr.length },
          'Container stderr truncated due to size limit',
        );
      } else {
        stderr += chunk;
      }
    });

    let timedOut = false;
    let hadStreamingOutput = false;
    const configTimeout = group.containerConfig?.timeout || CONTAINER_TIMEOUT;
    const timeoutMs = Math.max(configTimeout, IDLE_TIMEOUT + 30_000);

    const killOnTimeout = () => {
      timedOut = true;
      logger.error({ group: group.name, workspaceFolder, containerName }, 'Container timeout, stopping gracefully');
      stopContainer(containerName, container, 15000);
    };

    let timeout = setTimeout(killOnTimeout, timeoutMs);

    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(killOnTimeout, timeoutMs);
    };

    container.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      if (timedOut) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const timeoutLog = path.join(logsDir, `container-${ts}.log`);
        fs.writeFileSync(timeoutLog, [
          `=== Container Run Log (TIMEOUT) ===`,
          `Timestamp: ${new Date().toISOString()}`,
          `Group: ${group.name}`,
          `Container: ${containerName}`,
          `Duration: ${duration}ms`,
          `Exit Code: ${code}`,
          `Had Streaming Output: ${hadStreamingOutput}`,
        ].join('\n'));

        if (hadStreamingOutput) {
          logger.info(
            { group: group.name, containerName, duration, code },
            'Container timed out after output (idle cleanup)',
          );
          outputChain.then(() => {
            resolve({
              status: 'success',
              result: null,
              newSessionId,
            });
          });
          return;
        }

        logger.error(
          { group: group.name, workspaceFolder, containerName, duration, code },
          'Container timed out with no output',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Container timed out after ${configTimeout}ms`,
        });
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logsDir, `container-${timestamp}.log`);
      const isVerbose = process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace';

      const logLines = [
        `=== Container Run Log ===`,
        `Timestamp: ${new Date().toISOString()}`,
        `Group: ${group.name}`,
        `IsMain: ${input.isMain}`,
        `Duration: ${duration}ms`,
        `Exit Code: ${code}`,
        `Stdout Truncated: ${stdoutTruncated}`,
        `Stderr Truncated: ${stderrTruncated}`,
        ``,
      ];

      const isError = code !== 0;

      if (isVerbose || isError) {
        logLines.push(
          `=== Input ===`,
          JSON.stringify(input, null, 2),
          ``,
          `=== Container Args ===`,
          containerArgs.join(' '),
          ``,
          `=== Mounts ===`,
          mounts
            .map(
              (m) =>
                `${m.hostPath} -> ${m.containerPath}${m.readonly ? ' (ro)' : ''}`,
            )
            .join('\n'),
          ``,
          `=== Stderr${stderrTruncated ? ' (TRUNCATED)' : ''} ===`,
          stderr,
          ``,
          `=== Stdout${stdoutTruncated ? ' (TRUNCATED)' : ''} ===`,
          stdout,
        );
      } else {
        logLines.push(
          `=== Input Summary ===`,
          `Prompt length: ${input.prompt.length} chars`,
          `Session ID: ${input.sessionId || 'new'}`,
          ``,
          `=== Mounts ===`,
          mounts
            .map((m) => `${m.containerPath}${m.readonly ? ' (ro)' : ''}`)
            .join('\n'),
          ``,
        );
      }

      fs.writeFileSync(logFile, logLines.join('\n'));
      logger.debug({ logFile, verbose: isVerbose }, 'Container log written');

      if (code !== 0) {
        logger.error(
          {
            group: group.name,
            workspaceFolder,
            code,
            duration,
            stderr,
            stdout,
            logFile,
          },
          'Container exited with error',
        );

        resolve({
          status: 'error',
          result: null,
          error: formatUserFacingContainerError(code, stderr, stdout),
        });
        return;
      }

      // Streaming mode: wait for output chain to settle
      if (onOutput) {
        outputChain.then(() => {
          logger.info(
            { group: group.name, workspaceFolder, duration, newSessionId },
            'Container completed (streaming mode)',
          );
          resolve({
            status: 'success',
            result: null,
            newSessionId,
          });
        });
        return;
      }

      // Legacy mode: parse the last output marker pair from accumulated stdout
      try {
        const startIdx = stdout.indexOf(OUTPUT_START_MARKER);
        const endIdx = stdout.indexOf(OUTPUT_END_MARKER);

        let jsonLine: string;
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonLine = stdout
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
        } else {
          const lines = stdout.trim().split('\n');
          jsonLine = lines[lines.length - 1];
        }

        const output: ContainerOutput = JSON.parse(jsonLine);

        logger.info(
          {
            group: group.name,
            workspaceFolder,
            duration,
            status: output.status,
            hasResult: !!output.result,
          },
          'Container completed',
        );

        resolve(output);
      } catch (err) {
        logger.error(
          {
            group: group.name,
            workspaceFolder,
            stdout,
            stderr,
            error: err,
          },
          'Failed to parse container output',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Failed to parse container output: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });

    container.on('error', (err) => {
      clearTimeout(timeout);
      logger.error({ group: group.name, workspaceFolder, containerName, error: err }, 'Container spawn error');
      resolve({
        status: 'error',
        result: null,
        error: `Container spawn error: ${err.message}`,
      });
    });
  });
}
