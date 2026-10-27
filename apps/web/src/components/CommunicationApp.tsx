import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  MessageSquare,
  Hash,
  FileText,
  Search,
  Users,
  Bell,
  Shield,
  Settings,
  Plus,
  HelpCircle,
  MoreHorizontal,
  Wifi,
  WifiOff,
  LogOut,
  ChevronDown,
  CheckCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import {
  Channel,
  CommunicationAppProps,
  Message,
  TokenClaims,
  User,
  WorkOSObjectRef,
} from '../packages/contracts/types';
import {
  MOCK_TOKENS,
  SYNTHETIC_USERS,
} from '../packages/test-fixtures/fixtures';
import {
  communicationEngine,
  ConnectionStatus,
  WorkOSCommunicationClient,
} from '../packages/sdk/client';
import { WorkOSLogo } from './WorkOSLogo';
import { HomeDashboard } from './HomeDashboard';
import { ConversationView } from './ConversationView';
import { ThreadDrawer } from './ThreadDrawer';
import { SearchModal } from './SearchModal';
import { NewMessageModal } from './NewMessageModal';
import { NewChannelModal } from './NewChannelModal';
import { ChannelAdminModal } from './ChannelAdminModal';
import { WorkOSObjectDrawer } from './WorkOSObjectDrawer';
import { CreateTaskModal } from './CreateTaskModal';
import { AuditLogViewer } from './AuditLogViewer';
import { AcceptanceSuiteModal } from './AcceptanceSuiteModal';
import { ContractsDocsModal } from './ContractsDocsModal';

export const CommunicationApp: React.FC<CommunicationAppProps> = ({
  getAccessToken,
  onOpenObject: hostOnOpenObject,
  onCreateTask: hostOnCreateTask,
  theme,
  initialChannelId,
  embedded = false,
}) => {
  const [claims, setClaims] = useState<TokenClaims | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initialChannelId || null);
  const [currentView, setCurrentView] = useState<'home' | 'conversation'>('home');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);

  // Modals
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchInitialFilter, setSearchInitialFilter] = useState('all');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [adminChannel, setAdminChannel] = useState<Channel | null>(null);
  const [openedObject, setOpenedObject] = useState<WorkOSObjectRef | null>(null);
  const [taskModalContext, setTaskModalContext] = useState<{
    messageId: string;
    content: string;
    authorName: string;
  } | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const [showContractsModal, setShowContractsModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');

  // Load claims from getAccessToken
  const initSession = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const client = new WorkOSCommunicationClient({ getAccessToken });
      const resolvedClaims = await client.getClaims();
      setClaims(resolvedClaims);

      const userChannels = communicationEngine.getChannels(resolvedClaims);
      setChannels(userChannels);

      if (initialChannelId) {
        setActiveChannelId(initialChannelId);
        setCurrentView('conversation');
      }
    } catch (err) {
      console.error('Session init error', err);
    }
  }, [getAccessToken, initialChannelId]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Load messages for active channel
  const loadChannelMessages = useCallback(
    (channelId: string) => {
      if (!claims) return;
      try {
        const msgs = communicationEngine.getMessages(claims, channelId);
        setMessages(msgs);
        communicationEngine.markChannelRead(channelId);
      } catch (err: any) {
        console.error('Failed to load messages for channel', err);
      }
    },
    [claims]
  );

  useEffect(() => {
    if (activeChannelId && claims) {
      loadChannelMessages(activeChannelId);
    }
  }, [activeChannelId, claims, loadChannelMessages]);

  // Real-time engine event subscriptions
  useEffect(() => {
    const unsubMsg = communicationEngine.subscribe('message.created', (newMsg: Message) => {
      if (newMsg.channel_id === activeChannelId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      // Refresh channels for unread counters and snippets
      if (claims) {
        setChannels(communicationEngine.getChannels(claims));
      }
    });

    const unsubUpdated = communicationEngine.subscribe('message.updated', (updated: Message) => {
      if (updated.channel_id === activeChannelId) {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    });

    const unsubChan = communicationEngine.subscribe('channel.created', () => {
      if (claims) setChannels(communicationEngine.getChannels(claims));
    });

    const unsubChanUp = communicationEngine.subscribe('channel.updated', () => {
      if (claims) setChannels(communicationEngine.getChannels(claims));
    });

    const unsubConn = communicationEngine.subscribe(
      'connection.changed',
      (status: ConnectionStatus) => {
        setConnectionStatus(status);
      }
    );

    return () => {
      unsubMsg();
      unsubUpdated();
      unsubChan();
      unsubChanUp();
      unsubConn();
    };
  }, [activeChannelId, claims]);

  // ⌘K Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setCurrentView('conversation');
    setActiveThreadMessage(null);
  };

  const handleOpenObject = (obj: WorkOSObjectRef) => {
    if (hostOnOpenObject) {
      hostOnOpenObject(obj);
    }
    setOpenedObject(obj);
  };

  const handleCreateTask = (ctx: {
    messageId: string;
    content: string;
    authorName: string;
  }) => {
    if (hostOnCreateTask) {
      hostOnCreateTask(ctx);
    }
    setTaskModalContext(ctx);
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  if (!claims) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f4f6fa]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">
            Validating WorkOS signed session claims...
          </p>
        </div>
      </div>
    );
  }

  const userInitials = claims.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen w-full bg-[#edf3fc] overflow-hidden select-none font-sans">
      {/* Left Sidebar (Deep Sapphire Blue Theme) */}
      <aside className="w-64 bg-[#0a1a36] text-blue-100 flex flex-col justify-between shrink-0 border-r border-blue-900/60 z-20">
        <div>
          {/* Logo & Workspace Title */}
          <div className="px-6 py-6 border-b border-blue-900/60">
            <WorkOSLogo theme="dark" size="md" />
          </div>

          {/* Navigation Links */}
          <div className="px-4 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-170px)]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block px-3 mb-2">
                WORKSPACE
              </span>
              <nav className="space-y-1">
                {/* Home */}
                <button
                  onClick={() => {
                    setCurrentView('home');
                    setActiveThreadMessage(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    currentView === 'home'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>

                {/* Messages */}
                <button
                  onClick={() => {
                    // Jump to direct messages
                    const dm = channels.find((c) => c.type === 'direct');
                    if (dm) handleSelectChannel(dm.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    activeChannel?.type === 'direct' && currentView === 'conversation'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4" />
                    <span>Messages</span>
                  </div>
                  <span className="px-1.5 py-0.2 bg-blue-900 text-blue-200 rounded-md text-[10px] font-mono">
                    4
                  </span>
                </button>

                {/* Channels */}
                <button
                  onClick={() => {
                    handleSelectChannel('chan_engineering');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    activeChannel?.type !== 'direct' && currentView === 'conversation'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span>Channels</span>
                </button>

                {/* Files */}
                <button
                  onClick={() => {
                    setSearchInitialFilter('files');
                    setShowSearchModal(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <FileText className="w-4 h-4" />
                  <span>Files</span>
                </button>

                {/* Search */}
                <button
                  onClick={() => {
                    setSearchInitialFilter('all');
                    setShowSearchModal(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>

                {/* People */}
                <button
                  onClick={() => setShowNewMessageModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <Users className="w-4 h-4" />
                  <span>People</span>
                </button>

                {/* Notifications */}
                <button
                  onClick={() => handleSelectChannel('chan_engineering')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <Bell className="w-4 h-4" />
                  <span>Notifications</span>
                </button>

                {/* Admin */}
                <button
                  onClick={() => setShowAuditModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </button>

                {/* Settings */}
                <button
                  onClick={() => setShowContractsModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
              </nav>
            </div>

            {/* YOUR TEAMS section matching screenshot */}
            <div className="pt-2">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  YOUR TEAMS
                </span>
                <button
                  onClick={() => setShowNewChannelModal(true)}
                  className="text-slate-400 hover:text-white transition"
                  title="Create new channel"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                {channels
                  .filter((c) => c.type !== 'direct')
                  .slice(0, 6)
                  .map((chan) => {
                    const isActive = activeChannelId === chan.id && currentView === 'conversation';
                    return (
                      <button
                        key={chan.id}
                        onClick={() => handleSelectChannel(chan.id)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition text-left group ${
                          isActive
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-blue-400 group-hover:bg-white'}`} />
                          <span className="truncate">{chan.name}</span>
                        </div>
                        {chan.unread_count ? (
                          <span className="w-4 h-4 rounded-full bg-white text-blue-900 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {chan.unread_count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* User Account / Persona Footer Bar */}
        <div className="p-4 border-t border-blue-900/60 relative">
          <div className="flex items-center justify-between">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                {userInitials[0]}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate group-hover:text-blue-200">
                  {claims.name.split(' ')[0]}
                </div>
                <div className="text-[10px] text-blue-300/70 truncate">Workspace member</div>
              </div>
            </div>

            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-1 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition"
              title="Session & persona menu"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* User Popover Menu */}
          {showUserMenu && (
            <div className="absolute left-4 right-4 bottom-full mb-2 bg-[#0a1a36] border border-blue-800 rounded-2xl shadow-2xl p-2 z-50 text-xs text-white">
              <div className="px-3 py-2 border-b border-blue-900/80 mb-1">
                <div className="font-bold text-blue-100">{claims.name}</div>
                <div className="text-[10px] text-blue-300">{claims.email}</div>
                <div className="text-[10px] text-blue-400 font-mono mt-0.5">
                  Tenant: {claims.company_id}
                </div>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAuditModal(true);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-white/10 rounded-xl text-left flex items-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span>Audit Logs</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAcceptanceModal(true);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-white/10 rounded-xl text-left flex items-center gap-2 text-emerald-400 font-semibold"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Acceptance Suite</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowContractsModal(true);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-white/10 rounded-xl text-left flex items-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>API Contracts</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Viewport (Blue Shade Theme) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#edf3fc]">
        {/* Top Header Bar */}
        <header className="h-16 px-6 lg:px-8 bg-[#edf3fc] border-b border-blue-100/90 flex items-center justify-between shrink-0 z-10">
          {/* Omnibox Search bar */}
          <div
            onClick={() => setShowSearchModal(true)}
            className="w-full max-w-md bg-white rounded-xl border border-blue-100 px-3.5 py-2 flex items-center justify-between text-xs text-slate-400 hover:border-blue-300 hover:shadow-xs transition cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-3.5 h-3.5 text-blue-500" />
              <span>Search messages, files, people...</span>
            </div>
            <kbd className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200">
              ⌘K
            </kbd>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Connection Status Badge */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-blue-100 px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-slate-700">Connected</span>
            </div>

            {/* Help / Contracts Icon */}
            <button
              onClick={() => setShowContractsModal(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-white transition"
              title="Integration Contracts & API"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Notification Bell with unread dot */}
            <div className="relative">
              <button
                onClick={() => handleSelectChannel('chan_engineering')}
                className="p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-white transition"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-[#edf3fc]" />
            </div>

            {/* Avatar Pill */}
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {userInitials}
            </div>

            {/* "+ New message" Primary Blue Action Button */}
            <button
              onClick={() => setShowNewMessageModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-500/25 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New message</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <div className="flex-1 flex overflow-hidden">
          {currentView === 'home' ? (
            <HomeDashboard
              claims={claims}
              channels={channels}
              onSelectChannel={handleSelectChannel}
              onOpenSearch={(filter) => {
                setSearchInitialFilter(filter || 'all');
                setShowSearchModal(true);
              }}
              onOpenAuditLogs={() => setShowAuditModal(true)}
              onOpenNewMessage={() => setShowNewMessageModal(true)}
            />
          ) : activeChannel ? (
            <ConversationView
              claims={claims}
              channel={activeChannel}
              messages={messages}
              onOpenThread={(msg) => setActiveThreadMessage(msg)}
              onOpenObject={handleOpenObject}
              onCreateTask={handleCreateTask}
              onOpenChannelAdmin={(chan) => setAdminChannel(chan)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              Select a channel from the left sidebar to start communicating.
            </div>
          )}

          {/* Sliding Thread Drawer */}
          {activeThreadMessage && activeChannelId && (
            <ThreadDrawer
              claims={claims}
              parentMessage={activeThreadMessage}
              channelId={activeChannelId}
              onClose={() => setActiveThreadMessage(null)}
            />
          )}
        </div>
      </div>

      {/* Global Modals */}
      {showSearchModal && (
        <SearchModal
          claims={claims}
          initialFilter={searchInitialFilter}
          onClose={() => setShowSearchModal(false)}
          onSelectChannel={handleSelectChannel}
          onOpenObject={handleOpenObject}
        />
      )}

      {showNewMessageModal && (
        <NewMessageModal
          claims={claims}
          onClose={() => setShowNewMessageModal(false)}
          onSelectChannel={handleSelectChannel}
          onOpenNewChannelModal={() => setShowNewChannelModal(true)}
        />
      )}

      {showNewChannelModal && (
        <NewChannelModal
          claims={claims}
          onClose={() => setShowNewChannelModal(false)}
          onChannelCreated={(newChan) => {
            setShowNewChannelModal(false);
            setChannels(communicationEngine.getChannels(claims));
            handleSelectChannel(newChan.id);
          }}
        />
      )}

      {adminChannel && (
        <ChannelAdminModal
          claims={claims}
          channel={adminChannel}
          onClose={() => setAdminChannel(null)}
          onChannelUpdated={(updated) => {
            setAdminChannel(updated);
            setChannels(communicationEngine.getChannels(claims));
          }}
        />
      )}

      {openedObject && (
        <WorkOSObjectDrawer
          object={openedObject}
          onClose={() => setOpenedObject(null)}
          onRequestCreateTask={() => {
            setOpenedObject(null);
            handleCreateTask({
              messageId: 'linked_object',
              content: openedObject.title,
              authorName: 'WorkOS System',
            });
          }}
        />
      )}

      {taskModalContext && (
        <CreateTaskModal
          context={taskModalContext}
          onClose={() => setTaskModalContext(null)}
        />
      )}

      {showAuditModal && (
        <AuditLogViewer
          claims={claims}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {showAcceptanceModal && (
        <AcceptanceSuiteModal
          claims={claims}
          onClose={() => setShowAcceptanceModal(false)}
          onSwitchUser={(newClaims) => {
            setClaims(newClaims);
            setChannels(communicationEngine.getChannels(newClaims));
          }}
          onSelectChannel={handleSelectChannel}
        />
      )}

      {showContractsModal && (
        <ContractsDocsModal onClose={() => setShowContractsModal(false)} />
      )}
    </div>
  );
};
