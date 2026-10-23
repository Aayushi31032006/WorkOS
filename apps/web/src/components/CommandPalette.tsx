import React, { useEffect, useState } from "react";
import { Search, Hash, MessageSquare, X } from "lucide-react";
import type { Conversation } from "../types.js";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@cs/ui";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  conversations,
  onSelect,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const filtered = conversations.filter((c) => {
    const name = c.name ?? c.other_user?.name ?? "";
    return name.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-md overflow-hidden">
        <DialogTitle className="sr-only">Quick switcher</DialogTitle>
        <DialogDescription className="sr-only">Jump to channel or conversation</DialogDescription>
        <div className="flex items-center px-3 border-b border-[var(--border-subtle)]">
          <Search className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
          <input
            className="w-full bg-transparent px-2.5 py-3 text-sm text-[var(--fg-primary)] placeholder-[var(--fg-subtle)] outline-none"
            placeholder="Type a channel or member name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="text-[10px] bg-[var(--bg-muted)] text-[var(--fg-muted)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
              ESC
            </kbd>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--fg-muted)]">
              No matching channels or conversations
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c);
                  onOpenChange(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-[4px] text-xs text-left hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 truncate">
                  {c.type === "channel" ? (
                    <Hash className="h-3.5 w-3.5 text-[var(--fg-muted)] group-hover:text-[var(--accent)]" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 text-[var(--fg-muted)] group-hover:text-[var(--accent)]" />
                  )}
                  <span className="font-medium text-[var(--fg-primary)]">
                    {c.name ?? c.other_user?.name ?? "Direct Message"}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--fg-subtle)] uppercase">
                  {c.type === "channel" ? c.kind : "DM"}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}