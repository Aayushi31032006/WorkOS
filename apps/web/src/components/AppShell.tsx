import React, { useEffect, useState, useCallback } from "react";
import {
  Hash,
  Lock,
  Plus,
  MessageSquare,
  Search,
  Moon,
  Sun,
  Radio,
  ChevronDown,
  Building2,
  Users,
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
import type { Conversation, Message, User } from "../types.js";

export function AppShell() {
  const { currentUser, currentTag, switchUser, theme, toggleTheme, token, loading: authLoading } = useAuth();
  const { status: wsStatus } = useWebSocket();

  const [channels, setChannels] = useState<Conversation[]>([]);
  const [dms, setDms] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<"public" | "private">("public");
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

      if (!activeConversation && chRes.data.length > 0) {
        setActiveConversation(chRes.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch navigation items:", err);
    } finally {
      setLoading(false);
    }
  }, [token, activeConversation]);

  useEffect(() => {
    void fetchNav();
  }, [fetchNav]);

  const handleCreateChannel = async () => {
    if (!token || !newChannelName.trim()) return;
    try {
      const res = await apiRequest<{ data: Conversation }>("/v1/channels", token, {
        method: "POST",
        body: JSON.stringify({
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
          kind: newChannelKind,
        }),
      });
      setChannels((prev) => [...prev, res.data]);
      setActiveConversation(res.data);
      setCreateChannelOpen(false);
      setNewChannelName("");
    } catch (err) {
      console.error("Failed to create channel:", err);
    }
  };

  const handleSelectConversationById = (id: string) => {
    const found = [...channels, ...dms].find((c) => c.id === id);
    if (found) {
      setActiveConversation(found);
      setActiveThreadMessage(null);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="space-y-3 text-center">
          <div className="h-8 w-8 mx-auto border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[var(--fg-muted)]">Signing into WorkOS Communications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-canvas)] text-[var(--fg-primary)] select-none">
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
              <span className="text-[10px] text-[var(--fg-muted)]">Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NotificationFlyout onSelectConversation={handleSelectConversationById} />
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="p-1.5 rounded-[4px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              title="Search (Cmd+K)"
            >
              <Search className="h-4 w-4" />
            </button>
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
                      {ch.kind === "private" ? (
                        <Lock className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-[var(--fg-muted)]"}`} />
                      ) : (
                        <Hash className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-[var(--fg-muted)]"}`} />
                      )}
                      <span className="truncate">{ch.name}</span>
                    </div>
                    {ch.unread_count && ch.unread_count > 0 ? (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-white text-[var(--accent)]" : "bg-[var(--accent)] text-white"
                      }`}>
                        {ch.unread_count}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {/* Direct Messages Section */}
          <div className="space-y-0.5">
            <div className="px-2 py-1 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
              <span>Direct Messages</span>
            </div>

            {dms.length === 0 ? (
              <div className="px-2.5 py-1 text-[11px] text-[var(--fg-subtle)]">No active DMs</div>
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
                        name={dm.other_user?.name ?? "User"}
                        size="xs"
                        presence={dm.other_user?.presence ?? "online"}
                      />
                      <span className="truncate">{dm.other_user?.name ?? "Direct Message"}</span>
                    </div>
                    {dm.unread_count && dm.unread_count > 0 ? (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-white text-[var(--accent)]" : "bg-[var(--accent)] text-white"
                      }`}>
                        {dm.unread_count}
                      </span>
                    ) : null}
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
                        wsStatus === "connected" ? "bg-emerald-500" : wsStatus === "reconnecting" ? "bg-amber-500" : "bg-rose-500"
                      }`} />
                      {wsStatus === "connected" ? "Online" : wsStatus}
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

      {/* Main Conversation Pane */}
      <main className="flex-1 flex min-w-0 h-full">
        {activeConversation ? (
          <ConversationView
            conversation={activeConversation}
            onOpenThread={(msg) => setActiveThreadMessage(msg)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--fg-muted)]">
            Select a channel to start messaging
          </div>
        )}

        {/* Right Thread Slide-out Panel */}
        {activeConversation && activeThreadMessage && (
          <ThreadPanel
            conversation={activeConversation}
            rootMessage={activeThreadMessage}
            onClose={() => setActiveThreadMessage(null)}
          />
        )}
      </main>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        conversations={[...channels, ...dms]}
        onSelect={(conv) => {
          setActiveConversation(conv);
          setActiveThreadMessage(null);
        }}
      />

      {/* Create Channel Dialog */}
      <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>
              Channels are where your team communicates on a topic.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg-primary)]">Channel Name</label>
              <Input
                placeholder="e.g. project-launch"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg-primary)]">Visibility</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newChannelKind === "public" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setNewChannelKind("public")}
                  className="flex-1"
                >
                  <Hash className="h-3.5 w-3.5 mr-1" /> Public
                </Button>
                <Button
                  type="button"
                  variant={newChannelKind === "private" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setNewChannelKind("private")}
                  className="flex-1"
                >
                  <Lock className="h-3.5 w-3.5 mr-1" /> Private
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setCreateChannelOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateChannel} disabled={!newChannelName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}