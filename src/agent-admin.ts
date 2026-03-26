import 'dotenv/config';

import {
  getAllAgents,
  getAllDefaultChatAgentBindings,
  getAllRegisteredGroups,
  getAgent,
  initDatabase,
  setDefaultChatAgentBinding,
  upsertAgent,
} from './db/index.js';
import { AgentDefinition } from './types.js';

function usage(): never {
  console.error(`Usage:
  npm run agents -- list
  npm run agents -- chats
  npm run agents -- create <agent-id> --workspace <workspace-folder> [--name <name>] [--description <text>]
  npm run agents -- bind <chat-jid> <agent-id>
  npm run agents -- show <agent-id>`);
  process.exit(1);
}

function requireValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    console.error(`Missing value for ${flag}`);
    usage();
  }
  return args[index + 1]!;
}

function optionalValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return undefined;
  return args[index + 1];
}

function printAgents(): void {
  const agents = Object.values(getAllAgents()).sort((a, b) => a.id.localeCompare(b.id));
  if (agents.length === 0) {
    console.log('No agents found.');
    return;
  }

  for (const agent of agents) {
    const line = [
      agent.id,
      `workspace=${agent.workspaceFolder}`,
      `name=${JSON.stringify(agent.name)}`,
      agent.archived ? 'archived=true' : null,
    ].filter(Boolean).join(' | ');
    console.log(line);
  }
}

function printChats(): void {
  const groups = getAllRegisteredGroups();
  const bindings = getAllDefaultChatAgentBindings();
  const rows = Object.entries(groups)
    .map(([jid, group]) => ({
      jid,
      name: group.name,
      folder: group.folder,
      workspaceFolder: group.workspaceFolder || group.folder,
      agentId: bindings[jid] || '(unbound)',
    }))
    .sort((a, b) => a.jid.localeCompare(b.jid));

  if (rows.length === 0) {
    console.log('No registered chats found.');
    return;
  }

  for (const row of rows) {
    console.log(
      [
        row.jid,
        `name=${JSON.stringify(row.name)}`,
        `folder=${row.folder}`,
        `workspace=${row.workspaceFolder}`,
        `agent=${row.agentId}`,
      ].join(' | '),
    );
  }
}

function printAgent(agentId: string): void {
  const agent = getAgent(agentId);
  if (!agent) {
    console.error(`Agent not found: ${agentId}`);
    process.exit(1);
  }
  console.log(JSON.stringify(agent, null, 2));
}

function createAgent(args: string[]): void {
  const agentId = args[1];
  if (!agentId) usage();

  const workspaceFolder = requireValue(args, '--workspace');
  const now = new Date().toISOString();
  const existing = getAgent(agentId);
  const agent: AgentDefinition = {
    id: agentId,
    workspaceFolder,
    name: optionalValue(args, '--name') || agentId,
    description: optionalValue(args, '--description'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    archived: existing?.archived || false,
    systemPrompt: existing?.systemPrompt,
    containerConfig: existing?.containerConfig,
  };
  upsertAgent(agent);
  console.log(`Created/updated agent ${agentId} (workspace=${workspaceFolder})`);
}

function bindChat(args: string[]): void {
  const chatJid = args[1];
  const agentId = args[2];
  if (!chatJid || !agentId) usage();

  const groups = getAllRegisteredGroups();
  if (!groups[chatJid]) {
    console.error(`Registered chat not found: ${chatJid}`);
    process.exit(1);
  }

  const agent = getAgent(agentId);
  if (!agent) {
    console.error(`Agent not found: ${agentId}`);
    process.exit(1);
  }

  const createdAt = new Date().toISOString();
  setDefaultChatAgentBinding(chatJid, agentId, createdAt);
  console.log(`Bound ${chatJid} -> ${agentId}`);
}

function main(): void {
  initDatabase();

  const args = process.argv.slice(2);
  const command = args[0];
  if (!command) usage();

  switch (command) {
    case 'list':
      printAgents();
      return;
    case 'chats':
      printChats();
      return;
    case 'show':
      if (!args[1]) usage();
      printAgent(args[1]);
      return;
    case 'create':
      createAgent(args);
      return;
    case 'bind':
      bindChat(args);
      return;
    default:
      usage();
  }
}

main();
