import React, { useState, useEffect } from "react";
import { Search, X, MessageSquare, Hash, Loader2, ArrowRight } from "lucide-react";
import { Input, Badge, Avatar } from "@cs/ui";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import type { Message } from "../types.js";

interface SearchResultItem {
  message: Message;
  conversation: {
    id: string;
    name: string | null;
    type: "dm" | "group_dm" | "channel";
  };
  snippet: string;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectResult: (conversationId: string, messageId: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ open, onClose, onSelectResult }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !token) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      apiRequest<{ items: SearchResultItem[] }>(`/v1/search?q=${encodeURIComponent(trimmed)}`, token)
        .then((res) => {
          setResults(res.items ?? []);
        })
        .catch((err) => {
          console.error("Search failed:", err);
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, token]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4 z-50 animate-fadeIn">
      <div className="bg-[var(--bg-surface,#ffffff)] rounded-2xl max-w-2xl w-full shadow-2xl border border-[var(--border-subtle,#e2e8f0)] overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[var(--border-subtle,#e2e8f0)] flex items-center gap-3">
          <Search className="w-4 h-4 text-[var(--accent,#4f46e5)] shrink-0 ml-1" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all conversations, threads, and files (company isolated)..."
            className="flex-1 text-xs border-0 focus:ring-0 shadow-none px-0"
            autoFocus
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[var(--fg-muted)]" />}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {query.trim().length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--fg-muted)]">
              Type keywords to search across all public channels and joined private conversations.
            </div>
          ) : loading && results.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--fg-muted)]">Searching messages...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--fg-muted)]">
              No messages found matching "{query}".
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.message.id}
                onClick={() => {
                  onSelectResult(item.conversation.id, item.message.id);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl border border-[var(--border-subtle,#e2e8f0)] hover:border-[var(--accent,#4f46e5)] hover:bg-[var(--bg-subtle,#f8fafc)] transition-all cursor-pointer flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--fg-primary,#0f172a)] flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-[var(--accent,#4f46e5)]" />
                      {item.conversation.name ?? "Direct Message"}
                    </span>
                    <span className="text-[10px] text-[var(--fg-muted,#64748b)]">
                      by {item.message.author?.name ?? "Team Member"}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--fg-muted,#64748b)]">
                    {new Date(item.message.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div
                  className="text-xs text-[var(--fg-secondary,#334155)] line-clamp-2 leading-relaxed [&>mark]:bg-amber-300 [&>mark]:text-slate-950 [&>mark]:px-1 [&>mark]:rounded-xs"
                  dangerouslySetInnerHTML={{ __html: item.snippet }}
                />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
