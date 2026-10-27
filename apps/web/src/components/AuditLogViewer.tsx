import React, { useState, useEffect } from "react";
import { X, Shield, ShieldAlert, ShieldCheck, RefreshCw, Filter, Loader2 } from "lucide-react";
import { Badge, Button } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";

interface AuditLogEntry {
  id: string;
  company_id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface AuditLogViewerProps {
  open: boolean;
  onClose: () => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ open, onClose }) => {
  const { token, currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    apiRequest<{ data: AuditLogEntry[] }>("/v1/audit-log?limit=50", token)
      .then((res) => {
        setLogs(res.data ?? []);
      })
      .catch((err: any) => {
        setErrorMsg(err.message ?? "Permission denied: requires communication.audit.read");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, token]);

  if (!open) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterAction === "all") return true;
    if (filterAction === "channel") return log.action.startsWith("channel.");
    if (filterAction === "member") return log.action.startsWith("member.");
    if (filterAction === "message") return log.action.startsWith("message.");
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[var(--bg-surface,#ffffff)] rounded-2xl max-w-3xl w-full shadow-2xl border border-[var(--border-subtle,#e2e8f0)] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-subtle,#e2e8f0)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--fg-primary,#0f172a)]">
                  Communication Audit Trail
                </h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Tenant: {currentUser?.company.name}
                </span>
              </div>
              <p className="text-xs text-[var(--fg-muted,#64748b)]">
                Immutable, append-only record of administrative, membership, and moderation actions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-[var(--border-subtle,#e2e8f0)] bg-[var(--bg-subtle,#f8fafc)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
            <span className="text-[var(--fg-muted)] font-medium">Filter by:</span>
            {["all", "channel", "member", "message"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterAction(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  filterAction === cat
                    ? "bg-[var(--accent,#4f46e5)] text-white shadow-xs"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[var(--fg-muted)]">{filteredLogs.length} events</span>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : loading && logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--fg-muted)] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading audit logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--fg-muted)]">No audit events found.</div>
          ) : (
            filteredLogs.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl border border-[var(--border-subtle,#e2e8f0)] bg-[var(--bg-canvas,#ffffff)] text-xs flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[11px] text-[var(--accent,#4f46e5)] bg-[var(--accent-subtle,#e0e7ff)] px-2 py-0.5 rounded-md">
                      {entry.action}
                    </span>
                    <span className="text-[var(--fg-muted)]">•</span>
                    <span className="text-[var(--fg-secondary)]">Resource: {entry.resource_type} ({entry.resource_id.slice(0, 8)}...)</span>
                  </div>
                  <span className="text-[11px] text-[var(--fg-muted)]">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <pre className="p-2 rounded-lg bg-[var(--bg-subtle,#f8fafc)] text-[10px] font-mono text-[var(--fg-muted)] overflow-x-auto">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
