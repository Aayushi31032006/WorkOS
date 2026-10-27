/**
 * @license
 * WorkOS Internal Communication System
 * SDK Client & Engine with real-time listeners, tenant isolation,
 * RBAC validation, idempotency, signed attachments, and audit logging.
 */

import {
  AuditEvent,
  Channel,
  Message,
  TokenClaims,
  User,
  WebhookEvent,
  WorkOSObjectRef,
} from '../contracts/types';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_CHANNELS,
  INITIAL_MESSAGES,
  MOCK_TOKENS,
  SYNTHETIC_USERS,
} from '../test-fixtures/fixtures';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

type EventListener = (data: any) => void;

class CommunicationEngine {
  private channels: Channel[] = [...INITIAL_CHANNELS];
  private messages: Message[] = [...INITIAL_MESSAGES];
  private auditLogs: AuditEvent[] = [...INITIAL_AUDIT_LOGS];
  private webhookLogs: WebhookEvent[] = [];
  private processedIdempotencyKeys = new Set<string>();
  private listeners: Map<string, Set<EventListener>> = new Map();
  private connectionStatus: ConnectionStatus = 'connected';

  constructor() {
    // Try to load any saved demo state from sessionStorage or fallback to initial
    try {
      const saved = sessionStorage.getItem('workos_comm_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.channels && parsed.messages) {
          this.channels = parsed.channels;
          this.messages = parsed.messages;
          if (parsed.auditLogs) this.auditLogs = parsed.auditLogs;
        }
      }
    } catch {
      // Ignore storage errors in sandbox
    }
  }

  private persist() {
    try {
      sessionStorage.setItem(
        'workos_comm_state_v1',
        JSON.stringify({
          channels: this.channels,
          messages: this.messages,
          auditLogs: this.auditLogs,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.emit('connection.changed', status);
  }

  public subscribe(event: string, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: string, data: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error('Listener error for', event, err);
        }
      });
    }
  }

  private emitWebhook(
    event: 'message.created' | 'mention.created' | 'channel.created' | 'thread.reply_created',
    company_id: string,
    payload: Record<string, unknown>
  ) {
    const webhook: WebhookEvent = {
      id: `whk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event,
      company_id,
      timestamp: new Date().toISOString(),
      signature: `sha256=${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      payload,
    };
    this.webhookLogs.unshift(webhook);
    this.emit('webhook.dispatched', webhook);
  }

  /**
   * Verify token claims and tenant isolation.
   * Throws 401 or 403 error on failure.
   */
  public verifyToken(claims: TokenClaims): void {
    if (!claims || !claims.company_id || !claims.sub) {
      throw new Error('401 Unauthorized: Invalid or missing token claims');
    }
    if (claims.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('401 Unauthorized: Token has expired');
    }
  }

  /**
   * Fetch all channels accessible to user within their tenant company
   */
  public getChannels(claims: TokenClaims): Channel[] {
    this.verifyToken(claims);

    // Tenant Isolation: Only return channels belonging to the user's company
    const tenantChannels = this.channels.filter((c) => c.company_id === claims.company_id);

    // Enforce channel membership:
    // Public/company channels are visible to all company members
    // Private channels are only visible to explicit members
    return tenantChannels.filter((c) => {
      if (c.type === 'private' || c.type === 'direct') {
        return c.member_ids.includes(claims.sub);
      }
      return true;
    });
  }

  /**
   * Fetch messages for a specific channel with tenant & membership enforcement
   */
  public getMessages(
    claims: TokenClaims,
    channelId: string,
    parentMessageId?: string
  ): Message[] {
    this.verifyToken(claims);

    const channel = this.channels.find((c) => c.id === channelId);
    if (!channel) {
      throw new Error('404 Not Found: Channel does not exist');
    }

    // Tenant Isolation Check
    if (channel.company_id !== claims.company_id) {
      this.recordAudit(
        claims.company_id,
        claims.sub,
        claims.name,
        'security.cross_company_read_attempt',
        'channel',
        channelId,
        { targetCompany: channel.company_id }
      );
      throw new Error(
        `403 Forbidden: Cross-company access rejected. Tenant mismatch: ${claims.company_id} !== ${channel.company_id}`
      );
    }

    // Membership Check for private/direct
    if (
      (channel.type === 'private' || channel.type === 'direct') &&
      !channel.member_ids.includes(claims.sub)
    ) {
      throw new Error('403 Forbidden: You are not a member of this private conversation');
    }

    // Return messages or thread replies
    return this.messages.filter((m) => {
      if (m.company_id !== claims.company_id || m.channel_id !== channelId) return false;
      if (parentMessageId) {
        return m.parent_message_id === parentMessageId;
      }
      return !m.parent_message_id; // top-level messages
    });
  }

  /**
   * Post message with idempotency, permission check, mentions, and object refs
   */
  public sendMessage(
    claims: TokenClaims,
    payload: {
      channel_id: string;
      content: string;
      attachments?: Message['attachments'];
      object_refs?: WorkOSObjectRef[];
      mentions?: string[];
      parent_message_id?: string;
      idempotency_key?: string;
    }
  ): Message {
    this.verifyToken(claims);

    // Permission check
    if (!claims.permissions.includes('communication.message.send')) {
      throw new Error('403 Forbidden: Missing communication.message.send permission');
    }

    const channel = this.channels.find((c) => c.id === payload.channel_id);
    if (!channel) throw new Error('404 Not Found: Channel not found');

    // Tenant check
    if (channel.company_id !== claims.company_id) {
      throw new Error('403 Forbidden: Cross-company write attempt rejected');
    }

    // Announcement channel restriction
    if (
      channel.announcement_only &&
      !claims.permissions.includes('communication.announcement.publish')
    ) {
      throw new Error(
        '403 Forbidden: Only authorized announcers can publish in this channel'
      );
    }

    // Idempotency check: if already processed, return existing message
    if (payload.idempotency_key && this.processedIdempotencyKeys.has(payload.idempotency_key)) {
      const existing = this.messages.find((m) => m.idempotency_key === payload.idempotency_key);
      if (existing) return existing;
    }

    if (payload.idempotency_key) {
      this.processedIdempotencyKeys.add(payload.idempotency_key);
    }

    // Derive initials
    const initials = claims.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      company_id: claims.company_id,
      channel_id: payload.channel_id,
      sender_id: claims.sub,
      sender_name: claims.name,
      sender_initials: initials,
      sender_avatar: claims.avatar_url,
      content: payload.content,
      created_at: new Date().toISOString(),
      thread_count: 0,
      reactions: [],
      attachments: payload.attachments || [],
      object_refs: payload.object_refs || [],
      mentions: payload.mentions || [],
      parent_message_id: payload.parent_message_id,
      idempotency_key: payload.idempotency_key,
      delivery_status: 'delivered',
    };

    // If it is a thread reply, update parent thread_count and last_reply_at
    if (payload.parent_message_id) {
      const parent = this.messages.find((m) => m.id === payload.parent_message_id);
      if (parent) {
        parent.thread_count += 1;
        parent.last_reply_at = 'Just now';
      }
    }

    this.messages.push(newMessage);

    // Update channel metadata
    channel.last_message = `${claims.name.split(' ')[0]}: ${payload.content.slice(0, 45)}...`;
    channel.last_message_at = 'Just now';

    this.persist();

    // Real-time broadcast
    this.emit('message.created', newMessage);

    // Dispatch webhooks
    this.emitWebhook(
      payload.parent_message_id ? 'thread.reply_created' : 'message.created',
      claims.company_id,
      {
        messageId: newMessage.id,
        channelId: channel.id,
        senderId: claims.sub,
        content: newMessage.content,
        hasAttachments: newMessage.attachments.length > 0,
        hasObjects: newMessage.object_refs.length > 0,
      }
    );

    if (payload.mentions && payload.mentions.length > 0) {
      this.emitWebhook('mention.created', claims.company_id, {
        messageId: newMessage.id,
        channelId: channel.id,
        mentionedUsers: payload.mentions,
      });
      this.emit('mention.received', {
        message: newMessage,
        channelName: channel.name,
      });
    }

    return newMessage;
  }

  /**
   * React to message (toggle reaction)
   */
  public toggleReaction(claims: TokenClaims, messageId: string, emoji: string): Message {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    let rx = msg.reactions.find((r) => r.emoji === emoji);
    if (!rx) {
      rx = { emoji, count: 0, user_ids: [] };
      msg.reactions.push(rx);
    }

    if (rx.user_ids.includes(claims.sub)) {
      rx.user_ids = rx.user_ids.filter((id) => id !== claims.sub);
      rx.count -= 1;
      if (rx.count <= 0) {
        msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      rx.user_ids.push(claims.sub);
      rx.count += 1;
    }

    this.persist();
    this.emit('message.updated', msg);
    return msg;
  }

  /**
   * Pin or unpin message / PDF attachment in channel
   */
  public togglePinMessage(claims: TokenClaims, messageId: string): Message {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    const channel = this.channels.find((c) => c.id === msg.channel_id);
    if (!channel) throw new Error('Channel not found');

    msg.is_pinned = !msg.is_pinned;
    if (msg.is_pinned) {
      msg.pinned_by = claims.name;
      msg.pinned_at = new Date().toISOString();
      if (!channel.pinned_message_ids) channel.pinned_message_ids = [];
      if (!channel.pinned_message_ids.includes(msg.id)) {
        channel.pinned_message_ids.push(msg.id);
      }
    } else {
      msg.pinned_by = undefined;
      msg.pinned_at = undefined;
      if (channel.pinned_message_ids) {
        channel.pinned_message_ids = channel.pinned_message_ids.filter((id) => id !== msg.id);
      }
    }

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      msg.is_pinned ? 'message.pinned' : 'message.unpinned',
      'message',
      messageId,
      { channelId: msg.channel_id, hasAttachments: msg.attachments.length > 0 }
    );

    this.persist();
    this.emit('message.updated', msg);
    this.emit('channel.updated', channel);
    return msg;
  }

  /**
   * Edit message
   */
  public editMessage(claims: TokenClaims, messageId: string, newContent: string): Message {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    if (
      msg.sender_id !== claims.sub &&
      !claims.permissions.includes('communication.message.moderate')
    ) {
      throw new Error('403 Forbidden: Cannot edit another user\'s message without moderate permission');
    }

    msg.content = newContent;
    msg.is_edited = true;
    msg.updated_at = new Date().toISOString();

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      'message.edited',
      'message',
      messageId,
      { previousLength: msg.content.length, newLength: newContent.length }
    );

    this.persist();
    this.emit('message.updated', msg);
    return msg;
  }

  /**
   * Delete message
   */
  public deleteMessage(claims: TokenClaims, messageId: string): void {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    if (
      msg.sender_id !== claims.sub &&
      !claims.permissions.includes('communication.message.moderate')
    ) {
      throw new Error('403 Forbidden: Cannot delete another user\'s message without moderate permission');
    }

    msg.is_deleted = true;
    msg.content = '[This message was deleted]';
    msg.attachments = [];
    msg.object_refs = [];

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      'message.deleted',
      'message',
      messageId,
      { channelId: msg.channel_id, wasModerated: msg.sender_id !== claims.sub }
    );

    this.persist();
    this.emit('message.updated', msg);
  }

  /**
   * Create channel
   */
  public createChannel(
    claims: TokenClaims,
    payload: {
      name: string;
      description: string;
      type: Channel['type'];
      member_ids?: string[];
      linked_object?: WorkOSObjectRef;
      topic?: string;
    }
  ): Channel {
    this.verifyToken(claims);

    if (payload.type === 'private') {
      if (!claims.permissions.includes('communication.private_channel.create')) {
        throw new Error(
          '403 Forbidden: Missing communication.private_channel.create permission'
        );
      }
    } else {
      if (!claims.permissions.includes('communication.channel.create')) {
        throw new Error('403 Forbidden: Missing communication.channel.create permission');
      }
    }

    const cleanName = payload.name.toLowerCase().replace(/\s+/g, '-');
    const newChan: Channel = {
      id: `chan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      company_id: claims.company_id,
      name: cleanName,
      description: payload.description,
      type: payload.type,
      created_by: claims.sub,
      created_at: new Date().toISOString(),
      is_archived: false,
      member_ids: Array.from(new Set([claims.sub, ...(payload.member_ids || [])])),
      unread_count: 0,
      topic: payload.topic,
      linked_object: payload.linked_object,
    };

    this.channels.push(newChan);

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      'channel.created',
      'channel',
      newChan.id,
      { name: newChan.name, type: newChan.type, memberCount: newChan.member_ids.length }
    );

    this.persist();
    this.emit('channel.created', newChan);
    this.emitWebhook('channel.created', claims.company_id, {
      channelId: newChan.id,
      name: newChan.name,
      type: newChan.type,
      createdBy: claims.sub,
    });

    return newChan;
  }

  /**
   * Archive channel
   */
  public archiveChannel(claims: TokenClaims, channelId: string): Channel {
    this.verifyToken(claims);

    if (!claims.permissions.includes('communication.channel.manage')) {
      throw new Error('403 Forbidden: Missing communication.channel.manage permission');
    }

    const chan = this.channels.find((c) => c.id === channelId);
    if (!chan) throw new Error('Channel not found');

    chan.is_archived = !chan.is_archived;

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      chan.is_archived ? 'channel.archived' : 'channel.unarchived',
      'channel',
      channelId,
      { name: chan.name }
    );

    this.persist();
    this.emit('channel.updated', chan);
    return chan;
  }

  /**
   * Add or remove channel member
   */
  public updateChannelMembers(
    claims: TokenClaims,
    channelId: string,
    action: 'add' | 'remove',
    memberId: string
  ): Channel {
    this.verifyToken(claims);

    if (!claims.permissions.includes('communication.member.manage')) {
      throw new Error('403 Forbidden: Missing communication.member.manage permission');
    }

    const chan = this.channels.find((c) => c.id === channelId);
    if (!chan) throw new Error('Channel not found');

    if (action === 'add') {
      if (!chan.member_ids.includes(memberId)) chan.member_ids.push(memberId);
    } else {
      chan.member_ids = chan.member_ids.filter((id) => id !== memberId);
    }

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      `channel.member_${action}ed`,
      'channel',
      channelId,
      { targetMember: memberId }
    );

    this.persist();
    this.emit('channel.updated', chan);
    return chan;
  }

  /**
   * Search messages, channels, and files strictly within tenant & user permission scope
   */
  public search(
    claims: TokenClaims,
    query: string
  ): {
    messages: Message[];
    channels: Channel[];
    files: { name: string; channelName: string; size: number; url: string }[];
  } {
    this.verifyToken(claims);
    const q = query.trim().toLowerCase();
    if (!q) return { messages: [], channels: [], files: [] };

    // Get accessible channels
    const accessibleChannels = this.getChannels(claims);
    const accessibleChanIds = new Set(accessibleChannels.map((c) => c.id));

    // Channels matching
    const matchedChannels = accessibleChannels.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );

    // Messages matching in accessible channels
    const matchedMessages = this.messages.filter(
      (m) =>
        m.company_id === claims.company_id &&
        accessibleChanIds.has(m.channel_id) &&
        !m.is_deleted &&
        (m.content.toLowerCase().includes(q) ||
          m.object_refs.some((o) => o.title.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)))
    );

    // Files matching in accessible channels
    const matchedFiles: { name: string; channelName: string; size: number; url: string }[] = [];
    this.messages.forEach((m) => {
      if (m.company_id === claims.company_id && accessibleChanIds.has(m.channel_id)) {
        const chan = accessibleChannels.find((c) => c.id === m.channel_id);
        m.attachments.forEach((att) => {
          if (att.name.toLowerCase().includes(q)) {
            matchedFiles.push({
              name: att.name,
              channelName: chan ? chan.name : 'unknown',
              size: att.size,
              url: att.url,
            });
          }
        });
      }
    });

    return {
      messages: matchedMessages,
      channels: matchedChannels,
      files: matchedFiles,
    };
  }

  /**
   * Audit log retriever (enforcing communication.audit.read)
   */
  public getAuditLogs(claims: TokenClaims): AuditEvent[] {
    this.verifyToken(claims);
    if (!claims.permissions.includes('communication.audit.read')) {
      throw new Error('403 Forbidden: Missing communication.audit.read permission');
    }
    return this.auditLogs.filter((a) => a.company_id === claims.company_id);
  }

  /**
   * Webhook history
   */
  public getWebhookLogs(claims: TokenClaims): WebhookEvent[] {
    this.verifyToken(claims);
    return this.webhookLogs.filter((w) => w.company_id === claims.company_id);
  }

  public recordAudit(
    company_id: string,
    actor_id: string,
    actor_name: string,
    action: string,
    target_type: AuditEvent['target_type'],
    target_id: string,
    details: Record<string, unknown>
  ) {
    const entry: AuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      company_id,
      actor_id,
      actor_name,
      action,
      target_type,
      target_id,
      details,
      timestamp: new Date().toISOString(),
      ip_address: '192.168.1.42',
    };
    this.auditLogs.unshift(entry);
    this.persist();
    this.emit('audit.created', entry);
  }

  public markChannelRead(channelId: string) {
    const chan = this.channels.find((c) => c.id === channelId);
    if (chan) {
      chan.unread_count = 0;
      this.persist();
      this.emit('channel.updated', chan);
    }
  }

  public resetDemoData() {
    sessionStorage.removeItem('workos_comm_state_v1');
    this.channels = [...INITIAL_CHANNELS];
    this.messages = [...INITIAL_MESSAGES];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.webhookLogs = [];
    this.emit('state.reset', null);
  }
}

// Global Singleton Engine instance representing the Communication Backend Service
export const communicationEngine = new CommunicationEngine();

/**
 * WorkOS SDK Client instance constructor
 */
export class WorkOSCommunicationClient {
  private getAccessTokenFn: () => Promise<string>;
  private cachedClaims: TokenClaims | null = null;

  constructor(options: { getAccessToken: () => Promise<string> }) {
    this.getAccessTokenFn = options.getAccessToken;
  }

  public async getClaims(): Promise<TokenClaims> {
    const token = await this.getAccessTokenFn();
    // In real deployment, token is a signed JWT. In this standalone/demo system,
    // we match synthetic token keys or parse claims:
    if (MOCK_TOKENS[token]) {
      this.cachedClaims = MOCK_TOKENS[token];
      return this.cachedClaims;
    }
    // Fallback: lookup by user or default to Vedant
    const found = Object.values(MOCK_TOKENS).find((t) => t.sub === token || t.email === token);
    this.cachedClaims = found || MOCK_TOKENS.vedant;
    return this.cachedClaims;
  }

  public async listChannels(): Promise<Channel[]> {
    const claims = await this.getClaims();
    return communicationEngine.getChannels(claims);
  }

  public async listMessages(channelId: string, parentMessageId?: string): Promise<Message[]> {
    const claims = await this.getClaims();
    return communicationEngine.getMessages(claims, channelId, parentMessageId);
  }

  public async postMessage(params: {
    channelId: string;
    content: string;
    attachments?: Message['attachments'];
    objectRefs?: WorkOSObjectRef[];
    mentions?: string[];
    parentMessageId?: string;
    idempotencyKey?: string;
  }): Promise<Message> {
    const claims = await this.getClaims();
    return communicationEngine.sendMessage(claims, {
      channel_id: params.channelId,
      content: params.content,
      attachments: params.attachments,
      object_refs: params.objectRefs,
      mentions: params.mentions,
      parent_message_id: params.parentMessageId,
      idempotency_key: params.idempotencyKey,
    });
  }

  public async search(query: string) {
    const claims = await this.getClaims();
    return communicationEngine.search(claims, query);
  }
}
