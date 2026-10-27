import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Smile, AtSign, AlertCircle, Paperclip, X, FileText, Image, Loader2, FolderKanban } from "lucide-react";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import type { Conversation, User } from "../types.js";

export interface AttachedFile {
  id: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  status: "uploading" | "ready" | "error";
}

export interface AttachedObjectRef {
  type: string;
  id: string;
  title: string;
  subtitle?: string | undefined;
  status?: string | undefined;
}

interface ComposerProps {
  conversation?: Conversation | undefined;
  conversationId?: string | undefined;
  channelName?: string | undefined;
  onSend?: ((
    body: string,
    mentionIds?: string[] | undefined,
    attachmentIds?: string[] | undefined,
    objectRefs?: AttachedObjectRef[] | undefined,
  ) => Promise<void>) | undefined;
  onSendMessage?: ((
    body: string,
    mentionIds?: string[] | undefined,
    attachmentIds?: string[] | undefined,
    objectRefs?: AttachedObjectRef[] | undefined,
  ) => Promise<void>) | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  placeholder?: string | undefined;
}

const COMMON_EMOJIS = ["👍", "❤️", "🎉", "🔥", "🚀", "😄", "👀", "🙌", "💯", "✨"];

export function Composer({
  conversation,
  conversationId,
  channelName,
  onSend,
  onSendMessage,
  disabled = false,
  disabledReason,
  placeholder,
}: ComposerProps) {
  const { token, currentUser } = useAuth();
  const convId = conversation?.id ?? conversationId;
  const convName = channelName ?? conversation?.name ?? conversation?.dm_user?.name;
  const sendHandler = onSend ?? onSendMessage;

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<Map<string, string>>(new Map());
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [objectRefs, setObjectRefs] = useState<AttachedObjectRef[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<number | null>(null);

  // Load existing draft
  useEffect(() => {
    if (!token || !convId) return;
    let isCurrent = true;
    void apiRequest<{ data: { body: string } | null }>(
      `/v1/conversations/${convId}/draft`,
      token,
    )
      .then((res) => {
        if (isCurrent && res?.data?.body) {
          setText(res.data.body);
        }
      })
      .catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [convId, token]);

  // Save draft debounce
  const saveDraft = useCallback(
    (body: string) => {
      if (!token || !convId) return;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = window.setTimeout(() => {
        if (body.trim()) {
          void apiRequest(`/v1/conversations/${convId}/draft`, token, {
            method: "PUT",
            body: JSON.stringify({ body }),
          }).catch(() => {});
        } else {
          void apiRequest(`/v1/conversations/${convId}/draft`, token, {
            method: "DELETE",
          }).catch(() => {});
        }
      }, 500);
    },
    [convId, token],
  );

  // Handle @mention search
  useEffect(() => {
    if (mentionQuery === null || !token || !convId) {
      setMentionResults([]);
      return;
    }
    let isCurrent = true;
    void apiRequest<{ data: User[] }>(
      `/v1/conversations/${convId}/members/search?q=${encodeURIComponent(mentionQuery)}`,
      token,
    )
      .then((res) => {
        if (isCurrent) setMentionResults(res.data);
      })
      .catch(() => {
        if (isCurrent) setMentionResults([]);
      });
    return () => {
      isCurrent = false;
    };
  }, [mentionQuery, convId, token]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    saveDraft(val);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\- ]*)$/);
    if (lastAtMatch) {
      setMentionQuery(lastAtMatch[1] ?? "");
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (user: User) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const textAfterCursor = text.slice(cursorPos);
    const replacedBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_\- ]*)$/, `@${user.name} `);

    const newText = replacedBefore + textAfterCursor;
    setText(newText);
    setSelectedMentions((prev) => new Map(prev).set(user.id, user.name));
    setMentionQuery(null);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Direct-to-storage presigned file upload
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;

    setUploadingFiles(true);
    for (const file of Array.from(files)) {
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      setAttachments((prev) => [
        ...prev,
        {
          id: tempId,
          filename: file.name,
          size_bytes: file.size,
          mime_type: file.type || "application/octet-stream",
          status: "uploading",
        },
      ]);

      try {
        // 1. Calculate SHA-256 checksum
        const arrayBuf = await file.arrayBuffer();
        const hashBuf = await window.crypto.subtle.digest("SHA-256", arrayBuf);
        const checksum = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // 2. Request presigned upload URL
        const uploadRes = await apiRequest<{
          attachment_id: string;
          upload_url: string;
        }>("/v1/attachments/upload-url", token, {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            checksum_sha256: checksum,
          }),
        });

        // 3. Upload directly to S3 / MinIO storage
        await fetch(uploadRes.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });

        // 4. Finalize attachment
        await apiRequest("/v1/attachments/finalize", token, {
          method: "POST",
          body: JSON.stringify({ attachment_id: uploadRes.attachment_id }),
        });

        setAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? { ...a, id: uploadRes.attachment_id, status: "ready" }
              : a,
          ),
        );
      } catch (err) {
        console.error("Attachment upload failed:", err);
        setAttachments((prev) =>
          prev.map((a) => (a.id === tempId ? { ...a, status: "error" } : a)),
        );
      }
    }
    setUploadingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // WorkOS Object Reference linking (e.g. Project Apollo)
  const handleAttachDemoProject = () => {
    const demoRef: AttachedObjectRef = {
      type: "project",
      id: "PRJ-402",
      title: "Project Apollo - Client V2 Redesign",
      status: "In Progress",
    };
    if (!objectRefs.some((o) => o.id === demoRef.id)) {
      setObjectRefs((prev) => [...prev, demoRef]);
    }
  };

  const handleRemoveObjectRef = (id: string) => {
    setObjectRefs((prev) => prev.filter((o) => o.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    const readyAttachmentIds = attachments
      .filter((a) => a.status === "ready")
      .map((a) => a.id);

    if ((!trimmed && readyAttachmentIds.length === 0) || sending || disabled || !sendHandler) {
      return;
    }

    try {
      setSending(true);
      const mentionIds = Array.from(selectedMentions.keys());
      await sendHandler(trimmed, mentionIds, readyAttachmentIds, objectRefs);

      setText("");
      setSelectedMentions(new Map());
      setAttachments([]);
      setObjectRefs([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      if (token && convId) {
        void apiRequest(`/v1/conversations/${convId}/draft`, token, {
          method: "DELETE",
        }).catch(() => {});
      }
    } finally {
      setSending(false);
    }
  };

  const isAnnouncementBlocked =
    Boolean(conversation?.is_announcement_only) &&
    !currentUser?.permissions?.includes("communication.announcement.publish");

  if (isAnnouncementBlocked) {
    return (
      <div className="p-3 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] text-center text-xs text-[var(--fg-muted)] flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4 text-[var(--warning)] shrink-0" />
        {disabledReason ?? "Only channel admins and publishers can post in this announcement channel."}
      </div>
    );
  }

  return (
    <div className="relative p-3 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
      {/* Mention Dropdown */}
      {mentionQuery !== null && mentionResults.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 w-64 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-lg z-50 max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] uppercase font-semibold text-[var(--fg-muted)]">
            Mention members
          </div>
          {mentionResults.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSelectMention(u)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-[4px] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              <div className="h-5 w-5 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[10px] font-bold">
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="truncate text-[var(--fg-primary)]">{u.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Attachment & Object Reference Chips */}
      {(attachments.length > 0 || objectRefs.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
                att.status === "uploading"
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                  : att.status === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                  : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--fg-primary)]"
              }`}
            >
              {att.status === "uploading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : att.mime_type.startsWith("image/") ? (
                <Image className="w-3.5 h-3.5 text-indigo-500" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
              )}
              <span className="font-medium truncate max-w-[140px]">{att.filename}</span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="hover:text-rose-500 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {objectRefs.map((obj) => (
            <div
              key={obj.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-indigo-500/30 bg-indigo-500/10 text-indigo-500"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span className="font-bold">{obj.id}</span>
              <span className="truncate max-w-[140px]">{obj.title}</span>
              <button
                type="button"
                onClick={() => handleRemoveObjectRef(obj.id)}
                className="hover:text-rose-500 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer Input Box */}
      <div className="rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg-canvas)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15 transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={placeholder ?? `Message ${convName ? `#${convName}` : ""}`}
          rows={1}
          className="w-full resize-none bg-transparent px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder-[var(--fg-subtle)] outline-none min-h-[44px] max-h-[180px]"
        />

        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[var(--border-subtle)]/50">
          <div className="flex items-center gap-1 text-[var(--fg-muted)]">
            {/* Emoji Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded-[4px] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                  title="Insert emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setText((prev) => prev + emoji);
                        textareaRef.current?.focus();
                      }}
                      className="p-1.5 text-lg hover:bg-[var(--bg-subtle)] rounded transition-transform hover:scale-120 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Mention Button */}
            <button
              type="button"
              onClick={() => {
                setText((prev) => prev + "@");
                setMentionQuery("");
                textareaRef.current?.focus();
              }}
              className="p-1 rounded-[4px] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              title="Mention someone"
            >
              <AtSign className="h-4 w-4" />
            </button>

            {/* File Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
              multiple
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles}
              className="p-1 rounded-[4px] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              title="Attach files (MinIO S3 storage)"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Link WorkOS Object Button */}
            <button
              type="button"
              onClick={handleAttachDemoProject}
              className="p-1 rounded-[4px] hover:text-indigo-400 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer text-[10px] font-semibold flex items-center gap-0.5"
              title="Reference WorkOS Project"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ref</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--fg-subtle)] hidden sm:inline">
              <kbd className="font-sans">Enter</kbd> to send
            </span>
            <Button
              size="xs"
              onClick={handleSubmit}
              disabled={(!text.trim() && attachments.length === 0) || sending || disabled || uploadingFiles}
              className="h-7 px-2.5 gap-1"
            >
              <Send className="h-3 w-3" />
              <span>Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
