import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { STORE_DIR } from '../config.js';
import { migrateJsonState } from './migration.js';

let db: Database.Database;

export function getDb(): Database.Database {
  return db;
}

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      jid TEXT PRIMARY KEY,
      name TEXT,
      last_message_time TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT,
      chat_jid TEXT,
      sender TEXT,
      sender_name TEXT,
      content TEXT,
      timestamp TEXT,
      is_from_me INTEGER,
      PRIMARY KEY (id, chat_jid),
      FOREIGN KEY (chat_jid) REFERENCES chats(jid)
    );
    CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      group_folder TEXT NOT NULL,
      chat_jid TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      next_run TEXT,
      last_run TEXT,
      last_result TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_next_run ON scheduled_tasks(next_run);
    CREATE INDEX IF NOT EXISTS idx_status ON scheduled_tasks(status);

    CREATE TABLE IF NOT EXISTS task_run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      run_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id)
    );
    CREATE INDEX IF NOT EXISTS idx_task_run_logs ON task_run_logs(task_id, run_at);

    CREATE TABLE IF NOT EXISTS router_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      group_folder TEXT PRIMARY KEY,
      session_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_sessions (
      agent_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registered_groups (
      jid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder TEXT NOT NULL UNIQUE,
      workspace_folder TEXT,
      trigger_pattern TEXT NOT NULL,
      added_at TEXT NOT NULL,
      container_config TEXT,
      requires_trigger INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_registered_groups_workspace_folder
      ON registered_groups(workspace_folder);
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      workspace_folder TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT,
      container_config TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      archived INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_agents_workspace_folder
      ON agents(workspace_folder);
    CREATE TABLE IF NOT EXISTS chat_agent_bindings (
      chat_jid TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      is_default INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      PRIMARY KEY (chat_jid, agent_id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_agent_default
      ON chat_agent_bindings(chat_jid, is_default);

    CREATE TABLE IF NOT EXISTS agent_trace_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_folder TEXT NOT NULL,
      chat_jid TEXT,
      session_id TEXT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trace_group ON agent_trace_events(group_folder);
    CREATE INDEX IF NOT EXISTS idx_trace_id ON agent_trace_events(id);
  `);

  // Add context_mode column if it doesn't exist (migration for existing DBs)
  try {
    database.exec(
      `ALTER TABLE scheduled_tasks ADD COLUMN context_mode TEXT DEFAULT 'isolated'`,
    );
  } catch {
    /* column already exists */
  }

  try {
    database.exec(
      `ALTER TABLE scheduled_tasks ADD COLUMN agent_id TEXT`,
    );
  } catch {
    /* column already exists */
  }

  try {
    database.exec(
      `ALTER TABLE registered_groups ADD COLUMN workspace_folder TEXT`,
    );
  } catch {
    /* column already exists */
  }

  database.exec(
    `UPDATE registered_groups
     SET workspace_folder = folder
     WHERE workspace_folder IS NULL OR workspace_folder = ''`,
  );

  database.exec(
    `INSERT OR IGNORE INTO agents (id, workspace_folder, name, created_at, updated_at, archived)
     SELECT workspace_folder, workspace_folder, 'Default', MIN(added_at), MIN(added_at), 0
     FROM registered_groups
     GROUP BY workspace_folder`,
  );

  database.exec(
    `INSERT OR IGNORE INTO chat_agent_bindings (chat_jid, agent_id, is_default, created_at)
     SELECT jid, workspace_folder, 1, added_at
     FROM registered_groups`,
  );

  database.exec(
    `INSERT OR IGNORE INTO agent_sessions (agent_id, session_id)
     SELECT group_folder, session_id
     FROM sessions`,
  );

  database.exec(
    `UPDATE scheduled_tasks
     SET agent_id = group_folder
     WHERE agent_id IS NULL OR agent_id = ''`,
  );
}

export function initDatabase(): void {
  const dbPath = path.join(STORE_DIR, 'messages.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  createSchema(db);

  // Migrate from JSON files if they exist
  migrateJsonState();
}

/** @internal - for tests only. Creates a fresh in-memory database. */
export function _initTestDatabase(): void {
  db = new Database(':memory:');
  createSchema(db);
}
