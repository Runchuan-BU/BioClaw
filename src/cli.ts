/**
 * BioClaw CLI Mode
 * Test the agent locally without WhatsApp.
 * Usage: npm run cli
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import {
  ASSISTANT_NAME,
  CONTAINER_IMAGE,
  GROUPS_DIR,
  DATA_DIR,
} from './config.js';
import { logger } from './logger.js';

const GROUP_FOLDER = 'cli-test';

function ensureDirs() {
  const dirs = [
    path.join(GROUPS_DIR, GROUP_FOLDER, 'logs'),
    path.join(DATA_DIR, 'sessions', GROUP_FOLDER, '.claude'),
    path.join(DATA_DIR, 'ipc', GROUP_FOLDER, 'messages'),
    path.join(DATA_DIR, 'ipc', GROUP_FOLDER, 'tasks'),
    path.join(DATA_DIR, 'ipc', GROUP_FOLDER, 'input'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const settingsFile = path.join(DATA_DIR, 'sessions', GROUP_FOLDER, '.claude', 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
      env: {
        CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
        CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
      },
    }, null, 2) + '\n');
  }

  // Copy bio-tools skill
  const skillsSrc = path.join(process.cwd(), 'container', 'skills');
  const skillsDst = path.join(DATA_DIR, 'sessions', GROUP_FOLDER, '.claude', 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const skillDir of fs.readdirSync(skillsSrc)) {
      const srcDir = path.join(skillsSrc, skillDir);
      if (!fs.statSync(srcDir).isDirectory()) continue;
      const dstDir = path.join(skillsDst, skillDir);
      fs.mkdirSync(dstDir, { recursive: true });
      for (const file of fs.readdirSync(srcDir)) {
        fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file));
      }
    }
  }
}

function readSecrets(): Record<string, string> {
  const envFile = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) return {};
  const secrets: Record<string, string> = {};
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if ([
      'ANTHROPIC_API_KEY',
      'CLAUDE_CODE_OAUTH_TOKEN',
      'MODEL_PROVIDER',
      'OPENROUTER_API_KEY',
      'OPENROUTER_BASE_URL',
      'OPENROUTER_MODEL',
      'OPENAI_COMPATIBLE_API_KEY',
      'OPENAI_COMPATIBLE_BASE_URL',
      'OPENAI_COMPATIBLE_MODEL',
    ].includes(key) && value) {
      secrets[key] = value;
    }
  }
  return secrets;
}

async function runAgent(prompt: string): Promise<string> {
  const projectRoot = process.cwd();
  const groupDir = path.join(GROUPS_DIR, GROUP_FOLDER);
  const globalDir = path.join(GROUPS_DIR, 'global');
  const sessionsDir = path.join(DATA_DIR, 'sessions', GROUP_FOLDER, '.claude');
  const ipcDir = path.join(DATA_DIR, 'ipc', GROUP_FOLDER);
  const agentRunnerSrc = path.join(projectRoot, 'container', 'agent-runner', 'src');

  const input = {
    prompt,
    groupFolder: GROUP_FOLDER,
    chatJid: 'cli@local',
    isMain: false,
    secrets: readSecrets(),
  };

  const args = [
    'run', '-i', '--rm',
    '-v', `${groupDir}:/workspace/group`,
    '-v', `${globalDir}:/workspace/global:ro`,
    '-v', `${sessionsDir}:/home/node/.claude`,
    '-v', `${ipcDir}:/workspace/ipc`,
    '-v', `${agentRunnerSrc}:/app/src:ro`,
    CONTAINER_IMAGE,
  ];

  return new Promise((resolve) => {
    const container = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    container.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;

      // Parse streaming output markers
      const startMarker = '---BIOCLAW_OUTPUT_START---';
      const endMarker = '---BIOCLAW_OUTPUT_END---';
      let startIdx: number;
      while ((startIdx = stdout.indexOf(startMarker)) !== -1) {
        const endIdx = stdout.indexOf(endMarker, startIdx);
        if (endIdx === -1) break;
        const jsonStr = stdout.slice(startIdx + startMarker.length, endIdx).trim();
        stdout = stdout.slice(endIdx + endMarker.length);
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.result) {
            const text = parsed.result.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
            if (text) {
              console.log(`\n${ASSISTANT_NAME}: ${text}`);
            }
          }
        } catch { /* ignore parse errors */ }
      }
    });

    container.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    container.stdin.write(JSON.stringify(input));
    container.stdin.end();

    const timeout = setTimeout(() => {
      console.log('\n[Timeout - stopping container]');
      container.kill();
    }, 300000); // 5 min timeout

    container.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout.includes('BIOCLAW_OUTPUT')) {
        resolve(`[Error: container exited with code ${code}]`);
      } else {
        resolve('');
      }
    });
  });
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  BioClaw - Biology Research Assistant');
  console.log('  CLI Test Mode (Docker + Claude Agent)');
  console.log('========================================');
  console.log('');
  console.log('Type a biology question or task. Type "exit" to quit.');
  console.log('Example: "Analyze DNA sequence ATGCGATCG and find ORFs"');
  console.log('');

  ensureDirs();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === 'exit') {
        console.log('Bye!');
        rl.close();
        process.exit(0);
      }

      console.log('\n[Running in Docker container...]');
      await runAgent(trimmed);
      console.log('');
      askQuestion();
    });
  };

  askQuestion();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
