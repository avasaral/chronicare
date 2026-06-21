"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Stethoscope,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import type { LabRow } from "../labs/page";
import type { TimelineLabResult, TimelineVisit } from "./page";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function flagBadgeCls(flag: string): string {
  if (flag === "normal") return "bg-green-100 text-green-800";
  return "bg-red-100 text-red-800";
}

function truncateFirstLine(text: string, maxLen: number): string {
  const firstLine = text.split("\n")[0];
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen).trimEnd() + "…";
}

// ─── Normalized timeline entry ──────────────────────────────────────────────

type LabEntry = {
  date: string;
  type: "lab";
  id: string;
  created_at: string;
  source_lab: string | null;
  source_filename: string;
  extracted_json: LabRow[];
};

type VisitEntry = {
  date: string;
  type: "visit";
  id: string;
  created_at: string;
  provider_name: string;
  provider_specialty: string;
  visit_format: string;
  extracted_text: string;
  notes: string | null;
};

type TimelineEntry = LabEntry | VisitEntry;

function normalizeEntries(
  labs: TimelineLabResult[],
  visits: TimelineVisit[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const lab of labs) {
    entries.push({
      date: lab.report_date,
      type: "lab",
      id: lab.id,
      created_at: lab.created_at,
      source_lab: lab.source_lab,
      source_filename: lab.source_filename,
      extracted_json: lab.extracted_json,
    });
  }

  for (const visit of visits) {
    entries.push({
      date: visit.visit_date,
      type: "visit",
      id: visit.id,
      created_at: visit.created_at,
      provider_name: visit.provider_name,
      provider_specialty: visit.provider_specialty,
      visit_format: visit.visit_format,
      extracted_text: visit.extracted_text,
      notes: visit.notes,
    });
  }

  entries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.created_at.localeCompare(a.created_at);
  });

  return entries;
}

function groupByDate(entries: TimelineEntry[]): Map<string, TimelineEntry[]> {
  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    if (!groups.has(entry.date)) groups.set(entry.date, []);
    groups.get(entry.date)!.push(entry);
  }
  return groups;
}

// ─── Lab detail table (inline, read-only) ───────────────────────────────────

function LabDetailTable({ rows }: { rows: LabRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
              Test
            </th>
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
              Result
            </th>
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
              Reference
            </th>
            <th className="text-left py-2 font-medium text-muted-foreground">
              Flag
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-4 text-foreground font-medium">
                {row.test_name}
              </td>
              <td className="py-2 pr-4 text-foreground tabular-nums">
                {row.value}
                {row.unit ? ` ${row.unit}` : ""}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {row.reference_range ?? "—"}
              </td>
              <td className="py-2">
                <span
                  className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium capitalize ${flagBadgeCls(row.flag)}`}
                >
                  {row.flag}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Lab Card ───────────────────────────────────────────────────────────────

function LabCard({ entry }: { entry: LabEntry }) {
  const [expanded, setExpanded] = useState(false);

  const rows: LabRow[] = Array.isArray(entry.extracted_json)
    ? entry.extracted_json
    : [];
  const flaggedCount = rows.filter((r) => r.flag !== "normal").length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center px-5 py-4 text-left hover:opacity-80 transition-opacity"
      >
        <FlaskConical className="size-4 text-muted-foreground shrink-0 mr-3" />
        <div className="flex-1 flex flex-col items-start gap-0.5 min-w-0">
          <span className="text-sm font-medium text-foreground">
            Lab Report
          </span>
          <span className="text-xs text-muted-foreground">
            {entry.source_lab ?? entry.source_filename}
            {" · "}
            {rows.length} test{rows.length !== 1 ? "s" : ""}
            {flaggedCount > 0 && (
              <span className="text-red-600 font-medium">
                {" · "}{flaggedCount} flagged
              </span>
            )}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && rows.length > 0 && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          <LabDetailTable rows={rows} />
        </div>
      )}
    </div>
  );
}

// ─── Visit Card ─────────────────────────────────────────────────────────────

function VisitCard({ entry }: { entry: VisitEntry }) {
  const [expanded, setExpanded] = useState(false);

  const formatLabel =
    entry.visit_format === "in_person"
      ? "In-person"
      : entry.visit_format === "follow_up"
        ? "Follow-up"
        : "Virtual";

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center px-5 py-4 text-left hover:opacity-80 transition-opacity"
      >
        <Stethoscope className="size-4 text-muted-foreground shrink-0 mr-3" />
        <div className="flex-1 flex flex-col items-start gap-0.5 min-w-0">
          <span className="text-sm font-medium text-foreground">
            {entry.provider_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {entry.provider_specialty} · {formatLabel}
          </span>
          <span className="text-xs text-muted-foreground/60 truncate max-w-full">
            {truncateFirstLine(entry.extracted_text, 120)}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{entry.provider_specialty}</span>
            <span>{formatLabel}</span>
          </div>

          <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {entry.extracted_text}
          </div>

          {entry.notes && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-1">
                Notes
              </p>
              <p className="text-sm text-foreground">{entry.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TimelineClient({
  labs,
  visits,
}: {
  labs: TimelineLabResult[];
  visits: TimelineVisit[];
}) {
  const entries = normalizeEntries(labs, visits);
  const grouped = groupByDate(entries);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Timeline</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-8 shadow-xs text-center">
            <p className="text-sm text-muted-foreground">
              No lab reports or visit notes yet.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Upload a lab report on the{" "}
              <Link href="/labs" className="text-blue-500 hover:text-blue-400">
                Labs
              </Link>{" "}
              page or log a visit on the{" "}
              <Link
                href="/visits"
                className="text-blue-500 hover:text-blue-400"
              >
                Visits
              </Link>{" "}
              page to see them here.
            </p>
          </div>
        ) : (
          [...grouped.entries()].map(([date, dateEntries]) => (
            <section key={date} className="space-y-3">
              <h2 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-widest">
                {formatDate(date)}
              </h2>
              {dateEntries.map((entry) =>
                entry.type === "lab" ? (
                  <LabCard key={`lab-${entry.id}`} entry={entry} />
                ) : (
                  <VisitCard key={`visit-${entry.id}`} entry={entry} />
                )
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
