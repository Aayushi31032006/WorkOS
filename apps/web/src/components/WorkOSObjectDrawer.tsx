import React from "react";
import { X, FolderKanban, CheckSquare, Building2, Receipt, ExternalLink, Calendar, User, Clock, ArrowRight } from "lucide-react";
import { Button } from "@cs/ui";
import type { WorkOSObjectRef } from "../types.js";

export type { WorkOSObjectRef };

interface WorkOSObjectDrawerProps {
  object: WorkOSObjectRef;
  onClose: () => void;
  onRequestCreateTask?: () => void;
}

export const WorkOSObjectDrawer: React.FC<WorkOSObjectDrawerProps> = ({
  object,
  onClose,
  onRequestCreateTask,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-end z-50 animate-fadeIn">
      <div className="bg-[var(--bg-surface,#ffffff)] w-full max-w-lg h-full shadow-2xl border-l border-[var(--border-subtle,#e2e8f0)] flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="px-6 py-5 border-b border-[var(--border-subtle,#e2e8f0)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
                {object.type === "project" && <FolderKanban className="w-4 h-4" />}
                {object.type === "task" && <CheckSquare className="w-4 h-4" />}
                {object.type === "customer" && <Building2 className="w-4 h-4" />}
                {object.type === "invoice" && <Receipt className="w-4 h-4" />}
                {!["project", "task", "customer", "invoice"].includes(object.type) && (
                  <ExternalLink className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">
                  WorkOS Host Integration • {object.type.toUpperCase()}
                </span>
                <h3 className="text-base font-bold text-[var(--fg-primary,#0f172a)]">{object.id}</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--fg-muted,#64748b)] hover:text-[var(--fg-primary,#0f172a)] hover:bg-[var(--bg-subtle,#f1f5f9)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--fg-primary,#0f172a)] tracking-tight mb-1">
                {object.title}
              </h2>
              {object.subtitle && (
                <p className="text-xs text-[var(--fg-muted,#64748b)]">{object.subtitle}</p>
              )}
            </div>

            {/* Contract Notice */}
            <div className="p-4 bg-[var(--bg-subtle,#f8fafc)] rounded-xl border border-[var(--border-subtle,#e2e8f0)] text-xs space-y-1.5">
              <span className="font-bold text-[var(--fg-primary,#0f172a)] block">
                Integration Contract: Opaque Object Reference
              </span>
              <p className="text-[var(--fg-secondary,#475569)] leading-relaxed">
                This communication system stores only the opaque WorkOS object identifier (<code>{object.id}</code>) and display metadata. The underlying business data remains securely mastered in WorkOS.
              </p>
            </div>

            {/* Object Metadata Attributes */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted,#64748b)] block">
                Host Object Details
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-[var(--border-subtle,#e2e8f0)] bg-[var(--bg-canvas,#ffffff)]">
                  <span className="text-[10px] text-[var(--fg-muted,#64748b)] block mb-1">Status</span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {object.status ?? "Active in WorkOS"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-subtle,#e2e8f0)] bg-[var(--bg-canvas,#ffffff)]">
                  <span className="text-[10px] text-[var(--fg-muted,#64748b)] block mb-1">Object Type</span>
                  <span className="font-semibold text-[var(--fg-primary,#0f172a)] uppercase">
                    {object.type}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-[var(--border-subtle,#e2e8f0)] bg-[var(--bg-subtle,#f8fafc)] flex items-center justify-between gap-3">
          {onRequestCreateTask && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestCreateTask}
              className="text-xs flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Create Related Task
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            className="text-xs ml-auto"
          >
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
};
