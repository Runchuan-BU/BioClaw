/**
 * BioClaw Agent Runner
 * Runs inside a container, receives config via stdin, outputs result to stdout
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF, like before)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per agent teams result).
 *   Final marker after loop ends signals completion.
 */

import fs from 'fs';
import path from 'path';
import { exec as execChildProcess, execFile as execFileChildProcess, spawn as spawnChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { query, HookCallback, PreCompactHookInput, PreToolUseHookInput } from '@anthropic-ai/claude-agent-sdk';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { createInterface } from 'readline';
import { detectTaskRouting, mergeSkillSelections } from './task-routing.js';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  agentId?: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  agentSystemPrompt?: string;
  workdir?: string;
  runtimeConfig?: {
    provider?: 'anthropic' | 'openrouter' | 'openai-compatible' | 'openai-codex' | 'gemini';
    model?: string;
    baseUrl?: string;
    enabledSkills?: string[];
  };
  secrets?: Record<string, string>;
}

interface ContainerOutput {
  status: 'success' | 'error' | 'streaming';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface SessionEntry {
  sessionId: string;
  fullPath: string;
  summary: string;
  firstPrompt: string;
}

interface SessionsIndex {
  entries: SessionEntry[];
}

interface SDKUserMessage {
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
}

const IPC_INPUT_DIR = '/workspace/ipc/input';
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');
const IPC_POLL_MS = 500;
const IPC_DIR = '/workspace/ipc';
const IPC_MESSAGES_DIR = path.join(IPC_DIR, 'messages');
const IPC_TASKS_DIR = path.join(IPC_DIR, 'tasks');
const IPC_FILES_DIR = path.join(IPC_DIR, 'files');
const BASH_TIMEOUT_MS = 5 * 60 * 1000;
const BASH_MAX_OUTPUT_CHARS = 12000;
const WORKSPACE_GROUP_ROOT = '/workspace/group';
const OPENAI_TOOL_MAX_ITERATIONS = Math.max(
  1,
  parseInt(process.env.OPENAI_TOOL_MAX_ITERATIONS || '48', 10) || 48,
);
const SKILLS_ROOT = '/home/node/.claude/skills';
const MAX_SKILL_SUMMARY_LINES = 18;
const MAX_SKILL_DESCRIPTION_CHARS = 140;
const execAsync = promisify(execChildProcess);
const execFileAsync = promisify(execFileChildProcess);

type ProviderKind = 'anthropic' | 'openai-compatible' | 'openai-codex' | 'gemini';

interface ProviderConfig {
  provider: ProviderKind;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: OpenAIChatMessage & { content?: string | Array<{ type?: string; text?: string }> | null };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

const OPENAI_SESSION_DIR = '/home/node/.claude/openai-compatible-sessions';
const OPENAI_CODEX_HOME = '/home/node/.claude/codex-home';
const OPENAI_CODEX_AUTH_PATH = path.join(OPENAI_CODEX_HOME, 'auth.json');
const OPENAI_CODEX_OUTPUT_DIR = path.join(OPENAI_CODEX_HOME, 'outputs');
const DEFAULT_OPENAI_CODEX_CLI_JS = '/opt/host-node-modules/@openai/codex/bin/codex.js';

const GEMINI_HOME = '/home/node/.claude/gemini-home';
const GEMINI_OAUTH_PATH = path.join(GEMINI_HOME, 'oauth_creds.json');
const GEMINI_OUTPUT_DIR = path.join(GEMINI_HOME, 'outputs');
const DEFAULT_GEMINI_CLI_JS = '/opt/host-node-modules-gemini/@google/gemini-cli/dist/index.js';

function getOpenAICompatibleSessionPath(sessionId: string): string {
  return path.join(OPENAI_SESSION_DIR, `${encodeURIComponent(sessionId)}.json`);
}

function loadOpenAICompatibleSessionMessages(
  sessionId: string,
): OpenAIChatMessage[] | undefined {
  const sessionPath = getOpenAICompatibleSessionPath(sessionId);
  if (!fs.existsSync(sessionPath)) return undefined;

  try {
    const raw = fs.readFileSync(sessionPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      log(`Ignoring malformed OpenAI-compatible session file: ${sessionPath}`);
      return undefined;
    }
    return parsed as OpenAIChatMessage[];
  } catch (err) {
    log(
      `Failed to load OpenAI-compatible session ${sessionId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return undefined;
  }
}

function saveOpenAICompatibleSessionMessages(
  sessionId: string,
  messages: OpenAIChatMessage[],
): void {
  try {
    fs.mkdirSync(OPENAI_SESSION_DIR, { recursive: true });
    const sessionPath = getOpenAICompatibleSessionPath(sessionId);
    const tempPath = `${sessionPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(messages, null, 2));
    fs.renameSync(tempPath, sessionPath);
  } catch (err) {
    log(
      `Failed to persist OpenAI-compatible session ${sessionId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** Normalize API content (string or array of blocks) to string. */
function normalizeContent(
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => c.text || '').join('');
  return '';
}

/**
 * Push-based async iterable for streaming user messages to the SDK.
 * Keeps the iterable alive until end() is called, preventing isSingleUserTurn.
 */
class MessageStream {
  private queue: SDKUserMessage[] = [];
  private waiting: (() => void) | null = null;
  private done = false;

  push(text: string): void {
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    });
    this.waiting?.();
  }

  end(): void {
    this.done = true;
    this.waiting?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (this.done) return;
      await new Promise<void>(r => { this.waiting = r; });
      this.waiting = null;
    }
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

const OUTPUT_START_MARKER = '---BIOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---BIOCLAW_OUTPUT_END---';

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function truncateOutput(text: string | undefined | null, maxChars = BASH_MAX_OUTPUT_CHARS): string {
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n... [truncated]` : text;
}

function resolveWorkdir(workdir?: string): string {
  const raw = typeof workdir === 'string' ? workdir.trim() : '';
  if (!raw || raw === '.' || raw === '/') {
    return WORKSPACE_GROUP_ROOT;
  }

  let target = WORKSPACE_GROUP_ROOT;
  if (raw.startsWith(WORKSPACE_GROUP_ROOT)) {
    target = path.posix.normalize(raw);
  } else if (raw.startsWith('/')) {
    log(`Ignoring invalid workdir outside workspace root: ${raw}`);
    return WORKSPACE_GROUP_ROOT;
  } else {
    target = path.posix.normalize(path.posix.join(WORKSPACE_GROUP_ROOT, raw));
  }

  const rel = path.posix.relative(WORKSPACE_GROUP_ROOT, target);
  if (rel.startsWith('..') || path.posix.isAbsolute(rel)) {
    log(`Ignoring escaping workdir outside workspace root: ${raw}`);
    return WORKSPACE_GROUP_ROOT;
  }
  if (!fs.existsSync(target)) {
    log(`Configured workdir does not exist, falling back to workspace root: ${target}`);
    return WORKSPACE_GROUP_ROOT;
  }
  try {
    if (!fs.statSync(target).isDirectory()) {
      log(`Configured workdir is not a directory, falling back to workspace root: ${target}`);
      return WORKSPACE_GROUP_ROOT;
    }
  } catch (err) {
    log(`Failed to inspect workdir ${target}, falling back to workspace root: ${err instanceof Error ? err.message : String(err)}`);
    return WORKSPACE_GROUP_ROOT;
  }
  return target;
}

function buildEnabledSkillsBlock(preferredSkills?: string[], requiredSkills?: string[]): string {
  const { preferred, required } = mergeSkillSelections(preferredSkills, requiredSkills);
  const sections: string[] = [];

  if (required.length > 0) {
    sections.push(
      '[Required skill modules]',
      'You MUST use these installed skills for this task when they are relevant:',
      ...required.map((skill) => `- ${skill}`),
    );
  }

  if (preferred.length > 0) {
    sections.push(
      '[Preferred skill modules]',
      'Prefer these installed skills first when they are relevant to the task:',
      ...preferred.map((skill) => `- ${skill}`),
    );
  }

  if (sections.length === 0) return '';
  return `\n\n${sections.join('\n')}\n`;
}

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filePath = path.join(dir, filename);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
  return filename;
}

function queueIpcMessage(chatJid: string, groupFolder: string, text: string): string {
  return writeIpcFile(IPC_MESSAGES_DIR, {
    type: 'message',
    chatJid,
    text,
    groupFolder,
    timestamp: new Date().toISOString(),
  });
}

function queueIpcImage(chatJid: string, groupFolder: string, filePath: string, caption?: string): string {
  const ext = path.extname(filePath) || '.png';
  fs.mkdirSync(IPC_FILES_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destPath = path.join(IPC_FILES_DIR, filename);
  fs.copyFileSync(filePath, destPath);

  writeIpcFile(IPC_MESSAGES_DIR, {
    type: 'image',
    chatJid,
    filePath: `files/${filename}`,
    caption: caption || undefined,
    groupFolder,
    timestamp: new Date().toISOString(),
  });

  return filename;
}

function queueScheduledTask(
  containerInput: ContainerInput,
  args: { prompt: string; schedule_type: string; schedule_value: string; context_mode?: string; target_group_jid?: string },
): string {
  return writeIpcFile(IPC_TASKS_DIR, {
    type: 'schedule_task',
    prompt: args.prompt,
    schedule_type: args.schedule_type,
    schedule_value: args.schedule_value,
    context_mode: args.context_mode || 'group',
    targetJid: args.target_group_jid || containerInput.chatJid,
    createdBy: containerInput.groupFolder,
    timestamp: new Date().toISOString(),
  });
}

function resolveProviderConfig(env: Record<string, string | undefined>): ProviderConfig {
  const requestedProvider = (env.MODEL_PROVIDER || '').trim().toLowerCase();
  const openRouterKey = env.OPENROUTER_API_KEY;
  const openCompatibleKey = env.OPENAI_COMPATIBLE_API_KEY;
  const openAICodexAuthJson = env.OPENAI_CODEX_AUTH_JSON;
  const openAICodexCliJs = env.OPENAI_CODEX_CLI_JS || DEFAULT_OPENAI_CODEX_CLI_JS;
  const geminiOAuthJson = env.GEMINI_OAUTH_CREDS_JSON;
  const geminiApiKey = env.GEMINI_API_KEY;
  const geminiCliJs = env.GEMINI_CLI_JS || DEFAULT_GEMINI_CLI_JS;

  if (
    requestedProvider === 'anthropic' ||
    (!requestedProvider &&
      !openRouterKey &&
      !openCompatibleKey &&
      !openAICodexAuthJson &&
      !geminiOAuthJson &&
      !geminiApiKey)
  ) {
    return { provider: 'anthropic' };
  }

  if (requestedProvider === 'openai-codex' || (!requestedProvider && !openRouterKey && !openCompatibleKey && openAICodexAuthJson)) {
    if (!openAICodexAuthJson) {
      throw new Error('OpenAI Codex provider selected but OPENAI_CODEX_AUTH_JSON is missing');
    }
    if (!openAICodexCliJs) {
      throw new Error('OpenAI Codex provider selected but OPENAI_CODEX_CLI_JS is missing');
    }
    return {
      provider: 'openai-codex',
      model: env.OPENAI_CODEX_MODEL || 'gpt-5.4',
    };
  }

  if (
    requestedProvider === 'gemini' ||
    (!requestedProvider &&
      !openRouterKey &&
      !openCompatibleKey &&
      (geminiOAuthJson || geminiApiKey))
  ) {
    if (!geminiOAuthJson && !geminiApiKey) {
      throw new Error('Gemini provider selected but neither GEMINI_OAUTH_CREDS_JSON nor GEMINI_API_KEY is set');
    }
    if (!geminiCliJs) {
      throw new Error('Gemini provider selected but GEMINI_CLI_JS is missing');
    }
    return {
      provider: 'gemini',
      apiKey: geminiApiKey,
      model: env.GEMINI_MODEL || 'gemini-2.0-pro',
    };
  }

  const provider = requestedProvider === 'openrouter' || requestedProvider === 'openai-compatible'
    ? 'openai-compatible'
    : (openRouterKey || openCompatibleKey ? 'openai-compatible' : 'anthropic');

  if (provider === 'anthropic') {
    return { provider };
  }

  return {
    provider,
    apiKey: openRouterKey || openCompatibleKey,
    baseUrl: env.OPENROUTER_BASE_URL || env.OPENAI_COMPATIBLE_BASE_URL || 'https://openrouter.ai/api/v1',
    model: env.OPENROUTER_MODEL || env.OPENAI_COMPATIBLE_MODEL || 'openai/gpt-4.1-mini',
  };
}

function getOpenAICodexCliJsPath(env: Record<string, string | undefined>): string {
  const cliPath = (env.OPENAI_CODEX_CLI_JS || DEFAULT_OPENAI_CODEX_CLI_JS).trim();
  if (!cliPath) {
    throw new Error('OpenAI Codex CLI path is empty');
  }
  if (!fs.existsSync(cliPath)) {
    throw new Error(`OpenAI Codex CLI entrypoint not found: ${cliPath}`);
  }
  return cliPath;
}

function normalizeCodexMessageText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

async function ensureOpenAICodexHome(
  env: Record<string, string | undefined>,
): Promise<void> {
  const authJson = env.OPENAI_CODEX_AUTH_JSON?.trim();
  if (!authJson) {
    throw new Error('OpenAI Codex auth.json payload is missing');
  }

  fs.mkdirSync(OPENAI_CODEX_HOME, { recursive: true });
  fs.mkdirSync(OPENAI_CODEX_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OPENAI_CODEX_AUTH_PATH, authJson, { encoding: 'utf8', mode: 0o600 });
}

function scheduleOpenAICodexAuthCleanup(child: ReturnType<typeof spawnChildProcess>): void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      fs.unlinkSync(OPENAI_CODEX_AUTH_PATH);
    } catch {
      // Best effort: auth is re-written before each run anyway.
    }
  };

  const timer = setTimeout(cleanup, 2000);
  timer.unref?.();
  child.once('exit', cleanup);
  child.stdout?.once('data', cleanup);
  child.stderr?.once('data', cleanup);
}

async function configureOpenAICodexMcpServer(
  cliPath: string,
  mcpServerPath: string,
  containerInput: ContainerInput,
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<void> {
  const codexEnv = {
    ...process.env,
    ...env,
    CODEX_HOME: OPENAI_CODEX_HOME,
    HOME: '/home/node',
  };

  try {
    await execFileAsync('node', [cliPath, 'mcp', 'remove', 'bioclaw'], {
      cwd,
      env: Object.fromEntries(
        Object.entries(codexEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      ),
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    // Ignore missing-server errors. We re-add the MCP config below.
  }

  const args = [
    cliPath,
    'mcp',
    'add',
    'bioclaw',
    '--env',
    `BIOCLAW_CHAT_JID=${containerInput.chatJid}`,
    '--env',
    `BIOCLAW_GROUP_FOLDER=${containerInput.groupFolder}`,
    '--env',
    `BIOCLAW_AGENT_ID=${containerInput.agentId || containerInput.groupFolder}`,
    '--env',
    `BIOCLAW_IS_MAIN=${containerInput.isMain ? '1' : '0'}`,
    '--',
    'node',
    mcpServerPath,
  ];

  await execFileAsync('node', args, {
    cwd,
    env: Object.fromEntries(
      Object.entries(codexEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

interface SkillSummary {
  name: string;
  description: string;
}

function truncateInline(text: string, maxChars: number): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars - 1).trimEnd()}…`;
}

function extractSkillSummary(skillFilePath: string, dirName: string): SkillSummary | null {
  try {
    const content = fs.readFileSync(skillFilePath, 'utf-8');
    const lines = content.split('\n');

    let name = dirName;
    let description = '';

    if (lines[0]?.trim() === '---') {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') break;
        const nameMatch = line.match(/^name:\s*(.+)$/i);
        if (nameMatch) {
          name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
          continue;
        }
        const descMatch = line.match(/^description:\s*(.+)$/i);
        if (descMatch) {
          description = descMatch[1].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }

    if (!description) {
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line === '---' || line.startsWith('#')) continue;
        if (line.startsWith('name:') || line.startsWith('description:')) continue;
        description = line;
        break;
      }
    }

    if (!description) return null;
    return {
      name,
      description: truncateInline(description, MAX_SKILL_DESCRIPTION_CHARS),
    };
  } catch (err) {
    log(`Failed to parse skill summary from ${skillFilePath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function getInstalledSkillSummaries(): SkillSummary[] {
  if (!fs.existsSync(SKILLS_ROOT)) return [];

  const summaries: SkillSummary[] = [];
  for (const entry of fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const skillFilePath = path.join(SKILLS_ROOT, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFilePath)) continue;

    const summary = extractSkillSummary(skillFilePath, entry.name);
    if (summary) summaries.push(summary);
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

function getBioSystemPrompt(): string {
  const skillSummaries = getInstalledSkillSummaries();
  const skillLines = skillSummaries
    .slice(0, MAX_SKILL_SUMMARY_LINES)
    .map((skill) => `- ${skill.name}: ${skill.description}`);
  const remainingSkillCount = Math.max(0, skillSummaries.length - skillLines.length);

  return [
    '## BioClaw — Biology Research Assistant',
    '',
    'You are Bio, an AI biology research assistant running inside an isolated container.',
    'You have full access to bioinformatics tools: BLAST+, SAMtools, BEDTools, BWA, minimap2, FastQC, seqtk, fastp, MultiQC, bcftools, tabix, pigz, salmon, kallisto, SRA Toolkit.',
    'Python libraries: BioPython, pandas, NumPy, SciPy, matplotlib, seaborn, scikit-learn, RDKit, PyDESeq2, scanpy, pysam.',
    '',
    'When users ask biology questions, prefer running actual analysis over giving theoretical answers.',
    'Use tools to produce real results. Prefer the Bash tool for running shell commands, Python scripts, and bioinformatics workflows.',
    'Save output files to /workspace/group/ so users can access them.',
    'When you generate an image or document file (PNG, JPG, GIF, PDF, etc.), call the send_image tool so the user receives it in chat instead of only seeing a saved file path. The send_image tool works for ALL file types including PDF reports.',
    'Use send_message only for short mid-task progress updates when a task is still running. Do not use send_message for the final answer — put the final user-facing response in the normal assistant reply.',
    "If you generate plots with Chinese labels via matplotlib, configure a Chinese-capable font first (try: 'Noto Sans CJK SC' or 'WenQuanYi Zen Hei') and set axes.unicode_minus=False to avoid missing glyphs and minus-sign issues.",
    'Prioritize figures that look scientific, readable on a phone screen, and suitable for demos or slide decks.',
    'Avoid overcrowded labels, tiny fonts, excessive legends, rainbow color noise, and default low-quality plotting styles.',
    'Prefer clean layouts, restrained scientific color palettes, clear axis titles with units, and short informative titles.',
    'Default plotting style guidance: use matplotlib/seaborn with dpi>=300, a generous figure size (usually at least 8x5 inches), tight layout, and large readable fonts.',
    'If there are too many labels or points to annotate cleanly, annotate only the most important ones and keep the rest visually simple.',
    'For publication-style plots, include only information that improves interpretation; do not clutter the image with long paragraphs of text.',
    'Use these task-specific figure patterns when relevant:',
    '- Volcano plots: balanced red/blue/gray palette, significance threshold lines, minimal labels on top hits only, and readable axis names.',
    '- QC summary plots: compact multi-panel layout, consistent colors, short labels, and clear sample ordering.',
    '- Protein structure renders: prefer clean cartoon/surface representations, high-resolution output, sensible orientation, and focused highlighting of the biologically relevant region.',
    'Reusable built-in scripts are available and should be preferred for consistent output when they fit the task:',
    '- /home/node/.claude/skills/bio-tools/templates/volcano_plot_template.py',
    '- /home/node/.claude/skills/bio-tools/templates/qc_summary_plot_template.py',
    '- /home/node/.claude/skills/bio-tools/templates/pymol_render_template.py',
    ...(skillLines.length > 0
      ? [
          '',
          'Installed skill modules currently available in this session:',
          ...skillLines,
          ...(remainingSkillCount > 0
            ? [`- ... plus ${remainingSkillCount} more installed skill modules.`]
            : []),
          'Do not claim a skill is unavailable if it appears in the installed list above.',
          'To use a skill, read its full instructions with: read_file({ file_path: "/home/node/.claude/skills/<skill-name>/SKILL.md" })',
          'Always read the relevant SKILL.md before executing a skill-related task — the summaries above are abbreviated.',
          'CRITICAL: When a skill provides executable scripts or pipelines (e.g. python sec_pipeline.py), you MUST run them as instructed. Do NOT manually reimplement the same analysis logic — the bundled scripts are tested, produce standardized outputs (PDF reports, figures, JSON), and are the expected deliverable. Manual reimplementation is an error.',
        ]
      : []),
    'For publication-ready figures (Cell/Nature/Science style): use cnsplots (volcano, box, heatmap, etc.). For genome browser tracks: use pyGenomeTracks with make_tracks_file + pyGenomeTracks.',
    'Before sending an image, quickly sanity-check that labels are legible, colors are not confusing, and the figure communicates one clear message.',
    'Keep messages concise and action-oriented, and mention important output file paths when relevant.',
    '',
  ].join('\n');
}

function buildGlobalSystemPrompt(
  prompt: string,
  currentWorkdir: string,
  containerInput: ContainerInput,
): string {
  const bioSystemPrompt = getBioSystemPrompt()
    .replace('send_image tool', 'mcp__bioclaw__send_image')
    .replace('Use tools to produce real results. Prefer the Bash tool for running shell commands, Python scripts, and bioinformatics workflows.', 'Write and execute Python scripts or bash commands to produce real results.');

  const globalClaudeMdPath = '/workspace/global/CLAUDE.md';
  const globalContent = fs.existsSync(globalClaudeMdPath)
    ? fs.readFileSync(globalClaudeMdPath, 'utf-8')
    : '';
  const agentMemoryBlock = containerInput.agentSystemPrompt
    ? `\n\n[Agent memory]\n${containerInput.agentSystemPrompt.trim()}\n`
    : '';
  const taskRouting = detectTaskRouting(prompt);
  if (taskRouting) {
    log(`Applied automatic task routing: ${taskRouting.matchedRoute}`);
  }
  const enabledSkillsBlock = buildEnabledSkillsBlock(
    containerInput.runtimeConfig?.enabledSkills,
    taskRouting?.requiredSkills,
  );
  const routingBlock = taskRouting?.systemBlock || '';
  const workdirBlock = `\n\n[Current working directory]\n${currentWorkdir}\n`;
  const languageBlock = `\n\n[Language policy]\nDetect the language the user is writing in and reply in the same language. If the user writes in Chinese, reply in Chinese; if in English, reply in English; otherwise mirror their language. This applies to both your final answer and any "send_message" / progress updates. Tool inputs (commands, file paths, code) stay in their natural form (English/code).\n`;

  const dataIntegrityBlock = `\n\n[Data integrity — never fabricate scientific files]\nWhen the user asks for a structure file, sequence file, dataset, or any other scientific artifact, you MUST obtain it from a real, verifiable source — never reconstruct it from memory or invent contents.\n\n- PDB / mmCIF / structure files: download from RCSB (\`https://files.rcsb.org/view/{ID}.pdb\` or \`{ID}.cif\`) using curl/wget. Save the response as-is.\n- Sequences (FASTA / GenBank): fetch from NCBI Entrez / UniProt / Ensembl via their HTTP APIs.\n- Datasets / supplementary files: download from the original repository (GEO, ArrayExpress, supplementary URLs).\n\nIf a download fails (network blocked, 404, timeout), STOP and tell the user clearly: which URL you tried, the error you got, and what they can do (e.g. provide the file directly, retry, configure proxy). DO NOT write a placeholder file with a few hand-typed ATOM lines or REMARK summaries pretending to be the real data — this silently breaks downstream tools and looks like a successful download to the user.\n\nVerification rule for PDB downloads: after curl/wget, check the file ends with the line "END" and contains > 100 ATOM records. If not, treat the download as failed and report it.\n`;

  return bioSystemPrompt + globalContent + agentMemoryBlock + enabledSkillsBlock + routingBlock + workdirBlock + languageBlock + dataIntegrityBlock;
}

function getSessionSummary(sessionId: string, transcriptPath: string): string | null {
  const projectDir = path.dirname(transcriptPath);
  const indexPath = path.join(projectDir, 'sessions-index.json');

  if (!fs.existsSync(indexPath)) {
    log(`Sessions index not found at ${indexPath}`);
    return null;
  }

  try {
    const index: SessionsIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const entry = index.entries.find(e => e.sessionId === sessionId);
    if (entry?.summary) {
      return entry.summary;
    }
  } catch (err) {
    log(`Failed to read sessions index: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

/** Extract output file paths from transcript (for _latest.md snapshot before compaction). */
function extractOutputPathsFromTranscript(content: string): string[] {
  const re = /\/workspace\/group\/[^\s)"'\]<>]+\.(csv|tsv|png|jpg|jpeg|bam|sam|h5ad|pdf|txt)/gi;
  const seen = new Set<string>();
  const order: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const p = m[0];
    if (!seen.has(p)) {
      seen.add(p);
      order.push(p);
    } else {
      order.splice(order.indexOf(p), 1);
      order.push(p); // move to end (most recent)
    }
  }
  return order;
}

/**
 * Archive the full transcript to conversations/ before compaction.
 * Also writes _latest.md with output paths extracted from the transcript — helps
 * preserve "latest analysis state" when context is compacted.
 */
function createPreCompactHook(): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preCompact = input as PreCompactHookInput;
    const transcriptPath = preCompact.transcript_path;
    const sessionId = preCompact.session_id;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      log('No transcript found for archiving');
      return {};
    }

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const messages = parseTranscript(content);

      if (messages.length === 0) {
        log('No messages to archive');
        return {};
      }

      const summary = getSessionSummary(sessionId, transcriptPath);
      const name = summary ? sanitizeFilename(summary) : generateFallbackName();

      const conversationsDir = '/workspace/group/conversations';
      fs.mkdirSync(conversationsDir, { recursive: true });

      const date = new Date().toISOString().split('T')[0];
      const filename = `${date}-${name}.md`;
      const filePath = path.join(conversationsDir, filename);

      const markdown = formatTranscriptMarkdown(messages, summary);
      fs.writeFileSync(filePath, markdown);

      log(`Archived conversation to ${filePath}`);

      // Snapshot output paths for _latest.md — helps avoid analyzing old data after compaction
      const outputPaths = extractOutputPathsFromTranscript(content);
      if (outputPaths.length > 0 && fs.existsSync('/workspace/group')) {
        const now = new Date().toISOString();
        const latestContent = [
          '# Latest outputs (auto-updated before compaction)',
          '',
          `Updated: ${now}`,
          '',
          '## Output files',
          '',
          ...outputPaths.map((p) => `- ${p}`),
          '',
        ].join('\n');
        fs.writeFileSync('/workspace/group/_latest.md', latestContent);
        log(`Updated _latest.md with ${outputPaths.length} output paths`);
      }
    } catch (err) {
      log(`Failed to archive transcript: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {};
  };
}

// Secrets to strip from Bash tool subprocess environments.
// These are needed by claude-code for API auth but should never
// be visible to commands Kit runs.
const SECRET_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'OPENROUTER_API_KEY',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_CODEX_AUTH_JSON',
  'OPENAI_CODEX_CLI_JS',
  'GEMINI_OAUTH_CREDS_JSON',
  'GEMINI_API_KEY',
  'GEMINI_CLI_JS',
];

function createSanitizeBashHook(): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preInput = input as PreToolUseHookInput;
    const command = (preInput.tool_input as { command?: string })?.command;
    if (!command) return {};

    const unsetPrefix = `unset ${SECRET_ENV_VARS.join(' ')} 2>/dev/null; `;
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: {
          ...(preInput.tool_input as Record<string, unknown>),
          command: unsetPrefix + command,
        },
      },
    };
  };
}

function sanitizeFilename(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generateFallbackName(): string {
  const time = new Date();
  return `conversation-${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  content: string;
}

function parseTranscript(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' && entry.message?.content) {
        const text = typeof entry.message.content === 'string'
          ? entry.message.content
          : entry.message.content.map((c: { text?: string }) => c.text || '').join('');
        if (text) messages.push({ role: 'user', content: text });
      } else if (entry.type === 'assistant' && entry.message?.content) {
        const textParts = entry.message.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text);
        const text = textParts.join('');
        if (text) messages.push({ role: 'assistant', content: text });
      }
    } catch {
    }
  }

  return messages;
}

function formatTranscriptMarkdown(messages: ParsedMessage[], title?: string | null): string {
  const now = new Date();
  const formatDateTime = (d: Date) => d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const lines: string[] = [];
  lines.push(`# ${title || 'Conversation'}`);
  lines.push('');
  lines.push(`Archived: ${formatDateTime(now)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of messages) {
    const sender = msg.role === 'user' ? 'User' : 'Bio';
    const content = msg.content.length > 2000
      ? msg.content.slice(0, 2000) + '...'
      : msg.content;
    lines.push(`**${sender}**: ${content}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check for _close sentinel.
 */
function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE_SENTINEL)) {
    try { fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL); } catch { /* ignore */ }
    return true;
  }
  return false;
}

/**
 * Drain all pending IPC input messages.
 * Returns messages found, or empty array.
 */
function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs.readdirSync(IPC_INPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);
        if (data.type === 'message' && data.text) {
          messages.push(data.text);
        }
      } catch (err) {
        log(`Failed to process input file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
    return messages;
  } catch (err) {
    log(`IPC drain error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Wait for a new IPC message or _close sentinel.
 * Returns the messages as a single string, or null if _close.
 */
function waitForIpcMessage(): Promise<string | null> {
  return new Promise((resolve) => {
    const poll = () => {
      if (shouldClose()) {
        resolve(null);
        return;
      }
      const messages = drainIpcInput();
      if (messages.length > 0) {
        resolve(messages.join('\n'));
        return;
      }
      setTimeout(poll, IPC_POLL_MS);
    };
    poll();
  });
}

/**
 * Run a single query and stream results via writeOutput.
 * Uses MessageStream (AsyncIterable) to keep isSingleUserTurn=false,
 * allowing agent teams subagents to run to completion.
 * Also pipes IPC messages into the stream during the query.
 */
async function runQuery(
  prompt: string,
  sessionId: string | undefined,
  mcpServerPath: string,
  containerInput: ContainerInput,
  sdkEnv: Record<string, string | undefined>,
  resumeAt?: string,
): Promise<{ newSessionId?: string; lastAssistantUuid?: string; closedDuringQuery: boolean }> {
  const stream = new MessageStream();
  stream.push(prompt);

  // Poll IPC for follow-up messages and _close sentinel during the query
  let ipcPolling = true;
  let closedDuringQuery = false;
  const pollIpcDuringQuery = () => {
    if (!ipcPolling) return;
    if (shouldClose()) {
      log('Close sentinel detected during query, ending stream');
      closedDuringQuery = true;
      stream.end();
      ipcPolling = false;
      return;
    }
    const messages = drainIpcInput();
    for (const text of messages) {
      log(`Piping IPC message into active query (${text.length} chars)`);
      // Signal query boundary so trace UI shows a separate task card
      writeIpcFile(IPC_MESSAGES_DIR, {
        type: 'agent_step',
        stepType: 'query_start',
        text: text.slice(0, 500),
        groupFolder: containerInput.groupFolder,
        timestamp: new Date().toISOString(),
      });
      stream.push(text);
    }
    setTimeout(pollIpcDuringQuery, IPC_POLL_MS);
  };
  setTimeout(pollIpcDuringQuery, IPC_POLL_MS);

  let newSessionId: string | undefined;
  let lastAssistantUuid: string | undefined;
  let messageCount = 0;
  let resultCount = 0;
  const currentWorkdir = resolveWorkdir(containerInput.workdir);

  const globalClaudeMd = buildGlobalSystemPrompt(prompt, currentWorkdir, containerInput);

  // Discover additional directories mounted at /workspace/extra/*
  // These are passed to the SDK so their CLAUDE.md files are loaded automatically
  const extraDirs: string[] = [];
  const extraBase = '/workspace/extra';
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        extraDirs.push(fullPath);
      }
    }
  }
  if (extraDirs.length > 0) {
    log(`Additional directories: ${extraDirs.join(', ')}`);
  }

  for await (const message of query({
    prompt: stream,
    options: {
      cwd: currentWorkdir,
      additionalDirectories: extraDirs.length > 0 ? extraDirs : undefined,
      resume: sessionId,
      resumeSessionAt: resumeAt,
      systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append: globalClaudeMd || '' },
      allowedTools: [
        'Bash',
        'Read', 'Write', 'Edit', 'Glob', 'Grep',
        'WebSearch', 'WebFetch',
        'Task', 'TaskOutput', 'TaskStop',
        'TeamCreate', 'TeamDelete', 'SendMessage',
        'TodoWrite', 'ToolSearch', 'Skill',
        'NotebookEdit',
        'mcp__bioclaw__*'
      ],
      env: sdkEnv,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      settingSources: ['project', 'user'],
      mcpServers: {
        bioclaw: {
          command: 'node',
          args: [mcpServerPath],
          env: {
            BIOCLAW_CHAT_JID: containerInput.chatJid,
            BIOCLAW_GROUP_FOLDER: containerInput.groupFolder,
            BIOCLAW_AGENT_ID: containerInput.agentId || containerInput.groupFolder,
            BIOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
          },
        },
      },
      hooks: {
        PreCompact: [{ hooks: [createPreCompactHook()] }],
        PreToolUse: [{ matcher: 'Bash', hooks: [createSanitizeBashHook()] }],
      },
    }
  })) {
    messageCount++;
    const msgType = message.type === 'system' ? `system/${(message as { subtype?: string }).subtype}` : message.type;
    log(`[msg #${messageCount}] type=${msgType}`);

    if (message.type === 'assistant' && 'uuid' in message) {
      lastAssistantUuid = (message as { uuid: string }).uuid;
      // Emit agent thinking/tool_use steps to IPC for trace display
      try {
        const msg = message as { uuid: string; message?: { content?: unknown[] } };
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as Record<string, unknown>;
            if (b.type === 'text' && typeof b.text === 'string') {
              writeIpcFile(IPC_MESSAGES_DIR, {
                type: 'agent_step',
                stepType: 'thinking',
                text: (b.text as string).slice(0, 2000),
                groupFolder: containerInput.groupFolder,
                timestamp: new Date().toISOString(),
              });
            } else if (b.type === 'tool_use') {
              const rawInput = JSON.stringify(b.input ?? {});
              writeIpcFile(IPC_MESSAGES_DIR, {
                type: 'agent_step',
                stepType: 'tool_use',
                toolName: b.name as string,
                // Keep short preview for trace display
                toolInput: rawInput.slice(0, 1000),
                // Full input for notebook export (Bash commands, Write content, etc.)
                toolInputFull: rawInput.length > 1000 ? rawInput : undefined,
                groupFolder: containerInput.groupFolder,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      } catch { /* don't break the loop */ }
    }

    if (message.type === 'system' && message.subtype === 'init') {
      newSessionId = message.session_id;
      log(`Session initialized: ${newSessionId}`);
    }

    if (message.type === 'system' && (message as { subtype?: string }).subtype === 'task_notification') {
      const tn = message as { task_id: string; status: string; summary: string };
      log(`Task notification: task=${tn.task_id} status=${tn.status} summary=${tn.summary}`);
    }

    if (message.type === 'result') {
      resultCount++;
      const textResult = 'result' in message ? (message as { result?: string }).result : null;
      log(`Result #${resultCount}: subtype=${message.subtype}${textResult ? ` text=${textResult.slice(0, 200)}` : ''}`);
      writeOutput({
        status: 'success',
        result: textResult || null,
        newSessionId
      });
    }
  }

  ipcPolling = false;
  log(`Query done. Messages: ${messageCount}, results: ${resultCount}, lastAssistantUuid: ${lastAssistantUuid || 'none'}, closedDuringQuery: ${closedDuringQuery}`);
  return { newSessionId, lastAssistantUuid, closedDuringQuery };
}

function getOpenAICompatibleTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'bash',
        description: 'Run a shell command inside the BioClaw container. Use this for bioinformatics tools, Python scripts, file inspection, and data processing.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to execute.' },
          },
          required: ['command'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_message',
        description: 'Send a text message to the current chat while your analysis is still running.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Message text to send.' },
          },
          required: ['text'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_image',
        description: 'Send a file (image, PDF, or other document) from the container to the current chat. Use this for PNG, JPG, GIF, PDF, and any other file the user should receive.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Absolute image path inside the container.' },
            caption: { type: 'string', description: 'Optional image caption.' },
          },
          required: ['file_path'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'schedule_task',
        description: 'Schedule a recurring or one-time task for this chat.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            schedule_type: { type: 'string', enum: ['cron', 'interval', 'once'] },
            schedule_value: { type: 'string' },
            context_mode: { type: 'string', enum: ['group', 'isolated'] },
            target_group_jid: { type: 'string' },
          },
          required: ['prompt', 'schedule_type', 'schedule_value'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the contents of a file. Use this to inspect data files, scripts, configuration, skill definitions, and any other text files.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Absolute path to the file to read.' },
            offset: { type: 'number', description: 'Line number to start reading from (1-based). Optional.' },
            limit: { type: 'number', description: 'Maximum number of lines to read. Optional, defaults to 2000.' },
          },
          required: ['file_path'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does. Parent directories are created automatically.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Absolute path to the file to write.' },
            content: { type: 'string', description: 'The full content to write to the file.' },
          },
          required: ['file_path', 'content'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_files',
        description: 'List files and directories at a given path. Returns names with trailing / for directories.',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Absolute path to the directory to list.' },
            recursive: { type: 'boolean', description: 'If true, list files recursively. Default false.' },
          },
          required: ['directory'],
          additionalProperties: false,
        },
      },
    },
  ] as const;
}

async function runBashTool(
  command: string,
  env: Record<string, string | undefined>,
  cwd: string,
): Promise<string> {
  const safeEnv = { ...env } as Record<string, string | undefined>;
  for (const secretVar of SECRET_ENV_VARS) {
    delete safeEnv[secretVar];
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env: Object.fromEntries(
        Object.entries(safeEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      ),
      timeout: BASH_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: '/bin/bash',
    });

    // Log bash output to stderr so it appears in host logs
    if (stdout.trim() || stderr.trim()) {
      log(`[bash] ${[stdout.trim(), stderr.trim()].filter(Boolean).join('\n')}`);
    }

    const combined = [stdout, stderr].filter(Boolean).join(stderr && stdout ? '\n' : '');
    return truncateOutput(combined || 'Command completed with no output.');
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const combined = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
    return `Command failed.\n${truncateOutput(combined || 'Unknown error.')}`;
  }
}

async function executeOpenAIToolCall(
  toolName: string,
  rawArgs: string,
  containerInput: ContainerInput,
  env: Record<string, string | undefined>,
  cwd: string,
): Promise<string> {
  let args: Record<string, string> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return `Invalid JSON tool arguments for ${toolName}: ${rawArgs}`;
  }

  switch (toolName) {
    case 'bash':
      if (!args.command) return 'Missing required argument: command';
      return runBashTool(args.command, env, cwd);
    case 'send_message':
      if (!args.text) return 'Missing required argument: text';
      queueIpcMessage(containerInput.chatJid, containerInput.groupFolder, args.text);
      return 'Message queued for sending.';
    case 'send_image':
      if (!args.file_path) return 'Missing required argument: file_path';
      if (!fs.existsSync(args.file_path)) return `File not found: ${args.file_path}`;
      queueIpcImage(containerInput.chatJid, containerInput.groupFolder, args.file_path, args.caption);
      return `Image queued for sending from ${args.file_path}`;
    case 'schedule_task':
      if (!args.prompt || !args.schedule_type || !args.schedule_value) {
        return 'Missing one of required arguments: prompt, schedule_type, schedule_value';
      }
      queueScheduledTask(containerInput, {
        prompt: args.prompt,
        schedule_type: args.schedule_type,
        schedule_value: args.schedule_value,
        context_mode: args.context_mode,
        target_group_jid: args.target_group_jid,
      });
      return `Scheduled task queued (${args.schedule_type}: ${args.schedule_value}).`;
    case 'read_file': {
      if (!args.file_path) return 'Missing required argument: file_path';
      try {
        if (!fs.existsSync(args.file_path)) return `File not found: ${args.file_path}`;
        const stat = fs.statSync(args.file_path);
        if (stat.isDirectory()) return `Path is a directory, not a file: ${args.file_path}`;
        const content = fs.readFileSync(args.file_path, 'utf-8');
        const lines = content.split('\n');
        const offset = Math.max(0, (parseInt(args.offset || '1', 10) || 1) - 1);
        const limit = parseInt(args.limit || '2000', 10) || 2000;
        const slice = lines.slice(offset, offset + limit);
        const numbered = slice.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');
        const result = numbered || '(empty file)';
        if (lines.length > offset + limit) {
          return result + `\n\n... (${lines.length - offset - limit} more lines, use offset/limit to read more)`;
        }
        return result;
      } catch (err) {
        return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    case 'write_file': {
      if (!args.file_path) return 'Missing required argument: file_path';
      if (args.content === undefined) return 'Missing required argument: content';
      try {
        fs.mkdirSync(path.dirname(args.file_path), { recursive: true });
        fs.writeFileSync(args.file_path, args.content, 'utf-8');
        return `File written: ${args.file_path} (${Buffer.byteLength(args.content)} bytes)`;
      } catch (err) {
        return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    case 'list_files': {
      if (!args.directory) return 'Missing required argument: directory';
      try {
        if (!fs.existsSync(args.directory)) return `Directory not found: ${args.directory}`;
        const stat = fs.statSync(args.directory);
        if (!stat.isDirectory()) return `Path is not a directory: ${args.directory}`;
        const recursive = args.recursive === 'true';
        const entries: string[] = [];
        const walk = (dir: string, prefix: string) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
              entries.push(rel + '/');
              if (recursive) walk(path.join(dir, entry.name), rel);
            } else {
              entries.push(rel);
            }
          }
        };
        walk(args.directory, '');
        return entries.length > 0 ? entries.join('\n') : '(empty directory)';
      } catch (err) {
        return `Error listing directory: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    default:
      return `Unknown tool: ${toolName}`;
  }
}

async function callOpenAICompatibleApi(
  providerConfig: ProviderConfig,
  messages: OpenAIChatMessage[],
  onChunk?: (partialText: string) => void,
): Promise<any> {
  if (!providerConfig.apiKey || !providerConfig.baseUrl || !providerConfig.model) {
    throw new Error('OpenAI-compatible provider is missing apiKey, baseUrl, or model');
  }

  const baseUrl = providerConfig.baseUrl.replace(/\/+$/, '');
  const useStream = !!onChunk;

  // Retry on transient network errors (ECONNRESET, fetch failed) with exponential
  // backoff. DashScope/qwen sometimes resets connections under load — without
  // retries, the whole agent run fails on the first hiccup.
  const MAX_RETRIES = 4;
  const requestBody = JSON.stringify({
    model: providerConfig.model,
    messages,
    tools: getOpenAICompatibleTools(),
    tool_choice: 'auto',
    temperature: 0.2,
    stream: useStream,
  });
  let response: Response | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Runchuan-BU/BioClaw',
          'X-Title': 'BioClaw',
        },
        body: requestBody,
      });
      break;
    } catch (fetchErr) {
      lastErr = fetchErr;
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      const isLast = attempt === MAX_RETRIES - 1;
      if (isLast) break;
      const delayMs = 500 * Math.pow(2, attempt);   // 500ms, 1s, 2s, 4s
      log(`Provider fetch failed (${errMsg}), retry ${attempt + 1}/${MAX_RETRIES - 1} in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  if (!response) {
    if (useStream) {
      log(`All ${MAX_RETRIES} streaming attempts failed; falling back to non-streaming`);
      return callOpenAICompatibleApi(providerConfig, messages);
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  if (!response.ok) {
    // Error responses aren't SSE, parse as JSON
    const errData = await response.json().catch(() => ({})) as OpenAIChatResponse;
    throw new Error(errData.error?.message || `Provider request failed with status ${response.status}`);
  }

  if (!useStream) {
    const data = await response.json() as OpenAIChatResponse;
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('Provider returned no message choices');
    return message;
  }

  // Streaming SSE parse
  if (!response.body) throw new Error('Streaming response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';
  const aggregatedToolCalls: Record<number, { id?: string; type?: string; function: { name?: string; arguments?: string } }> = {};
  let lastEmitAt = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on \n\n (SSE event boundary)
      let sepIdx;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let evt: { choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string | null }> };
          try { evt = JSON.parse(payload); } catch { continue; }
          const delta = evt.choices?.[0]?.delta;
          if (!delta) continue;
          if (typeof delta.content === 'string' && delta.content.length) {
            accumulatedText += delta.content;
            const now = Date.now();
            if (onChunk && (now - lastEmitAt >= 60)) {
              lastEmitAt = now;
              try { onChunk(accumulatedText); } catch { /* ignore */ }
            }
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const slot = aggregatedToolCalls[idx] ?? { function: { name: '', arguments: '' } };
              if (tc.id) slot.id = tc.id;
              if (tc.type) slot.type = tc.type;
              if (tc.function?.name) slot.function.name = (slot.function.name || '') + tc.function.name;
              if (tc.function?.arguments) slot.function.arguments = (slot.function.arguments || '') + tc.function.arguments;
              aggregatedToolCalls[idx] = slot;
            }
          }
        }
      }
    }
  } catch (streamErr) {
    log(`Stream interrupted (${streamErr instanceof Error ? streamErr.message : String(streamErr)}); falling back to non-streaming retry`);
    return callOpenAICompatibleApi(providerConfig, messages);
  }

  // Final flush
  if (onChunk && accumulatedText) {
    try { onChunk(accumulatedText); } catch { /* ignore */ }
  }

  const toolCalls = Object.keys(aggregatedToolCalls)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => aggregatedToolCalls[Number(k)])
    .filter(tc => tc.function.name)
    .map(tc => {
      // Streaming SSE delivers arguments as fragments; if assembly produced
      // invalid/empty JSON the next API call will be rejected with
      // `function.arguments parameter must be in JSON format`. Normalize to '{}'
      // when the assembled string isn't a parseable JSON object.
      const argsRaw = (tc.function.arguments || '').trim();
      let args = argsRaw;
      if (!args) {
        args = '{}';
      } else {
        try { JSON.parse(args); }
        catch { args = '{}'; }
      }
      return {
        id: tc.id || '',
        type: 'function' as const,
        function: {
          name: tc.function.name || '',
          arguments: args,
        },
      };
    });

  // If we ended up with tool_calls whose arguments all degraded to '{}' (likely
  // because streaming was truncated mid-flight), retry without streaming so the
  // model returns a clean, complete response.
  if (toolCalls.length && useStream) {
    const allEmpty = toolCalls.every(tc => tc.function.arguments === '{}');
    if (allEmpty) {
      log('Streaming produced empty/invalid tool_call arguments; retrying without stream');
      return callOpenAICompatibleApi(providerConfig, messages);
    }
  }

  return {
    role: 'assistant' as const,
    content: accumulatedText || null,
    tool_calls: toolCalls.length ? toolCalls : undefined,
  };
}

async function runOpenAICompatibleConversation(
  prompt: string,
  sessionId: string | undefined,
  containerInput: ContainerInput,
  env: Record<string, string | undefined>,
  cwd: string,
  providerConfig: ProviderConfig,
  existingMessages?: OpenAIChatMessage[],
): Promise<{ newSessionId: string; closedDuringQuery: boolean; messages: OpenAIChatMessage[] }> {
  const newSessionId = sessionId || `openai-compatible:${randomUUID()}`;
  const persistedMessages = existingMessages || loadOpenAICompatibleSessionMessages(newSessionId);
  const systemPrompt = buildGlobalSystemPrompt(prompt, cwd, containerInput);
  const messages: OpenAIChatMessage[] = persistedMessages
    ? [...persistedMessages]
    : [];
  if (messages.length > 0 && messages[0]?.role === 'system') {
    messages[0] = { role: 'system', content: systemPrompt };
  } else {
    messages.unshift({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });
  saveOpenAICompatibleSessionMessages(newSessionId, messages);

  let toolIterations = 0;
  while (toolIterations < OPENAI_TOOL_MAX_ITERATIONS) {
    toolIterations += 1;
    // Pipe every streamed chunk back as a writeOutput so the orchestrator
    // records a stream_output trace event and the UI sees progressive text.
    const assistantMessage = await callOpenAICompatibleApi(
      providerConfig,
      messages,
      (partial) => {
        writeOutput({
          status: 'streaming',
          result: partial,
          newSessionId,
        });
      },
    );

    messages.push({
      role: 'assistant',
      content: normalizeContent(assistantMessage.content),
      tool_calls: assistantMessage.tool_calls,
    });
    saveOpenAICompatibleSessionMessages(newSessionId, messages);

    // Emit thinking trace for assistant text content
    const assistantText = normalizeContent(assistantMessage.content);
    if (assistantText) {
      writeIpcFile(IPC_MESSAGES_DIR, {
        type: 'agent_step',
        stepType: 'thinking',
        text: assistantText.slice(0, 2000),
        groupFolder: containerInput.groupFolder,
        timestamp: new Date().toISOString(),
      });
    }

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      writeOutput({
        status: 'success',
        result: assistantText,
        newSessionId,
      });
      return { newSessionId, closedDuringQuery: false, messages };
    }

    for (const toolCall of assistantMessage.tool_calls) {
      // Emit tool_use trace for notebook export
      const rawInput = toolCall.function.arguments || '{}';
      writeIpcFile(IPC_MESSAGES_DIR, {
        type: 'agent_step',
        stepType: 'tool_use',
        toolName: toolCall.function.name,
        toolInput: rawInput.slice(0, 1000),
        toolInputFull: rawInput.length > 1000 ? rawInput : undefined,
        groupFolder: containerInput.groupFolder,
        timestamp: new Date().toISOString(),
      });

      const toolResult = await executeOpenAIToolCall(
        toolCall.function.name,
        toolCall.function.arguments,
        containerInput,
        env,
        cwd,
      );

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      });
      saveOpenAICompatibleSessionMessages(newSessionId, messages);
    }
  }

  throw new Error(`OpenAI-compatible agent exceeded ${OPENAI_TOOL_MAX_ITERATIONS} tool iterations`);
}

async function runOpenAICodexConversation(
  prompt: string,
  sessionId: string | undefined,
  containerInput: ContainerInput,
  env: Record<string, string | undefined>,
  cwd: string,
  providerConfig: ProviderConfig,
  mcpServerPath: string,
): Promise<{ newSessionId: string; closedDuringQuery: boolean }> {
  const cliPath = getOpenAICodexCliJsPath(env);
  await ensureOpenAICodexHome(env);
  await configureOpenAICodexMcpServer(cliPath, mcpServerPath, containerInput, cwd, env);

  const outputPath = path.join(OPENAI_CODEX_OUTPUT_DIR, `${randomUUID()}.txt`);
  const codexEnv = {
    ...process.env,
    ...env,
    CODEX_HOME: OPENAI_CODEX_HOME,
    HOME: '/home/node',
  };
  const safeEnv = Object.fromEntries(
    Object.entries(codexEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  const args = sessionId
    ? [
        cliPath,
        'exec',
        'resume',
        '--json',
        '--skip-git-repo-check',
        '--dangerously-bypass-approvals-and-sandbox',
        '-m',
        providerConfig.model || 'gpt-5.4',
        '-o',
        outputPath,
        sessionId,
        prompt,
      ]
    : [
        cliPath,
        'exec',
        '--json',
        '--skip-git-repo-check',
        '--dangerously-bypass-approvals-and-sandbox',
        '-m',
        providerConfig.model || 'gpt-5.4',
        '-C',
        cwd,
        '-o',
        outputPath,
        prompt,
      ];

  const child = spawnChildProcess('node', args, {
    cwd,
    env: safeEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  scheduleOpenAICodexAuthCleanup(child);

  let stderr = '';
  let newSessionId = sessionId;
  let lastAgentMessage = '';
  const pendingSendMessageCalls = new Map<string, string>();
  const completedSendMessageTexts = new Set<string>();

  const stdoutLines = createInterface({ input: child.stdout! });
  stdoutLines.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
      return;
    }

    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        thread_id?: string;
        item?: {
          id?: string;
          type?: string;
          text?: string;
          tool?: string;
          summary?: string[];
          content?: string[];
          status?: string;
          error?: { message?: string } | null;
          arguments?: { text?: unknown } | null;
        };
      };

      if (event.type === 'thread.started' && typeof event.thread_id === 'string' && event.thread_id) {
        newSessionId = event.thread_id;
        return;
      }

      const item = event.item;
      if (!item) return;

      if (item.type === 'agent_message' && typeof item.text === 'string' && item.text.trim()) {
        lastAgentMessage = item.text;
        return;
      }

      if (item.type === 'mcp_tool_call' && item.tool) {
        const toolText =
          item.arguments && typeof item.arguments.text === 'string'
            ? normalizeCodexMessageText(item.arguments.text)
            : '';

        if (event.type === 'item.started' && item.id && toolText) {
          pendingSendMessageCalls.set(item.id, toolText);
        }

        if (item.tool === 'send_message' && event.type === 'item.completed') {
          const completedText = toolText || (item.id ? pendingSendMessageCalls.get(item.id) || '' : '');
          if (completedText && item.status !== 'failed' && !item.error) {
            completedSendMessageTexts.add(completedText);
          }
        }

        if (event.type === 'item.completed' && item.id) {
          pendingSendMessageCalls.delete(item.id);
        }
      }

      if (item.type === 'reasoning') {
        const thinkingText = [...(item.summary || []), ...(item.content || [])].join('\n').trim();
        if (thinkingText) {
          writeIpcFile(IPC_MESSAGES_DIR, {
            type: 'agent_step',
            stepType: 'thinking',
            text: thinkingText.slice(0, 2000),
            groupFolder: containerInput.groupFolder,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      if (item.type === 'dynamic_tool_call' && item.tool) {
        writeIpcFile(IPC_MESSAGES_DIR, {
          type: 'agent_step',
          stepType: 'tool_use',
          toolName: item.tool,
          groupFolder: containerInput.groupFolder,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Ignore non-protocol stdout lines.
    }
  });

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    stderr += text;
    const trimmed = text.trim();
    if (trimmed) {
      log(`[codex] ${trimmed}`);
    }
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
  stdoutLines.close();

  let finalMessage = '';
  try {
    finalMessage = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8').trim() : '';
  } finally {
    try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
  }

  if (exitCode !== 0) {
    throw new Error(
      `Codex CLI exited with code ${exitCode}.\n${truncateOutput(stderr || finalMessage || 'Unknown Codex error.')}`,
    );
  }

  const rawResultText = finalMessage || lastAgentMessage || null;
  const normalizedResultText = rawResultText ? normalizeCodexMessageText(rawResultText) : '';
  const resultText =
    normalizedResultText && completedSendMessageTexts.has(normalizedResultText)
      ? null
      : rawResultText;
  if (!newSessionId) {
    throw new Error('Codex CLI completed without returning a thread id.');
  }

  writeOutput({
    status: 'success',
    result: resultText,
    newSessionId,
  });

  return { newSessionId, closedDuringQuery: false };
}

// ── Gemini CLI provider ──────────────────────────────────────────────────
//
// Mirrors the Codex runner. Auth precedence:
//   1. OAuth creds at ~/.gemini/oauth_creds.json (passed via
//      GEMINI_OAUTH_CREDS_JSON env; written to GEMINI_HOME before exec)
//   2. GEMINI_API_KEY (Google AI Studio direct)
//
// The CLI binary is mounted read-only from the host. We register BioClaw's
// IPC MCP server with `gemini mcp add bioclaw ...` before each exec so the
// agent can call our tools the same way the Codex path does.

function getGeminiCliJsPath(env: Record<string, string | undefined>): string {
  const cliPath = (env.GEMINI_CLI_JS || DEFAULT_GEMINI_CLI_JS).trim();
  if (!cliPath) {
    throw new Error('Gemini CLI path is empty');
  }
  if (!fs.existsSync(cliPath)) {
    throw new Error(`Gemini CLI entrypoint not found: ${cliPath}`);
  }
  return cliPath;
}

function normalizeGeminiMessageText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

async function ensureGeminiHome(
  env: Record<string, string | undefined>,
): Promise<void> {
  fs.mkdirSync(GEMINI_HOME, { recursive: true });
  fs.mkdirSync(GEMINI_OUTPUT_DIR, { recursive: true });
  const oauthJson = env.GEMINI_OAUTH_CREDS_JSON?.trim();
  if (oauthJson) {
    fs.writeFileSync(GEMINI_OAUTH_PATH, oauthJson, { encoding: 'utf8', mode: 0o600 });
  } else if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini auth missing: neither GEMINI_OAUTH_CREDS_JSON nor GEMINI_API_KEY set');
  }
}

function scheduleGeminiAuthCleanup(child: ReturnType<typeof spawnChildProcess>): void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { fs.unlinkSync(GEMINI_OAUTH_PATH); } catch { /* best effort */ }
  };
  const timer = setTimeout(cleanup, 2000);
  timer.unref?.();
  child.once('exit', cleanup);
  child.stdout?.once('data', cleanup);
  child.stderr?.once('data', cleanup);
}

async function configureGeminiMcpServer(
  cliPath: string,
  mcpServerPath: string,
  containerInput: ContainerInput,
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<void> {
  const geminiEnv = {
    ...process.env,
    ...env,
    GEMINI_HOME,
    HOME: '/home/node',
  };
  const safeEnv = Object.fromEntries(
    Object.entries(geminiEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  try {
    await execFileAsync('node', [cliPath, 'mcp', 'remove', 'bioclaw'], {
      cwd,
      env: safeEnv,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    // Missing-server errors are ignored; we re-add the MCP config next.
  }

  const args = [
    cliPath,
    'mcp',
    'add',
    'bioclaw',
    '--env',
    `BIOCLAW_CHAT_JID=${containerInput.chatJid}`,
    '--env',
    `BIOCLAW_GROUP_FOLDER=${containerInput.groupFolder}`,
    '--env',
    `BIOCLAW_AGENT_ID=${containerInput.agentId || containerInput.groupFolder}`,
    '--env',
    `BIOCLAW_IS_MAIN=${containerInput.isMain ? '1' : '0'}`,
    '--',
    'node',
    mcpServerPath,
  ];

  await execFileAsync('node', args, {
    cwd,
    env: safeEnv,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function runGeminiConversation(
  prompt: string,
  sessionId: string | undefined,
  containerInput: ContainerInput,
  env: Record<string, string | undefined>,
  cwd: string,
  providerConfig: ProviderConfig,
  mcpServerPath: string,
): Promise<{ newSessionId: string; closedDuringQuery: boolean }> {
  const cliPath = getGeminiCliJsPath(env);
  await ensureGeminiHome(env);
  await configureGeminiMcpServer(cliPath, mcpServerPath, containerInput, cwd, env);

  const outputPath = path.join(GEMINI_OUTPUT_DIR, `${randomUUID()}.txt`);
  const geminiEnv = {
    ...process.env,
    ...env,
    GEMINI_HOME,
    HOME: '/home/node',
  };
  const safeEnv = Object.fromEntries(
    Object.entries(geminiEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  // Gemini CLI flags mirror the Codex `exec` contract as closely as possible.
  // `--yolo` bypasses approval prompts (analogous to Codex's
  // --dangerously-bypass-approvals-and-sandbox); `--model` selects the model;
  // `--include-directories` seeds the cwd. Session resume uses `--resume`
  // when the CLI version supports it; otherwise each query is fresh.
  const baseArgs = [
    cliPath,
    '--yolo',
    '--model',
    providerConfig.model || 'gemini-2.0-pro',
    '--include-directories',
    cwd,
    '--output',
    outputPath,
    '--prompt',
    prompt,
  ];
  const args = sessionId
    ? [...baseArgs.slice(0, 1), '--resume', sessionId, ...baseArgs.slice(1)]
    : baseArgs;

  const child = spawnChildProcess('node', args, {
    cwd,
    env: safeEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  scheduleGeminiAuthCleanup(child);

  let stderr = '';
  let lastAgentMessage = '';
  let newSessionId = sessionId;

  const stdoutLines = createInterface({ input: child.stdout! });
  stdoutLines.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    // Gemini CLI emits stdout as free-form text by default; if a JSON event
    // stream is enabled upstream in the future, we can parse it here.
    // For now, accumulate the last non-empty line as a best-effort final
    // message, and forward anything that looks like a session identifier.
    if (/^session[:=]/i.test(trimmed)) {
      const id = trimmed.split(/[:=]/, 2)[1]?.trim();
      if (id) newSessionId = id;
      return;
    }
    lastAgentMessage = trimmed;
  });

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    stderr += text;
    const t = text.trim();
    if (t) log(`[gemini] ${t}`);
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
  stdoutLines.close();

  let finalMessage = '';
  try {
    finalMessage = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8').trim() : '';
  } finally {
    try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
  }

  if (exitCode !== 0) {
    throw new Error(
      `Gemini CLI exited with code ${exitCode}.\n${truncateOutput(stderr || finalMessage || 'Unknown Gemini error.')}`,
    );
  }

  const rawResultText = finalMessage || lastAgentMessage || null;
  const resultText = rawResultText ? normalizeGeminiMessageText(rawResultText) : null;
  // Gemini CLI does not yet emit persistent thread IDs reliably; synthesize
  // one if the runner didn't pick a session marker out of stdout so the
  // host side has a stable handle for this conversation.
  const effectiveSessionId = newSessionId || sessionId || randomUUID();

  writeOutput({
    status: 'success',
    result: resultText,
    newSessionId: effectiveSessionId,
  });

  return { newSessionId: effectiveSessionId, closedDuringQuery: false };
}

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    // Delete the temp file the entrypoint wrote — it contains secrets
    try { fs.unlinkSync('/tmp/input.json'); } catch { /* may not exist */ }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`
    });
    process.exit(1);
  }

  // Build SDK env: merge secrets into process.env for the SDK only.
  // Secrets never touch process.env itself, so Bash subprocesses can't see them.
  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(containerInput.secrets || {})) {
    sdkEnv[key] = value;
  }
  const providerConfig = resolveProviderConfig(sdkEnv);
  const currentWorkdir = resolveWorkdir(containerInput.workdir);
  log(`Using provider: ${providerConfig.provider}${providerConfig.model ? ` (${providerConfig.model})` : ''}`);
  log(`Using workdir: ${currentWorkdir}`);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  let sessionId = containerInput.sessionId;
  let openAiMessages: OpenAIChatMessage[] | undefined;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  // Clean up stale _close sentinel from previous container runs
  try { fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL); } catch { /* ignore */ }

  // Build initial prompt (drain any pending IPC messages too)
  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += '\n' + pending.join('\n');
  }

  // Query loop: run query → wait for IPC message → run new query → repeat
  let resumeAt: string | undefined;
  try {
    while (true) {
      log(`Starting query (session: ${sessionId || 'new'}, resumeAt: ${resumeAt || 'latest'})...`);

      if (providerConfig.provider === 'anthropic') {
        const queryResult = await runQuery(prompt, sessionId, mcpServerPath, containerInput, sdkEnv, resumeAt);
        if (queryResult.newSessionId) {
          sessionId = queryResult.newSessionId;
        }
        if (queryResult.lastAssistantUuid) {
          resumeAt = queryResult.lastAssistantUuid;
        }

        if (queryResult.closedDuringQuery) {
          log('Close sentinel consumed during query, exiting');
          break;
        }
      } else if (providerConfig.provider === 'openai-compatible') {
        const queryResult = await runOpenAICompatibleConversation(
          prompt,
          sessionId,
          containerInput,
          sdkEnv,
          currentWorkdir,
          providerConfig,
          openAiMessages,
        );
        sessionId = queryResult.newSessionId;
        resumeAt = undefined;
        openAiMessages = queryResult.messages;

        if (queryResult.closedDuringQuery) {
          log('Close sentinel consumed during query, exiting');
          break;
        }
      } else if (providerConfig.provider === 'gemini') {
        const queryResult = await runGeminiConversation(
          prompt,
          sessionId,
          containerInput,
          sdkEnv,
          currentWorkdir,
          providerConfig,
          mcpServerPath,
        );
        sessionId = queryResult.newSessionId;
        resumeAt = undefined;
        openAiMessages = undefined;

        if (queryResult.closedDuringQuery) {
          log('Close sentinel consumed during query, exiting');
          break;
        }
      } else {
        const queryResult = await runOpenAICodexConversation(
          prompt,
          sessionId,
          containerInput,
          sdkEnv,
          currentWorkdir,
          providerConfig,
          mcpServerPath,
        );
        sessionId = queryResult.newSessionId;
        resumeAt = undefined;
        openAiMessages = undefined;

        if (queryResult.closedDuringQuery) {
          log('Close sentinel consumed during query, exiting');
          break;
        }
      }

      // Emit session update so host can track it
      writeOutput({ status: 'success', result: null, newSessionId: sessionId });

      log('Query ended, waiting for next IPC message...');

      // Wait for the next message or _close sentinel
      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log('Close sentinel received, exiting');
        break;
      }

      log(`Got new message (${nextMessage.length} chars), starting new query`);
      // Signal query boundary so the orchestrator can split trace events into
      // separate task cards.
      writeIpcFile(IPC_MESSAGES_DIR, {
        type: 'agent_step',
        stepType: 'query_start',
        text: nextMessage.slice(0, 500),
        groupFolder: containerInput.groupFolder,
        timestamp: new Date().toISOString(),
      });
      prompt = nextMessage;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage
    });
    process.exit(1);
  }
}

main();
