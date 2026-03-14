import { exec } from 'child_process';
import os from 'os';

import { Browsers } from '@whiskeysockets/baileys';

export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

export function getWhatsAppBrowser(browser = 'Chrome'): [string, string, string] {
  if (process.platform === 'darwin') {
    return Browsers.macOS(browser);
  }
  if (process.platform === 'win32') {
    return Browsers.windows(browser);
  }
  return Browsers.appropriate(browser);
}

export function notifyAuthRequired(message: string): void {
  if (process.platform !== 'darwin') return;

  const escaped = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  exec(
    `osascript -e 'display notification "${escaped}" with title "BioClaw" sound name "Basso"'`,
  );
}
