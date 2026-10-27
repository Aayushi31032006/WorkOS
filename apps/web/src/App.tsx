/**
 * @license
 * WorkOS Internal Communication System
 * Standalone & Embedded Host Root Application.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Code,
  Users,
  LogOut,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { TokenClaims, WorkOSObjectRef } from './packages/contracts/types';
import { MOCK_TOKENS } from './packages/test-fixtures/fixtures';
import { AuthScreen } from './components/AuthScreen';
import { CommunicationApp } from './components/CommunicationApp';
import { AcceptanceSuiteModal } from './components/AcceptanceSuiteModal';
import { ContractsDocsModal } from './components/ContractsDocsModal';
import { WorkOSObjectDrawer } from './components/WorkOSObjectDrawer';
import { CreateTaskModal } from './components/CreateTaskModal';

export default function App() {
  const [currentClaims, setCurrentClaims] = useState<TokenClaims | null>(MOCK_TOKENS.vedant);
  const [displayMode, setDisplayMode] = useState<'standalone' | 'embedded'>('standalone');
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const [showContractsModal, setShowContractsModal] = useState(false);
  const [hostOpenedObject, setHostOpenedObject] = useState<WorkOSObjectRef | null>(null);
  const [hostTaskContext, setHostTaskContext] = useState<{
    messageId: string;
    content: string;
    authorName: string;
  } | null>(null);

  // If signed out, show the login screen matching image_4e54f67a.png
  if (!currentClaims) {
    return <AuthScreen onSignIn={(claims) => setCurrentClaims(claims)} />;
  }

  // Token provider passed into <CommunicationApp />
  const getAccessToken = async (): Promise<string> => {
    return currentClaims.sub;
  };

  const handleOpenObject = (obj: WorkOSObjectRef) => {
    setHostOpenedObject(obj);
  };

  const handleCreateTask = (ctx: {
    messageId: string;
    content: string;
    authorName: string;
  }) => {
    setHostTaskContext(ctx);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#edf3fc] overflow-hidden select-none">
      {/* Top Demo & Reviewer Control Strip */}
      <div className="h-10 bg-[#0a1a36] text-blue-100 px-4 flex items-center justify-between text-xs font-medium border-b border-blue-900/60 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="font-bold text-white tracking-wide">WorkOS Communication System</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-md border border-blue-400/20 hidden sm:inline">
              Blue Edition
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-white/10 p-0.5 rounded-lg">
            <button
              onClick={() => setDisplayMode('standalone')}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition ${
                displayMode === 'standalone'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >
              Standalone App
            </button>
            <button
              onClick={() => setDisplayMode('embedded')}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition ${
                displayMode === 'embedded'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >
              Embedded Host View
            </button>
          </div>
        </div>

        {/* Persona Switcher & Tools */}
        <div className="flex items-center gap-3">
          {/* Persona selector dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 hidden md:inline">Session:</span>
            <select
              value={currentClaims.sub}
              onChange={(e) => {
                const selected = Object.values(MOCK_TOKENS).find((t) => t.sub === e.target.value);
                if (selected) setCurrentClaims(selected);
              }}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-slate-500"
            >
              <option value="usr_vedant">Vedant Kulkarni (Member)</option>
              <option value="usr_rohan">Rohan Deshmukh (Admin & Lead)</option>
              <option value="usr_sneha">Sneha Patil (Designer)</option>
              <option value="usr_alex_ext">Alex Vance (Cross-Company 403 Test)</option>
            </select>
          </div>

          {/* Section 11 Test Suite */}
          <button
            onClick={() => setShowAcceptanceModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/30 transition"
            title="Run Section 11 Acceptance Checks"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Acceptance Suite</span>
          </button>

          {/* Contracts Docs */}
          <button
            onClick={() => setShowContractsModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-semibold transition"
            title="Inspect TypeScript Contracts & Integration SDK"
          >
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Contracts</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={() => setCurrentClaims(null)}
            className="p-1 hover:text-white text-slate-400 transition"
            title="Sign out to Login screen"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-hidden relative">
        {displayMode === 'standalone' ? (
          /* Standalone full-viewport mode */
          <CommunicationApp
            key={currentClaims.sub}
            getAccessToken={getAccessToken}
            onOpenObject={handleOpenObject}
            onCreateTask={handleCreateTask}
            theme={{ primaryColor: '#0c1527', mode: 'light' }}
          />
        ) : (
          /* Embedded WorkOS Host Preview */
          <div className="h-full w-full bg-slate-900 p-4 sm:p-6 flex flex-col">
            {/* Mock WorkOS Host Header */}
            <div className="bg-slate-800 text-white rounded-t-2xl px-5 py-3 border border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="ml-2 font-mono text-slate-300">
                  https://app.workos.com/org/apex-labs/communication
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                WorkOS Host Mounting Point &lt;CommunicationApp /&gt;
              </span>
            </div>

            {/* Embed container frame */}
            <div className="flex-1 bg-white rounded-b-2xl overflow-hidden border-x border-b border-slate-700 shadow-2xl">
              <CommunicationApp
                key={currentClaims.sub}
                getAccessToken={getAccessToken}
                onOpenObject={handleOpenObject}
                onCreateTask={handleCreateTask}
                theme={{ primaryColor: '#0c1527', mode: 'light' }}
                embedded={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals triggered from Top Bar */}
      {showAcceptanceModal && (
        <AcceptanceSuiteModal
          claims={currentClaims}
          onClose={() => setShowAcceptanceModal(false)}
          onSwitchUser={(newClaims) => setCurrentClaims(newClaims)}
          onSelectChannel={() => setShowAcceptanceModal(false)}
        />
      )}

      {showContractsModal && (
        <ContractsDocsModal onClose={() => setShowContractsModal(false)} />
      )}

      {hostOpenedObject && (
        <WorkOSObjectDrawer
          object={hostOpenedObject}
          onClose={() => setHostOpenedObject(null)}
        />
      )}

      {hostTaskContext && (
        <CreateTaskModal
          context={hostTaskContext}
          onClose={() => setHostTaskContext(null)}
        />
      )}
    </div>
  );
}
