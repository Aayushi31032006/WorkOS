import React, { useState, useEffect } from 'react';
import { X, Shield, ShieldAlert, ShieldCheck, Filter, RefreshCw } from 'lucide-react';
import { AuditEvent, TokenClaims } from '../packages/contracts/types';
import { communicationEngine } from '../packages/sdk/client';

interface AuditLogViewerProps {
  claims: TokenClaims;
  onClose: () => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ claims, onClose }) => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('all');

  const fetchLogs = () => {
    try {
      setErrorMsg(null);
      const auditData = communicationEngine.getAuditLogs(claims);
      setLogs(auditData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Permission denied to read audit records');
    }
  };

  useEffect(() => {
    fetchLogs();
    const unsub = communicationEngine.subscribe('audit.created', (entry: AuditEvent) => {
      if (entry.company_id === claims.company_id) {
        setLogs((prev) => [entry, ...prev]);
      }
    });
    return () => unsub();
  }, [claims]);

  const filteredLogs = logs.filter((log) => {
    if (filterAction === 'all') return true;
    if (filterAction === 'security') return log.action.startsWith('security.');
    if (filterAction === 'channel') return log.action.startsWith('channel.');
    if (filterAction === 'message') return log.action.startsWith('message.');
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Communication Audit Trail</h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                  Tenant Isolated: {claims.company_id}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Immutable event stream for compliance, channel modifications, and access attempts.
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

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600">Filter:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800"
            >
              <option value="all">All Events ({logs.length})</option>
              <option value="security">Security & Rejections</option>
              <option value="channel">Channel Administration</option>
              <option value="message">Message Moderation</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error / Unauthorized */}
        {errorMsg ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-rose-900">Access Restricted</h4>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMsg}</p>
            <p className="text-[11px] text-slate-400">
              Only roles with <code className="font-mono text-slate-700">communication.audit.read</code> may view the compliance trail.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 divide-y divide-slate-100 space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No audit entries recorded for this filter.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSecurity = log.action.startsWith('security.');
                return (
                  <div key={log.id} className="pt-3 first:pt-0 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            isSecurity
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="font-semibold text-slate-900">{log.actor_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({log.actor_id})
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-slate-600 flex items-center gap-3">
                      <span>Target: <strong className="text-slate-800 font-mono">{log.target_type}:{log.target_id}</strong></span>
                      <span>·</span>
                      <span className="font-mono text-[11px] text-slate-400">IP: {log.ip_address}</span>
                    </div>

                    {log.details && (
                      <pre className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-700 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Signed Short-Lived Audit Assertion</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
