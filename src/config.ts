import { loadEnvFile } from './env.js';
import { getHomeDir } from './platform.js';
import path from 'path';

loadEnvFile();

export const ASSISTANT_NAME = process.env.ASSISTANT_NAME || 'Bioclaw';
export const POLL_INTERVAL = 2000;
export const SCHEDULER_POLL_INTERVAL = 60000;
export const ENABLE_WHATSAPP = process.env.ENABLE_WHATSAPP !== 'false';
export const ENABLE_LOCAL_WEB = process.env.ENABLE_LOCAL_WEB === 'true';
export const LOCAL_WEB_HOST = process.env.LOCAL_WEB_HOST || '127.0.0.1';
export const LOCAL_WEB_PORT = parseInt(process.env.LOCAL_WEB_PORT || '3210', 10);
export const LOCAL_WEB_GROUP_JID =
  process.env.LOCAL_WEB_GROUP_JID || 'local-web@local.web';
export const LOCAL_WEB_GROUP_NAME =
  process.env.LOCAL_WEB_GROUP_NAME || 'Local Web Chat';
export const LOCAL_WEB_GROUP_FOLDER =
  process.env.LOCAL_WEB_GROUP_FOLDER || 'local-web';
export const LOCAL_WEB_SECRET = process.env.LOCAL_WEB_SECRET || '';

// Absolute paths needed for container mounts
const PROJECT_ROOT = process.cwd();
const HOME_DIR = getHomeDir();

// Mount security: allowlist stored OUTSIDE project root, never mounted into containers
export const MOUNT_ALLOWLIST_PATH = path.join(
  HOME_DIR,
  '.config',
  'bioclaw',
  'mount-allowlist.json',
);
export const STORE_DIR = path.resolve(PROJECT_ROOT, 'store');
export const GROUPS_DIR = path.resolve(PROJECT_ROOT, 'groups');
export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
export const MAIN_GROUP_FOLDER = 'main';

export const CONTAINER_IMAGE =
  process.env.CONTAINER_IMAGE || 'bioclaw-agent:latest';
export const CONTAINER_TIMEOUT = parseInt(
  process.env.CONTAINER_TIMEOUT || '1800000',
  10,
);
export const CONTAINER_MAX_OUTPUT_SIZE = parseInt(
  process.env.CONTAINER_MAX_OUTPUT_SIZE || '10485760',
  10,
); // 10MB default
export const IPC_POLL_INTERVAL = 1000;
export const IDLE_TIMEOUT = parseInt(
  process.env.IDLE_TIMEOUT || '1800000',
  10,
); // 30min default — how long to keep container alive after last result
export const MAX_CONCURRENT_CONTAINERS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_CONTAINERS || '5', 10) || 5,
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TRIGGER_PATTERN = new RegExp(
  `^@${escapeRegex(ASSISTANT_NAME)}\\b`,
  'i',
);

// Timezone for scheduled tasks (cron expressions, etc.)
// Uses system timezone by default
export const TIMEZONE =
  process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
