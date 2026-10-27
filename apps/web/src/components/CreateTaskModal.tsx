import React, { useState } from "react";
import { X, CheckSquare, Check, ArrowRight } from "lucide-react";
import { Button, Input } from "@cs/ui";

interface CreateTaskModalProps {
  context: {
    messageId: string;
    content: string;
    authorName: string;
  };
  onClose: () => void;
  onSubmit?: (task: { title: string; priority: string; assignee: string }) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ context, onClose, onSubmit }) => {
  const [taskTitle, setTaskTitle] = useState(
    `Follow up on: "${context.content.slice(0, 45)}${context.content.length > 45 ? "..." : ""}"`,
  );
  const [priority, setPriority] = useState("High");
  const [assignee, setAssignee] = useState(context.authorName);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({ title: taskTitle, priority, assignee });
    }
    setIsDone(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[var(--bg-surface,#ffffff)] rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border-subtle,#e2e8f0)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border-subtle,#e2e8f0)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">
                WorkOS Host Action
              </span>
              <h3 className="text-base font-bold text-[var(--fg-primary,#0f172a)]">
                Create Task from Message
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--fg-muted,#64748b)] hover:text-[var(--fg-primary,#0f172a)] hover:bg-[var(--bg-subtle,#f1f5f9)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDone ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-[var(--fg-primary,#0f172a)]">
              Task Created in WorkOS!
            </h4>
            <p className="text-xs text-[var(--fg-muted,#64748b)]">
              Callback invoked and linked to message{" "}
              <code className="font-mono text-[var(--fg-primary,#0f172a)]">
                {context.messageId.slice(0, 8)}...
              </code>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-[var(--fg-secondary,#475569)] block mb-1.5">
                Task Title
              </label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--fg-secondary,#475569)] block mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-[var(--bg-surface,#ffffff)] border border-[var(--border-subtle,#cbd5e1)] text-[var(--fg-primary,#0f172a)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--fg-secondary,#475569)] block mb-1.5">
                  Assignee
                </label>
                <Input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-subtle,#f8fafc)] rounded-lg border border-[var(--border-subtle,#e2e8f0)] text-[11px] text-[var(--fg-muted,#64748b)]">
              <span className="font-semibold text-[var(--fg-primary,#0f172a)] block mb-0.5">
                Source Context:
              </span>
              <p className="italic line-clamp-2">"{context.content}"</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="text-xs flex items-center gap-1.5">
                Create WorkOS Task
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
