import { getDb } from './connection.js';
import { AgentDefinition } from '../types.js';

export function getAgent(id: string): AgentDefinition | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(id) as
    | {
        id: string;
        workspace_folder: string;
        name: string;
        description: string | null;
        system_prompt: string | null;
        container_config: string | null;
        created_at: string;
        updated_at: string | null;
        archived: number | null;
      }
    | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    workspaceFolder: row.workspace_folder,
    name: row.name,
    description: row.description || undefined,
    systemPrompt: row.system_prompt || undefined,
    containerConfig: row.container_config
      ? JSON.parse(row.container_config)
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
    archived: row.archived === 1,
  };
}

export function getAllAgents(): Record<string, AgentDefinition> {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM agents WHERE archived = 0 OR archived IS NULL')
    .all() as Array<{
      id: string;
      workspace_folder: string;
      name: string;
      description: string | null;
      system_prompt: string | null;
      container_config: string | null;
      created_at: string;
      updated_at: string | null;
      archived: number | null;
    }>;
  const result: Record<string, AgentDefinition> = {};
  for (const row of rows) {
    result[row.id] = {
      id: row.id,
      workspaceFolder: row.workspace_folder,
      name: row.name,
      description: row.description || undefined,
      systemPrompt: row.system_prompt || undefined,
      containerConfig: row.container_config
        ? JSON.parse(row.container_config)
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at || undefined,
      archived: row.archived === 1,
    };
  }
  return result;
}

export function upsertAgent(agent: AgentDefinition): void {
  const db = getDb();
  db.prepare(
    `
      INSERT OR REPLACE INTO agents (
        id, workspace_folder, name, description, system_prompt,
        container_config, created_at, updated_at, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    agent.id,
    agent.workspaceFolder,
    agent.name,
    agent.description || null,
    agent.systemPrompt || null,
    agent.containerConfig ? JSON.stringify(agent.containerConfig) : null,
    agent.createdAt,
    agent.updatedAt || null,
    agent.archived ? 1 : 0,
  );
}

export function ensureDefaultAgentForWorkspace(
  workspaceFolder: string,
  createdAt = new Date().toISOString(),
): string {
  const existing = getAgent(workspaceFolder);
  if (existing) return existing.id;

  upsertAgent({
    id: workspaceFolder,
    workspaceFolder,
    name: 'Default',
    createdAt,
    updatedAt: createdAt,
    archived: false,
  });
  return workspaceFolder;
}

export function setDefaultChatAgentBinding(
  chatJid: string,
  agentId: string,
  createdAt = new Date().toISOString(),
): void {
  const db = getDb();
  db.prepare('UPDATE chat_agent_bindings SET is_default = 0 WHERE chat_jid = ?')
    .run(chatJid);
  db.prepare(
    `
      INSERT INTO chat_agent_bindings (chat_jid, agent_id, is_default, created_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(chat_jid, agent_id) DO UPDATE SET is_default = 1
    `,
  ).run(chatJid, agentId, createdAt);
}

export function getAllDefaultChatAgentBindings(): Record<string, string> {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT chat_jid, agent_id FROM chat_agent_bindings WHERE is_default = 1',
    )
    .all() as Array<{ chat_jid: string; agent_id: string }>;
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.chat_jid] = row.agent_id;
  }
  return result;
}

