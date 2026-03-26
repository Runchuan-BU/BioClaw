/**
 * Container Runtime — low-level container operations (spawn, volume mounts, args).
 * Supports Docker and Apptainer (Singularity) backends via CONTAINER_RUNTIME env var.
 * container-runner.ts only handles high-level orchestration (input/output, timeouts, lifecycle).
 */
import { ChildProcess, execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  CONTAINER_IMAGE,
  CONTAINER_RUNTIME,
  GROUPS_DIR,
} from './config.js';
import { ensureGroupDir, ensureGroupIpcDir, ensureGroupSessionDir } from './group-folder.js';
import { logger } from './logger.js';
import { validateAdditionalMounts } from './mount-security.js';
import { RegisteredGroup } from './types.js';
import { getWorkspaceFolder } from './workspace.js';

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

/**
 * Build volume mounts for a group's container.
 */
export function buildVolumeMounts(
  group: RegisteredGroup,
  isMain: boolean,
  agentId?: string,
): VolumeMount[] {
  const mounts: VolumeMount[] = [];
  const projectRoot = process.cwd();
  const workspaceFolder = getWorkspaceFolder(group);
  const runtimeScope = agentId || workspaceFolder;

  // Ensure group directory exists
  ensureGroupDir(workspaceFolder);

  if (isMain) {
    mounts.push({
      hostPath: projectRoot,
      containerPath: '/workspace/project',
      readonly: false,
    });
    mounts.push({
      hostPath: path.join(GROUPS_DIR, workspaceFolder),
      containerPath: '/workspace/group',
      readonly: false,
    });
  } else {
    mounts.push({
      hostPath: path.join(GROUPS_DIR, workspaceFolder),
      containerPath: '/workspace/group',
      readonly: false,
    });

    const globalDir = path.join(GROUPS_DIR, 'global');
    if (fs.existsSync(globalDir)) {
      mounts.push({
        hostPath: globalDir,
        containerPath: '/workspace/global',
        readonly: true,
      });
    }
  }

  // Per-group Claude sessions directory
  const groupSessionsDir = ensureGroupSessionDir(runtimeScope);
  mounts.push({
    hostPath: groupSessionsDir,
    containerPath: '/home/node/.claude',
    readonly: false,
  });

  // Per-group IPC namespace
  const groupIpcDir = ensureGroupIpcDir(runtimeScope);
  mounts.push({
    hostPath: groupIpcDir,
    containerPath: '/workspace/ipc',
    readonly: false,
  });

  // Mount agent-runner source from host
  const agentRunnerSrc = path.join(projectRoot, 'container', 'agent-runner', 'src');
  mounts.push({
    hostPath: agentRunnerSrc,
    containerPath: '/app/src',
    readonly: true,
  });

  // Additional mounts validated against external allowlist
  if (group.containerConfig?.additionalMounts) {
    const validatedMounts = validateAdditionalMounts(
      group.containerConfig.additionalMounts,
      group.name,
      isMain,
    );
    mounts.push(...validatedMounts);
  }

  return mounts;
}

// ---------------------------------------------------------------------------
// Docker backend
// ---------------------------------------------------------------------------

function buildDockerArgs(mounts: VolumeMount[], containerName: string): string[] {
  const args: string[] = ['run', '-i', '--rm', '--name', containerName];
  for (const mount of mounts) {
    if (mount.readonly) {
      args.push('-v', `${mount.hostPath}:${mount.containerPath}:ro`);
    } else {
      args.push('-v', `${mount.hostPath}:${mount.containerPath}`);
    }
  }
  args.push(CONTAINER_IMAGE);
  return args;
}

function spawnDocker(args: string[]): ChildProcess {
  return spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
}

// ---------------------------------------------------------------------------
// Apptainer backend
// ---------------------------------------------------------------------------

function buildApptainerArgs(mounts: VolumeMount[], _containerName: string): string[] {
  const args: string[] = ['exec', '--no-home', '--containall', '--writable-tmpfs'];
  for (const mount of mounts) {
    if (mount.readonly) {
      args.push('--bind', `${mount.hostPath}:${mount.containerPath}:ro`);
    } else {
      args.push('--bind', `${mount.hostPath}:${mount.containerPath}`);
    }
  }
  args.push(CONTAINER_IMAGE);
  // Apptainer doesn't auto-run the entrypoint — invoke it explicitly
  args.push('/app/entrypoint.sh');
  return args;
}

function spawnApptainer(args: string[]): ChildProcess {
  return spawn('apptainer', args, { stdio: ['pipe', 'pipe', 'pipe'] });
}

// ---------------------------------------------------------------------------
// Public API — delegates to the configured runtime
// ---------------------------------------------------------------------------

/**
 * Build CLI arguments for running a container.
 */
export function buildContainerArgs(mounts: VolumeMount[], containerName: string): string[] {
  if (CONTAINER_RUNTIME === 'apptainer') {
    return buildApptainerArgs(mounts, containerName);
  }
  return buildDockerArgs(mounts, containerName);
}

/**
 * Spawn a container process.
 */
export function spawnContainer(containerArgs: string[]): ChildProcess {
  if (CONTAINER_RUNTIME === 'apptainer') {
    return spawnApptainer(containerArgs);
  }
  return spawnDocker(containerArgs);
}

/**
 * Stop a running container.
 * Docker: `docker stop <name>` for graceful shutdown.
 * Apptainer: kill the process directly (no daemon).
 */
export function stopContainer(
  containerName: string,
  proc?: ChildProcess | null,
  timeoutMs = 15000,
): void {
  if (CONTAINER_RUNTIME === 'apptainer') {
    // Apptainer has no daemon — just kill the process
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      // Force kill after timeout
      const forceKill = setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, Math.min(timeoutMs, 5000));
      proc.once('exit', () => clearTimeout(forceKill));
    }
    return;
  }
  // Docker: graceful stop via CLI
  try {
    execSync(`docker stop ${containerName}`, { timeout: timeoutMs, stdio: 'ignore' });
  } catch {
    // stop failed or timed out — caller handles fallback
  }
}

/**
 * Check that the configured container runtime is available.
 * Throws if not found or not running.
 */
export function checkRuntime(): void {
  if (CONTAINER_RUNTIME === 'apptainer') {
    try {
      execSync('apptainer --version', { stdio: 'pipe', timeout: 10000 });
    } catch {
      console.error('\nFATAL: Apptainer is not installed. Install it from https://apptainer.org/\n');
      throw new Error('Apptainer is required but not found');
    }
    return;
  }
  // Docker
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 10000 });
  } catch {
    console.error('\nFATAL: Docker is not running. Start Docker Desktop or run: sudo systemctl start docker\n');
    throw new Error('Docker is required but not running');
  }
}

/**
 * Clean up orphaned containers from a previous run.
 * Docker: find and stop containers matching the bioclaw- prefix.
 * Apptainer: no-op (no daemon, no orphans possible).
 */
export function cleanupOrphans(): void {
  if (CONTAINER_RUNTIME === 'apptainer') return; // no daemon → no orphans

  try {
    const output = execSync(
      'docker ps --filter "name=bioclaw-" --format "{{.Names}}"',
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' },
    );
    const orphans = output.trim().split('\n').filter(Boolean);
    for (const name of orphans) {
      try { execSync(`docker stop ${name}`, { stdio: 'pipe' }); } catch {}
    }
    if (orphans.length > 0) {
      logger.info({ count: orphans.length }, 'Stopped orphaned containers');
    }
  } catch {}
}

/**
 * Generate a unique container name for a group.
 */
export function makeContainerName(folder: string): string {
  const safeName = folder.replace(/[^a-zA-Z0-9-]/g, '-');
  return `bioclaw-${safeName}-${Date.now()}`;
}
