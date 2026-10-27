import React from 'react';
import {
  MessageSquare,
  AtSign,
  FileText,
  Hash,
  FolderKanban,
  ArrowUpRight,
  ArrowRight,
  Calendar,
  Sparkles,
  Pin,
} from 'lucide-react';
import { Channel, Message, TokenClaims, User } from '../packages/contracts/types';

interface HomeDashboardProps {
  claims: TokenClaims;
  channels: Channel[];
  onSelectChannel: (channelId: string) => void;
  onOpenSearch: (filter?: string) => void;
  onOpenAuditLogs: () => void;
  onOpenNewMessage: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  claims,
  channels,
  onSelectChannel,
  onOpenSearch,
  onOpenAuditLogs,
  onOpenNewMessage,
}) => {
  const firstName = claims.name ? claims.name.split(' ')[0] : 'there';

  return (
    <div className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 animate-fadeIn">
      {/* Header Greeting Section (Blue Shade Theme) */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-blue-500 block mb-1">
          FRIDAY, OCTOBER 23
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Good afternoon, {firstName}.
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Your workspace, in sync. Here's what's happening today.
        </p>
      </div>

      {/* Top 3 Stat Cards with Blue Accents */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Unread messages */}
        <div
          onClick={() => onSelectChannel('chan_engineering')}
          className="bg-white rounded-2xl p-6 border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700 transition">
              Unread messages
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
            12
          </div>
          <div className="text-xs text-slate-500 mt-2">Across your conversations</div>
        </div>

        {/* Mentions */}
        <div
          onClick={() => onSelectChannel('chan_engineering')}
          className="bg-white rounded-2xl p-6 border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700 transition">
              Mentions
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <AtSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
            3
          </div>
          <div className="text-xs text-slate-500 mt-2">You're part of the conversation</div>
        </div>

        {/* New files */}
        <div
          onClick={() => onOpenSearch('files')}
          className="bg-white rounded-2xl p-6 border border-blue-100 shadow-xs hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700 transition">
              New files
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
            5
          </div>
          <div className="text-xs text-slate-500 mt-2">Shared with your teams</div>
        </div>
      </div>

      {/* Main 2-Column Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Recent conversations & Latest activity */}
        <div className="lg:col-span-8 space-y-8">
          {/* Recent Conversations */}
          <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Recent conversations</h2>
              <button
                onClick={() => onOpenSearch('channels')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-blue-50">
              {/* Row 1: Team Engineering */}
              <div
                onClick={() => onSelectChannel('chan_engineering')}
                className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 hover:bg-blue-50/60 px-3 -mx-3 rounded-xl transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    TE
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-900 flex items-center gap-2">
                      <span>Team Engineering</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Rohan: I've pushed the latest changes to the repo...
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400 font-medium">10:24 AM</span>
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                    3
                  </span>
                </div>
              </div>

              {/* Row 2: Project Apollo */}
              <div
                onClick={() => onSelectChannel('chan_apollo')}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-blue-50/60 px-3 -mx-3 rounded-xl transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                    PA
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-900">
                      Project Apollo
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Aaditya: The client meeting is scheduled for 4 PM...
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400 font-medium">09:56 AM</span>
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                    1
                  </span>
                </div>
              </div>

              {/* Row 3: Design Team */}
              <div
                onClick={() => onSelectChannel('chan_design')}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-blue-50/60 px-3 -mx-3 rounded-xl transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                    DT
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-900">
                      Design Team
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Sneha: Shared a design mockup
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400 font-medium">Yesterday</span>
                </div>
              </div>

              {/* Row 4: General */}
              <div
                onClick={() => onSelectChannel('chan_general')}
                className="py-3.5 last:pb-0 flex items-center justify-between gap-4 hover:bg-blue-50/60 px-3 -mx-3 rounded-xl transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                    GN
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-900">
                      General
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Karan: Happy Friday everyone!
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400 font-medium">Yesterday</span>
                </div>
              </div>
            </div>
          </div>

          {/* Latest Activity Section */}
          <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Latest activity</h2>
              <button
                onClick={onOpenAuditLogs}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <span>Activity log</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              <div
                onClick={() => onSelectChannel('chan_engineering')}
                className="flex items-start gap-3 hover:bg-blue-50/60 p-2.5 -m-2 rounded-xl transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                  RS
                </div>
                <div className="text-xs">
                  <p className="text-slate-800 font-medium">
                    <strong className="text-slate-900">Rohan Deshmukh</strong> mentioned you in{' '}
                    <span className="text-blue-600 font-semibold">#engineering</span>.
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1 block">12 minutes ago</span>
                </div>
              </div>

              <div
                onClick={() => onSelectChannel('chan_apollo')}
                className="flex items-start gap-3 hover:bg-blue-50/60 p-2.5 -m-2 rounded-xl transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                  SP
                </div>
                <div className="text-xs">
                  <p className="text-slate-800 font-medium">
                    <strong className="text-slate-900">Sneha Patil</strong> shared a file in{' '}
                    <span className="text-blue-600 font-semibold">Project Apollo</span>.
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1 block">38 minutes ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Quick access & Your day */}
        <div className="lg:col-span-4 space-y-8">
          {/* Quick Access Card */}
          <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4">Quick access</h2>
            <div className="space-y-3">
              <button
                onClick={() => onSelectChannel('chan_engineering')}
                className="w-full p-3 rounded-xl border border-blue-100/80 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Engineering</div>
                    <div className="text-[11px] text-slate-500">24 members · 8 new messages</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => onSelectChannel('chan_apollo')}
                className="w-full p-3 rounded-xl border border-blue-100/80 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Project Apollo</div>
                    <div className="text-[11px] text-slate-500">5 members · Active today</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => onOpenSearch('files')}
                className="w-full p-3 rounded-xl border border-blue-100/80 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Shared files</div>
                    <div className="text-[11px] text-slate-500">Recently updated documents</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>
            </div>
          </div>

          {/* Your Day Schedule */}
          <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Your day</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                TODAY
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/60 transition">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center font-mono border border-blue-100">
                  10
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Engineering stand-up</div>
                  <div className="text-[11px] text-slate-500">10:30 AM · Team Engineering</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/60 transition">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center font-mono border border-blue-100">
                  04
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Project Apollo review</div>
                  <div className="text-[11px] text-slate-500">4:00 PM · Project Apollo</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quiet Footer Note */}
      <div className="text-center text-xs text-blue-400/80 pt-6">
        WorkOS Communication · Blue Theme
      </div>
    </div>
  );
};
