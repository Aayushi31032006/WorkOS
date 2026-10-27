import React, { useEffect, useState, useCallback } from "react";
import {
  Hash,
  Lock,
  Plus,
  Search,
  Moon,
  Sun,
  ChevronDown,
  Megaphone,
  UserPlus,
  Settings,
  Archive,
  Wifi,
  WifiOff,
  Shield,
  FolderKanban,
  CheckSquare,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Skeleton,
} from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth, DEMO_USERS } from "../context/AuthContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";
import { ConversationView } from "./ConversationView.js";
import { ThreadPanel } from "./ThreadPanel.js";
import { CommandPalette } from "./CommandPalette.js";
import { NotificationFlyout } from "./NotificationFlyout.js";
import { ChannelAdminModal } from "./ChannelAdminModal.js";
import { SearchModal } from "./SearchModal.js";
import { AuditLogViewer } from "./AuditLogViewer.js";
import { WorkOSObjectDrawer } from "./WorkOSObjectDrawer.js";
import { CreateTaskModal } from "./CreateTaskModal.js";
import type { Conversation, Message, User, WorkOSObjectRef } from "../types.js";

export interface AppShellProps {
  onOpenObject?: (obj: WorkOSObjectRef) => void;
  onCreateTask?: (context: { messageId: string; content: string; authorName: string }) => void;
  theme?: "light" | "dark";
}

export function AppShell({
  onOpenObject: hostOnOpenObject,
  onCreateTask: hostOnCreateTask,
}: AppShellProps = {}) {
  const { currentUser, currentTag, switchUser, theme, toggleTheme, token, loading: authLoading } = useAuth();
  const { status: wsStatus, lastEvent } = useWebSocket();

  const [channels, setChannels] = useState<Conversation[]>([]);
  const [dms, setDms] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  // Dialogs
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<"public" | "private" | "announcement">("public");

  const [createDmOpen, setCreateDmOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [channelAdminTarget, setChannelAdminTarget] = useState<Conversation | null>(null);
  const [activeObject, setActiveObject] = useState<WorkOSObjectRef | null>(null);
  const [activeTaskContext, setActiveTaskContext] = useState<{
    messageId: string;
    content: string;
    authorName: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  // Fetch channels & DMs
  const fetchNav = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [chRes, dmRes] = await Promise.all([
        apiRequest<{ data: Conversation[] }>("/v1/channels?limit=50", token),
        apiRequest<{ data: Conversation[] }>("/v1/dms?limit=50", token),
      ]);
      setChannels(chRes.data);
      setDms(dmRes.data);

      // Default to general channel if no active conversation
      if (!activeConversation && chRes.data.length > 0) {
        const general = chRes.data.find((c) => c.name === "general") ?? chRes.data[0];
        setActiveConversation(general ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch navigation:", err);
    } finally {
      setLoading(false);
    }
  }, [token, activeConversation]);

  useEffect(() => {
    void fetchNav();
  }, [fetchNav]);

  // URL Hash Deep-Linking: Synchronize activeConversation & thread to URL hash
  useEffect(() => {
    if (!activeConversation) return;
    if (activeThreadMessage) {
      window.location.hash = `/c/${activeConversation.id}/t/${activeThreadMessage.id}`;
    } else {
      window.location.hash = `/c/${activeConversation.id}`;
    }
  }, [activeConversation?.id, activeThreadMessage?.id]);

  // Listen to hash changes (browser forward/back or external deep link)
  useEffect(() => {
    const syncFromHash = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, "");
      const match = rawHash.match(/^c\/([^/]+)(?:\/t\/([^/]+))?/);
      if (!match) return;
      const [, convId, threadId] = match;
      if (!convId) return;

      const allConvs = [...channels, ...dms];
      const target = allConvs.find((c) => c.id === convId);
      if (target && target.id !== activeConversation?.id) {
        setActiveConversation(target);
      }

      if (threadId) {
        setActiveThreadMessage((prev) =>
          prev?.id === threadId ? prev : ({ id: threadId, conversation_id: convId } as Message),
        );
      } else if (!threadId && activeThreadMessage) {
        setActiveThreadMessage(null);
      }
    };

    window.addEventListener("hashchange", syncFromHash);
    syncFromHash();
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [channels, dms, activeConversation?.id, activeThreadMessage]);

  // Handle live WebSocket unread updates for non-active conversations
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "message.created") {
      const msg = (lastEvent.payload as { message?: Message })?.message;
      if (msg && msg.conversation_id !== activeConversation?.id) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === msg.conversation_id ? { ...c, unread_count: (c.unread_count ?? 0) + 1 } : c,
          ),
        );
        setDms((prev) =>
          prev.map((d) =>
            d.id === msg.conversation_id ? { ...d, unread_count: (d.unread_count ?? 0) + 1 } : d,
          ),
        );
      }
    }
  }, [lastEvent, activeConversation?.id]);

  // Host Action Handlers
  const handleOpenObject = (obj: WorkOSObjectRef) => {
    if (hostOnOpenObject) {
      hostOnOpenObject(obj);
    }
    setActiveObject(obj);
  };

  const handleCreateTask = (ctx: { messageId: string; content: string; authorName: string }) => {
    if (hostOnCreateTask) {
      hostOnCreateTask(ctx);
    }
    setActiveTaskContext(ctx);
  };

  // Create Channel Handler
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newChannelName.trim()) return;

    try {
      const res = await apiRequest<{ data: Conversation }>("/v1/channels", token, {
        method: "POST",
        body: JSON.stringify({
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
          topic: newChannelTopic.trim() || undefined,
          kind: newChannelKind,
          is_announcement_only: newChannelKind === "announcement",
        }),
      });

      setChannels((prev) => [...prev, res.data]);
      setActiveConversation(res.data);
      setCreateChannelOpen(false);
      setNewChannelName("");
      setNewChannelTopic("");
      setNewChannelKind("public");
    } catch (err) {
      console.error("Failed to create channel:", err);
    }
  };

  // Search Users for DM People Picker
  useEffect(() => {
    if (!createDmOpen || !token) return;
    const timeout = setTimeout(async () => {
      try {
        setSearchingUsers(true);
        const res = await apiRequest<{ data: User[] }>(
          `/v1/users/search?q=${encodeURIComponent(userSearchQuery)}`,
          token,
        );
        setSearchResults(res.data.filter((u) => u.id !== currentUser?.id));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [userSearchQuery, createDmOpen, token, currentUser?.id]);

  // Start DM with selected user
  const handleStartDm = async (recipientId: string) => {
    if (!token) return;
    try {
      const res = await apiRequest<{ data: Conversation }>("/v1/dms", token, {
        method: "POST",
        body: JSON.stringify({ recipient_id: recipientId }),
      });

      setDms((prev) => {
        if (prev.some((d) => d.id === res.data.id)) return prev;
        return [res.data, ...prev];
      });
      setActiveConversation(res.data);
      setCreateDmOpen(false);
      setUserSearchQuery("");
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  };

  // Notification click handler: opens conversation & highlights message
  const handleSelectNotification = (conversationId: string, messageId?: string | null) => {
    const target =
      channels.find((c) => c.id === conversationId) ??
      dms.find((d) => d.id === conversationId);

    if (target) {
      setActiveConversation(target);
    } else {
      void apiRequest<{ data: Conversation[] }>(`/v1/channels`, token ?? "").then((res) => {
        const found = res.data.find((c: Conversation) => c.id === conversationId);
        if (found) setActiveConversation(found);
      });
    }

    if (messageId) {
      setHighlightMessageId(messageId);
      setTimeout(() => setHighlightMessageId(null), 3500);
    }
  };

  // Search selection handler
  const handleSelectSearchResult = (conversationId: string, messageId: string) => {
    handleSelectNotification(conversationId, messageId);
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[var(--bg-canvas)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-xs text-[var(--fg-muted)]">Signing in with Mock IdP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[var(--bg-canvas)] text-[var(--fg-primary)] overflow-hidden font-sans select-none antialiased">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col shrink-0">
        {/* Workspace Brand / Header */}
        <div className="h-13 px-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="h-7 w-7 rounded-[6px] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser?.company.name.slice(0, 1) ?? "W"}
            </div>
            <div className="truncate">
              <h1 className="text-xs font-bold text-[var(--fg-primary)] truncate">
                {currentUser?.company.name ?? "WorkOS"}
              </h1>
              <span className="text-[10px] text-[var(--fg-muted)]">Internal Communication</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NotificationFlyout onSelectNotification={handleSelectNotification} />
            <button
              onClick={() => setSearchModalOpen(true)}
              className="p-1.5 rounded-[4px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              title="Search (Cmd+K)"
            >
              <Search className="h-4 w-4" />
            </button>
            {currentUser?.permissions?.includes("communication.audit.read") && (
              <button
                onClick={() => setAuditLogOpen(true)}
                className="p-1.5 rounded-[4px] text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                title="Audit Trail"
              >
                <Shield className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Channel Navigation Stream */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Channels Section */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
              <span>Channels</span>
              <button
                onClick={() => setCreateChannelOpen(true)}
                className="p-0.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
                title="Create channel"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-1.5 px-2 py-1">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : (
              channels.map((ch) => {
                const isActive = activeConversation?.id === ch.id;
                const isAnnounce = ch.kind === "announcement" || ch.is_announcement_only;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setActiveConversation(ch);
                      setActiveThreadMessage(null);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[var(--accent)] text-white font-medium shadow-xs"
                        : "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isAnnounce ? (
                        <Megaphone className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-amber-400"}`} />
                      ) : ch.kind === "private" ? (
                        <Lock className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-[var(--fg-muted)]"}`} />
                      ) : (
                        <Hash className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-[var(--fg-muted)]"}`} />
                      )}
                      <span className="truncate">{ch.name}</span>
                    </div>
                    {Boolean(ch.unread_count && ch.unread_count > 0) && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-white text-[var(--accent)]" : "bg-[var(--accent)] text-white"
                      }`}>
                        {ch.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Direct Messages Section */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
              <span>Direct Messages</span>
              <button
                onClick={() => setCreateDmOpen(true)}
                className="p-0.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
                title="New direct message"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {dms.length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-[var(--fg-subtle)] flex items-center justify-between">
                <span>No active DMs</span>
                <Button variant="ghost" size="xs" onClick={() => setCreateDmOpen(true)} className="h-5 text-[10px]">
                  Start one
                </Button>
              </div>
            ) : (
              dms.map((dm) => {
                const isActive = activeConversation?.id === dm.id;
                return (
                  <button
                    key={dm.id}
                    onClick={() => {
                      setActiveConversation(dm);
                      setActiveThreadMessage(null);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[var(--accent)] text-white font-medium shadow-xs"
                        : "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Avatar
                        name={dm.dm_user?.name ?? "Member"}
                        src={dm.dm_user?.avatar_url}
                        size="xs"
                        presence={dm.dm_user?.presence ?? "online"}
                      />
                      <span className="truncate">{dm.dm_user?.name ?? "Direct Message"}</span>
                    </div>
                    {Boolean(dm.unread_count && dm.unread_count > 0) && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-white text-[var(--accent)]" : "bg-[var(--accent)] text-white"
                      }`}>
                        {dm.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between p-1.5 rounded-[6px] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar
                    name={currentUser?.name}
                    src={currentUser?.avatar_url}
                    size="sm"
                    presence="online"
                  />
                  <div className="text-left truncate">
                    <p className="text-xs font-semibold text-[var(--fg-primary)] truncate">
                      {currentUser?.name}
                    </p>
                    <p className="text-[10px] text-[var(--fg-muted)] truncate flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        wsStatus === "connected" ? "bg-emerald-500 animate-pulse" : wsStatus === "reconnecting" ? "bg-amber-500" : "bg-rose-500"
                      }`} />
                      {wsStatus === "connected" ? "Live Connected" : wsStatus === "reconnecting" ? "Reconnecting" : "Offline"}
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--fg-muted)] shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5 border-b border-[var(--border-subtle)]">
                <p className="text-xs font-bold text-[var(--fg-primary)]">{currentUser?.name}</p>
                <p className="text-[10px] text-[var(--fg-muted)]">{currentUser?.company.name}</p>
              </div>

              <div className="px-2 py-1 text-[10px] uppercase font-bold text-[var(--fg-muted)]">
                Switch Demo User
              </div>
              {DEMO_USERS.map((u) => (
                <DropdownMenuItem
                  key={u.tag}
                  onClick={() => void switchUser(u.tag)}
                  className={`flex items-center justify-between ${
                    currentTag === u.tag ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold" : ""
                  }`}
                >
                  <span>{u.name}</span>
                  <span className="text-[10px] text-[var(--fg-subtle)]">{u.role}</span>
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme} className="flex items-center justify-between">
                <span>Theme</span>
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Conversation Center */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeConversation ? (
          <ConversationView
            key={activeConversation.id}
            conversation={activeConversation}
            onOpenThread={(msg) => setActiveThreadMessage(msg)}
            highlightMessageId={highlightMessageId}
            onOpenObject={handleOpenObject}
            onCreateTask={handleCreateTask}
            onOpenChannelSettings={() => setChannelAdminTarget(activeConversation)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Hash className="h-10 w-10 text-[var(--fg-subtle)] mb-3" />
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">Select a channel</h3>
            <p className="text-xs text-[var(--fg-muted)] mt-1">Choose a channel or direct message from the sidebar.</p>
          </div>
        )}
      </main>

      {/* Slide-out Thread Panel */}
      {activeConversation && activeThreadMessage && (
        <ThreadPanel
          conversation={activeConversation}
          rootMessage={activeThreadMessage}
          onClose={() => setActiveThreadMessage(null)}
          onOpenObject={handleOpenObject}
        />
      )}

      {/* Search Modal */}
      <SearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Audit Log Modal */}
      <AuditLogViewer
        open={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
      />

      {/* Channel Settings & Admin Modal */}
      {channelAdminTarget && (
        <ChannelAdminModal
          channel={channelAdminTarget}
          onClose={() => setChannelAdminTarget(null)}
          onChannelUpdated={(updated) => {
            setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            if (activeConversation?.id === updated.id) {
              setActiveConversation(updated);
            }
            setChannelAdminTarget(updated);
          }}
        />
      )}

      {/* WorkOS Object Drawer */}
      {activeObject && (
        <WorkOSObjectDrawer
          object={activeObject}
          onClose={() => setActiveObject(null)}
          onRequestCreateTask={() => {
            setActiveTaskContext({
              messageId: activeConversation?.id ?? "manual",
              content: `Reviewing WorkOS ${activeObject.type.toUpperCase()}: ${activeObject.title}`,
              authorName: currentUser?.name ?? "Team Member",
            });
          }}
        />
      )}

      {/* Create Task Modal */}
      {activeTaskContext && (
        <CreateTaskModal
          context={activeTaskContext}
          onClose={() => setActiveTaskContext(null)}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        channels={channels}
        onSelectConversation={(conv) => {
          setActiveConversation(conv);
          setActiveThreadMessage(null);
        }}
      />

      {/* Create Channel Dialog */}
      <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>
              Channels are where conversations happen around topics, projects, or teams.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateChannel} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-[var(--fg-secondary)] block mb-1.5">
                Channel Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[var(--fg-subtle)] text-xs font-mono">#</span>
                <Input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. project-alpha"
                  className="pl-7 text-xs"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--fg-secondary)] block mb-1.5">
                Topic (optional)
              </label>
              <Input
                value={newChannelTopic}
                onChange={(e) => setNewChannelTopic(e.target.value)}
                placeholder="What is this channel about?"
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--fg-secondary)] block mb-1.5">
                Channel Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewChannelKind("public")}
                  className={`p-2.5 rounded-[6px] border text-left cursor-pointer transition-colors ${
                    newChannelKind === "public"
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)]/30 text-[var(--fg-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <Hash className="h-4 w-4 mb-1 text-[var(--accent)]" />
                  <p className="text-xs font-semibold">Public</p>
                  <p className="text-[10px] text-[var(--fg-subtle)]">Open to anyone</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNewChannelKind("private")}
                  className={`p-2.5 rounded-[6px] border text-left cursor-pointer transition-colors ${
                    newChannelKind === "private"
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)]/30 text-[var(--fg-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <Lock className="h-4 w-4 mb-1 text-amber-500" />
                  <p className="text-xs font-semibold">Private</p>
                  <p className="text-[10px] text-[var(--fg-subtle)]">Invite only</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNewChannelKind("announcement")}
                  className={`p-2.5 rounded-[6px] border text-left cursor-pointer transition-colors ${
                    newChannelKind === "announcement"
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)]/30 text-[var(--fg-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <Megaphone className="h-4 w-4 mb-1 text-purple-400" />
                  <p className="text-xs font-semibold">Announce</p>
                  <p className="text-[10px] text-[var(--fg-subtle)]">Admins post only</p>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateChannelOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!newChannelName.trim()}>
                Create Channel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* People Picker / Direct Message Dialog */}
      <Dialog open={createDmOpen} onOpenChange={setCreateDmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
            <DialogDescription>
              Select a colleague from your organization to start a conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-[var(--fg-muted)]" />
              <Input
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-9 text-xs"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg">
              {searchingUsers ? (
                <div className="p-4 text-center text-xs text-[var(--fg-muted)]">Searching members...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--fg-muted)]">
                  {userSearchQuery ? "No members found" : "Type to search company members"}
                </div>
              ) : (
                searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => void handleStartDm(user.id)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-[var(--bg-subtle)] transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={user.name} src={user.avatar_url} size="sm" presence="online" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--fg-primary)]">{user.name}</p>
                        <p className="text-[10px] text-[var(--fg-muted)]">Team Member</p>
                      </div>
                    </div>
                    <UserPlus className="h-4 w-4 text-[var(--fg-subtle)]" />
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
