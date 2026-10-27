import React, { useState } from 'react';
import { X, Code, FileText, Webhook, Shield, Copy, Check } from 'lucide-react';

interface ContractsDocsModalProps {
  onClose: () => void;
}

export const ContractsDocsModal: React.FC<ContractsDocsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'embedding' | 'rbac' | 'webhooks' | 'objects'>('embedding');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const codeSnippets = {
    embedding: `import { CommunicationApp } from '@workos/communication-system';

export function WorkOSPortalRoute() {
  const { getSessionToken, navigateToObject, showTaskModal } = useWorkOSHost();

  return (
    <CommunicationApp
      getAccessToken={async () => {
        const token = await getSessionToken();
        return token; // Signed short-lived JWT with tenant & claims
      }}
      onOpenObject={(ref) => {
        // Safe opaque reference resolution - host owns business data
        navigateToObject(ref.type, ref.id);
      }}
      onCreateTask={({ messageId, content, authorName }) => {
        showTaskModal({ title: \`Follow up: \${content}\`, sourceMsg: messageId });
      }}
      theme={{
        primaryColor: '#0c1427',
        mode: 'light',
      }}
    />
  );
}`,
    rbac: `// WorkOS Resolved Identity & Communication RBAC Claims
{
  "sub": "usr_vedant_9812",
  "company_id": "comp_workos_1",
  "email": "vedant@company.com",
  "name": "Vedant Kulkarni",
  "permissions": [
    "communication.access",               // Open & use the communication module
    "communication.channel.create",        // Create public channels
    "communication.private_channel.create",// Create private channels
    "communication.channel.manage",        // Archive and channel settings
    "communication.member.manage",         // Add or remove channel members
    "communication.message.send",          // Send messages in accessible conversations
    "communication.message.moderate",      // Edit or delete messages
    "communication.announcement.publish",  // Publish in announcement-only channels
    "communication.audit.read"             // View immutable audit logs
  ],
  "iss": "https://auth.workos.com",
  "aud": "workos-communication",
  "exp": 1792842000
}`,
    webhooks: `// Outbound signed webhook emitted to host: message.created
{
  "id": "whk_msg_10928172",
  "event": "message.created",
  "company_id": "comp_workos_1",
  "timestamp": "2026-10-23T10:24:00Z",
  "signature": "sha256=d3b07384d113edec49eaa6238ad5ff00",
  "payload": {
    "messageId": "msg_103",
    "channelId": "chan_engineering",
    "senderId": "usr_rohan",
    "content": "I've pushed the latest changes to the repo.",
    "hasAttachments": true,
    "hasObjects": true
  }
}`,
    objects: `// Safe WorkOS Object Reference Schema (stored opaquely in message)
export interface WorkOSObjectRef {
  type: 'project' | 'task' | 'customer' | 'invoice' | 'document';
  id: string;      // e.g. "PRJ-402", "TSK-108"
  title: string;   // Display title for the pill/card
  status?: string; // e.g. "In Progress", "Resolved"
  subtitle?: string;
}
// Rule: Communication DB NEVER mirrors client or billing databases.
// Live records are rendered through the host onOpenObject callback.`,
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                WorkOS Integration Contracts & SDK
              </h3>
              <p className="text-xs text-slate-500">
                Independent integration surface: JWT claims, React embedding, webhooks & objects.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 px-6 gap-6 text-xs font-semibold bg-slate-50/50">
          <button
            onClick={() => setActiveTab('embedding')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'embedding'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            React Embedding
          </button>
          <button
            onClick={() => setActiveTab('rbac')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'rbac'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            RBAC Claims Matrix
          </button>
          <button
            onClick={() => setActiveTab('objects')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'objects'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Object References
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'webhooks'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Signed Webhooks
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {activeTab === 'embedding' && 'Root Embeddable Component Signature'}
              {activeTab === 'rbac' && 'Standard WorkOS Communication Permission Claims'}
              {activeTab === 'objects' && 'Opaque Business Object Reference Structure'}
              {activeTab === 'webhooks' && 'Replay-Resistant Signed Webhook Specification'}
            </span>
            <button
              onClick={() => copyToClipboard(codeSnippets[activeTab], activeTab)}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-semibold"
            >
              {copied === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied === activeTab ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-950 text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
            {codeSnippets[activeTab]}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Packages: @workos/contracts · @workos/communication-sdk</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
