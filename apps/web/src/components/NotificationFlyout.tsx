import React, { useEffect, useState, useCallback, useRef } from "react";
import { Bell, CheckCheck, AtSign, MessageCircle, AlertCircle, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent, Button, Badge } from "@cs/ui";
import type { Notification } from "../types.js";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";

interface NotificationFlyoutProps {
  onSelectNotification?: (conversationId: string, messageId?: string | null) => void;
}

function formatRelativeTime(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationFlyout({ onSelectNotification }: NotificationFlyoutProps) {
  const { token } = useAuth();
  const { lastEvent } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<{ data: Notification[]; unread_count: number }>(
        "/v1/notifications",
        token,
      );
      setNotifications(res.data);
      setUnreadCount(res.unread_count);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Refresh when websocket notification event arrives
  useEffect(() => {
    if (lastEvent?.type === "notification.created" || lastEvent?.type === "message.created") {
      void fetchNotifications();
    }
  }, [lastEvent, fetchNotifications]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleClickItem = async (n: Notification) => {
    if (!token) return;
    try {
      await apiRequest(`/v1/notifications/${n.id}/read`, token, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
    setOpen(false);
    if (onSelectNotification) {
      onSelectNotification(n.conversation_id, n.message_id);
    }
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      await apiRequest("/v1/notifications/read-all", token, { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 rounded-[6px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white shadow-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 sm:w-88 p-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] shadow-2xl shadow-black/40 ring-1 ring-white/10 z-50 focus:outline-none"
      >
        <div ref={popoverRef} className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--fg-primary)] tracking-tight">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="accent" className="text-[10px] px-1.5 py-0 font-medium">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={markAllRead}
                  className="h-6 text-[11px] gap-1 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </Button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]/50">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Bell className="h-6 w-6 text-[var(--fg-subtle)] mx-auto mb-2 opacity-50" />
                <p className="text-xs text-[var(--fg-muted)] font-medium">No notifications yet</p>
                <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">When someone mentions you, you'll see it here</p>
              </div>
            ) : (
              notifications.map((n) => {
                const actor = n.actor_name ?? "Someone";
                const channel = n.conversation_name ? `#${n.conversation_name}` : "a conversation";
                const title = n.kind === "mention"
                  ? `${actor} mentioned you in ${channel}`
                  : n.kind === "reply"
                  ? `${actor} replied in ${channel}`
                  : `${actor} posted in ${channel}`;

                return (
                  <div
                    key={n.id}
                    onClick={() => void handleClickItem(n)}
                    className={`p-3 text-xs transition-colors cursor-pointer hover:bg-[var(--bg-subtle)]/70 ${
                      !n.is_read ? "bg-[var(--accent-subtle)]/25" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {n.kind === "mention" ? (
                          <div className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                            <AtSign className="h-3 w-3" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
                            <MessageCircle className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-xs font-medium text-[var(--fg-primary)] truncate">
                            {title}
                          </p>
                          <span className="text-[10px] text-[var(--fg-subtle)] shrink-0">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        {n.message_snippet && (
                          <p className="text-[11px] text-[var(--fg-muted)] truncate mt-0.5 italic">
                            "{n.message_snippet}"
                          </p>
                        )}
                      </div>
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-[var(--accent)] shrink-0 mt-1.5 shadow-xs" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
