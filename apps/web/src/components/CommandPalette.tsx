import React, { useEffect, useState } from "react";
import { Search, Hash, MessageSquare, X } from "lucide-react";
import type { Conversation } from "../types.js";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@cs/ui";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations?: Conversation[];
  channels?: Conversation[];
  onSelect?: (conv: Conversation) => void;
  onSelectConversation?: (conv: Conversation) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  conversations,
  channels,
  onSelect,
  onSelectConversation,
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

  const list = conversations ?? channels ?? [];
  const filtered = list.filter((c) => {
    const name = c.name ?? c.dm_user?.name ?? "";
    return name.toLowerCase().includes(query.toLowerCase());
  });

  const handleSelect = (conv: Conversation) => {
    onSelect?.(conv);
    onSelectConversation?.(conv);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Quick switcher</DialogTitle>
        <DialogDescription className="sr-only">Search and switch between channels and DMs</DialogDescription>
        <div className="flex items-center px-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
          <Search className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels or people... (Cmd+K)"
            className="w-full bg-transparent border-0 px-3 py-3 text-xs text-[var(--fg-primary)] focus:outline-none placeholder:text-[var(--fg-subtle)]"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5 divide-y divide-[var(--border-subtle)]/30">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--fg-muted)]">
              No matching channels or conversations
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-xs text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)] text-left transition-colors cursor-pointer"
              >
                {c.type === "dm" ? (
                  <MessageSquare className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                ) : (
                  <Hash className="h-3.5 w-3.5 text-[var(--fg-muted)] shrink-0" />
                )}
                <span className="font-medium truncate">
                  {c.type === "dm" ? c.dm_user?.name ?? "Direct Message" : c.name}
                </span>
                {c.topic && (
                  <span className="text-[10px] text-[var(--fg-subtle)] truncate ml-auto">
                    {c.topic}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
