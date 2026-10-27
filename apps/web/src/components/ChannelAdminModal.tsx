import React, { useState, useEffect } from "react";
import { X, Users, UserPlus, UserMinus, Archive, RotateCcw, Hash, Lock, ShieldAlert, Check, Loader2 } from "lucide-react";
import { Button, Input, Avatar, Badge } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import type { Conversation, User } from "../types.js";

interface ChannelMember {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  user?: User;
}

interface ChannelAdminModalProps {
  channel: Conversation;
  onClose: () => void;
  onChannelUpdated: (updated: Conversation) => void;
}

export const ChannelAdminModal: React.FC<ChannelAdminModalProps> = ({
  channel,
  onClose,
  onChannelUpdated,
}) => {
  const { token, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"members" | "settings">("members");
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [candidateUsers, setCandidateUsers] = useState<User[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [savingTopic, setSavingTopic] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const canManageChannel =
    currentUser?.permissions?.includes("communication.channel.manage") ?? false;
  const canManageMembers =
    currentUser?.permissions?.includes("communication.member.manage") ?? false;

  // Fetch current members
  useEffect(() => {
    if (!token || !channel.id) return;
    setLoadingMembers(true);
    apiRequest<{ data: ChannelMember[] }>(`/v1/conversations/${channel.id}/members`, token)
      .then((res) => {
        setMembers(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch members:", err);
      })
      .finally(() => {
        setLoadingMembers(false);
      });
  }, [channel.id, token]);

  // Search candidate users to add
  useEffect(() => {
    if (!searchQuery.trim() || !token) {
      setCandidateUsers([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchingCandidates(true);
      apiRequest<{ data: User[] }>(`/v1/users/search?q=${encodeURIComponent(searchQuery)}`, token)
        .then((res) => {
          const currentMemberIds = new Set(members.map((m) => m.user_id));
          setCandidateUsers(res.data.filter((u) => !currentMemberIds.has(u.id)));
        })
        .catch(() => setCandidateUsers([]))
        .finally(() => setSearchingCandidates(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, token, members]);

  const handleAddMember = async (userId: string) => {
    if (!token) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiRequest<{ data: ChannelMember }>(
        `/v1/conversations/${channel.id}/members`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ user_id: userId, role: "member" }),
        },
      );
      setMembers((prev) => [...prev, res.data]);
      setActionSuccess("Member added successfully");
      setSearchQuery("");
      setCandidateUsers([]);
      onChannelUpdated({ ...channel, member_count: (channel.member_count ?? 1) + 1 });
    } catch (err: any) {
      setActionError(err.message ?? "Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!token) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiRequest(
        `/v1/conversations/${channel.id}/members/${userId}`,
        token,
        { method: "DELETE" },
      );
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setActionSuccess("Member removed");
      onChannelUpdated({ ...channel, member_count: Math.max(1, (channel.member_count ?? 2) - 1) });
    } catch (err: any) {
      setActionError(err.message ?? "Failed to remove member");
    }
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canManageChannel) return;
    setSavingTopic(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiRequest<{ data: Conversation }>(
        `/v1/channels/${channel.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ topic }),
        },
      );
      onChannelUpdated(res.data);
      setActionSuccess("Channel topic updated");
    } catch (err: any) {
      setActionError(err.message ?? "Failed to update channel");
    } finally {
      setSavingTopic(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!token || !canManageChannel) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const endpoint = channel.is_archived
        ? `/v1/channels/${channel.id}/unarchive`
        : `/v1/channels/${channel.id}/archive`;
      const res = await apiRequest<{ data: Conversation }>(endpoint, token, { method: "POST" });
      onChannelUpdated(res.data);
      setActionSuccess(res.data.is_archived ? "Channel archived" : "Channel restored");
    } catch (err: any) {
      setActionError(err.message ?? "Failed to archive channel");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[var(--bg-surface,#ffffff)] rounded-2xl max-w-lg w-full shadow-2xl border border-[var(--border-subtle,#e2e8f0)] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-subtle,#e2e8f0)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle,#e0e7ff)] text-[var(--accent,#4f46e5)] flex items-center justify-center font-bold">
              {channel.kind === "private" ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--fg-primary,#0f172a)] flex items-center gap-2">
                #{channel.name}
                {channel.is_archived && (
                  <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                    Archived
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-[var(--fg-muted,#64748b)]">Channel Management & Permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--fg-muted,#64748b)] hover:text-[var(--fg-primary,#0f172a)] hover:bg-[var(--bg-subtle,#f1f5f9)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-subtle,#e2e8f0)] px-6 shrink-0 bg-[var(--bg-subtle,#f8fafc)]">
          <button
            onClick={() => setActiveTab("members")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "members"
                ? "border-[var(--accent,#4f46e5)] text-[var(--accent,#4f46e5)]"
                : "border-transparent text-[var(--fg-muted,#64748b)] hover:text-[var(--fg-primary,#0f172a)]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "border-[var(--accent,#4f46e5)] text-[var(--accent,#4f46e5)]"
                : "border-transparent text-[var(--fg-muted,#64748b)] hover:text-[var(--fg-primary,#0f172a)]"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Settings & Archive
          </button>
        </div>

        {/* Feedback alerts */}
        {actionError && (
          <div className="mx-6 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="mx-6 mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "members" ? (
            <div className="space-y-4">
              {/* Add member search */}
              {canManageMembers && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--fg-secondary,#475569)] block">
                    Add Team Member
                  </label>
                  <div className="relative">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search company members to add..."
                      className="text-xs"
                    />
                    {searchingCandidates && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-2.5 text-[var(--fg-muted)]" />
                    )}
                  </div>
                  {candidateUsers.length > 0 && (
                    <div className="border border-[var(--border-subtle,#e2e8f0)] rounded-lg divide-y divide-[var(--border-subtle,#e2e8f0)] max-h-36 overflow-y-auto bg-[var(--bg-canvas,#ffffff)]">
                      {candidateUsers.map((user) => (
                        <div
                          key={user.id}
                          className="p-2 flex items-center justify-between hover:bg-[var(--bg-subtle,#f8fafc)] text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={user.name} src={user.avatar_url} size="xs" />
                            <span className="font-medium text-[var(--fg-primary,#0f172a)]">{user.name}</span>
                          </div>
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleAddMember(user.id)}
                            className="flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[var(--fg-secondary,#475569)] block">
                  Current Channel Members
                </span>
                {loadingMembers ? (
                  <div className="py-6 text-center text-xs text-[var(--fg-muted)]">Loading members...</div>
                ) : (
                  <div className="border border-[var(--border-subtle,#e2e8f0)] rounded-xl divide-y divide-[var(--border-subtle,#e2e8f0)] bg-[var(--bg-canvas,#ffffff)] max-h-56 overflow-y-auto">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 flex items-center justify-between hover:bg-[var(--bg-subtle,#f8fafc)] transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={m.user?.name ?? `User ${m.user_id.slice(0, 5)}`}
                            src={m.user?.avatar_url}
                            size="sm"
                          />
                          <div className="truncate">
                            <p className="font-semibold text-[var(--fg-primary,#0f172a)] truncate">
                              {m.user?.name ?? m.user_id}
                            </p>
                            <span className="text-[10px] text-[var(--fg-muted,#64748b)] capitalize">
                              {m.role}
                            </span>
                          </div>
                        </div>

                        {canManageMembers && m.user_id !== currentUser?.id && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove member"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Channel Topic */}
              <form onSubmit={handleSaveTopic} className="space-y-3">
                <label className="text-xs font-semibold text-[var(--fg-secondary,#475569)] block">
                  Channel Topic
                </label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Set channel topic or description..."
                  className="text-xs"
                  disabled={!canManageChannel}
                />
                {canManageChannel && (
                  <Button type="submit" size="xs" variant="primary" disabled={savingTopic}>
                    {savingTopic ? "Saving..." : "Save Topic"}
                  </Button>
                )}
              </form>

              {/* Archive / Unarchive */}
              {canManageChannel && (
                <div className="pt-4 border-t border-[var(--border-subtle,#e2e8f0)] space-y-3">
                  <span className="text-xs font-bold text-[var(--fg-primary,#0f172a)] block">
                    {channel.is_archived ? "Restore Channel" : "Archive Channel"}
                  </span>
                  <p className="text-xs text-[var(--fg-muted,#64748b)]">
                    {channel.is_archived
                      ? "Unarchiving this channel will restore it for all members and allow new messages."
                      : "Archiving this channel hides it from active navigation and prevents new messages. Existing messages remain searchable."}
                  </p>
                  <Button
                    type="button"
                    variant={channel.is_archived ? "outline" : "danger"}
                    size="sm"
                    onClick={handleToggleArchive}
                    className="flex items-center gap-1.5"
                  >
                    {channel.is_archived ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Unarchive #{channel.name}
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5" />
                        Archive #{channel.name}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
