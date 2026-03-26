/**
 * Message Loop — polls for new messages and dispatches to groups.
 */
import {
  ASSISTANT_NAME,
  POLL_INTERVAL,
} from './config.js';
import { getAllChats, getMessagesSince, getNewMessages } from './db/index.js';
import { AvailableGroup } from './group-folder.js';
import { GroupQueue } from './group-queue.js';
import { logger } from './logger.js';
import {
  getLastTimestamp,
  setLastTimestamp,
  getAgentIdForChat,
  getRegisteredGroupsMap,
  getLastAgentTimestamp,
  saveState,
} from './session-manager.js';

let messageLoopRunning = false;

/**
 * Get available groups list for the agent.
 * Returns groups ordered by most recent activity.
 */
export function getAvailableGroups(): AvailableGroup[] {
  const registeredGroups = getRegisteredGroupsMap();
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

/**
 * Startup recovery: check for unprocessed messages in registered groups.
 */
export function recoverPendingMessages(queue: GroupQueue): void {
  const registeredGroups = getRegisteredGroupsMap();
  const lastAgentTimestamp = getLastAgentTimestamp();
  const queuedAgents = new Set<string>();

  for (const [chatJid, group] of Object.entries(registeredGroups)) {
    const sinceTimestamp = lastAgentTimestamp[chatJid] || '';
    const pending = getMessagesSince(chatJid, sinceTimestamp, ASSISTANT_NAME);
    if (pending.length > 0) {
      const agentId = getAgentIdForChat(chatJid) || group.workspaceFolder || group.folder;
      if (queuedAgents.has(agentId)) continue;
      queuedAgents.add(agentId);
      logger.info(
        { group: group.name, agentId, pendingCount: pending.length },
        'Recovery: found unprocessed messages',
      );
      queue.enqueueMessageCheck(agentId);
    }
  }
}

/**
 * Main message polling loop.
 */
export async function startMessageLoop(queue: GroupQueue): Promise<void> {
  if (messageLoopRunning) {
    logger.debug('Message loop already running, skipping duplicate start');
    return;
  }
  messageLoopRunning = true;

  logger.info(`BioClaw running (trigger: @${ASSISTANT_NAME})`);

  while (true) {
    try {
      const registeredGroups = getRegisteredGroupsMap();
      const jids = Object.keys(registeredGroups);
      const { messages, newTimestamp } = getNewMessages(
        jids,
        getLastTimestamp(),
        ASSISTANT_NAME,
      );

      if (messages.length > 0) {
        logger.info({ count: messages.length }, 'New messages');

        setLastTimestamp(newTimestamp);
        saveState();

        const agentsWithMessages = new Set<string>();
        for (const msg of messages) {
          const agentId = getAgentIdForChat(msg.chat_jid);
          if (agentId) agentsWithMessages.add(agentId);
        }

        for (const agentId of agentsWithMessages) {
          queue.enqueueMessageCheck(agentId);
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error in message loop');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}
