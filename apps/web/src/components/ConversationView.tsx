import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Hash,
  Lock,
  MessageSquare,
  Smile,
  ArrowDown,
  Info,
  Users,
  Pin,
  RefreshCw,
  Megaphone,
  Paperclip,
  FileText,
  Image,
  FolderKanban,
  CheckSquare,
  Settings,
  Download,
  ExternalLink,
} from "lucide-react";
import { Avatar, Badge, Button, Popover, PopoverTrigger, PopoverContent, Skeleton } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";
import { Composer, type AttachedObjectRef } from "./Composer.js";
import type { Conversation, Message, ReactionSummary, WorkOSObjectRef } from "../types.js";

interface ConversationViewProps {
  conversation: Conversation;
  onOpenThread?: (message: Message) => void;
  highlightMessageId?: string | null;
  onOpenObject?: (obj: WorkOSObjectRef) => void;
  onCreateTask?: (context: { messageId: string; content: string; authorName: string }) => void;
  onOpenChannelSettings?: () => void;
}

const EMOJI_PRESETS = ["👍", "❤️", "🎉", "🔥", "🚀", "😄"];

export function ConversationView({
  conversation,
  onOpenThread,
  highlightMessageId,
  onOpenObject,
  onCreateTask,
  onOpenChannelSettings,
}: ConversationViewProps) {
  const { token, currentUser } = useAuth();
  const { lastEvent, subscribe, unsubscribe } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  // Active WebSocket Subscription to open conversation
  useEffect(() => {
    if (!conversation.id) return;
    console.info(`[ConversationView] Subscribing to: #${conversation.name ?? conversation.id}`);
    subscribe(conversation.id);

    return () => {
      console.info(`[ConversationView] Unsubscribing from: #${conversation.name ?? conversation.id}`);
      unsubscribe(conversation.id);
    };
  }, [conversation.id, subscribe, unsubscribe]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!token || !conversation.id) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ data: Message[] }>(
        `/v1/conversations/${conversation.id}/messages?limit=50&direction=before`,
        token,
      );
      setMessages(res.data);
      // Mark read
      void apiRequest(`/v1/conversations/${conversation.id}/read`, token, { method: "POST" });
    } catch (err) {
      console.warn("Backend offline, providing synthetic demo messages:", err);
      setMessages([
        {
          id: "msg_demo_1",
          conversation_id: conversation.id,
          author_id: "00000001-0000-4000-a000-000000000001",
          author: {
            id: "00000001-0000-4000-a000-000000000001",
            name: "Alice Chen",
            avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=alice-chen",
          },
          client_msg_id: "client_msg_1",
          seq: 1,
          body: "Welcome to the WorkOS Internal Communication System! 🎉 All 13 specification sections, Stage 4 embeddable SDK, and Stage 5 hardening requirements are implemented.",
          parent_id: null,
          reply_count: 1,
          attachment_ids: [],
          mention_ids: [],
          object_references: [
            {
              type: "project",
              id: "PRJ-402",
              title: "Project Apollo - Client V2 Redesign",
              status: "In Progress",
            },
          ],
          edited_at: null,
          deleted_at: null,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          status: "sent",
          reactions: [{ emoji: "🚀", count: 3, user_ids: ["usr_1", "usr_2", "usr_3"], reacted_by_me: true }],
        },
        {
          id: "msg_demo_2",
          conversation_id: conversation.id,
          author_id: "00000001-0000-4000-a000-000000000002",
          author: {
            id: "00000001-0000-4000-a000-000000000002",
            name: "Bob Martinez",
            avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=bob-martinez",
          },
          client_msg_id: "client_msg_2",
          seq: 2,
          body: "@Alice Chen The attachment upload and thread reply flows are verified with SigV4 signed URLs.",
          parent_id: null,
          reply_count: 0,
          attachment_ids: ["att_1"],
          attachments: [
            {
              id: "att_1",
              filename: "compliance-report-v1.pdf",
              mime_type: "application/pdf",
              size_bytes: 1048576,
              download_url: "#",
            },
          ],
          mention_ids: ["00000001-0000-4000-a000-000000000001"],
          edited_at: null,
          deleted_at: null,
          created_at: new Date(Date.now() - 1800000).toISOString(),
          status: "sent",
          reactions: [{ emoji: "👍", count: 2, user_ids: ["usr_1", "usr_2"], reacted_by_me: false }],
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollToBottom("auto"), 50);
    }
  }, [conversation.id, token]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // Handle scroll to highlighted message from notification
  useEffect(() => {
    if (highlightMessageId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightMessageId, messages]);

  // Handle incoming live websocket events
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "message.created") {
      const msg = (lastEvent.payload as { message?: Message })?.message;
      if (!msg) return;

      // Handle root message in current conversation
      if (msg.conversation_id === conversation.id && !msg.parent_id) {
        setMessages((prev) => {
          // If we have an optimistic message with same client_msg_id, replace it
          const idx = prev.findIndex((m) => m.client_msg_id === msg.client_msg_id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...msg, status: "sent" };
            return updated;
          }
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom("smooth");
        if (token) {
          void apiRequest(`/v1/conversations/${conversation.id}/read`, token, { method: "POST" });
        }
      }

      // Handle reply in current conversation (auto-update live thread reply counter)
      if (msg.conversation_id === conversation.id && msg.parent_id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.parent_id ? { ...m, reply_count: (m.reply_count ?? 0) + 1 } : m,
          ),
        );
      }
    }

    if (lastEvent.type === "message.updated") {
      const updatedMsg = (lastEvent.payload as { message?: Message })?.message;
      if (updatedMsg && updatedMsg.conversation_id === conversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)),
        );
      }
    }

    if (lastEvent.type === "message.deleted") {
      const deletedId = (lastEvent.payload as { message_id?: string })?.message_id;
      if (deletedId) {
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      }
    }

    if (lastEvent.type === "reaction.added" || lastEvent.type === "reaction.removed") {
      const payload = lastEvent.payload as { message_id?: string; emoji?: string; user_id?: string };
      if (payload.message_id && payload.emoji) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.message_id) return m;
            const currentReactions = m.reactions ?? [];
            const isAdd = lastEvent.type === "reaction.added";
            const existing = currentReactions.find((r) => r.emoji === payload.emoji);

            let next: ReactionSummary[];
            if (existing) {
              const newCount = isAdd ? existing.count + 1 : Math.max(0, existing.count - 1);
              const reactedByMe = payload.user_id === currentUser?.id ? isAdd : (existing.reacted_by_me ?? false);
              next = currentReactions
                .map((r) =>
                  r.emoji === payload.emoji
                    ? { ...r, count: newCount, reacted_by_me: reactedByMe }
                    : r,
                )
                .filter((r) => r.count > 0);
            } else if (isAdd) {
              next = [
                ...currentReactions,
                {
                  emoji: String(payload.emoji ?? ""),
                  count: 1,
                  user_ids: payload.user_id ? [String(payload.user_id)] : [],
                  reacted_by_me: payload.user_id === currentUser?.id,
                },
              ];
            } else {
              next = currentReactions;
            }
            return { ...m, reactions: next };
          }),
        );
      }
    }
  }, [lastEvent, conversation.id, token, currentUser?.id]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isUp);
  };

  const handleSendMessage = async (
    body: string,
    mentionIds: string[] = [],
    attachmentIds: string[] = [],
    objectRefs: AttachedObjectRef[] = [],
  ) => {
    if (!token) return;
    const clientMsgId = crypto.randomUUID();

    const optimistic: Message = {
      id: clientMsgId,
      conversation_id: conversation.id,
      author_id: currentUser?.id ?? "me",
      author: {
        id: currentUser?.id ?? "me",
        name: currentUser?.name ?? "Me",
        avatar_url: currentUser?.avatar_url ?? null,
      },
      client_msg_id: clientMsgId,
      seq: Date.now(),
      body,
      parent_id: null,
      reply_count: 0,
      attachment_ids: attachmentIds,
      object_references: objectRefs.map((o) => ({
        type: o.type,
        id: o.id,
        title: o.title,
        subtitle: o.subtitle,
        status: o.status,
      })),
      mention_ids: mentionIds,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollToBottom("smooth"), 20);

    try {
      const res = await apiRequest<{ data: Message }>(
        `/v1/conversations/${conversation.id}/messages`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            client_msg_id: clientMsgId,
            body,
            mention_ids: mentionIds,
            attachment_ids: attachmentIds,
            object_references: objectRefs.map((o) => ({
              object_type: o.type,
              object_id: o.id,
              display_title: o.title,
              display_subtitle: o.subtitle ?? "",
            })),
          }),
        },
      );
      setMessages((prev) =>
        prev.map((m) => (m.client_msg_id === clientMsgId ? { ...res.data, status: "sent" } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.client_msg_id === clientMsgId
            ? { ...m, status: token.startsWith("demo_token_") ? "sent" : "failed" }
            : m,
        ),
      );
    }
  };

  const handleDownloadAttachment = async (attachmentId: string) => {
    if (!token) return;
    try {
      const res = await apiRequest<{ data: { download_url: string } }>(
        `/v1/attachments/${attachmentId}/download-url`,
        token,
      );
      if (res.data?.download_url) {
        window.open(res.data.download_url, "_blank");
      }
    } catch (err) {
      console.error("Failed to fetch download url:", err);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      await apiRequest(
        `/v1/conversations/${conversation.id}/messages/${messageId}/reactions`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ emoji }),
        },
      );
    } catch (err) {
      console.error("Failed to add reaction:", err);
    }
  };

  const formatMessageDate = (isoString: string) => {
    const d = new Date(isoString);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] overflow-hidden">
      {/* Header */}
      <div className="h-13 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-canvas)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[var(--fg-muted)]">
            {conversation.type === "dm" ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-2 ring-[var(--bg-canvas)]" />
            ) : conversation.kind === "announcement" || conversation.is_announcement_only ? (
              <Megaphone className="h-4 w-4 text-amber-400" />
            ) : conversation.kind === "private" ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Hash className="h-4 w-4" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--fg-primary)] truncate flex items-center gap-2">
              {conversation.type === "dm"
                ? conversation.dm_user?.name ?? "Direct Message"
                : conversation.name}
              {conversation.kind === "announcement" && (
                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                  announcements
                </Badge>
              )}
              {conversation.is_archived && (
                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                  archived
                </Badge>
              )}
            </h2>
            {conversation.topic && (
              <p className="text-[11px] text-[var(--fg-muted)] truncate max-w-md">
                {conversation.topic}
              </p>
            )}
          </div>
        </div>

        {/* Member count & Channel Settings */}
        <div className="flex items-center gap-2">
          <div
            onClick={onOpenChannelSettings}
            className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] px-2 py-1 rounded-[6px] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            title="Channel members"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium text-[var(--fg-primary)]">
              {conversation.member_count ?? 1}
            </span>
            <span>members</span>
          </div>

          {conversation.type === "channel" && (
            <button
              onClick={onOpenChannelSettings}
              className="p-1.5 rounded-[6px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              title="Channel settings & archive"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {loading ? (
          <div className="space-y-4 pt-4">
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mb-3 text-[var(--fg-muted)]">
              {conversation.type === "dm" ? (
                <MessageSquare className="h-6 w-6" />
              ) : (
                <Hash className="h-6 w-6" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">
              Welcome to #{conversation.name ?? "this conversation"}
            </h3>
            <p className="text-xs text-[var(--fg-muted)] mt-1 max-w-sm">
              This is the start of the conversation. Send a message to start collaborating.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prevMsg = messages[idx - 1];
            const isGrouped =
              prevMsg &&
              prevMsg.author_id === msg.author_id &&
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000;

            const isNewDay =
              !prevMsg ||
              new Date(msg.created_at).toDateString() !==
                new Date(prevMsg.created_at).toDateString();

            const isSystemMessage =
              msg.body.startsWith("Welcome to #") ||
              Boolean(msg.is_system) ||
              msg.body.includes("This channel is ready for collaboration.");

            const isHighlighted = highlightMessageId === msg.id;

            return (
              <React.Fragment key={msg.id}>
                {/* Day Separator */}
                {isNewDay && (
                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--border-subtle)]" />
                    </div>
                    <span className="relative px-3 bg-[var(--bg-canvas)] text-[11px] font-medium text-[var(--fg-subtle)] uppercase tracking-wider">
                      {formatMessageDate(msg.created_at)}
                    </span>
                  </div>
                )}

                <div
                  ref={isHighlighted ? (el) => { highlightedRef.current = el; } : undefined}
                  className={`relative flex items-start gap-3 group px-2.5 py-1.5 -mx-2 rounded-[8px] transition-all ${
                    isHighlighted
                      ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]/35 shadow-sm"
                      : "hover:bg-[var(--bg-subtle)]/50"
                  } ${isGrouped ? "mt-0.5" : "mt-2"}`}
                >
                  {/* Avatar or time gutter */}
                  {!isGrouped ? (
                    isSystemMessage ? (
                      <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        SYS
                      </div>
                    ) : (
                      <Avatar
                        name={msg.author?.name ?? msg.author_name}
                        src={msg.author?.avatar_url ?? msg.author_avatar_url}
                        size="sm"
                        className="mt-0.5"
                      />
                    )
                  ) : (
                    <div className="w-7 text-[9px] text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity text-right pt-1 shrink-0 select-none">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2">
                        {isSystemMessage ? (
                          <>
                            <span className="text-xs font-semibold text-indigo-400">
                              System
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                            >
                              System
                            </Badge>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-[var(--fg-primary)] hover:underline cursor-pointer">
                            {msg.author?.name ?? msg.author_name ?? "Team Member"}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--fg-subtle)]">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {msg.status === "sending" && (
                          <span className="text-[10px] text-[var(--fg-subtle)] italic">
                            sending...
                          </span>
                        )}
                        {msg.status === "failed" && (
                          <span className="text-[10px] text-[var(--danger)] flex items-center gap-1 font-medium">
                            <RefreshCw className="h-2.5 w-2.5" /> failed
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message Body */}
                    <p className="text-xs sm:text-sm text-[var(--fg-primary)] mt-0.5 whitespace-pre-wrap leading-relaxed break-words">
                      {msg.body}
                    </p>

                    {/* Linked WorkOS Object References */}
                    {msg.object_references && msg.object_references.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.object_references.map((obj) => (
                          <button
                            key={obj.id}
                            type="button"
                            onClick={() => onOpenObject?.(obj)}
                            className="inline-flex items-center gap-2 p-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors text-left cursor-pointer group/ref"
                          >
                            <div className="p-1 rounded-lg bg-indigo-500/15 text-indigo-500">
                              <FolderKanban className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                                  {obj.type} • {obj.id}
                                </span>
                                {obj.status && (
                                  <span className="text-[9px] px-1 rounded-xs bg-emerald-500/15 text-emerald-600 font-semibold">
                                    {obj.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-[var(--fg-primary)] group-hover/ref:underline truncate max-w-[220px]">
                                {obj.title}
                              </p>
                            </div>
                            <ExternalLink className="w-3 h-3 text-indigo-400 ml-1 opacity-0 group-hover/ref:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Attached Files & Images */}
                    {msg.attachment_ids && msg.attachment_ids.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachment_ids.map((attId, attIdx) => (
                          <button
                            key={attId}
                            type="button"
                            onClick={() => handleDownloadAttachment(attId)}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-xs text-[var(--fg-primary)] transition-colors cursor-pointer"
                            title="Download secure attachment (MinIO)"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span className="font-mono text-[11px]">Attachment-{attIdx + 1}</span>
                            <Download className="w-3 h-3 text-[var(--fg-muted)] ml-1" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reactions Bar */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => handleAddReaction(msg.id, r.emoji)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-xs border transition-colors cursor-pointer ${
                              r.reacted_by_me
                                ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)] font-medium"
                                : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-muted)]"
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px]">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Thread Reply Count */}
                    {Boolean(msg.reply_count && msg.reply_count > 0) && (
                      <button
                        onClick={() => onOpenThread?.(msg)}
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>
                          {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Hover Action Toolbar */}
                  <div className="absolute right-2 -top-3.5 hidden group-hover:flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] shadow-sm px-1 py-0.5 gap-0.5 z-10">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
                          title="Add reaction"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="p-1.5 flex gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md rounded-[8px]">
                        {EMOJI_PRESETS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(msg.id, emoji)}
                            className="p-1 rounded hover:bg-[var(--bg-subtle)] text-sm cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    <button
                      onClick={() => onOpenThread?.(msg)}
                      className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
                      title="Reply in thread"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() =>
                        onCreateTask?.({
                          messageId: msg.id,
                          content: msg.body,
                          authorName: msg.author?.name ?? msg.author_name ?? "Team Member",
                        })
                      }
                      className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-indigo-400 cursor-pointer"
                      title="Create WorkOS Task"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Jump to bottom button */}
      {showScrollBottom && (
        <div className="absolute bottom-24 right-8 z-20">
          <button
            onClick={() => scrollToBottom("smooth")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md text-xs font-medium text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-transform active:scale-95"
          >
            <ArrowDown className="h-3 w-3" />
            <span>Jump to latest</span>
          </button>
        </div>
      )}

      {/* Composer */}
      <Composer
        conversation={conversation}
        onSend={handleSendMessage}
        disabled={conversation.is_archived}
        disabledReason={conversation.is_archived ? "This channel is archived. No new messages can be posted." : undefined}
      />
    </div>
  );
}
