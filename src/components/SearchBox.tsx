"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";

type SearchResult = {
  type: "medication" | "daily_tracker" | "lab" | "visit";
  id: string;
  label: string;
  snippet: string;
  href: string;
};

const TYPE_LABELS: Record<string, string> = {
  medication: "Medications",
  daily_tracker: "Daily Tracker",
  lab: "Labs",
  visit: "Visits",
};

const TYPE_ORDER = ["medication", "daily_tracker", "lab", "visit"];

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setOpen(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    setResults(data.results);
    setSearching(false);
  }

  const grouped = results
    ? TYPE_ORDER.filter((t) => results.some((r) => r.type === t)).map(
        (type) => [type, results.filter((r) => r.type === type)] as const
      )
    : [];

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-28 sm:w-44 rounded-md border border-border bg-background pl-7 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(null);
                setOpen(false);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
            >
              <X className="size-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </form>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-50">
          {searching ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Searching…
            </p>
          ) : results && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No results found
            </p>
          ) : (
            grouped.map(([type, items]) => (
              <div key={type}>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {TYPE_LABELS[type] ?? type}
                </p>
                {items.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.snippet}
                    </p>
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
