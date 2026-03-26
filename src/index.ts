/**
 * BioClaw Orchestrator
 * Top-level startup, shutdown, and wiring. All logic is delegated to sub-modules.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';

import {
  ASSISTANT_NAME,
  ENABLE_LOCAL_WEB,
  ENABLE_WECHAT,
  ENABLE_WHATSAPP,
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_CONNECTION_MODE,
  FEISHU_ENCRYPT_KEY,
  FEISHU_HOST,
  FEISHU_PATH,
  FEISHU_PORT,
  FEISHU_VERIFICATION_TOKEN,
  QQ_APP_ID,
  QQ_CLIENT_SECRET,
  QQ_SANDBOX,
  IDLE_TIMEOUT,
  LOCAL_WEB_GROUP_FOLDER,
  LOCAL_WEB_GROUP_JID,
  LOCAL_WEB_GROUP_NAME,
  LOCAL_WEB_HOST,
  LOCAL_WEB_PORT,
  MAIN_GROUP_FOLDER,
  TRIGGER_PATTERN,
} from './config.js';
import { recordAgentTraceEvent } from './agent-trace.js';
import { ContainerOutput, runContainerAgent } from './container-runner.js';
import { checkRuntime, cleanupOrphans } from './container-runtime.js';
import { writeGroupsSnapshot, writeTasksSnapshot } from './group-folder.js';
import {
  getAllTasks,
  getAllChats,
  getMessagesSince,
  getRecentMessagesForChats,
  initDatabase,
  storeMessage,
  storeChatMetadata,
} from './db/index.js';
import { GroupQueue } from './group-queue.js';
import { startIpcWatcher } from './ipc.js';
import { startMessageLoop, getAvailableGroups, recoverPendingMessages } from './message-loop.js';
import { findChannel, formatMessages, formatOutbound } from './router.js';
import {
  loadState,
  saveState,
  registerGroup,
  getRegisteredGroupsMap,
  getSessions,
  updateSession,
  getLastAgentTimestamp,
  setLastAgentTimestampFor,
  getAgentIdForChat,
  getAgentWorkspaceFolder,
  getChatJidsForAgent,
  getWorkspaceFolderForChat,
  getWorkspaceFolderForAgent,
  getChatJidsForWorkspace,
} from './session-manager.js';
import { startSchedulerLoop } from './task-scheduler.js';
import { LocalWebChannel } from './channels/local-web/channel.js';
import { QQChannel } from './channels/qq.js';
import { FeishuChannel } from './channels/feishu.js';
import { WhatsAppChannel } from './channels/whatsapp/channel.js';
import { WeComChannel } from './channels/wecom.js';
import { DiscordChannel } from './channels/discord.js';
import { SlackChannel } from './channels/slack.js';
import { WeChatChannel } from './channels/wechat.js';
import { Channel, NewMessage } from './types.js';
import { logger } from './logger.js';
import { getRuntimeGroupForWorkspace, getWorkspaceFolder } from './workspace.js';

const WORKSPACE_SYNC_HEADER = '[Workspace sync from linked clients]';

function sanitizeLocalWebThreadTitle(title?: string): string {
  const trimmed = (title || '').replace(/\s+/g, ' ').trim();
  if (trimmed) return trimmed.slice(0, 80);
  return 'New chat';
}

function summarizeWorkspaceSyncContent(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= 220) return compact;
  return `${compact.slice(0, 217)}...`;
}

function buildWorkspaceSyncPrefix(
  agentId: string,
  replyChatJid: string,
  sinceTimestamp: string,
  registeredGroups: ReturnType<typeof getRegisteredGroupsMap>,
): string {
  const chatJids = getChatJidsForAgent(agentId);
  if (chatJids.length <= 1) return '';

  let syncMessages = getRecentMessagesForChats(chatJids, 200)
    .filter((msg) => msg.chat_jid !== replyChatJid)
    .filter((msg) => !msg.content.includes(WORKSPACE_SYNC_HEADER));

  if (sinceTimestamp) {
    syncMessages = syncMessages.filter((msg) => msg.timestamp > sinceTimestamp);
  } else {
    syncMessages = syncMessages.slice(-4);
  }

  if (syncMessages.length === 0) return '';

  const selected = syncMessages.slice(-8);
  const lines = selected.map((msg) => {
    const chatName = registeredGroups[msg.chat_jid]?.name || msg.chat_jid;
    const sender = msg.is_from_me ? ASSISTANT_NAME : (msg.sender_name || msg.sender);
    return `- ${chatName} / ${sender}: ${summarizeWorkspaceSyncContent(msg.content)}`;
  });

  return `${WORKSPACE_SYNC_HEADER}\n${lines.join('\n')}`;
}

const channels: Channel[] = [];
const queue = new GroupQueue();
let localWeb: LocalWebChannel | undefined;

function channelForJid(jid: string): Channel | undefined {
  return channels.find(ch => ch.ownsJid(jid));
}

function notifyLocalWebWorkspaceUpdate(chatJid: string): void {
  if (!localWeb) return;
  const agentId = getAgentIdForChat(chatJid);
  if (!agentId) return;
  const agentChatJids = getChatJidsForAgent(agentId);
  if (agentChatJids.some((jid) => jid.endsWith('@local.web'))) {
    localWeb.notifyExternalUpdate(chatJid);
  }
}

async function sendToChannel(jid: string, text: string): Promise<void> {
  const ch = channelForJid(jid);
  if (!ch) { logger.warn({ jid }, 'No channel owns this JID'); return; }
  const formatted = formatOutbound(ch, text);
  if (!formatted) return;
  await ch.sendMessage(jid, formatted);
  if (!(ch instanceof LocalWebChannel)) {
    const now = new Date().toISOString();
    const group = getRegisteredGroupsMap()[jid];
    storeChatMetadata(jid, now, group?.name);
    storeMessage({
      id: `${ch.name}-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chat_jid: jid,
      sender: 'bioclaw@system',
      sender_name: ASSISTANT_NAME,
      content: formatted,
      timestamp: now,
      is_from_me: true,
    });
    notifyLocalWebWorkspaceUpdate(jid);
  }
}

async function sendImageToChannel(jid: string, imagePath: string, caption?: string): Promise<void> {
  const ch = channelForJid(jid);
  if (!ch?.sendImage) { logger.warn({ jid }, 'No channel with image support'); return; }
  await ch.sendImage(jid, imagePath, caption);
  if (!(ch instanceof LocalWebChannel)) {
    const now = new Date().toISOString();
    const group = getRegisteredGroupsMap()[jid];
    const description = caption
      ? `[Image sent: ${imagePath.split('/').pop() || 'image'}]\n${caption}`
      : `[Image sent: ${imagePath.split('/').pop() || 'image'}]`;
    storeChatMetadata(jid, now, group?.name);
    storeMessage({
      id: `${ch.name}-image-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chat_jid: jid,
      sender: 'bioclaw@system',
      sender_name: ASSISTANT_NAME,
      content: description,
      timestamp: now,
      is_from_me: true,
    });
    notifyLocalWebWorkspaceUpdate(jid);
  }
}

async function processAgentMessages(agentId: string): Promise<boolean> {
  const registeredGroups = getRegisteredGroupsMap();
  const chatJids = getChatJidsForAgent(agentId);
  if (chatJids.length === 0) return true;
  const workspaceFolder = getWorkspaceFolderForAgent(agentId);
  if (!workspaceFolder) return true;

  const lastAgentTimestamp = getLastAgentTimestamp();
  const pendingByChat = new Map<string, NewMessage[]>();
  for (const chatJid of chatJids) {
    const pending = getMessagesSince(
      chatJid,
      lastAgentTimestamp[chatJid] || '',
      ASSISTANT_NAME,
    );
    if (pending.length > 0) pendingByChat.set(chatJid, pending);
  }

  if (pendingByChat.size === 0) return true;

  const isMainWorkspace = workspaceFolder === MAIN_GROUP_FOLDER;
  const missedMessages = Array.from(pendingByChat.entries())
    .flatMap(([chatJid, messages]) => {
      const chatGroup = registeredGroups[chatJid];
      if (!chatGroup) return [];
      if (
        isMainWorkspace ||
        chatGroup.requiresTrigger === false ||
        messages.some((message) => TRIGGER_PATTERN.test(message.content.trim()))
      ) {
        return messages;
      }
      return [];
    })
    .sort((a, b) => (
      a.timestamp === b.timestamp
        ? a.id.localeCompare(b.id)
        : a.timestamp.localeCompare(b.timestamp)
    ));

  if (missedMessages.length === 0) return true;

  const replyChatJid = missedMessages[missedMessages.length - 1].chat_jid;
  const group = getRuntimeGroupForWorkspace(
    registeredGroups,
    workspaceFolder,
    replyChatJid,
  );
  if (!group) return true;
  const channel = findChannel(channels, replyChatJid);
  if (!channel) {
    logger.warn({ replyChatJid, workspaceFolder }, 'No channel found for workspace reply route');
    return true;
  }

  const prompt = formatMessages(missedMessages);
  const previousCursors = new Map<string, string>();
  for (const [chatJid, messages] of pendingByChat) {
    const eligibleForChat = messages.filter(
      (message) => missedMessages.some((pending) => pending.id === message.id),
    );
    if (eligibleForChat.length === 0) continue;
    previousCursors.set(chatJid, lastAgentTimestamp[chatJid] || '');
    setLastAgentTimestampFor(
      chatJid,
      eligibleForChat[eligibleForChat.length - 1].timestamp,
    );
  }
  saveState();

  logger.info(
    { group: group.name, agentId, workspaceFolder, replyChatJid, messageCount: missedMessages.length },
    'Processing agent messages',
  );

  const workspaceSyncPrefix = replyChatJid.endsWith('@local.web')
    ? ''
    : buildWorkspaceSyncPrefix(
        agentId,
        replyChatJid,
        previousCursors.get(replyChatJid) || '',
        registeredGroups,
      );
  let pendingWorkspaceSyncPrefix = workspaceSyncPrefix;

  const sessions = getSessions();
  recordAgentTraceEvent({
    group_folder: workspaceFolder,
    chat_jid: replyChatJid,
    session_id: sessions[agentId] ?? null,
    type: 'run_start',
    payload: {
      messageCount: missedMessages.length,
      promptLength: prompt.length,
      preview: prompt.slice(0, 500),
    },
  });

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      queue.closeStdin(agentId);
    }, IDLE_TIMEOUT);
  };

  await channel.setTyping?.(replyChatJid, true);
  let hadError = false;
  let outputSentToUser = false;

  const output = await runAgent(group, agentId, prompt, replyChatJid, async (result) => {
    if (result.result) {
      const raw = typeof result.result === 'string'
        ? result.result
        : JSON.stringify(result.result);
      const text = raw.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
      if (text) {
        const outboundText = pendingWorkspaceSyncPrefix
          ? `${pendingWorkspaceSyncPrefix}\n\n${text}`
          : text;
        await sendToChannel(replyChatJid, outboundText);
        pendingWorkspaceSyncPrefix = '';
        outputSentToUser = true;
      }
      resetIdleTimer();
    }
    if (result.status === 'error') hadError = true;
  });

  await channel.setTyping?.(replyChatJid, false);
  if (idleTimer) clearTimeout(idleTimer);

  if (output === 'error' || hadError) {
    if (outputSentToUser) return true;
    for (const [chatJid, previousCursor] of previousCursors) {
      setLastAgentTimestampFor(chatJid, previousCursor);
    }
    saveState();
    logger.warn(
      { group: group.name, agentId, workspaceFolder },
      'Agent error, rolled back cursor for retry',
    );
    return false;
  }
  return true;
}

async function runAgent(
  group: import('./types.js').RegisteredGroup,
  agentId: string,
  prompt: string, chatJid: string,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<'success' | 'error'> {
  const workspaceFolder = getWorkspaceFolder(group);
  const isMain = workspaceFolder === MAIN_GROUP_FOLDER;
  const sessions = getSessions();
  const sessionId = sessions[agentId];

  const tasks = getAllTasks();
  writeTasksSnapshot(agentId, isMain, tasks.map((t) => ({
    id: t.id, groupFolder: t.agent_id || t.group_folder, prompt: t.prompt,
    schedule_type: t.schedule_type, schedule_value: t.schedule_value,
    status: t.status, next_run: t.next_run,
  })));

  const availableGroups = getAvailableGroups();
  const registeredGroups = getRegisteredGroupsMap();
  writeGroupsSnapshot(agentId, isMain, availableGroups, new Set(Object.keys(registeredGroups)));

  const wrappedOnOutput = onOutput
    ? async (out: ContainerOutput) => {
        if (out.newSessionId) updateSession(agentId, out.newSessionId);
        const r = out.result == null ? '' : typeof out.result === 'string' ? out.result : JSON.stringify(out.result);
        recordAgentTraceEvent({
          group_folder: workspaceFolder, chat_jid: chatJid,
          session_id: getSessions()[agentId] ?? null, type: 'stream_output',
          payload: { status: out.status, resultLength: r.length, preview: r.replace(/<internal>[\s\S]*?<\/internal>/g, '').slice(0, 800), newSessionId: out.newSessionId ?? null },
        });
        await onOutput(out);
      }
    : undefined;

  try {
    const out = await runContainerAgent(
      group,
      { prompt, sessionId, groupFolder: workspaceFolder, agentId, chatJid, isMain },
      (proc, cn) => queue.registerProcess(agentId, proc, cn, agentId),
      wrappedOnOutput,
    );
    if (out.newSessionId) updateSession(agentId, out.newSessionId);
    recordAgentTraceEvent({
      group_folder: workspaceFolder, chat_jid: chatJid,
      session_id: getSessions()[agentId] ?? null,
      type: 'run_end', payload: { status: out.status, error: out.error ?? null },
    });
    if (out.status === 'error') { logger.error({ group: group.name, error: out.error }, 'Container agent error'); return 'error'; }
    return 'success';
  } catch (err) {
    recordAgentTraceEvent({
      group_folder: workspaceFolder, chat_jid: chatJid,
      session_id: getSessions()[agentId] ?? null,
      type: 'run_error', payload: { message: err instanceof Error ? err.message : String(err) },
    });
    logger.error({ group: group.name, err }, 'Agent error');
    return 'error';
  }
}

// --- Startup ---

function ensureRuntimeAvailable(): void {
  checkRuntime();
  cleanupOrphans();
}

let whatsapp: WhatsAppChannel | undefined;

async function main(): Promise<void> {
  ensureRuntimeAvailable();
  initDatabase();
  logger.info('Database initialized');
  loadState();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    await queue.shutdown(10000);
    await Promise.all(channels.map((ch) => ch.disconnect()));
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const channelCallbacks = {
    onMessage: (_chatJid: string, msg: NewMessage) => {
      storeMessage(msg);
      notifyLocalWebWorkspaceUpdate(msg.chat_jid);
    },
    onChatMetadata: (chatJid: string, timestamp: string, name?: string) => {
      storeChatMetadata(chatJid, timestamp, name);
      notifyLocalWebWorkspaceUpdate(chatJid);
    },
    registeredGroups: () => getRegisteredGroupsMap(),
    autoRegister: (jid: string, name: string, channelName: string) => {
      if (getRegisteredGroupsMap()[jid]) return;
      const folder = `${channelName}-${jid.split('@')[0].slice(-8)}`;
      registerGroup(jid, { name, folder, trigger: TRIGGER_PATTERN.source, added_at: new Date().toISOString(), requiresTrigger: false });
    },
  };

  // --- Channels ---

  if (ENABLE_LOCAL_WEB) {
    const rg = getRegisteredGroupsMap();
    if (!rg[LOCAL_WEB_GROUP_JID]) {
      const conflict = Object.entries(rg).find(([jid, g]) => jid !== LOCAL_WEB_GROUP_JID && g.folder === LOCAL_WEB_GROUP_FOLDER);
      if (!conflict) {
        registerGroup(LOCAL_WEB_GROUP_JID, { name: LOCAL_WEB_GROUP_NAME, folder: LOCAL_WEB_GROUP_FOLDER, trigger: `@${ASSISTANT_NAME}`, added_at: new Date().toISOString(), requiresTrigger: false });
      }
    }

    const listLocalWebThreads = () => {
      const chatInfoByJid = Object.fromEntries(
        getAllChats().map((chat) => [chat.jid, chat]),
      );

      return Object.entries(getRegisteredGroupsMap())
        .filter(([jid]) => jid.endsWith('@local.web'))
        .map(([jid, group]) => {
          const chatInfo = chatInfoByJid[jid];
          const workspaceFolder = getWorkspaceFolderForChat(jid) || group.folder;
          return {
            chatJid: jid,
            title: group.name,
            workspaceFolder,
            addedAt: group.added_at,
            lastActivity: chatInfo?.last_message_time || group.added_at,
            agentId: getAgentIdForChat(jid) || workspaceFolder,
          };
        })
        .sort((a, b) => (b.lastActivity || b.addedAt).localeCompare(a.lastActivity || a.addedAt));
    };

    const createLocalWebThread = async (title?: string) => {
      const now = new Date().toISOString();
      const token = randomUUID().replace(/-/g, '').slice(0, 12);
      const chatJid = `thread-${token}@local.web`;
      const folder = `thread-${token}`;
      const threadTitle = sanitizeLocalWebThreadTitle(title);
      registerGroup(chatJid, {
        name: threadTitle,
        folder,
        workspaceFolder: folder,
        trigger: `@${ASSISTANT_NAME}`,
        added_at: now,
        requiresTrigger: false,
      });
      storeChatMetadata(chatJid, now, threadTitle);
      return listLocalWebThreads().find((thread) => thread.chatJid === chatJid)!;
    };

    localWeb = new LocalWebChannel({
      onMessage: (_jid, msg) => {
        storeMessage(msg);
        notifyLocalWebWorkspaceUpdate(msg.chat_jid);
      },
      onChatMetadata: (jid, ts, name) => {
        storeChatMetadata(jid, ts, name);
        notifyLocalWebWorkspaceUpdate(jid);
      },
      listThreads: listLocalWebThreads,
      createThread: createLocalWebThread,
      getWorkspaceFolder: (chatJid) =>
        getWorkspaceFolderForChat(chatJid) || LOCAL_WEB_GROUP_FOLDER,
      getWorkspaceChatJids: (chatJid) => [chatJid],
    });
    channels.push(localWeb);
    await localWeb.connect();
  }

  if (QQ_APP_ID && QQ_CLIENT_SECRET) {
    const qq = new QQChannel({
      appId: QQ_APP_ID,
      clientSecret: QQ_CLIENT_SECRET,
      sandbox: QQ_SANDBOX,
      ...channelCallbacks,
    });
    channels.push(qq);
    try { await qq.connect(); } catch (err) { logger.error({ err }, 'QQ connection failed'); }
  }

  if (FEISHU_APP_ID && FEISHU_APP_SECRET) {
    const feishu = new FeishuChannel({
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      connectionMode: FEISHU_CONNECTION_MODE === 'webhook' ? 'webhook' : 'websocket',
      verificationToken: FEISHU_VERIFICATION_TOKEN || undefined,
      encryptKey: FEISHU_ENCRYPT_KEY || undefined,
      host: FEISHU_HOST,
      port: FEISHU_PORT,
      path: FEISHU_PATH,
      ...channelCallbacks,
    });
    channels.push(feishu);
    try { await feishu.connect(); } catch (err) { logger.error({ err }, 'Feishu connection failed'); }
  }

  if (process.env.WECOM_BOT_ID && process.env.WECOM_SECRET) {
    const agentCreds = process.env.WECOM_CORP_ID && process.env.WECOM_CORP_SECRET && process.env.WECOM_AGENT_ID
      ? { corpId: process.env.WECOM_CORP_ID, corpSecret: process.env.WECOM_CORP_SECRET, agentId: process.env.WECOM_AGENT_ID } : undefined;
    const wecom = new WeComChannel({ botId: process.env.WECOM_BOT_ID, secret: process.env.WECOM_SECRET, agent: agentCreds, ...channelCallbacks });
    channels.push(wecom);
    try { await wecom.connect(); } catch (err) { logger.error({ err }, 'WeCom connection failed'); }
  }

  if (ENABLE_WHATSAPP && !process.env.DISABLE_WHATSAPP) {
    whatsapp = new WhatsAppChannel(channelCallbacks);
    channels.push(whatsapp);
    await whatsapp.connect();
  }

  if (ENABLE_WECHAT) {
    const wechat = new WeChatChannel(channelCallbacks);
    channels.push(wechat);
    try { await wechat.connect(); } catch (err) { logger.error({ err }, 'WeChat connection failed'); }
  }

  if (process.env.DISCORD_BOT_TOKEN) {
    const discord = new DiscordChannel({ token: process.env.DISCORD_BOT_TOKEN, ...channelCallbacks });
    channels.push(discord);
    try { await discord.connect(); } catch (err) { logger.error({ err }, 'Discord connection failed'); }
  }

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
    const slack = new SlackChannel({ botToken: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, ...channelCallbacks });
    channels.push(slack);
    try { await slack.connect(); } catch (err) { logger.error({ err }, 'Slack connection failed'); }
  }

  // --- Subsystems ---

  startSchedulerLoop({
    registeredGroups: () => getRegisteredGroupsMap(),
    getSessions: () => getSessions(),
    getAgentWorkspaceFolder,
    queue,
    onProcess: (agentId, proc, cn, ipcFolder) =>
      queue.registerProcess(agentId, proc, cn, ipcFolder),
    sendMessage: async (jid, rawText) => sendToChannel(jid, rawText),
  });

  startIpcWatcher({
    registeredGroups: () => getRegisteredGroupsMap(),
    registerGroup,
    getAgentIdForChat,
    getAgentWorkspaceFolder,
    sendMessage: (jid, text) => sendToChannel(jid, text),
    sendImage: (jid, path, caption) => sendImageToChannel(jid, path, caption),
    syncGroupMetadata: (force) => whatsapp?.syncGroupMetadata(force) ?? Promise.resolve(),
    getAvailableGroups,
    writeGroupsSnapshot: (gf, im, ag, rj) => writeGroupsSnapshot(gf, im, ag, rj),
  });

  queue.setProcessMessagesFn(processAgentMessages);
  recoverPendingMessages(queue);
  startMessageLoop(queue);
}

const isDirectRun = process.argv[1] && new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;
if (isDirectRun) { main().catch((err) => { logger.error({ err }, 'Failed to start BioClaw'); process.exit(1); }); }
