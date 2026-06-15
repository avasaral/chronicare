"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";
import type { LabRow } from "./page";

// ─── Types ────────────────────────────────────────────────────────────────────

type PreviousResult = {
  id: string;
  report_date: string;
  source_filename: string;
  extracted_json: LabRow[];
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
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

// ─── Lab Results Table ────────────────────────────────────────────────────────

function LabTable({ rows }: { rows: LabRow[] }) {
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

// ─── Previous Upload Card ─────────────────────────────────────────────────────

function PreviousCard({ result }: { result: PreviousResult }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rows: LabRow[] = Array.isArray(result.extracted_json)
    ? result.extracted_json
    : [];

  async function handleDelete() {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("lab_results").delete().eq("id", result.id);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="flex items-center px-5 py-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center justify-between gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {result.source_filename}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(result.report_date)} · {rows.length} result
              {rows.length !== 1 ? "s" : ""}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          )}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-4 text-xs text-destructive hover:text-destructive/80 transition-colors shrink-0"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      {expanded && rows.length > 0 && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          <LabTable rows={rows} />
        </div>
      )}
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadSection({
  onResults,
}: {
  onResults: (rows: LabRow[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-lab", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Extraction failed.");
        return;
      }

      onResults(data.results ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
      <h2 className="font-semibold text-foreground">Upload lab report</h2>

      <label
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background p-8 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 ${loading ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <Upload className="size-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground text-center">
          {loading ? "Extracting lab values…" : "Click to upload a PDF"}
        </span>
        {loading && (
          <span className="inline-block size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function LabsClient({
  userId,
  previousResults,
}: {
  userId: string;
  previousResults: PreviousResult[];
}) {
  const router = useRouter();
  const [latestRows, setLatestRows] = useState<LabRow[] | null>(null);

  void userId; // used server-side for auth; kept in props for consistency

  function handleResults(rows: LabRow[]) {
    setLatestRows(rows);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Lab Results</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <UploadSection onResults={handleResults} />

        {latestRows !== null && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h2 className="font-semibold text-foreground">
              Extracted results
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({latestRows.length} test{latestRows.length !== 1 ? "s" : ""})
              </span>
            </h2>
            {latestRows.length > 0 ? (
              <LabTable rows={latestRows} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No lab values found in this PDF.
              </p>
            )}
          </section>
        )}

        {previousResults.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground">Previous uploads</h2>
            {previousResults.map((r) => (
              <PreviousCard key={r.id} result={r} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
