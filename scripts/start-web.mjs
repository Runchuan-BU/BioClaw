#!/usr/bin/env node
/**
 * Start BioClaw in web-only mode: Local Web + Lab trace on the same port.
 * Loads .env from project root, then forces ENABLE_LOCAL_WEB=true and
 * disables all other chat channels so the browser UI can be used in isolation.
 *
 * Usage (from repo root): npm run web
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const require = createRequire(import.meta.url);
const tsxPkgDir = path.dirname(require.resolve('tsx/package.json'));
const tsxCli = path.join(tsxPkgDir, 'dist', 'cli.mjs');
if (!fs.existsSync(tsxCli)) {
  console.error('tsx not found. Run: npm install');
  process.exit(1);
}

const env = {
  ...process.env,
  ENABLE_LOCAL_WEB: 'true',
  ENABLE_WHATSAPP: 'false',
  ENABLE_WECHAT: 'false',
  DISABLE_WHATSAPP: '1',
  QQ_APP_ID: '',
  QQ_CLIENT_SECRET: '',
  FEISHU_APP_ID: '',
  FEISHU_APP_SECRET: '',
  WECOM_BOT_ID: '',
  WECOM_SECRET: '',
  DISCORD_BOT_TOKEN: '',
  SLACK_BOT_TOKEN: '',
  SLACK_APP_TOKEN: '',
};

const host = env.LOCAL_WEB_HOST || 'localhost';
const port = env.LOCAL_WEB_PORT || '3000';
console.log(`\n  BioClaw (web): http://${host}:${port}/  — chat + lab trace in one page (tabs · split ≥1100px)\n`);

const child = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
  cwd: root,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
