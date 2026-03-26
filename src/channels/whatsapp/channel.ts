import fs from 'fs';
import path from 'path';

import makeWASocket, {
  DisconnectReason,
  WASocket,
  WAMessage,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

import {
  ALLOW_WHATSAPP_SELF_MESSAGES,
  ASSISTANT_NAME,
  GROUPS_DIR,
  STORE_DIR,
} from '../../config.js';
import {
  getLastGroupSync,
  setLastGroupSync,
  updateChatName,
} from '../../db/index.js';
import { logger } from '../../logger.js';
import { getWhatsAppBrowser, notifyAuthRequired } from '../../platform.js';
import { Channel, OnInboundMessage, OnChatMetadata, RegisteredGroup } from '../../types.js';
import { getWorkspaceFolder } from '../../workspace.js';

const GROUP_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface WhatsAppChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  autoRegister?: (jid: string, name: string, channelName: string) => void;
}

export class WhatsAppChannel implements Channel {
  name = 'whatsapp';
  prefixAssistantName = true;

  private sock!: WASocket;
  private connected = false;
  private lidToPhoneMap: Record<string, string> = {};
  private outgoingQueue: Array<{ jid: string; text: string }> = [];
  private flushing = false;
  private groupSyncTimerStarted = false;

  private opts: WhatsAppChannelOpts;

  constructor(opts: WhatsAppChannelOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.connectInternal(resolve).catch(reject);
    });
  }

  private async connectInternal(onFirstOpen?: () => void): Promise<void> {
    const authDir = path.join(STORE_DIR, 'auth');
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    let version: [number, number, number] | undefined;
    try {
      const versionInfo = await fetchLatestBaileysVersion();
      version = versionInfo.version;
      logger.info({ version: version.join('.') }, 'Using WhatsApp version');
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch latest WhatsApp version, using default');
    }

    this.sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      ...(version ? { version } : {}),
      printQRInTerminal: false,
      logger,
      browser: getWhatsAppBrowser('Chrome'),
      // Disable history sync to avoid 20s AwaitingInitialSync timeout and "forcing state to Online" WARN.
      // Bot mainly handles new messages; history sync can block startup on slow networks.
      shouldSyncHistoryMessage: () => false,
    });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const msg =
          'WhatsApp authentication required. Run /setup in Claude Code.';
        logger.error(msg);
        notifyAuthRequired(msg);
        setTimeout(() => process.exit(1), 1000);
      }

      if (connection === 'close') {
        this.connected = false;
        const reason = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        logger.info({ reason, shouldReconnect, queuedMessages: this.outgoingQueue.length }, 'Connection closed');

        if (shouldReconnect) {
          logger.info('Reconnecting...');
          this.connectInternal().catch((err) => {
            logger.error({ err }, 'Failed to reconnect, retrying in 5s');
            setTimeout(() => {
              this.connectInternal().catch((err2) => {
                logger.error({ err: err2 }, 'Reconnection retry failed');
              });
            }, 5000);
          });
        } else {
          logger.info('Logged out. Run /setup to re-authenticate.');
          process.exit(0);
        }
      } else if (connection === 'open') {
        this.connected = true;
        logger.info('Connected to WhatsApp');

        // Build LID to phone mapping from auth state for self-chat translation
        if (this.sock.user) {
          const phoneUser = this.sock.user.id.split(':')[0];
          const lidUser = this.sock.user.lid?.split(':')[0];
          if (lidUser && phoneUser) {
            this.lidToPhoneMap[lidUser] = `${phoneUser}@s.whatsapp.net`;
            logger.debug({ lidUser, phoneUser }, 'LID to phone mapping set');
          }
        }

        // Flush any messages queued while disconnected
        this.flushOutgoingQueue().catch((err) =>
          logger.error({ err }, 'Failed to flush outgoing queue'),
        );

        // Sync group metadata on startup (respects 24h cache)
        this.syncGroupMetadata().catch((err) =>
          logger.error({ err }, 'Initial group sync failed'),
        );
        // Set up daily sync timer (only once)
        if (!this.groupSyncTimerStarted) {
          this.groupSyncTimerStarted = true;
          setInterval(() => {
            this.syncGroupMetadata().catch((err) =>
              logger.error({ err }, 'Periodic group sync failed'),
            );
          }, GROUP_SYNC_INTERVAL_MS);
        }

        // Signal first connection to caller
        if (onFirstOpen) {
          onFirstOpen();
          onFirstOpen = undefined;
        }
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message) continue;
        const rawJid = msg.key.remoteJid;
        if (!rawJid || rawJid === 'status@broadcast') continue;

        // Translate LID JID to phone JID if applicable
        const chatJid = await this.translateJid(rawJid);

        const timestamp = new Date(
          Number(msg.messageTimestamp) * 1000,
        ).toISOString();
        const sender = msg.key.participant || msg.key.remoteJid || '';
        const senderName = msg.pushName || sender.split('@')[0] || chatJid.split('@')[0];
        const isGroup = rawJid.endsWith('@g.us');
        const chatName = isGroup
          ? `WhatsApp Group ${chatJid.slice(-8)}`
          : `WhatsApp DM ${senderName}`;

        // Always notify about chat metadata for group discovery
        this.opts.onChatMetadata(chatJid, timestamp, chatName);

        // Only deliver full message for registered groups
        let groups = this.opts.registeredGroups();
        if (!groups[chatJid] && this.opts.autoRegister) {
          this.opts.autoRegister(chatJid, chatName, 'whatsapp');
          groups = this.opts.registeredGroups();
        }

        if (groups[chatJid]) {
          const content = await this.buildInboundContent(
            chatJid,
            msg,
            getWorkspaceFolder(groups[chatJid]),
          );
          const isBotEcho =
            Boolean(msg.key.fromMe) &&
            content.trim().startsWith(`${ASSISTANT_NAME}:`);
          const allowSelfMessage =
            ALLOW_WHATSAPP_SELF_MESSAGES &&
            Boolean(msg.key.fromMe) &&
            !isBotEcho;

          this.opts.onMessage(chatJid, {
            id: msg.key.id || '',
            chat_jid: chatJid,
            sender,
            sender_name: senderName,
            content,
            timestamp,
            // Debug mode: allow manually sent self-messages to enter the agent,
            // but keep bot echoes filtered to avoid self-trigger loops.
            is_from_me: allowSelfMessage ? false : msg.key.fromMe || false,
          });
        } else {
          logger.info({ chatJid }, 'WhatsApp message from unregistered conversation, ignored');
        }
      }
    });
  }

  private async buildInboundContent(
    chatJid: string,
    msg: WAMessage,
    groupFolder: string,
  ): Promise<string> {
    const textContent =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.videoMessage?.caption ||
      '';

    const imageCaption = msg.message?.imageMessage?.caption || '';
    const imagePath = await this.saveInboundImage(chatJid, msg, groupFolder);
    if (!imagePath) {
      return textContent || imageCaption || '';
    }

    const parts = [`[Image attached: ${imagePath}]`];
    if (imageCaption) parts.push(`Image caption: ${imageCaption}`);
    if (textContent) parts.push(textContent);
    return parts.join('\n');
  }

  private async saveInboundImage(
    chatJid: string,
    msg: WAMessage,
    groupFolder: string,
  ): Promise<string | null> {
    if (!msg.message?.imageMessage) return null;

    try {
      const imageBuffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger, reuploadRequest: this.sock.updateMediaMessage },
      );
      const ext = this.imageExtensionFromMime(msg.message.imageMessage.mimetype ?? undefined);
      const filename = `${msg.key.id || Date.now().toString()}${ext}`;
      const uploadsDir = path.join(GROUPS_DIR, groupFolder, 'uploads');
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, filename), imageBuffer);
      const containerPath = `/workspace/group/uploads/${filename}`;
      logger.info({ chatJid, containerPath }, 'Saved inbound WhatsApp image');
      return containerPath;
    } catch (err) {
      logger.error({ chatJid, err }, 'Failed to save inbound WhatsApp image');
      return null;
    }
  }

  private imageExtensionFromMime(mimetype?: string): string {
    switch (mimetype) {
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      case 'image/jpeg':
      default:
        return '.jpg';
    }
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.connected) {
      this.outgoingQueue.push({ jid, text });
      logger.info({ jid, length: text.length, queueSize: this.outgoingQueue.length }, 'WA disconnected, message queued');
      return;
    }
    try {
      await this.sock.sendMessage(jid, { text });
      logger.info({ jid, length: text.length }, 'Message sent');
    } catch (err) {
      // If send fails, queue it for retry on reconnect
      this.outgoingQueue.push({ jid, text });
      logger.warn({ jid, err, queueSize: this.outgoingQueue.length }, 'Failed to send, message queued');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.endsWith('@g.us') || jid.endsWith('@s.whatsapp.net');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.sock?.end(undefined);
  }

  async sendImage(jid: string, imagePath: string, caption?: string): Promise<void> {
    if (!this.connected) {
      logger.warn({ jid, imagePath }, 'WA disconnected, image not sent');
      return;
    }
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      await this.sock.sendMessage(jid, { image: imageBuffer, caption: caption || undefined });
      logger.info({ jid, imagePath, caption: caption?.slice(0, 50) }, 'Image sent');
    } catch (err) {
      logger.error({ jid, imagePath, err }, 'Failed to send image');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    try {
      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to update typing status');
    }
  }

  /**
   * Sync group metadata from WhatsApp.
   * Fetches all participating groups and stores their names in the database.
   * Called on startup, daily, and on-demand via IPC.
   */
  async syncGroupMetadata(force = false): Promise<void> {
    if (!force) {
      const lastSync = getLastGroupSync();
      if (lastSync) {
        const lastSyncTime = new Date(lastSync).getTime();
        if (Date.now() - lastSyncTime < GROUP_SYNC_INTERVAL_MS) {
          logger.debug({ lastSync }, 'Skipping group sync - synced recently');
          return;
        }
      }
    }

    try {
      logger.info('Syncing group metadata from WhatsApp...');
      const groups = await this.sock.groupFetchAllParticipating();

      let count = 0;
      for (const [jid, metadata] of Object.entries(groups)) {
        if (metadata.subject) {
          updateChatName(jid, metadata.subject);
          count++;
        }
      }

      setLastGroupSync();
      logger.info({ count }, 'Group metadata synced');
    } catch (err) {
      logger.error({ err }, 'Failed to sync group metadata');
    }
  }

  private async translateJid(jid: string): Promise<string> {
    if (!jid.endsWith('@lid')) return jid;
    const lidUser = jid.split('@')[0].split(':')[0];

    // Check local cache first
    const cached = this.lidToPhoneMap[lidUser];
    if (cached) {
      logger.debug({ lidJid: jid, phoneJid: cached }, 'Translated LID to phone JID (cached)');
      return cached;
    }

    // Query Baileys' signal repository for the mapping
    try {
      const pn = await this.sock.signalRepository?.lidMapping?.getPNForLID(jid);
      if (pn) {
        const phoneJid = `${pn.split('@')[0].split(':')[0]}@s.whatsapp.net`;
        this.lidToPhoneMap[lidUser] = phoneJid;
        logger.info({ lidJid: jid, phoneJid }, 'Translated LID to phone JID (signalRepository)');
        return phoneJid;
      }
    } catch (err) {
      logger.debug({ err, jid }, 'Failed to resolve LID via signalRepository');
    }

    return jid;
  }

  private async flushOutgoingQueue(): Promise<void> {
    if (this.flushing || this.outgoingQueue.length === 0) return;
    this.flushing = true;
    try {
      logger.info({ count: this.outgoingQueue.length }, 'Flushing outgoing message queue');
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue.shift()!;
        await this.sendMessage(item.jid, item.text);
      }
    } finally {
      this.flushing = false;
    }
  }
}
