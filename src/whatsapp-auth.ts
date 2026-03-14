/**
 * WhatsApp Authentication Script
 *
 * Run this during setup to authenticate with WhatsApp.
 * Displays QR code, waits for scan, saves credentials, then exits.
 *
 * Usage: npx tsx src/whatsapp-auth.ts
 * Pairing code: npx tsx src/whatsapp-auth.ts --pairing-code --phone 14155551234
 */
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import readline from 'readline';

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

import { getWhatsAppBrowser } from './platform.js';

const AUTH_DIR = './store/auth';
const QR_FILE = './store/qr-data.txt';
const STATUS_FILE = './store/auth-status.txt';

const logger = pino({
  level: 'warn',
});

const usePairingCode = process.argv.includes('--pairing-code');
const phoneArg = process.argv.find((_, i, arr) => arr[i - 1] === '--phone');

let pairingCodeRequested = false;
let retryCount = 0;
const MAX_RETRIES = 10;

function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function connectSocket(phoneNumber?: string): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  if (state.creds.registered) {
    fs.writeFileSync(STATUS_FILE, 'already_authenticated');
    console.log('✓ Already authenticated with WhatsApp');
    console.log(
      '  To re-authenticate, delete the store/auth folder and run again.',
    );
    process.exit(0);
  }

  let version: [number, number, number] | undefined;
  try {
    const versionInfo = await fetchLatestBaileysVersion();
    version = versionInfo.version;
    console.log(`Using WhatsApp version: ${version.join('.')}`);
  } catch (err: any) {
    console.warn('Failed to fetch latest version, using default:', err.message);
  }

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    ...(version ? { version } : {}),
    printQRInTerminal: false,
    logger,
    browser: getWhatsAppBrowser('Chrome'),
  });

  if (usePairingCode && phoneNumber && !pairingCodeRequested) {
    pairingCodeRequested = true;
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber!);
        console.log(`\n🔗 Your pairing code: ${code}\n`);
        console.log('  1. Open WhatsApp on your phone');
        console.log('  2. Tap Settings → Linked Devices → Link a Device');
        console.log('  3. Tap "Link with phone number instead"');
        console.log(`  4. Enter this code: ${code}\n`);
        console.log('  ⏳ Waiting for you to enter the code on your phone...\n');
        fs.writeFileSync(STATUS_FILE, `pairing_code:${code}`);
      } catch (err: any) {
        console.error('Failed to request pairing code:', err.message);
        console.log('  Retrying...');
        pairingCodeRequested = false;
      }
    }, 5000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !usePairingCode) {
      fs.writeFileSync(QR_FILE, qr);
      console.log('Scan this QR code with WhatsApp:\n');
      console.log('  1. Open WhatsApp on your phone');
      console.log('  2. Tap Settings → Linked Devices → Link a Device');
      console.log('  3. Point your camera at the QR code below\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as any)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        fs.writeFileSync(STATUS_FILE, 'failed:logged_out');
        console.log('\n✗ Logged out. Delete store/auth and try again.');
        process.exit(1);
      }

      retryCount++;
      if (retryCount > MAX_RETRIES) {
        fs.writeFileSync(STATUS_FILE, `failed:max_retries`);
        console.log('\n✗ Max retries exceeded. Please try again.');
        process.exit(1);
      }

      if (reason === 515 || reason === 405 || reason === DisconnectReason.timedOut) {
        const delay = Math.min(2000 * retryCount, 10000);
        console.log(`\n⟳ Reconnecting in ${delay / 1000}s (reason: ${reason}, attempt ${retryCount}/${MAX_RETRIES})...`);
        setTimeout(() => connectSocket(phoneNumber), delay);
      } else {
        fs.writeFileSync(STATUS_FILE, `failed:${reason || 'unknown'}`);
        console.log(`\n✗ Connection failed (reason: ${reason}). Please try again.`);
        process.exit(1);
      }
    }

    if (connection === 'open') {
      retryCount = 0;
      fs.writeFileSync(STATUS_FILE, 'authenticated');
      try { fs.unlinkSync(QR_FILE); } catch {}
      console.log('\n✓ Successfully authenticated with WhatsApp!');
      console.log('  Credentials saved to store/auth/');
      console.log('  You can now start the BioClaw service.\n');

      setTimeout(() => process.exit(0), 2000);
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

async function authenticate(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  try { fs.unlinkSync(QR_FILE); } catch {}
  try { fs.unlinkSync(STATUS_FILE); } catch {}

  let phoneNumber = phoneArg;
  if (usePairingCode && !phoneNumber) {
    phoneNumber = await askQuestion('Enter your phone number (with country code, no + or spaces, e.g. 14155551234): ');
  }

  console.log('Starting WhatsApp authentication...\n');

  await connectSocket(phoneNumber);
}

authenticate().catch((err) => {
  console.error('Authentication failed:', err.message);
  process.exit(1);
});
