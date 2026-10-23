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
} from "lucide-react";
import { Avatar, Badge, Button, Popover, PopoverTrigger, PopoverContent, Skeleton } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";
import { Composer } from "./Composer.js";
import type { Conversation, Message, ReactionSummary } from "../types.js";

interface ConversationViewProps {
  conversation: Conversation;
  onOpenThread?: (message: Message) => void;
}

const EMOJI_PRESETS = ["👍", "❤️", "🔥", "🎉", "👀", "🚀"];

export function ConversationView({ conversation, onOpenThread }: ConversationViewProps) {
  const { token, currentUser } = useAuth();
  const { lastEvent } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
      setTimeout(() => scrollToBottom("auto"), 50);
    }
  }, [conversation.id, token]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // Handle incoming live websocket events
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "message.created") {
      const msg = (lastEvent.payload as { message?: Message })?.message;
      if (msg && msg.conversation_id === conversation.id && !msg.parent_id) {
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
        // Auto mark read if conversation is open
        if (token) {
          void apiRequest(`/v1/conversations/${conversation.id}/read`, token, { method: "POST" });
        }
      }
    }
  }, [lastEvent, conversation.id, token]);

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

  const handleSendMessage = async (body: string, mentionIds: string[]) => {
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
      attachment_ids: [],
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
          }),
        },
      );
      setMessages((prev) =>
        prev.map((m) => (m.client_msg_id === clientMsgId ? { ...res.data, status: "sent" } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.client_msg_id === clientMsgId ? { ...m, status: "failed" } : m)),
      );
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
      // Fetch updated reactions or optimistically toggle
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const currentReactions = m.reactions ?? [];
          const existing = currentReactions.find((r) => r.emoji === emoji);
          let nextReactions: ReactionSummary[];
          if (existing) {
            nextReactions = currentReactions.map((r) =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: r.reacted_by_me ? r.count - 1 : r.count + 1,
                    reacted_by_me: !r.reacted_by_me,
                  }
                : r,
            ).filter((r) => r.count > 0);
          } else {
            nextReactions = [
              ...currentReactions,
              { emoji, count: 1, user_ids: [currentUser?.id ?? ""], reacted_by_me: true },
            ];
          }
          return { ...m, reactions: nextReactions };
        }),
      );
    } catch {
      // ignore
    }
  };

  const formatMessageDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] min-w-0">
      {/* Conversation Top Header */}
      <div className="h-13 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {conversation.type === "channel" ? (
            conversation.kind === "private" ? (
              <Lock className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
            ) : (
              <Hash className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
            )
          ) : (
            <Avatar name={conversation.name ?? "Member"} size="sm" />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--fg-primary)] truncate">
                {conversation.name ?? conversation.other_user?.name ?? "Direct Message"}
              </h2>
              {conversation.is_announcement_only && (
                <Badge variant="accent" className="text-[10px] px-1.5 py-0">
                  Announcements
                </Badge>
              )}
            </div>
            {conversation.topic && (
              <p className="text-xs text-[var(--fg-muted)] truncate hidden md:block">
                {conversation.topic}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)] px-2 py-1 rounded-[4px] bg-[var(--bg-subtle)]">
            <Users className="h-3.5 w-3.5" />
            <span>{conversation.member_count}</span>
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {loading ? (
          <div className="space-y-4 pt-4">
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <div className="h-10 w-10 mx-auto rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--accent)]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">
              Welcome to #{conversation.name ?? "this chat"}!
            </h3>
            <p className="text-xs text-[var(--fg-muted)] max-w-sm mx-auto">
              This is the beginning of the conversation. Send a message to start chatting with your team.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const isDifferentDay =
              !prevMsg ||
              new Date(msg.created_at).toDateString() !==
                new Date(prevMsg.created_at).toDateString();
            const isGrouped =
              prevMsg &&
              !isDifferentDay &&
              prevMsg.author_id === msg.author_id &&
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000; // 5 mins

            return (
              <React.Fragment key={msg.id}>
                {isDifferentDay && (
                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--border-subtle)]" />
                    </div>
                    <span className="relative px-3 bg-[var(--bg-canvas)] text-[11px] font-medium text-[var(--fg-subtle)] uppercase tracking-wider">
                      {formatMessageDate(msg.created_at)}
                    </span>
                  </div>
                )}

                <div className={`relative flex items-start gap-3 group px-2 py-1 -mx-2 rounded-[6px] hover:bg-[var(--bg-subtle)]/50 transition-colors ${
                  isGrouped ? "mt-0.5" : "mt-2"
                }`}>
                  {/* Avatar or time gutter */}
                  {!isGrouped ? (
                    <Avatar
                      name={msg.author?.name}
                      src={msg.author?.avatar_url}
                      size="sm"
                      className="mt-0.5"
                    />
                  ) : (
                    <div className="w-6 text-[9px] text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity text-right pt-1 shrink-0 select-none">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-[var(--fg-primary)] hover:underline cursor-pointer">
                          {msg.author?.name ?? "Team Member"}
                        </span>
                        <span className="text-[10px] text-[var(--fg-subtle)]">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.status === "sending" && (
                          <span className="text-[10px] text-[var(--fg-subtle)] italic">sending...</span>
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

                    {/* Reactions Bar */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => handleAddReaction(msg.id, r.emoji)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-xs border transition-colors cursor-pointer ${
                              r.reacted_by_me
                                ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
                                : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-muted)]"
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-medium">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Thread Reply Banner */}
                    {msg.reply_count > 0 && (
                      <button
                        onClick={() => onOpenThread?.(msg)}
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>{msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}</span>
                      </button>
                    )}
                  </div>

                  {/* Hover Actions Toolbar */}
                  <div className="absolute right-2 -top-3 hidden group-hover:flex items-center gap-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm rounded-[6px] px-1 py-0.5 z-10 animate-in fade-in-0 duration-100">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                          title="Add reaction"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-1.5 flex gap-1">
                        {EMOJI_PRESETS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(msg.id, emoji)}
                            className="p-1 text-sm hover:scale-120 transition-transform cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    <button
                      onClick={() => onOpenThread?.(msg)}
                      className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                      title="Reply in thread"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
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
        <div className="relative">
          <button
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-4 right-6 p-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-transform hover:scale-105 cursor-pointer z-20"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Message Composer */}
      <Composer conversation={conversation} onSend={handleSendMessage} />
    </div>
  );
}