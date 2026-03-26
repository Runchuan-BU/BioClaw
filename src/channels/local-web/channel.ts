import fs from 'fs';
import http, { IncomingMessage, ServerResponse } from 'http';
import path from 'path';

import {
  ASSISTANT_NAME,
  DASHBOARD_TOKEN,
  GROUPS_DIR,
  LOCAL_WEB_GROUP_FOLDER,
  LOCAL_WEB_GROUP_JID,
  LOCAL_WEB_GROUP_NAME,
  LOCAL_WEB_HOST,
  LOCAL_WEB_PORT,
  LOCAL_WEB_SECRET,
} from '../../config.js';
import { handleDashboardRoutes, initDashboardTraceBroadcast, shutdownDashboardTraceBroadcast } from '../../dashboard/server.js';
import { getWebVendorScripts } from './vendor-scripts.js';
import { getRecentMessages, getRecentMessagesForChats, storeChatMetadata, storeMessageDirect } from '../../db/index.js';
import { logger } from '../../logger.js';
import { Channel, OnInboundMessage, OnChatMetadata } from '../../types.js';

interface LocalWebChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  getWorkspaceFolder?: (chatJid: string) => string;
  getWorkspaceChatJids?: (chatJid: string) => string[];
  listThreads?: () => Array<{
    chatJid: string;
    title: string;
    workspaceFolder: string;
    addedAt: string;
    lastActivity?: string;
    agentId?: string;
  }>;
  createThread?: (title?: string) => Promise<{
    chatJid: string;
    title: string;
    workspaceFolder: string;
    addedAt: string;
    lastActivity?: string;
    agentId?: string;
  }>;
}

interface IncomingPayload {
  text?: string;
  sender?: string;
  senderName?: string;
  chatJid?: string;
}

const MAX_UPLOAD_BYTES = Math.max(
  1,
  parseInt(process.env.LOCAL_WEB_MAX_UPLOAD_MB || '200', 10) * 1024 * 1024,
);

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

function sanitizeFileName(filename: string): string {
  const basename = path.basename(filename).replace(/[^\w.\-]/g, '_');
  return basename || 'upload.bin';
}

function isSafeRelativePath(relativePath: string): boolean {
  const normalized = path.posix.normalize(relativePath).replace(/^\/+/, '');
  return normalized.length > 0 && !normalized.startsWith('..');
}

export class LocalWebChannel implements Channel {
  name = 'local-web';
  prefixAssistantName = true;

  private server?: http.Server;
  private connected = false;
  private opts: LocalWebChannelOpts;
  /** SSE subscribers for instant UI refresh */
  private readonly sseClients = new Set<ServerResponse>();

  constructor(opts: LocalWebChannelOpts) {
    this.opts = opts;
  }

  private resolveWorkspaceFolder(chatJid: string): string {
    return this.opts.getWorkspaceFolder?.(chatJid) || LOCAL_WEB_GROUP_FOLDER;
  }

  private resolveWorkspaceChatJids(chatJid: string): string[] {
    const related = this.opts.getWorkspaceChatJids?.(chatJid);
    return related && related.length > 0 ? related : [chatJid];
  }

  private buildUploadPaths(
    chatJid: string,
    filename: string,
  ): { relativePath: string; absolutePath: string; publicPath: string } {
    const safeName = sanitizeFileName(filename);
    const storedName = `${Date.now()}-${safeName}`;
    const relativePath = path.posix.join('uploads', storedName);
    const workspaceFolder = this.resolveWorkspaceFolder(chatJid);
    const uploadDir = path.join(GROUPS_DIR, workspaceFolder, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    return {
      relativePath,
      absolutePath: path.join(uploadDir, storedName),
      publicPath: this.buildPublicFilePath(chatJid, relativePath),
    };
  }

  private resolveWorkspacePath(chatJid: string, relativePath: string): string {
    return path.join(GROUPS_DIR, this.resolveWorkspaceFolder(chatJid), relativePath);
  }

  private buildPublicFilePath(chatJid: string, relativePath: string): string {
    return `/files/chat/${encodeURIComponent(chatJid)}/${relativePath}`;
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
    initDashboardTraceBroadcast();
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
    shutdownDashboardTraceBroadcast();
    for (const client of this.sseClients) {
      try {
        client.end();
      } catch {
        /* ignore */
      }
    }
    this.sseClients.clear();
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
    this.notifySse(jid);
  }

  async sendImage(jid: string, imagePath: string, caption?: string): Promise<void> {
    const filename = path.basename(imagePath);
    // Copy image to group dir so it can be served via /files/
    const imagesDir = path.join(GROUPS_DIR, this.resolveWorkspaceFolder(jid), 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    const destPath = path.join(imagesDir, `${Date.now()}-${filename}`);
    fs.copyFileSync(imagePath, destPath);
    const relativePath = path.posix.join('images', path.basename(destPath));
    const webPath = this.buildPublicFilePath(jid, relativePath);
    const content = caption
      ? `${caption}\n\n![${caption}](${webPath})`
      : `![image](${webPath})`;
    await this.sendMessage(jid, content);
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    const handled = await handleDashboardRoutes(req, res, url, 'merged');
    if (handled) return;

    // ── Static assets ──
    if (req.method === 'GET' && url.pathname === '/vendor/marked.umd.js') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.end(getWebVendorScripts().marked);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/vendor/purify.min.js') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.end(getWebVendorScripts().purify);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
      this.serveStaticAsset(url.pathname, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/favicon.jpg') {
      this.serveFile(path.resolve('bioclaw_logo.jpg'), 'image/jpeg', res, 604800);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      this.serveStaticAsset('/assets/index.html', res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const streamQs = DASHBOARD_TOKEN ? `?token=${encodeURIComponent(DASHBOARD_TOKEN)}` : '';
      sendJson(res, 200, {
        chatJid: LOCAL_WEB_GROUP_JID,
        assistantName: ASSISTANT_NAME,
        authToken: DASHBOARD_TOKEN || '',
        streamQs,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/threads') {
      const threads = this.opts.listThreads?.() || [
        {
          chatJid: LOCAL_WEB_GROUP_JID,
          title: LOCAL_WEB_GROUP_NAME,
          workspaceFolder: this.resolveWorkspaceFolder(LOCAL_WEB_GROUP_JID),
          addedAt: new Date().toISOString(),
        },
      ];
      sendJson(res, 200, { threads });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/threads') {
      if (!this.opts.createThread) {
        sendJson(res, 501, { error: 'Thread creation not supported' });
        return;
      }
      const body = (await readBody(req)).toString('utf-8');
      const payload = JSON.parse(body || '{}') as { title?: string };
      const thread = await this.opts.createThread(payload.title);
      sendJson(res, 200, { ok: true, thread });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      const chatJid = url.searchParams.get('chatJid') || LOCAL_WEB_GROUP_JID;
      this.wireSse(res, chatJid);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/messages') {
      const chatJid = url.searchParams.get('chatJid') || LOCAL_WEB_GROUP_JID;
      const scope = url.searchParams.get('scope') || 'chat';
      const chatJids = scope === 'workspace'
        ? this.resolveWorkspaceChatJids(chatJid)
        : [chatJid];
      sendJson(
        res,
        200,
        {
          messages: chatJids.length > 1
            ? getRecentMessagesForChats(chatJids, 100)
            : getRecentMessages(chatJid, 100),
        },
      );
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/files/chat/')) {
      const relative = url.pathname.slice('/files/chat/'.length);
      const slash = relative.indexOf('/');
      if (slash === -1) {
        sendJson(res, 400, { error: 'Invalid file path' });
        return;
      }
      const encodedChatJid = relative.slice(0, slash);
      const chatJid = decodeURIComponent(encodedChatJid);
      const relativePath = relative.slice(slash + 1);
      if (!isSafeRelativePath(relativePath)) {
        sendJson(res, 400, { error: 'Invalid file path' });
        return;
      }
      const workspaceRoot = path.join(GROUPS_DIR, this.resolveWorkspaceFolder(chatJid));
      const absolutePath = path.join(workspaceRoot, relativePath);
      if (!absolutePath.startsWith(workspaceRoot)) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
      }
      if (!fs.existsSync(absolutePath)) {
        sendJson(res, 404, { error: 'File not found' });
        return;
      }
      const ext = path.extname(absolutePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
      };
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.end(fs.readFileSync(absolutePath));
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const relativePath = url.pathname.slice('/files/'.length);
      if (!isSafeRelativePath(relativePath)) {
        sendJson(res, 400, { error: 'Invalid file path' });
        return;
      }
      const workspaceRoot = path.join(GROUPS_DIR, this.resolveWorkspaceFolder(LOCAL_WEB_GROUP_JID));
      const absolutePath = path.join(workspaceRoot, relativePath);
      if (!absolutePath.startsWith(workspaceRoot)) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
      }
      if (!fs.existsSync(absolutePath)) {
        sendJson(res, 404, { error: 'File not found' });
        return;
      }
      const ext = path.extname(absolutePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
      };
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
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
      const paths = this.buildUploadPaths(chatJid, originalName);
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
    this.notifySse(chatJid);
  }

  private wireSse(res: ServerResponse, chatJid: string): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    res.write(`data: ${JSON.stringify({ type: 'hello', chatJid })}\n\n`);

    this.sseClients.add(res);
    const hb = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(hb);
      }
    }, 25_000);
    res.on('close', () => {
      clearInterval(hb);
      this.sseClients.delete(res);
    });
  }

  private notifySse(chatJid: string): void {
    const line = `data: ${JSON.stringify({ type: 'messages', chatJid })}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(line);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  notifyExternalUpdate(_chatJid: string): void {
    this.notifySse(LOCAL_WEB_GROUP_JID);
  }

  private static readonly ASSETS_DIR = path.join('src', 'channels', 'local-web', 'assets');
  private static readonly MIME_MAP: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };

  private serveStaticAsset(pathname: string, res: ServerResponse): void {
    // pathname is e.g. "/assets/style.css" → resolve to "src/channels/local-web/assets/style.css"
    const relative = pathname.replace(/^\/assets\//, '');
    if (relative.includes('..')) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    const filePath = path.join(LocalWebChannel.ASSETS_DIR, relative);
    this.serveFile(
      filePath,
      LocalWebChannel.MIME_MAP[path.extname(filePath)] || 'application/octet-stream',
      res,
      0, // no cache — assets are small, avoid stale JS/CSS during development
    );
  }

  private serveFile(filePath: string, contentType: string, res: ServerResponse, maxAge = 0): void {
    try {
      const buf = fs.readFileSync(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      if (maxAge > 0) res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      res.end(buf);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  }
}
