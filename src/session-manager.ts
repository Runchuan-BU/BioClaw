/**
 * Session Manager — manages Claude Agent SDK session IDs and router state.
 */
import { logger } from './logger.js';
import {
  ensureDefaultAgentForWorkspace,
  getAllAgents,
  getAllDefaultChatAgentBindings,
  getAllRegisteredGroups,
  getAllSessions,
  getRouterState,
  setRegisteredGroup,
  setRouterState,
  setSession,
  setDefaultChatAgentBinding,
} from './db/index.js';
import { AgentDefinition, RegisteredGroup } from './types.js';
import { ensureGroupDir } from './group-folder.js';
import {
  getWorkspaceChatJids,
  getWorkspaceFolder,
  normalizeRegisteredGroup,
} from './workspace.js';

let lastTimestamp = '';
let sessions: Record<string, string> = {};
let registeredGroups: Record<string, RegisteredGroup> = {};
let agents: Record<string, AgentDefinition> = {};
let chatAgentBindings: Record<string, string> = {};
let lastAgentTimestamp: Record<string, string> = {};

export function getLastTimestamp(): string {
  return lastTimestamp;
}

export function setLastTimestamp(ts: string): void {
  lastTimestamp = ts;
}

export function getSessions(): Record<string, string> {
  return sessions;
}

export function updateSession(agentId: string, sessionId: string): void {
  sessions[agentId] = sessionId;
  setSession(agentId, sessionId);
}

export function getRegisteredGroupsMap(): Record<string, RegisteredGroup> {
  return registeredGroups;
}

export function getAgentsMap(): Record<string, AgentDefinition> {
  return agents;
}

export function getAgentIdForChat(chatJid: string): string | undefined {
  return chatAgentBindings[chatJid];
}

export function getAgentForChat(chatJid: string): AgentDefinition | undefined {
  const agentId = getAgentIdForChat(chatJid);
  return agentId ? agents[agentId] : undefined;
}

export function getWorkspaceFolderForAgent(agentId: string): string | undefined {
  return agents[agentId]?.workspaceFolder;
}

export function getAgentWorkspaceFolder(agentId: string): string | undefined {
  return getWorkspaceFolderForAgent(agentId);
}

export function getChatJidsForAgent(agentId: string): string[] {
  return Object.entries(chatAgentBindings)
    .filter(([, boundAgentId]) => boundAgentId === agentId)
    .map(([chatJid]) => chatJid);
}

export function getLastAgentTimestamp(): Record<string, string> {
  return lastAgentTimestamp;
}

export function setLastAgentTimestampFor(chatJid: string, ts: string): void {
  lastAgentTimestamp[chatJid] = ts;
}

export function loadState(): void {
  lastTimestamp = getRouterState('last_timestamp') || '';
  const agentTs = getRouterState('last_agent_timestamp');
  try {
    lastAgentTimestamp = agentTs ? JSON.parse(agentTs) : {};
  } catch {
    logger.warn('Corrupted last_agent_timestamp in DB, resetting');
    lastAgentTimestamp = {};
  }
  sessions = getAllSessions();
  registeredGroups = Object.fromEntries(
    Object.entries(getAllRegisteredGroups()).map(([jid, group]) => [
      jid,
      normalizeRegisteredGroup(group),
    ]),
  );
  agents = getAllAgents();
  chatAgentBindings = getAllDefaultChatAgentBindings();

  for (const [jid, group] of Object.entries(registeredGroups)) {
    if (!chatAgentBindings[jid]) {
      const workspaceFolder = getWorkspaceFolder(group);
      const agentId = ensureDefaultAgentForWorkspace(workspaceFolder, group.added_at);
      setDefaultChatAgentBinding(jid, agentId, group.added_at);
      chatAgentBindings[jid] = agentId;
    }
  }
  agents = getAllAgents();

  logger.info(
    {
      groupCount: Object.keys(registeredGroups).length,
      agentCount: Object.keys(agents).length,
    },
    'State loaded',
  );
}

export function saveState(): void {
  setRouterState('last_timestamp', lastTimestamp);
  setRouterState(
    'last_agent_timestamp',
    JSON.stringify(lastAgentTimestamp),
  );
}

export function registerGroup(jid: string, group: RegisteredGroup): void {
  const normalized = normalizeRegisteredGroup(group);
  registeredGroups[jid] = normalized;
  setRegisteredGroup(jid, normalized);
  const workspaceFolder = getWorkspaceFolder(normalized);
  ensureGroupDir(workspaceFolder);
  const agentId = ensureDefaultAgentForWorkspace(workspaceFolder, normalized.added_at);
  const agent = getAllAgents()[agentId];
  if (agent) agents[agentId] = agent;
  setDefaultChatAgentBinding(jid, agentId, normalized.added_at);
  chatAgentBindings[jid] = agentId;
  logger.info(
    {
      jid,
      name: normalized.name,
      folder: normalized.folder,
      workspaceFolder,
      agentId,
    },
    'Group registered',
  );
}

export function getWorkspaceFolderForChat(chatJid: string): string | undefined {
  const group = registeredGroups[chatJid];
  return group ? getWorkspaceFolder(group) : undefined;
}

export function getChatJidsForWorkspace(workspaceFolder: string): string[] {
  return getWorkspaceChatJids(registeredGroups, workspaceFolder);
}

/** @internal - exported for testing */
export function _setRegisteredGroups(groups: Record<string, RegisteredGroup>): void {
  registeredGroups = groups;
}
