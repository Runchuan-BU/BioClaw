import fs from 'fs';
import http, { IncomingMessage, ServerResponse } from 'http';
import path from 'path';

import {
  ASSISTANT_NAME,
  GROUPS_DIR,
  LOCAL_WEB_GROUP_FOLDER,
  LOCAL_WEB_GROUP_JID,
  LOCAL_WEB_HOST,
  LOCAL_WEB_PORT,
  LOCAL_WEB_SECRET,
} from '../config.js';
import { getRecentMessages, storeChatMetadata, storeMessageDirect } from '../db.js';
import { logger } from '../logger.js';
import { Channel, OnInboundMessage, OnChatMetadata } from '../types.js';

interface LocalWebChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
}

interface IncomingPayload {
  text?: string;
  sender?: string;
  senderName?: string;
  chatJid?: string;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      size += buffer.length;
      if (size > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFileName(filename: string): string {
  const basename = path.basename(filename).replace(/[^\w.\-]/g, '_');
  return basename || 'upload.bin';
}

function ensureUploadDir(): string {
  const uploadDir = path.join(GROUPS_DIR, LOCAL_WEB_GROUP_FOLDER, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

function buildUploadPaths(filename: string): { relativePath: string; absolutePath: string; publicPath: string } {
  const safeName = sanitizeFileName(filename);
  const storedName = `${Date.now()}-${safeName}`;
  const relativePath = path.posix.join('uploads', storedName);
  return {
    relativePath,
    absolutePath: path.join(ensureUploadDir(), storedName),
    publicPath: `/files/${relativePath}`,
  };
}

function isSafeRelativePath(relativePath: string): boolean {
  const normalized = path.posix.normalize(relativePath).replace(/^\/+/, '');
  return normalized.length > 0 && !normalized.startsWith('..');
}

function renderPage(chatJid: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BioClaw Local Web Chat</title>
  <style>
    :root {
      --bg: #f4efe4;
      --panel: rgba(255, 250, 242, 0.92);
      --ink: #1b1a17;
      --muted: #6f665b;
      --accent: #1f6f5f;
      --accent-2: #c96d38;
      --line: rgba(27, 26, 23, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(201, 109, 56, 0.18), transparent 32%),
        radial-gradient(circle at top right, rgba(31, 111, 95, 0.2), transparent 30%),
        linear-gradient(160deg, #f7f2e9 0%, #efe4d4 100%);
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .app {
      width: min(980px, 100%);
      height: min(92vh, 900px);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 28px;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto 1fr auto;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 60px rgba(78, 58, 38, 0.18);
    }
    .header {
      padding: 24px 24px 18px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(31,111,95,0.08), rgba(201,109,56,0.08));
    }
    .header h1 {
      margin: 0;
      font-size: clamp(26px, 4vw, 40px);
      line-height: 1;
      letter-spacing: -0.04em;
    }
    .sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }
    .messages {
      padding: 22px;
      overflow: auto;
      display: grid;
      gap: 12px;
      align-content: start;
    }
    .bubble {
      max-width: min(82%, 760px);
      border-radius: 20px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      white-space: pre-wrap;
      word-break: break-word;
      animation: rise .18s ease-out;
    }
    .bubble.user {
      justify-self: end;
      background: #1f6f5f;
      color: #fffaf1;
      border-color: transparent;
    }
    .bubble.bot {
      justify-self: start;
      background: #fffaf1;
    }
    .meta {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .content {
      display: grid;
      gap: 10px;
    }
    .content a {
      color: inherit;
    }
    .file-card {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.72);
      border: 1px solid var(--line);
      color: var(--ink);
    }
    .bubble.user .file-card {
      background: rgba(255,255,255,0.16);
      border-color: rgba(255,255,255,0.18);
      color: #fffaf1;
    }
    .file-title {
      font-weight: 700;
      font-size: 15px;
    }
    .file-path {
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 12px;
      opacity: 0.8;
      word-break: break-all;
    }
    .file-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .file-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 0 14px;
      border-radius: 999px;
      text-decoration: none;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.88);
      color: var(--ink);
    }
    .bubble.user .file-button {
      background: rgba(255,255,255,0.14);
      color: #fffaf1;
      border-color: rgba(255,255,255,0.22);
    }
    .preview {
      max-width: min(100%, 420px);
      max-height: 260px;
      border-radius: 14px;
      object-fit: cover;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.5);
    }
    form {
      border-top: 1px solid var(--line);
      padding: 18px;
      display: grid;
      gap: 12px;
      background: rgba(255,255,255,0.35);
    }
    textarea {
      width: 100%;
      min-height: 110px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px 16px;
      font: inherit;
      background: rgba(255,255,255,0.9);
    }
    .row {
      display: flex;
      gap: 12px;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }
    .hint {
      color: var(--muted);
      font-size: 13px;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .upload {
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 11px 16px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.86);
      cursor: pointer;
    }
    .upload input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .filename {
      color: var(--muted);
      font-size: 13px;
    }
    .status {
      min-height: 18px;
      color: var(--muted);
      font-size: 13px;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      font: inherit;
      background: linear-gradient(135deg, var(--accent), #0f4e43);
      color: white;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    @keyframes rise {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="header">
      <h1>BioClaw Local Web Chat</h1>
      <div class="sub">本地网页聊天入口，适合 Windows + 中国网络环境先验证 BioClaw。当前会话：${escapeHtml(chatJid)}</div>
    </section>
    <section id="messages" class="messages"></section>
    <form id="composer">
      <textarea id="text" placeholder="直接输入你的生物信息学问题，例如：分析 DNA 序列并找 ORF"></textarea>
      <div class="row">
        <div class="hint">如果当前群组未要求触发词，可直接发送；默认本地网页聊天不需要 @${escapeHtml(ASSISTANT_NAME)}。</div>
        <div class="toolbar">
          <label class="upload">
            <span>上传文件</span>
            <input id="file" type="file">
          </label>
          <span id="filename" class="filename">未选择文件</span>
          <button id="send" type="submit">发送</button>
        </div>
      </div>
      <div id="status" class="status"></div>
    </form>
  </main>
  <script>
    const chatJid = ${JSON.stringify(chatJid)};
    const messagesEl = document.getElementById('messages');
    const form = document.getElementById('composer');
    const input = document.getElementById('text');
    const fileInput = document.getElementById('file');
    const fileNameEl = document.getElementById('filename');
    const sendBtn = document.getElementById('send');
    const statusEl = document.getElementById('status');
    let lastSignature = '';

    function render(messages) {
      const signature = JSON.stringify(messages.map(m => [m.id, m.timestamp, m.content]));
      if (signature === lastSignature) return;
      lastSignature = signature;
      messagesEl.innerHTML = messages.map((msg) => {
        const kind = msg.is_from_me ? 'bot' : 'user';
        const name = msg.is_from_me ? ${JSON.stringify(ASSISTANT_NAME)} : (msg.sender_name || 'User');
        return '<article class="bubble ' + kind + '">' +
          '<div class="meta">' + escapeHtml(name) + ' · ' + escapeHtml(msg.timestamp) + '</div>' +
          '<div class="content">' + renderBody(msg.content) + '</div>' +
        '</article>';
      }).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderBody(text) {
      const upload = parseUploadMessage(text);
      if (upload) {
        return renderUploadCard(upload);
      }
      return escapeHtml(text)
        .replace(/(\\/files\\/[\\w./%-]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
        .replace(/\\n/g, '<br>');
    }

    function parseUploadMessage(text) {
      const lines = String(text).split('\\n');
      const fileLine = lines.find((line) => line.startsWith('Uploaded file: '));
      const workspaceLine = lines.find((line) => line.startsWith('Workspace path: '));
      const previewLine = lines.find((line) => line.startsWith('Preview URL: '));
      if (!fileLine || !workspaceLine || !previewLine) return null;
      return {
        filename: fileLine.slice('Uploaded file: '.length),
        workspacePath: workspaceLine.slice('Workspace path: '.length),
        previewUrl: previewLine.slice('Preview URL: '.length),
      };
    }

    function renderUploadCard(file) {
      const escapedName = escapeHtml(file.filename);
      const escapedPath = escapeHtml(file.workspacePath);
      const escapedPreview = escapeHtml(file.previewUrl);
      const isImage = /\\.(png|jpe?g|gif|webp|svg)$/i.test(file.filename);
      const preview = isImage
        ? '<img class="preview" src="' + escapedPreview + '" alt="' + escapedName + '">'
        : '';
      return [
        '<section class="file-card">',
        '<div class="file-title">已上传文件 · ' + escapedName + '</div>',
        '<div class="file-path">工作区路径：' + escapedPath + '</div>',
        preview,
        '<div class="file-actions">',
        '<a class="file-button" href="' + escapedPreview + '" target="_blank" rel="noreferrer">预览</a>',
        '<a class="file-button" href="' + escapedPreview + '" download>下载</a>',
        '</div>',
        '</section>',
      ].join('');
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function setStatus(text) {
      statusEl.textContent = text || '';
    }

    async function refresh() {
      const res = await fetch('/api/messages?chatJid=' + encodeURIComponent(chatJid));
      if (!res.ok) return;
      const data = await res.json();
      render(data.messages || []);
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileNameEl.textContent = file ? file.name : '未选择文件';
    });

    async function uploadSelectedFile() {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return null;

      setStatus('正在上传文件...');
      const res = await fetch('/api/upload?chatJid=' + encodeURIComponent(chatJid), {
        method: 'POST',
        headers: {
          'x-file-name': encodeURIComponent(file.name),
          'content-type': file.type || 'application/octet-stream'
        },
        body: file
      });
      if (!res.ok) {
        throw new Error('文件上传失败');
      }
      const data = await res.json();
      fileInput.value = '';
      fileNameEl.textContent = '未选择文件';
      return data;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      const file = fileInput.files && fileInput.files[0];
      if (!text && !file) return;
      sendBtn.disabled = true;
      try {
        if (file) {
          await uploadSelectedFile();
        }
        if (text) {
          const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatJid, text })
          });
          if (!res.ok) {
            throw new Error('消息发送失败');
          }
          input.value = '';
        }
        setStatus('');
        await refresh();
      } finally {
        sendBtn.disabled = false;
      }
    });

    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>`;
}

export class LocalWebChannel implements Channel {
  name = 'local-web';
  prefixAssistantName = true;

  private server?: http.Server;
  private connected = false;
  private opts: LocalWebChannelOpts;

  constructor(opts: LocalWebChannelOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    if (this.server) return;

    this.server = http.createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res);
      } catch (err) {
        logger.error({ err }, 'Local web request failed');
        sendJson(res, 500, { error: 'Internal server error' });
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(LOCAL_WEB_PORT, LOCAL_WEB_HOST, () => {
        this.server!.off('error', reject);
        resolve();
      });
    });

    this.connected = true;
    logger.info(
      { host: LOCAL_WEB_HOST, port: LOCAL_WEB_PORT, jid: LOCAL_WEB_GROUP_JID },
      'Local web channel listening',
    );
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.endsWith('@local.web');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()));
    });
    this.server = undefined;
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const now = new Date().toISOString();
    storeChatMetadata(jid, now, jid);
    storeMessageDirect({
      id: `local-web-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chat_jid: jid,
      sender: 'bioclaw@local.web',
      sender_name: ASSISTANT_NAME,
      content: text,
      timestamp: now,
      is_from_me: true,
    });
  }

  async sendImage(jid: string, imagePath: string, caption?: string): Promise<void> {
    const filename = path.basename(imagePath);
    const fallback = caption
      ? `${caption}\n[Image generated: ${filename}]`
      : `[Image generated: ${filename}]`;
    await this.sendMessage(jid, fallback);
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderPage(LOCAL_WEB_GROUP_JID));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/messages') {
      const chatJid = url.searchParams.get('chatJid') || LOCAL_WEB_GROUP_JID;
      sendJson(res, 200, { messages: getRecentMessages(chatJid, 100) });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const relativePath = url.pathname.slice('/files/'.length);
      if (!isSafeRelativePath(relativePath)) {
        sendJson(res, 400, { error: 'Invalid file path' });
        return;
      }
      const absolutePath = path.join(GROUPS_DIR, LOCAL_WEB_GROUP_FOLDER, relativePath);
      if (!absolutePath.startsWith(path.join(GROUPS_DIR, LOCAL_WEB_GROUP_FOLDER))) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
      }
      if (!fs.existsSync(absolutePath)) {
        sendJson(res, 404, { error: 'File not found' });
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.end(fs.readFileSync(absolutePath));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/messages') {
      const body = (await readBody(req)).toString('utf-8');
      const payload = JSON.parse(body || '{}') as IncomingPayload;
      await this.acceptInbound(payload.chatJid || LOCAL_WEB_GROUP_JID, payload.text || '', 'web-user@local.web', 'Web User');
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const chatJid = url.searchParams.get('chatJid') || LOCAL_WEB_GROUP_JID;
      const fileNameHeader = req.headers['x-file-name'];
      const originalName = typeof fileNameHeader === 'string'
        ? decodeURIComponent(fileNameHeader)
        : 'upload.bin';
      const body = await readBody(req, MAX_UPLOAD_BYTES);
      if (body.length === 0) {
        sendJson(res, 400, { error: 'Empty file upload' });
        return;
      }
      const paths = buildUploadPaths(originalName);
      fs.writeFileSync(paths.absolutePath, body);
      await this.acceptInbound(
        chatJid,
        [
          `Uploaded file: ${originalName}`,
          `Workspace path: ${paths.relativePath}`,
          `Preview URL: ${paths.publicPath}`,
        ].join('\n'),
        'web-user@local.web',
        'Web User',
      );
      sendJson(res, 200, {
        ok: true,
        filename: originalName,
        workspacePath: paths.relativePath,
        publicPath: paths.publicPath,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhook') {
      if (LOCAL_WEB_SECRET) {
        const supplied = req.headers['x-bioclaw-secret'];
        if (supplied !== LOCAL_WEB_SECRET) {
          sendJson(res, 403, { error: 'Forbidden' });
          return;
        }
      }
      const body = (await readBody(req)).toString('utf-8');
      const payload = JSON.parse(body || '{}') as IncomingPayload;
      await this.acceptInbound(
        payload.chatJid || LOCAL_WEB_GROUP_JID,
        payload.text || '',
        payload.sender || 'webhook-user@local.web',
        payload.senderName || 'Webhook User',
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  }

  private async acceptInbound(
    chatJid: string,
    text: string,
    sender: string,
    senderName: string,
  ): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    this.opts.onChatMetadata(chatJid, now, 'Local Web Chat');
    this.opts.onMessage(chatJid, {
      id: `local-web-in-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chat_jid: chatJid,
      sender,
      sender_name: senderName,
      content: trimmed,
      timestamp: now,
      is_from_me: false,
    });
  }
}
