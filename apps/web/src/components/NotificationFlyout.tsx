import React, { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, AtSign, MessageCircle, AlertCircle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent, Button, Badge } from "@cs/ui";
import type { Notification } from "../types.js";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";

interface NotificationFlyoutProps {
  onSelectConversation?: (conversationId: string) => void;
}

export function NotificationFlyout({ onSelectConversation }: NotificationFlyoutProps) {
  const { token } = useAuth();
  const { lastEvent } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [open, setOpen] = useState(false);

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
    if (lastEvent?.type === "notification.created") {
      void fetchNotifications();
    }
  }, [lastEvent, fetchNotifications]);

  const markAsRead = async (id: string, conversationId?: string) => {
    if (!token) return;
    try {
      await apiRequest(`/v1/notifications/${id}/read`, token, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (conversationId && onSelectConversation) {
        onSelectConversation(conversationId);
        setOpen(false);
      }
    } catch {
      // ignore
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
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-lg">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--fg-primary)]">Notifications</span>
            {unreadCount > 0 && <Badge variant="accent">{unreadCount} new</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={markAllRead} className="h-5 text-[11px] gap-1">
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--fg-muted)]">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => void markAsRead(n.id, n.conversation_id)}
                className={`p-2.5 text-xs transition-colors cursor-pointer hover:bg-[var(--bg-subtle)] ${
                  !n.is_read ? "bg-[var(--accent-subtle)]/30 font-medium" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {n.kind === "mention" ? (
                    <AtSign className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                  ) : n.kind === "reply" ? (
                    <MessageCircle className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-[var(--fg-muted)] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--fg-primary)] truncate">
                      {n.kind === "mention" ? "You were mentioned in a message" : "New activity"}
                    </p>
                    <span className="text-[10px] text-[var(--fg-subtle)]">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-[var(--accent)] mt-1.5" />}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}