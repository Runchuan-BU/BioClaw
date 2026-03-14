import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  ASSISTANT_NAME,
  DATA_DIR,
  ENABLE_LOCAL_WEB,
  ENABLE_WHATSAPP,
  IDLE_TIMEOUT,
  LOCAL_WEB_GROUP_FOLDER,
  LOCAL_WEB_GROUP_JID,
  LOCAL_WEB_GROUP_NAME,
  MAIN_GROUP_FOLDER,
  POLL_INTERVAL,
  TRIGGER_PATTERN,
} from './config.js';
import { LocalWebChannel } from './channels/local-web.js';
import { WhatsAppChannel } from './channels/whatsapp.js';
import { WeComChannel } from './channels/wecom.js';
import { DiscordChannel } from './channels/discord.js';
import {
  ContainerOutput,
  runContainerAgent,
  writeGroupsSnapshot,
  writeTasksSnapshot,
} from './container-runner.js';
import {
  getAllChats,
  getAllRegisteredGroups,
  getAllSessions,
  getAllTasks,
  getMessagesSince,
  getNewMessages,
  getRouterState,
  initDatabase,
  setRegisteredGroup,
  setRouterState,
  setSession,
  storeChatMetadata,
  storeMessage,
} from './db.js';
import { GroupQueue } from './group-queue.js';
import { startIpcWatcher } from './ipc.js';
import { findChannel, formatMessages, formatOutbound } from './router.js';
import { startSchedulerLoop } from './task-scheduler.js';
import { Channel, NewMessage, RegisteredGroup } from './types.js';
import { logger } from './logger.js';

// Re-export for backwards compatibility during refactor
export { escapeXml, formatMessages } from './router.js';

let lastTimestamp = '';
let sessions: Record<string, string> = {};
let registeredGroups: Record<string, RegisteredGroup> = {};
let lastAgentTimestamp: Record<string, string> = {};
let messageLoopRunning = false;

<<<<<<< HEAD
let whatsapp: WhatsAppChannel | undefined;
let wecom: WeComChannel | null = null;
const channels: Channel[] = [];
const queue = new GroupQueue();

function channelForJid(jid: string): Channel | undefined {
  return channels.find(ch => ch.ownsJid(jid));
}

async function sendToChannel(jid: string, text: string): Promise<void> {
  const ch = channelForJid(jid);
  if (!ch) {
    logger.warn({ jid }, 'No channel owns this JID, cannot send');
    return;
  }
  const formatted = ch.prefixAssistantName ? `${ASSISTANT_NAME}: ${text}` : text;
  await ch.sendMessage(jid, formatted);
}

async function sendImageToChannel(jid: string, imagePath: string, caption?: string): Promise<void> {
  const ch = channelForJid(jid);
  if (!ch?.sendImage) {
    logger.warn({ jid }, 'No channel with image support for this JID');
    return;
  }
  await ch.sendImage(jid, imagePath, caption);
}

function loadState(): void {
  lastTimestamp = getRouterState('last_timestamp') || '';
  const agentTs = getRouterState('last_agent_timestamp');
  try {
    lastAgentTimestamp = agentTs ? JSON.parse(agentTs) : {};
  } catch {
    logger.warn('Corrupted last_agent_timestamp in DB, resetting');
    lastAgentTimestamp = {};
  }
  sessions = getAllSessions();
  registeredGroups = getAllRegisteredGroups();
  logger.info(
    { groupCount: Object.keys(registeredGroups).length },
    'State loaded',
  );
}

function saveState(): void {
  setRouterState('last_timestamp', lastTimestamp);
  setRouterState(
    'last_agent_timestamp',
    JSON.stringify(lastAgentTimestamp),
  );
}

function registerGroup(jid: string, group: RegisteredGroup): void {
  registeredGroups[jid] = group;
  setRegisteredGroup(jid, group);

  // Create group folder
  const groupDir = path.join(DATA_DIR, '..', 'groups', group.folder);
  fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });

  logger.info(
    { jid, name: group.name, folder: group.folder },
    'Group registered',
  );
}

/**
 * Get available groups list for the agent.
 * Returns groups ordered by most recent activity.
 */
export function getAvailableGroups(): import('./container-runner.js').AvailableGroup[] {
  const chats = getAllChats();
  const registeredJids = new Set(Object.keys(registeredGroups));

  return chats
    .filter(
      (c) =>
        c.jid !== '__group_sync__' &&
        (c.jid.endsWith('@g.us') || c.jid.endsWith('@local.web')),
    )
    .map((c) => ({
      jid: c.jid,
      name: c.name,
      lastActivity: c.last_message_time,
      isRegistered: registeredJids.has(c.jid),
    }));
}

/** @internal - exported for testing */
export function _setRegisteredGroups(groups: Record<string, RegisteredGroup>): void {
  registeredGroups = groups;
}

/**
 * Process all pending messages for a group.
 * Called by the GroupQueue when it's this group's turn.
 */
async function processGroupMessages(chatJid: string): Promise<boolean> {
  const group = registeredGroups[chatJid];
  if (!group) return true;
  const channel = findChannel(channels, chatJid);
  if (!channel) {
    logger.warn({ chatJid }, 'No channel found for group');
    return true;
  }

  const isMainGroup = group.folder === MAIN_GROUP_FOLDER;

  const sinceTimestamp = lastAgentTimestamp[chatJid] || '';
  const missedMessages = getMessagesSince(
    chatJid,
    sinceTimestamp,
    ASSISTANT_NAME,
  );

  if (missedMessages.length === 0) return true;

  // For non-main groups, check if trigger is required and present
  if (!isMainGroup && group.requiresTrigger !== false) {
    const hasTrigger = missedMessages.some((m) =>
      TRIGGER_PATTERN.test(m.content.trim()),
    );
    if (!hasTrigger) return true;
  }

  const prompt = formatMessages(missedMessages);

  // Advance cursor so the piping path in startMessageLoop won't re-fetch
  // these messages. Save the old cursor so we can roll back on error.
  const previousCursor = lastAgentTimestamp[chatJid] || '';
  lastAgentTimestamp[chatJid] =
    missedMessages[missedMessages.length - 1].timestamp;
  saveState();

  logger.info(
    { group: group.name, messageCount: missedMessages.length },
    'Processing messages',
  );

  // Track idle timer for closing stdin when agent is idle
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      logger.debug({ group: group.name }, 'Idle timeout, closing container stdin');
      queue.closeStdin(chatJid);
    }, IDLE_TIMEOUT);
  };

  await channel.setTyping?.(chatJid, true);
  let hadError = false;
  let outputSentToUser = false;

  const output = await runAgent(group, prompt, chatJid, async (result) => {
    if (result.result) {
      const raw = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
      const text = raw.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
      logger.info({ group: group.name }, `Agent output: ${raw.slice(0, 200)}`);
      if (text) {
        await sendToChannel(chatJid, text);
        outputSentToUser = true;
      }
      resetIdleTimer();
    }

    if (result.status === 'error') {
      hadError = true;
    }
  });

  await channel.setTyping?.(chatJid, false);
  if (idleTimer) clearTimeout(idleTimer);

  if (output === 'error' || hadError) {
    // If we already sent output to the user, don't roll back the cursor —
    // the user got their response and re-processing would send duplicates.
    if (outputSentToUser) {
      logger.warn({ group: group.name }, 'Agent error after output was sent, skipping cursor rollback to prevent duplicates');
      return true;
    }
    // Roll back cursor so retries can re-process these messages
    lastAgentTimestamp[chatJid] = previousCursor;
    saveState();
    logger.warn({ group: group.name }, 'Agent error, rolled back message cursor for retry');
    return false;
  }

  return true;
}

async function runAgent(
  group: RegisteredGroup,
  prompt: string,
  chatJid: string,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<'success' | 'error'> {
  const isMain = group.folder === MAIN_GROUP_FOLDER;
  const sessionId = sessions[group.folder];

  // Update tasks snapshot for container to read (filtered by group)
  const tasks = getAllTasks();
  writeTasksSnapshot(
    group.folder,
    isMain,
    tasks.map((t) => ({
      id: t.id,
      groupFolder: t.group_folder,
      prompt: t.prompt,
      schedule_type: t.schedule_type,
      schedule_value: t.schedule_value,
      status: t.status,
      next_run: t.next_run,
    })),
  );

  // Update available groups snapshot (main group only can see all groups)
  const availableGroups = getAvailableGroups();
  writeGroupsSnapshot(
    group.folder,
    isMain,
    availableGroups,
    new Set(Object.keys(registeredGroups)),
  );

  // Wrap onOutput to track session ID from streamed results
  const wrappedOnOutput = onOutput
    ? async (output: ContainerOutput) => {
        if (output.newSessionId) {
          sessions[group.folder] = output.newSessionId;
          setSession(group.folder, output.newSessionId);
        }
        await onOutput(output);
      }
    : undefined;

  try {
    const output = await runContainerAgent(
      group,
      {
        prompt,
        sessionId,
        groupFolder: group.folder,
        chatJid,
        isMain,
      },
      (proc, containerName) => queue.registerProcess(chatJid, proc, containerName, group.folder),
      wrappedOnOutput,
    );

    if (output.newSessionId) {
      sessions[group.folder] = output.newSessionId;
      setSession(group.folder, output.newSessionId);
    }

    if (output.status === 'error') {
      logger.error(
        { group: group.name, error: output.error },
        'Container agent error',
      );
      return 'error';
    }

    return 'success';
  } catch (err) {
    logger.error({ group: group.name, err }, 'Agent error');
    return 'error';
  }
}

async function startMessageLoop(): Promise<void> {
  if (messageLoopRunning) {
    logger.debug('Message loop already running, skipping duplicate start');
    return;
  }
  messageLoopRunning = true;

  logger.info(`BioClaw running (trigger: @${ASSISTANT_NAME})`);

  while (true) {
    try {
      const jids = Object.keys(registeredGroups);
      const { messages, newTimestamp } = getNewMessages(
        jids,
        lastTimestamp,
        ASSISTANT_NAME,
      );

      if (messages.length > 0) {
        logger.info({ count: messages.length }, 'New messages');

        // Advance the "seen" cursor for all messages immediately
        lastTimestamp = newTimestamp;
        saveState();

        // Deduplicate by group
        const messagesByGroup = new Map<string, NewMessage[]>();
        for (const msg of messages) {
          const existing = messagesByGroup.get(msg.chat_jid);
          if (existing) {
            existing.push(msg);
          } else {
            messagesByGroup.set(msg.chat_jid, [msg]);
          }
        }

        for (const [chatJid, groupMessages] of messagesByGroup) {
          const group = registeredGroups[chatJid];
          if (!group) continue;

          const isMainGroup = group.folder === MAIN_GROUP_FOLDER;
          const needsTrigger = !isMainGroup && group.requiresTrigger !== false;

          // For non-main groups, only act on trigger messages.
          // Non-trigger messages accumulate in DB and get pulled as
          // context when a trigger eventually arrives.
          if (needsTrigger) {
            const hasTrigger = groupMessages.some((m) =>
              TRIGGER_PATTERN.test(m.content.trim()),
            );
            if (!hasTrigger) continue;
          }

          // Pull all messages since lastAgentTimestamp so non-trigger
          // context that accumulated between triggers is included.
          const allPending = getMessagesSince(
            chatJid,
            lastAgentTimestamp[chatJid] || '',
            ASSISTANT_NAME,
          );
          const messagesToSend =
            allPending.length > 0 ? allPending : groupMessages;
          const formatted = formatMessages(messagesToSend);

          if (queue.sendMessage(chatJid, formatted)) {
            logger.debug(
              { chatJid, count: messagesToSend.length },
              'Piped messages to active container',
            );
            lastAgentTimestamp[chatJid] =
              messagesToSend[messagesToSend.length - 1].timestamp;
            saveState();
          } else {
            // No active container — enqueue for a new one
            queue.enqueueMessageCheck(chatJid);
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error in message loop');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Startup recovery: check for unprocessed messages in registered groups.
 * Handles crash between advancing lastTimestamp and processing messages.
 */
function recoverPendingMessages(): void {
  for (const [chatJid, group] of Object.entries(registeredGroups)) {
    const sinceTimestamp = lastAgentTimestamp[chatJid] || '';
    const pending = getMessagesSince(chatJid, sinceTimestamp, ASSISTANT_NAME);
    if (pending.length > 0) {
      logger.info(
        { group: group.name, pendingCount: pending.length },
        'Recovery: found unprocessed messages',
      );
      queue.enqueueMessageCheck(chatJid);
    }
  }
}

function ensureDockerRunning(): void {
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 10000 });
    logger.debug('Docker daemon is running');
  } catch {
    logger.error('Docker daemon is not running');
    console.error('\n╔════════════════════════════════════════════════════════════════╗');
    console.error('║  FATAL: Docker is not running                                  ║');
    console.error('║                                                                ║');
    console.error('║  Agents cannot run without Docker. To fix:                     ║');
    console.error('║  macOS: Start Docker Desktop                                   ║');
    console.error('║  Linux: sudo systemctl start docker                            ║');
    console.error('║  Windows: Start Docker Desktop (prefer WSL2 backend)           ║');
    console.error('║                                                                ║');
    console.error('║  Install from: https://docker.com/products/docker-desktop      ║');
    console.error('╚════════════════════════════════════════════════════════════════╝\n');
    throw new Error('Docker is required but not running');
  }

  // Kill and clean up orphaned BioClaw containers from previous runs
  try {
    const output = execSync('docker ps --filter "name=bioclaw-" --format "{{.Names}}"', {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    const orphans = output.trim().split('\n').filter(Boolean);
    for (const name of orphans) {
      try {
        execSync(`docker stop ${name}`, { stdio: 'pipe' });
      } catch { /* already stopped */ }
    }
    if (orphans.length > 0) {
      logger.info({ count: orphans.length, names: orphans }, 'Stopped orphaned containers');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to clean up orphaned containers');
  }
}

async function main(): Promise<void> {
  ensureDockerRunning();
  initDatabase();
  logger.info('Database initialized');
  loadState();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    await queue.shutdown(10000);
    await Promise.all(channels.map((channel) => channel.disconnect()));
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Create and connect channels
  const channelCallbacks = {
    onMessage: (_chatJid: string, msg: NewMessage) => storeMessage(msg),
    onChatMetadata: (chatJid: string, timestamp: string) => storeChatMetadata(chatJid, timestamp),
    registeredGroups: () => registeredGroups,
    autoRegister: (jid: string, name: string, channelName: string) => {
      if (registeredGroups[jid]) return;
      const folder = `${channelName}-${jid.split('@')[0].slice(-8)}`;
      registerGroup(jid, {
        name,
        folder,
        trigger: TRIGGER_PATTERN.source,
        added_at: new Date().toISOString(),
        requiresTrigger: false,
      });
    },
  };

  if (ENABLE_LOCAL_WEB) {
    if (!registeredGroups[LOCAL_WEB_GROUP_JID]) {
      const folderConflict = Object.entries(registeredGroups).find(
        ([jid, group]) =>
          jid !== LOCAL_WEB_GROUP_JID && group.folder === LOCAL_WEB_GROUP_FOLDER,
      );
      if (folderConflict) {
        logger.warn(
          {
            localWebJid: LOCAL_WEB_GROUP_JID,
            folder: LOCAL_WEB_GROUP_FOLDER,
            conflictJid: folderConflict[0],
          },
          'Skipping local web auto-registration because folder is already in use',
        );
      } else {
        registerGroup(LOCAL_WEB_GROUP_JID, {
          name: LOCAL_WEB_GROUP_NAME,
          folder: LOCAL_WEB_GROUP_FOLDER,
          trigger: `@${ASSISTANT_NAME}`,
          added_at: new Date().toISOString(),
          requiresTrigger: false,
        });
      }
    }

    const localWeb = new LocalWebChannel({
      onMessage: (_chatJid, msg) => storeMessage(msg),
      onChatMetadata: (chatJid, timestamp, name) =>
        storeChatMetadata(chatJid, timestamp, name),
    });
    channels.push(localWeb);
    await localWeb.connect();
  }

  // WeCom channel (connect first — WhatsApp's heavy sync can starve the event loop)
  const wecomBotId = process.env.WECOM_BOT_ID;
  const wecomSecret = process.env.WECOM_SECRET;
  if (wecomBotId && wecomSecret) {
    const agentCreds = process.env.WECOM_CORP_ID && process.env.WECOM_CORP_SECRET && process.env.WECOM_AGENT_ID
      ? { corpId: process.env.WECOM_CORP_ID, corpSecret: process.env.WECOM_CORP_SECRET, agentId: process.env.WECOM_AGENT_ID }
      : undefined;
    wecom = new WeComChannel({ botId: wecomBotId, secret: wecomSecret, agent: agentCreds, ...channelCallbacks });
    channels.push(wecom);
    try {
      await wecom.connect();
    } catch (err) {
      logger.error({ err }, 'WeCom connection failed, continuing without it');
      wecom = null;
    }
  } else {
    logger.info('WeCom not configured (set WECOM_BOT_ID and WECOM_SECRET to enable)');
  }

  // WhatsApp channel (skip if DISABLE_WHATSAPP is set)
  if (ENABLE_WHATSAPP && !process.env.DISABLE_WHATSAPP) {
    whatsapp = new WhatsAppChannel(channelCallbacks);
    channels.push(whatsapp);
    await whatsapp.connect();
  } else {
    logger.info('WhatsApp disabled via DISABLE_WHATSAPP env var');
  }

  // Discord channel (optional — only if token is configured)
  const discordToken = process.env.DISCORD_BOT_TOKEN;
  if (discordToken) {
    const discord = new DiscordChannel({ token: discordToken, ...channelCallbacks });
    channels.push(discord);
    try {
      await discord.connect();
    } catch (err) {
      logger.error({ err }, 'Discord connection failed, continuing without it');
    }
  } else {
    logger.info('Discord not configured (set DISCORD_BOT_TOKEN to enable)');
  }

  // Start subsystems
  startSchedulerLoop({
    registeredGroups: () => registeredGroups,
    getSessions: () => sessions,
    queue,
    onProcess: (groupJid, proc, containerName, groupFolder) => queue.registerProcess(groupJid, proc, containerName, groupFolder),
    sendMessage: async (jid, rawText) => {
      const ch = channelForJid(jid);
      if (ch) {
        const text = formatOutbound(ch, rawText);
        if (text) await ch.sendMessage(jid, text);
      }
    },
  });
  startIpcWatcher({
    registeredGroups: () => registeredGroups,
    registerGroup,
    sendMessage: (jid, text) => sendToChannel(jid, text),
    sendImage: (jid, imagePath, caption) => sendImageToChannel(jid, imagePath, caption),
    syncGroupMetadata: (force) => whatsapp?.syncGroupMetadata(force),
    getAvailableGroups,
    writeGroupsSnapshot: (gf, im, ag, rj) => writeGroupsSnapshot(gf, im, ag, rj),
  });
  queue.setProcessMessagesFn(processGroupMessages);
  recoverPendingMessages();
  startMessageLoop();
}

// Guard: only run when executed directly, not when imported by tests
const isDirectRun =
  process.argv[1] &&
  new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;

if (isDirectRun) {
  main().catch((err) => {
    logger.error({ err }, 'Failed to start BioClaw');
    process.exit(1);
  });
}
