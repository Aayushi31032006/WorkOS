import React, { useEffect, useState, useCallback, useRef } from "react";
import { X, MessageSquare, CornerDownRight, Paperclip, Download, FolderKanban } from "lucide-react";
import { Avatar, Skeleton } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";
import { Composer, type AttachedObjectRef } from "./Composer.js";
import type { Message, Conversation, WorkOSObjectRef } from "../types.js";

interface ThreadPanelProps {
  conversation: Conversation;
  rootMessage: Message;
  onClose: () => void;
  onOpenObject?: (obj: WorkOSObjectRef) => void;
}

export function ThreadPanel({ conversation, rootMessage, onClose, onOpenObject }: ThreadPanelProps) {
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

  const handleSendReply = async (
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
      parent_id: rootMessage.id,
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
    <div className="w-80 sm:w-96 flex flex-col h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shrink-0 animate-slideIn">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">Thread</h3>
          <span className="text-xs text-[var(--fg-muted)]">
            in #{conversation.name ?? "conversation"}
          </span>
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
        {/* Root Message */}
        <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-[8px] space-y-2">
          <div className="flex items-center gap-2">
            <Avatar
              name={rootMessage.author?.name}
              src={rootMessage.author?.avatar_url}
              size="sm"
            />
            <div>
              <p className="text-xs font-semibold text-[var(--fg-primary)]">
                {rootMessage.author?.name ?? "Team Member"}
              </p>
              <span className="text-[10px] text-[var(--fg-subtle)]">
                {new Date(rootMessage.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <p className="text-xs text-[var(--fg-primary)] whitespace-pre-wrap leading-relaxed">
            {rootMessage.body}
          </p>

          {/* Root Message Object References */}
          {rootMessage.object_references && rootMessage.object_references.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {rootMessage.object_references.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => onOpenObject?.(obj)}
                  className="inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span className="font-bold">{obj.id}</span>
                  <span className="truncate max-w-[150px]">{obj.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 text-[11px] text-[var(--fg-subtle)]">
          <CornerDownRight className="h-3.5 w-3.5" />
          <span>
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </span>
          <div className="flex-1 border-t border-[var(--border-subtle)]" />
        </div>

        {/* Replies List */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : replies.length === 0 ? (
          <p className="text-center text-xs text-[var(--fg-muted)] py-4">No replies yet. Start the discussion below.</p>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="flex gap-2.5 text-xs group">
              <Avatar
                name={reply.author?.name}
                src={reply.author?.avatar_url}
                size="xs"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--fg-primary)]">
                    {reply.author?.name ?? "Team Member"}
                  </span>
                  <span className="text-[10px] text-[var(--fg-subtle)]">
                    {new Date(reply.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-[var(--fg-secondary)] leading-relaxed whitespace-pre-wrap">
                  {reply.body}
                </p>

                {/* Reply attachments */}
                {reply.attachment_ids && reply.attachment_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {reply.attachment_ids.map((attId, idx) => (
                      <button
                        key={attId}
                        type="button"
                        onClick={() => handleDownloadAttachment(attId)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[10px] hover:bg-[var(--bg-muted)]"
                      >
                        <Paperclip className="w-3 h-3 text-[var(--accent)]" />
                        <span>Attachment-{idx + 1}</span>
                        <Download className="w-2.5 h-2.5 text-[var(--fg-muted)]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <Composer
        conversation={conversation}
        onSend={handleSendReply}
        placeholder="Reply to thread..."
      />
    </div>
  );
}
