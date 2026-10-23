import React, { useEffect, useState, useCallback, useRef } from "react";
import { X, MessageSquare, CornerDownRight } from "lucide-react";
import { Avatar, Skeleton } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";
import { Composer } from "./Composer.js";
import type { Message, Conversation } from "../types.js";

interface ThreadPanelProps {
  conversation: Conversation;
  rootMessage: Message;
  onClose: () => void;
}

export function ThreadPanel({ conversation, rootMessage, onClose }: ThreadPanelProps) {
  const { token, currentUser } = useAuth();
  const { lastEvent } = useWebSocket();
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchReplies = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<{ data: Message[] }>(
        `/v1/conversations/${conversation.id}/messages/${rootMessage.id}/thread`,
        token,
      );
      setReplies(res.data);
    } catch (err) {
      console.error("Failed to fetch thread replies:", err);
    } finally {
      setLoading(false);
    }
  }, [conversation.id, rootMessage.id, token]);

  useEffect(() => {
    void fetchReplies();
  }, [fetchReplies]);

  // Listen to new replies via WebSocket
  useEffect(() => {
    if (lastEvent?.type === "message.created") {
      const msg = (lastEvent.payload as { message?: Message })?.message;
      if (msg && msg.parent_id === rootMessage.id) {
        setReplies((prev) => {
          if (prev.some((m) => m.id === msg.id || m.client_msg_id === msg.client_msg_id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    }
  }, [lastEvent, rootMessage.id]);

  const handleSendReply = async (body: string, mentionIds: string[]) => {
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
      parent_id: rootMessage.id,
      reply_count: 0,
      attachment_ids: [],
      mention_ids: mentionIds,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      status: "sending",
    };

    setReplies((prev) => [...prev, optimistic]);

    try {
      const res = await apiRequest<{ data: Message }>(
        `/v1/conversations/${conversation.id}/messages`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            client_msg_id: clientMsgId,
            body,
            parent_id: rootMessage.id,
            mention_ids: mentionIds,
          }),
        },
      );
      setReplies((prev) =>
        prev.map((m) => (m.client_msg_id === clientMsgId ? { ...res.data, status: "sent" } : m)),
      );
    } catch {
      setReplies((prev) =>
        prev.map((m) => (m.client_msg_id === clientMsgId ? { ...m, status: "failed" } : m)),
      );
    }
  };

  return (
    <div className="w-80 sm:w-96 flex flex-col h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">Thread</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-[4px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Root message */}
        <div className="p-3 rounded-[8px] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-1.5">
            <Avatar name={rootMessage.author?.name} src={rootMessage.author?.avatar_url} size="sm" />
            <div>
              <span className="text-xs font-semibold text-[var(--fg-primary)]">
                {rootMessage.author?.name ?? "Member"}
              </span>
              <span className="text-[10px] text-[var(--fg-subtle)] ml-2">
                {new Date(rootMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <p className="text-xs text-[var(--fg-primary)] whitespace-pre-wrap">{rootMessage.body}</p>
        </div>

        {/* Replies header */}
        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)] font-medium">
          <CornerDownRight className="h-3.5 w-3.5" />
          <span>{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
        </div>

        {/* Replies stream */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </div>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2.5 group">
              <Avatar name={reply.author?.name} src={reply.author?.avatar_url} size="xs" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium text-[var(--fg-primary)]">
                    {reply.author?.name ?? "Member"}
                  </span>
                  <span className="text-[10px] text-[var(--fg-subtle)]">
                    {new Date(reply.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {reply.status === "sending" && (
                    <span className="text-[9px] text-[var(--fg-subtle)] italic">sending...</span>
                  )}
                  {reply.status === "failed" && (
                    <span className="text-[9px] text-[var(--danger)] font-medium">failed</span>
                  )}
                </div>
                <p className="text-xs text-[var(--fg-secondary)] mt-0.5 whitespace-pre-wrap">{reply.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Thread Composer */}
      <Composer
        conversation={conversation}
        onSend={handleSendReply}
        placeholder="Reply in thread..."
      />
    </div>
  );
}