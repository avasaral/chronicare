"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import type { LabRow } from "./page";

// ─── Types ────────────────────────────────────────────────────────────────────

type PreviousResult = {
  id: string;
  report_date: string;
  source_filename: string;
  extracted_json: LabRow[];
  created_at: string;
};

type TrendPoint = { date: string; displayDate: string; value: number };

type TestTrend = {
  testName: string;
  unit: string | null;
  points: TrendPoint[];
  refLow: number | null;
  refHigh: number | null;
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

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function flagBadgeCls(flag: string): string {
  if (flag === "normal") return "bg-green-100 text-green-800";
  return "bg-red-100 text-red-800";
}

// Handles all reference_range formats seen in real data:
//   "N-M", "N - M", "N - M units (annotation)"
//   "<N", "upto N ...", "Non-Reactive" (returns null)
function parseRefRange(ref: string | null): { low: number; high: number } | null {
  if (!ref) return null;

  // less-than: "<N" or "< N"
  const lt = ref.match(/^[<＜]\s*([\d.]+)/);
  if (lt) return { low: 0, high: parseFloat(lt[1]) };

  // "upto N ..."
  const upto = ref.match(/upto\s+([\d.]+)/i);
  if (upto) return { low: 0, high: parseFloat(upto[1]) };

  // range: first two numbers separated by dash (handles "N-M", "N - M", "00 - 01%", "N - M units")
  const range = ref.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (range) {
    const low = parseFloat(range[1]);
    const high = parseFloat(range[2]);
    if (!isNaN(low) && !isNaN(high) && high >= low) return { low, high };
  }

  return null; // qualitative (e.g. "Non-Reactive")
}

// Groups lab results by test_name, averaging values when multiple reports share
// the same report_date. Returns only tests with 2+ distinct dates.
function buildTrendData(results: PreviousResult[]): TestTrend[] {
  const sorted = [...results].sort((a, b) =>
    a.report_date.localeCompare(b.report_date)
  );

  const map = new Map<
    string,
    { date: string; value: number; ref: string | null; unit: string | null }[]
  >();

  for (const result of sorted) {
    for (const row of result.extracted_json ?? []) {
      const v = parseFloat(row.value);
      if (isNaN(v)) continue; // skip qualitative values
      if (!map.has(row.test_name)) map.set(row.test_name, []);
      map.get(row.test_name)!.push({
        date: result.report_date,
        value: v,
        ref: row.reference_range ?? null,
        unit: row.unit ?? null,
      });
    }
  }

  const trends: TestTrend[] = [];

  for (const [testName, entries] of map) {
    const distinctDates = [...new Set(entries.map((e) => e.date))];
    if (distinctDates.length < 2) continue;

    // Average values per date (handles 3 labs uploading same test on same day)
    const byDate = new Map<
      string,
      { sum: number; count: number; ref: string | null; unit: string | null }
    >();
    for (const e of entries) {
      if (!byDate.has(e.date))
        byDate.set(e.date, { sum: 0, count: 0, ref: e.ref, unit: e.unit });
      const d = byDate.get(e.date)!;
      d.sum += e.value;
      d.count++;
    }

    const points: TrendPoint[] = [];
    for (const [date, { sum, count }] of byDate) {
      points.push({
        date,
        displayDate: formatDateShort(date),
        value: Math.round((sum / count) * 100) / 100,
      });
    }

    const last = entries[entries.length - 1];
    const parsed = parseRefRange(last.ref);

    trends.push({
      testName,
      unit: last.unit,
      points,
      refLow: parsed?.low ?? null,
      refHigh: parsed?.high ?? null,
    });
  }

  return trends.sort((a, b) => a.testName.localeCompare(b.testName));
}

// ─── Mini trend chart ─────────────────────────────────────────────────────────

function MiniChart({ trend }: { trend: TestTrend }) {
  const { testName, unit, points, refLow, refHigh } = trend;

  const latestVal = points[points.length - 1].value;
  const inRange =
    (refLow == null || latestVal >= refLow) &&
    (refHigh == null || latestVal <= refHigh);
  const lineColor = inRange ? "#3b82f6" : "#f43f5e";

  // Y domain: expand to include the reference band with padding
  const allVals: number[] = [
    ...points.map((p) => p.value),
    ...(refLow != null ? [refLow] : []),
    ...(refHigh != null ? [refHigh] : []),
  ];
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const pad = Math.max((yMax - yMin) * 0.25, yMax * 0.05, 0.5);
  const domainMin = Math.max(0, yMin - pad);
  const domainMax = yMax + pad;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-tight">
          {testName}
        </p>
        <span
          className={`text-xs font-semibold shrink-0 tabular-nums ${
            inRange ? "text-foreground/50" : "text-rose-600"
          }`}
        >
          {latestVal}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={96}>
        <LineChart
          data={points.map((p) => ({ date: p.displayDate, value: p.value }))}
          margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
        >
          {refLow != null && refHigh != null && (
            <ReferenceArea
              y1={refLow}
              y2={refHigh}
              fill="#dcfce7"
              fillOpacity={0.8}
              stroke="#bbf7d0"
              strokeOpacity={0.6}
            />
          )}
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[domainMin, domainMax]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickCount={3}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: "8px",
              border: "1px solid #f1f5f9",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              padding: "4px 8px",
            }}
            formatter={(v: unknown) => [
              `${v}${unit ? ` ${unit}` : ""}`,
              testName,
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {refLow != null && refHigh != null && (
        <p className="text-[11px] text-foreground/30 tabular-nums">
          Ref {refLow}–{refHigh}
          {unit ? ` ${unit}` : ""}
        </p>
      )}
    </div>
  );
}

// ─── Trend section ────────────────────────────────────────────────────────────

function TrendSection({ results }: { results: PreviousResult[] }) {
  if (results.length < 2) return null;

  const trends = buildTrendData(results);
  const distinctDates = [...new Set(results.map((r) => r.report_date))];
  const allSameDate = distinctDates.length === 1;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground">Lab trends</h2>

      {trends.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6">
          <p className="text-sm text-muted-foreground">
            {allSameDate
              ? `All ${results.length} uploads share the same report date (${formatDate(distinctDates[0])}). Trends appear once you upload reports from different dates.`
              : "No tests have results across multiple dates yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trends.map((t) => (
            <MiniChart key={t.testName} trend={t} />
          ))}
        </div>
      )}
    </section>
  );
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

  void userId;

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

        <TrendSection results={previousResults} />

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
