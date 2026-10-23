import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Smile, Paperclip, AtSign, AlertCircle } from "lucide-react";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import type { Conversation, User } from "../types.js";

interface ComposerProps {
  conversation: Conversation;
  onSend: (body: string, mentionIds: string[]) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
}

const COMMON_EMOJIS = ["👍", "❤️", "🔥", "🚀", "🎉", "👀", "🙌", "😂", "✅", "💯"];

export function Composer({
  conversation,
  onSend,
  disabled = false,
  disabledReason,
  placeholder,
}: ComposerProps) {
  const { token, currentUser } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<Map<string, string>>(new Map()); // id -> name
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftTimerRef = useRef<number | null>(null);

  // Load existing draft
  useEffect(() => {
    if (!token || !conversation.id) return;
    let isCurrent = true;
    void apiRequest<{ data: { body: string } | null }>(
      `/v1/conversations/${conversation.id}/draft`,
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
  }, [conversation.id, token]);

  // Save draft debounce
  const saveDraft = useCallback(
    (body: string) => {
      if (!token) return;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = window.setTimeout(() => {
        if (body.trim()) {
          void apiRequest(`/v1/conversations/${conversation.id}/draft`, token, {
            method: "PUT",
            body: JSON.stringify({ body }),
          }).catch(() => {});
        } else {
          void apiRequest(`/v1/conversations/${conversation.id}/draft`, token, {
            method: "DELETE",
          }).catch(() => {});
        }
      }, 500);
    },
    [conversation.id, token],
  );

  // Handle @mention search
  useEffect(() => {
    if (mentionQuery === null || !token) {
      setMentionResults([]);
      return;
    }
    let isCurrent = true;
    void apiRequest<{ data: User[] }>(
      `/v1/conversations/${conversation.id}/members/search?q=${encodeURIComponent(mentionQuery)}`,
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
  }, [mentionQuery, conversation.id, token]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    saveDraft(val);

    // Auto-grow textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }

    // Check for @ mention trigger
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

    // Re-focus
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    try {
      setSending(true);
      const mentionIds = Array.from(selectedMentions.keys());
      await onSend(trimmed, mentionIds);
      setText("");
      setSelectedMentions(new Map());
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      // Clear draft
      if (token) {
        void apiRequest(`/v1/conversations/${conversation.id}/draft`, token, {
          method: "DELETE",
        }).catch(() => {});
      }
    } finally {
      setSending(false);
    }
  };

  const isAnnouncementBlocked =
    conversation.is_announcement_only &&
    !currentUser?.permissions.includes("communication.announcement.publish");

  if (isAnnouncementBlocked) {
    return (
      <div className="p-3 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] text-center text-xs text-[var(--fg-muted)] flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4 text-[var(--warning)] shrink-0" />
        Only channel admins and publishers can post in this announcement channel.
      </div>
    );
  }

  return (
    <div className="relative p-3 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
      {/* Mention suggestions popup */}
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

      <div className="rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg-canvas)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15 transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={
            placeholder ??
            `Message ${conversation.name ? `#${conversation.name}` : conversation.other_user?.name ?? ""}`
          }
          rows={1}
          className="w-full resize-none bg-transparent px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder-[var(--fg-subtle)] outline-none min-h-[44px] max-h-[180px]"
        />

        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[var(--border-subtle)]/50">
          <div className="flex items-center gap-1 text-[var(--fg-muted)]">
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
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--fg-subtle)] hidden sm:inline">
              <kbd className="font-sans">Enter</kbd> to send
            </span>
            <Button
              size="xs"
              onClick={handleSubmit}
              disabled={!text.trim() || sending || disabled}
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