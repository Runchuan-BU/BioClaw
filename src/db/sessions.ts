import { getDb } from './connection.js';

export function getSession(agentId: string): string | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT session_id FROM agent_sessions WHERE agent_id = ?')
    .get(agentId) as { session_id: string } | undefined;
  return row?.session_id;
}

export function setSession(agentId: string, sessionId: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO agent_sessions (agent_id, session_id) VALUES (?, ?)',
  ).run(agentId, sessionId);
}

export function getAllSessions(): Record<string, string> {
  const db = getDb();
  const rows = db
    .prepare('SELECT agent_id, session_id FROM agent_sessions')
    .all() as Array<{ agent_id: string; session_id: string }>;
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.agent_id] = row.session_id;
  }
  return result;
}
