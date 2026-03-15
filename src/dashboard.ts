import { exec } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  CONTAINER_IMAGE,
  MINIMAX_API_KEY,
  MINIMAX_BASE_URL,
  MINIMAX_MODEL,
  QWEN_API_BASE,
  QWEN_AUTH_TOKEN,
  QWEN_MODEL,
} from './config.js';
import {
  deleteTask,
  getAllChats,
  getAllRegisteredGroups,
  getAllTasks,
  getTaskRunLogs,
  updateTask,
} from './db.js';
import { logger } from './logger.js';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'bioclaw.log');
const HTML_FILE = path.join(PROJECT_ROOT, 'src', 'dashboard.html');
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '3847', 10);

function readEnvFile(): Record<string, string> {
  const envFile = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envFile)) return {};
  const result: Record<string, string> = {};
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) result[key] = value;
  }
  return result;
}

// SSE clients listening for log lines
const sseClients = new Set<http.ServerResponse>();

// Broadcast a log line to all SSE clients
export function broadcastLogLine(line: string): void {
  if (sseClients.size === 0) return;
  const payload = `data: ${JSON.stringify(line)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function getContainers(): Promise<object[]> {
  return new Promise((resolve) => {
    exec(
      'docker ps --filter "name=bioclaw-" --format "{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.RunningFor}}"',
      { timeout: 5000 },
      (_err, stdout) => {
        if (!stdout) { resolve([]); return; }
        resolve(
          stdout.trim().split('\n').filter(Boolean).map((line) => {
            const [name, image, status, running] = line.split('\t');
            return { name, image, status, running };
          }),
        );
      },
    );
  });
}

function tailFile(filePath: string, lines: number): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const stat = fs.statSync(filePath);
    const chunkSize = Math.min(stat.size, lines * 200);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(chunkSize);
    fs.readSync(fd, buf, 0, chunkSize, stat.size - chunkSize);
    fs.closeSync(fd);
    const text = buf.toString('utf-8');
    const all = text.split('\n').filter(Boolean);
    return all.slice(-lines);
  } catch {
    return [];
  }
}

// Model specs (context window / max output / reasoning support)
const MODEL_SPECS: Record<string, { contextWindow: number; maxOutput: number; reasoning: boolean }> = {
  'MiniMax-M2.5':              { contextWindow: 1_000_000, maxOutput: 40_960, reasoning: true },
  'MiniMax-M1':                { contextWindow: 1_000_000, maxOutput: 40_960, reasoning: true },
  'claude-opus-4-6':           { contextWindow: 200_000,   maxOutput: 32_768, reasoning: true },
  'claude-sonnet-4-6':         { contextWindow: 200_000,   maxOutput: 16_384, reasoning: true },
  'claude-haiku-4-5-20251001': { contextWindow: 200_000,   maxOutput: 8_192,  reasoning: false },
};

function getModels(): object[] {
  const groups = getAllRegisteredGroups();
  const agentCounts: Record<string, number> = {};
  for (const g of Object.values(groups)) {
    const t = g.agentType || 'claude';
    agentCounts[t] = (agentCounts[t] || 0) + 1;
  }

  const models: object[] = [];

  if (MINIMAX_MODEL) {
    const spec = MODEL_SPECS[MINIMAX_MODEL] ?? { contextWindow: 1_000_000, maxOutput: 40_960, reasoning: true };
    models.push({ id: 'minimax', name: MINIMAX_MODEL, provider: 'MiniMax',
      endpoint: MINIMAX_BASE_URL, agentCount: agentCounts['minimax'] ?? 0,
      configured: !!MINIMAX_API_KEY, ...spec });
  }

  if (QWEN_MODEL) {
    const displayName = QWEN_MODEL.split('/').pop() ?? QWEN_MODEL;
    models.push({ id: 'qwen', name: displayName, fullModel: QWEN_MODEL, provider: 'Qwen (Local)',
      endpoint: QWEN_API_BASE, agentCount: agentCounts['qwen'] ?? 0,
      configured: !!QWEN_API_BASE,
      contextWindow: 32_768, maxOutput: 8_192, reasoning: false });
  }

  const claudeModel = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
  const claudeSpec = MODEL_SPECS[claudeModel] ?? { contextWindow: 200_000, maxOutput: 32_768, reasoning: true };
  const dotEnv = readEnvFile();
  const hasClaudeAuth = !!(process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY || dotEnv['CLAUDE_CODE_OAUTH_TOKEN'] || dotEnv['ANTHROPIC_API_KEY']);
  const imageTag = CONTAINER_IMAGE.split(':')[1] ?? 'latest';
  models.push({ id: 'claude', name: claudeModel, provider: 'Anthropic (Claude Code)',
    endpoint: `Docker image: ${imageTag}`, agentCount: agentCounts['claude'] ?? 0,
    configured: hasClaudeAuth, ...claudeSpec });

  return models;
}

async function testModel(modelType: string, prompt: string): Promise<object> {
  const start = Date.now();
  try {
    let apiBase: string, apiKey: string, model: string;
    if (modelType === 'minimax') {
      apiBase = MINIMAX_BASE_URL; apiKey = MINIMAX_API_KEY; model = MINIMAX_MODEL;
    } else if (modelType === 'qwen') {
      apiBase = QWEN_API_BASE; apiKey = QWEN_AUTH_TOKEN; model = QWEN_MODEL;
    } else {
      return { ok: false, response: 'Claude cannot be tested directly (runs in container)', durationMs: 0 };
    }
    if (!apiBase || !model) return { ok: false, response: 'Not configured', durationMs: 0 };
    const res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? data.error?.message ?? JSON.stringify(data).slice(0, 300);
    const usage = data.usage ?? {};
    return { ok: res.ok, response: text, durationMs: Date.now() - start,
      promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0 };
  } catch (err: any) {
    return { ok: false, response: err.message, durationMs: Date.now() - start };
  }
}

function getSkills(): object {
  const agentTools = [
    { name: 'bash',           category: 'System',        description: 'Execute bash commands (BLAST, samtools, python, etc.)' },
    { name: 'read_file',      category: 'File',          description: 'Read file from filesystem' },
    { name: 'write_file',     category: 'File',          description: 'Write content to file' },
    { name: 'web_fetch',      category: 'Network',       description: 'Fetch and extract web page content' },
    { name: 'send_message',   category: 'Communication', description: 'Send progress update to user mid-task' },
    { name: 'send_file',      category: 'Communication', description: 'Send result file to user' },
    { name: 'search_pubmed',  category: 'Bio API',       description: 'Search PubMed literature' },
    { name: 'fetch_abstract', category: 'Bio API',       description: 'Fetch paper abstracts by PMID' },
    { name: 'search_chip_atlas', category: 'Bio API',    description: 'Search CHIP-Atlas ChIP-seq/ATAC-seq' },
  ];

  const bioCliTools = [
    { name: 'ncbi-blast+',  category: 'Sequence',      description: 'BLAST similarity search' },
    { name: 'samtools',     category: 'NGS',           description: 'SAM/BAM manipulation' },
    { name: 'bedtools',     category: 'Genomics',      description: 'Genome arithmetic' },
    { name: 'bwa',          category: 'Alignment',     description: 'BWA short-read aligner' },
    { name: 'minimap2',     category: 'Alignment',     description: 'Long-read / RNA-seq aligner' },
    { name: 'fastqc',       category: 'QC',            description: 'FastQ quality control' },
    { name: 'fastp',        category: 'QC',            description: 'All-in-one FASTQ preprocessor' },
    { name: 'seqtk',        category: 'Sequence',      description: 'FASTA/FASTQ toolkit' },
    { name: 'bcftools',     category: 'Variant',       description: 'VCF/BCF utilities' },
    { name: 'seqkit',       category: 'Sequence',      description: 'FASTA/FASTQ analysis' },
    { name: 'salmon',       category: 'Quantification',description: 'Transcript quantification' },
    { name: 'kallisto',     category: 'Quantification',description: 'RNA-seq pseudo-alignment' },
    { name: 'tabix',        category: 'Indexing',      description: 'Genomic file indexer' },
    { name: 'sra-toolkit',  category: 'Data',          description: 'NCBI SRA data access' },
    { name: 'pymol',        category: 'Structure',     description: 'Molecular visualization (headless)' },
    { name: 'pigz',         category: 'Compression',   description: 'Parallel gzip compression' },
  ];

  const pythonLibs = [
    { name: 'biopython',    category: 'Core',              description: 'Biological computation toolkit' },
    { name: 'pandas',       category: 'Data',              description: 'Data analysis' },
    { name: 'numpy',        category: 'Data',              description: 'Numerical computing' },
    { name: 'scipy',        category: 'Data',              description: 'Scientific computing' },
    { name: 'matplotlib',   category: 'Visualization',     description: 'Data visualization' },
    { name: 'seaborn',      category: 'Visualization',     description: 'Statistical data visualization' },
    { name: 'scikit-learn', category: 'ML',                description: 'Machine learning' },
    { name: 'scanpy',       category: 'scRNA-seq',         description: 'Single-cell RNA-seq analysis' },
    { name: 'pydeseq2',     category: 'RNAseq',            description: 'Differential expression' },
    { name: 'pysam',        category: 'NGS',               description: 'Python SAM/BAM interface' },
    { name: 'rdkit',        category: 'Cheminformatics',   description: 'Chemical informatics' },
    { name: 'anndata',      category: 'scRNA-seq',         description: 'Annotated data matrix' },
    { name: 'multiqc',      category: 'QC',                description: 'Multi-sample QC report' },
    { name: 'requests',     category: 'Network',           description: 'HTTP library for Python' },
  ];

  // Dynamically scan container/skills/ directory
  const skillsDir = path.join(process.cwd(), 'container', 'skills');
  const containerSkills: Array<{ name: string; category: string; description: string }> = [];
  try {
    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
    for (const dir of dirs) {
      const skillMd = path.join(skillsDir, dir, 'SKILL.md');
      let description = '';
      let category = 'Bio Skill';
      if (fs.existsSync(skillMd)) {
        const content = fs.readFileSync(skillMd, 'utf-8').slice(0, 500);
        const descMatch = content.match(/^description:\s*"?(.+?)"?\s*$/m);
        if (descMatch) description = descMatch[1].replace(/^"|"$/g, '').trim();
      }
      if (dir === 'agent-browser') category = 'Browser';
      else if (dir.startsWith('bio-')) category = 'Bio Pipeline';
      else if (dir.endsWith('-database')) category = 'Database';
      else if (dir === 'pubmed-search' || dir === 'literature-search') category = 'Literature';
      else if (dir === 'scrna-qc' || dir === 'visium-analysis') category = 'scRNA-seq';
      containerSkills.push({ name: dir, category, description: description || dir.replace(/-/g, ' ') });
    }
  } catch {
    // skills dir not accessible
  }

  return { agentTools, bioCliTools, pythonLibs, containerSkills };
}

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === '/api/groups' && req.method === 'GET') {
    const groups = getAllRegisteredGroups();
    json(res, groups);
    return true;
  }

  if (pathname === '/api/tasks' && req.method === 'GET') {
    json(res, getAllTasks());
    return true;
  }

  if (pathname === '/api/containers' && req.method === 'GET') {
    json(res, await getContainers());
    return true;
  }

  if (pathname === '/api/stats' && req.method === 'GET') {
    const chats = getAllChats();
    const tasks = getAllTasks();
    const groups = getAllRegisteredGroups();
    json(res, {
      totalChats: chats.length,
      registeredGroups: Object.keys(groups).length,
      activeTasks: tasks.filter((t) => t.status === 'active').length,
      totalTasks: tasks.length,
    });
    return true;
  }

  if (pathname === '/api/models' && req.method === 'GET') {
    json(res, getModels());
    return true;
  }

  if (pathname === '/api/models/test' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    json(res, await testModel(body.modelType, body.prompt || 'Reply with exactly one word: ok'));
    return true;
  }

  if (pathname === '/api/skills' && req.method === 'GET') {
    json(res, getSkills());
    return true;
  }

  // Task actions
  const taskPause = pathname.match(/^\/api\/tasks\/([^/]+)\/pause$/);
  if (taskPause && req.method === 'PUT') {
    updateTask(taskPause[1], { status: 'paused' });
    json(res, { ok: true });
    return true;
  }

  const taskResume = pathname.match(/^\/api\/tasks\/([^/]+)\/resume$/);
  if (taskResume && req.method === 'PUT') {
    updateTask(taskResume[1], { status: 'active' });
    json(res, { ok: true });
    return true;
  }

  const taskDelete = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskDelete && req.method === 'DELETE') {
    deleteTask(taskDelete[1]);
    json(res, { ok: true });
    return true;
  }

  const taskLogs = pathname.match(/^\/api\/task-logs\/([^/]+)$/);
  if (taskLogs && req.method === 'GET') {
    json(res, getTaskRunLogs(taskLogs[1], 50));
    return true;
  }

  // SSE log stream
  if (pathname === '/api/logs' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();

    // Send last 200 lines immediately
    const recent = tailFile(LOG_FILE, 200);
    for (const line of recent) {
      res.write(`data: ${JSON.stringify(line)}\n\n`);
    }

    sseClients.add(res);

    // Also tail the file in case bioclaw logs don't hit broadcastLogLine
    let filePos = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;
    const watchInterval = setInterval(() => {
      if (!fs.existsSync(LOG_FILE)) return;
      const stat = fs.statSync(LOG_FILE);
      if (stat.size <= filePos) return;
      const fd = fs.openSync(LOG_FILE, 'r');
      const readLen = stat.size - filePos;
      const buf = Buffer.alloc(readLen);
      fs.readSync(fd, buf, 0, readLen, filePos);
      fs.closeSync(fd);
      filePos = stat.size;
      const lines = buf.toString('utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          res.write(`data: ${JSON.stringify(line)}\n\n`);
        } catch {
          /* client disconnected */
        }
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(watchInterval);
      sseClients.delete(res);
    });
    return true;
  }

  return false;
}

function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  const url = new URL(req.url || '/', `http://localhost`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  handleApi(req, res, pathname).then((handled) => {
    if (!handled) {
      if (pathname === '/' && req.method === 'GET') {
        const html = fs.readFileSync(HTML_FILE, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      }
    }
  }).catch((err) => {
    logger.error({ err }, 'Dashboard request error');
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
}

export function startDashboard(): void {
  const server = http.createServer(handleRequest);
  server.listen(DASHBOARD_PORT, '127.0.0.1', () => {
    logger.info({ port: DASHBOARD_PORT }, `Dashboard: http://127.0.0.1:${DASHBOARD_PORT}`);
  });
  server.on('error', (err) => {
    logger.error({ err }, 'Dashboard server error');
  });
}
