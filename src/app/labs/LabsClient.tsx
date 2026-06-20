"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Upload } from "lucide-react";
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
  source_lab: string | null;
  extracted_json: LabRow[];
  created_at: string;
};

type TrendPoint = { date: string; displayDate: string; value: number };

type TestTrend = {
  displayName: string;
  unit: string | null;
  category: string;
  points: TrendPoint[];
  refLow: number | null;
  refHigh: number | null;
};

// ─── Test-name normalization (display/grouping only — stored data unchanged) ──

// Fixed clinical equivalences only — NOT fuzzy matching.
// Maps lowercase input variant → canonical grouping key (also lowercase).
const TEST_SYNONYM_KEYS: Record<string, string> = {
  // SGOT = AST, SGPT = ALT: old enzyme naming vs modern (universal equivalence)
  "sgot":       "ast",
  "sgot (ast)": "ast",
  "sgot(ast)":  "ast",
  "ast/sgot":   "ast",
  "sgpt":       "alt",
  "sgpt (alt)": "alt",
  "sgpt(alt)":  "alt",
  "alt/sgpt":   "alt",
  // Platelet Count variants seen in real data (previous session SQL analysis)
  "platelet count (plt)": "platelet count",
  "plt":                  "platelet count",
  "platelets":            "platelet count",
  // Haemoglobin: British spelling (Indian lab standard) vs American
  "hemoglobin": "haemoglobin",
  "hb":         "haemoglobin",
  "hgb":        "haemoglobin",
};

// Preferred display label for keys that have synonym consolidation.
const CANONICAL_TEST_DISPLAY: Record<string, string> = {
  "ast":           "AST",
  "alt":           "ALT",
  "platelet count": "Platelet Count",
  "haemoglobin":   "Haemoglobin",
};

function testKey(name: string): string {
  const lower = name.trim().toLowerCase().replace(/\s+/g, " ");
  return TEST_SYNONYM_KEYS[lower] ?? lower;
}

// Most-frequent original form wins; canonical display name overrides if defined.
function pickDisplayName(variants: string[]): string {
  const freq = new Map<string, number>();
  for (const n of variants) freq.set(n, (freq.get(n) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function resolveDisplayName(key: string, variants: string[]): string {
  return CANONICAL_TEST_DISPLAY[key] ?? pickDisplayName(variants);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
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

// Handles real reference_range formats: "N-M", "N - M", "N - M unit (note)",
// "<N", "upto N ...", "Non-Reactive" (qualitative → returns null).
function parseRefRange(ref: string | null): { low: number; high: number } | null {
  if (!ref) return null;

  const lt = ref.match(/^[<＜]\s*([\d.]+)/);
  if (lt) return { low: 0, high: parseFloat(lt[1]) };

  const upto = ref.match(/upto\s+([\d.]+)/i);
  if (upto) return { low: 0, high: parseFloat(upto[1]) };

  const range = ref.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (range) {
    const low = parseFloat(range[1]);
    const high = parseFloat(range[2]);
    if (!isNaN(low) && !isNaN(high) && high >= low) return { low, high };
  }

  return null;
}

const UNCATEGORIZED = "Other / Uncategorized";

// Maps Claude output variants → canonical category strings.
// Stored data is never modified; normalization is display-layer only.
const CATEGORY_ALIASES: Record<string, string> = {
  // CBC
  "cbc": "CBC (Complete Blood Count)",
  "complete blood count": "CBC (Complete Blood Count)",
  "complete blood picture": "CBC (Complete Blood Count)",
  "cbp": "CBC (Complete Blood Count)",
  // LFT
  "lft": "LFT (Liver Function Test)",
  "liver function": "LFT (Liver Function Test)",
  "liver function test": "LFT (Liver Function Test)",
  "liver function tests": "LFT (Liver Function Test)",
  "liver panel": "LFT (Liver Function Test)",
  // KFT
  "kft": "KFT (Kidney Function Test)",
  "kidney function": "KFT (Kidney Function Test)",
  "kidney function test": "KFT (Kidney Function Test)",
  "renal function": "KFT (Kidney Function Test)",
  "renal function test": "KFT (Kidney Function Test)",
  "rft": "KFT (Kidney Function Test)",
  // Inflammatory
  "inflammatory": "Inflammatory Markers",
  "inflammatory marker": "Inflammatory Markers",
  // Iron
  "iron": "Iron Studies",
  "iron panel": "Iron Studies",
  "iron profile": "Iron Studies",
  // Lipids
  "lipids": "Lipid Profile",
  "lipid": "Lipid Profile",
  "lipid panel": "Lipid Profile",
  // Thyroid
  "thyroid": "Thyroid Panel",
  "thyroid function": "Thyroid Panel",
  "thyroid function test": "Thyroid Panel",
  "tft": "Thyroid Panel",
  // Vitamins
  "vitamin": "Vitamins",
  "vitamins & minerals": "Vitamins",
  "vitamins and minerals": "Vitamins",
  // Stool
  "stool": "Stool Studies",
  "stool study": "Stool Studies",
  // Other
  "other": UNCATEGORIZED,
  "uncategorized": UNCATEGORIZED,
  "other/uncategorized": UNCATEGORIZED,
};

function resolveCategory(cat: string | null | undefined): string {
  if (!cat) return UNCATEGORIZED;
  return CATEGORY_ALIASES[cat.trim().toLowerCase()] ?? cat;
}

// ─── Trend data builder ───────────────────────────────────────────────────────

function buildTrendData(results: PreviousResult[]): TestTrend[] {
  const sorted = [...results].sort((a, b) =>
    a.report_date.localeCompare(b.report_date)
  );

  // keyed by normalised test name
  const map = new Map<
    string,
    {
      date: string;
      value: number;
      ref: string | null;
      unit: string | null;
      category: string;
      originalName: string;
    }[]
  >();

  for (const result of sorted) {
    for (const row of result.extracted_json ?? []) {
      const v = parseFloat(row.value);
      if (isNaN(v)) continue;
      const key = testKey(row.test_name);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        date: result.report_date,
        value: v,
        ref: row.reference_range ?? null,
        unit: row.unit ?? null,
        category: resolveCategory(row.category),
        originalName: row.test_name,
      });
    }
  }

  const trends: TestTrend[] = [];

  for (const [key, entries] of map) {
    const distinctDates = [...new Set(entries.map((e) => e.date))];
    if (distinctDates.length < 2) continue;

    // Average values for the same date
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
    points.sort((a, b) => a.date.localeCompare(b.date));

    // Reference band from the most-recent report's range for this test
    const last = entries[entries.length - 1];
    const parsed = parseRefRange(last.ref);

    // Display name = canonical if in synonym map, else most-common original casing
    const displayName = resolveDisplayName(key, entries.map((e) => e.originalName));

    // Category = first non-uncategorized value
    const category =
      entries.find((e) => e.category !== UNCATEGORIZED)?.category ??
      UNCATEGORIZED;

    trends.push({
      displayName,
      unit: last.unit,
      category,
      points,
      refLow: parsed?.low ?? null,
      refHigh: parsed?.high ?? null,
    });
  }

  return trends.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.displayName.localeCompare(b.displayName)
  );
}

// ─── Mini trend chart ─────────────────────────────────────────────────────────

function MiniChart({ trend }: { trend: TestTrend }) {
  const { displayName, unit, points, refLow, refHigh } = trend;

  const latestVal = points[points.length - 1].value;
  const inRange =
    (refLow == null || latestVal >= refLow) &&
    (refHigh == null || latestVal <= refHigh);
  const lineColor = inRange ? "#3b82f6" : "#f43f5e";

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
          {displayName}
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
              displayName,
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

// ─── Category section header ──────────────────────────────────────────────────

function CategoryHeader({ label, first }: { label: string; first: boolean }) {
  return (
    <h3
      className={`text-[11px] font-semibold text-foreground/40 uppercase tracking-widest ${
        first ? "" : "mt-2"
      }`}
    >
      {label}
    </h3>
  );
}

// ─── Trend section (category-grouped) ────────────────────────────────────────

function TrendSection({ results }: { results: PreviousResult[] }) {
  if (results.length < 2) return null;

  const trends = buildTrendData(results);
  const distinctDates = [...new Set(results.map((r) => r.report_date))];
  const allSameDate = distinctDates.length === 1;

  if (trends.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-semibold text-foreground">Lab trends</h2>
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-6">
          <p className="text-sm text-muted-foreground">
            {allSameDate
              ? `All ${results.length} uploads share the same report date (${formatDate(distinctDates[0])}). Trends appear once you have reports from different dates.`
              : "No tests have results across multiple dates yet."}
          </p>
        </div>
      </section>
    );
  }

  const byCategory = new Map<string, TestTrend[]>();
  for (const t of trends) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }
  const sortedCategories = [...byCategory.keys()].sort();

  return (
    <section className="space-y-5">
      <h2 className="font-semibold text-foreground">Lab trends</h2>
      {sortedCategories.map((cat, i) => (
        <div key={cat} className="space-y-3">
          <CategoryHeader label={cat} first={i === 0} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {byCategory.get(cat)!.map((t) => (
              <MiniChart key={t.displayName} trend={t} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// ─── Cross-date table ─────────────────────────────────────────────────────────

function CrossDateTable({ results }: { results: PreviousResult[] }) {
  if (results.length === 0) return null;

  const sorted = [...results].sort((a, b) =>
    a.report_date.localeCompare(b.report_date)
  );

  // Column = one report (report_date + source_lab). Use row id as stable key.
  const columns = sorted.map((r) => ({
    id: r.id,
    date: r.report_date,
    lab: r.source_lab,
  }));

  type CellData = {
    value: string;
    unit: string | null;
    flag: "normal" | "low" | "high";
  };

  // normalizedKey → { displayName variants, category, cells: Map<reportId, CellData> }
  const testIndex = new Map<
    string,
    {
      nameVariants: string[];
      category: string;
      cells: Map<string, CellData>;
    }
  >();

  for (const result of sorted) {
    for (const row of result.extracted_json ?? []) {
      const key = testKey(row.test_name);
      if (!testIndex.has(key)) {
        testIndex.set(key, {
          nameVariants: [],
          category: resolveCategory(row.category),
          cells: new Map(),
        });
      }
      const entry = testIndex.get(key)!;
      entry.nameVariants.push(row.test_name);
      if (row.category && entry.category === UNCATEGORIZED) {
        entry.category = row.category;
      }
      entry.cells.set(result.id, {
        value: row.value,
        unit: row.unit ?? null,
        flag: row.flag,
      });
    }
  }

  const byCategory = new Map<string, string[]>(); // category → normalizedKeys
  for (const [key, { category }] of testIndex) {
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(key);
  }

  // Sort categories; within each, sort by display name
  const sortedCategories = [...byCategory.keys()].sort();
  for (const [, keys] of byCategory) {
    keys.sort((a, b) => {
      const na = resolveDisplayName(a, testIndex.get(a)!.nameVariants);
      const nb = resolveDisplayName(b, testIndex.get(b)!.nameVariants);
      return na.localeCompare(nb);
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground">All results by date</h2>
      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
        {sortedCategories.map((cat, catIdx) => {
          const keys = byCategory.get(cat)!;
          return (
            <div key={cat}>
              {/* Category row */}
              <div
                className={`px-5 py-2 bg-slate-50 ${
                  catIdx > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <span className="text-[11px] font-semibold text-foreground/40 uppercase tracking-widest">
                  {cat}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs min-w-[140px]">
                        Test
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col.id}
                          className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs tabular-nums whitespace-nowrap"
                        >
                          {formatDateShort(col.date)}
                          {col.lab && (
                            <div className="text-[10px] font-normal text-muted-foreground/40 mt-0.5 max-w-[88px] truncate ml-auto">
                              {col.lab}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((key) => {
                      const { nameVariants, cells } =
                        testIndex.get(key)!;
                      const label = resolveDisplayName(key, nameVariants);
                      return (
                        <tr
                          key={key}
                          className="border-b border-slate-50 last:border-0"
                        >
                          <td className="px-5 py-2.5 text-foreground text-sm">
                            {label}
                          </td>
                          {columns.map((col) => {
                            const cell = cells.get(col.id) ?? null;
                            if (!cell) {
                              return (
                                <td
                                  key={col.id}
                                  className="px-4 py-2.5 text-right text-muted-foreground/30 text-sm tabular-nums"
                                >
                                  —
                                </td>
                              );
                            }
                            const hi = cell.flag === "high";
                            const lo = cell.flag === "low";
                            return (
                              <td
                                key={col.id}
                                className={`px-4 py-2.5 text-right tabular-nums text-sm font-medium ${
                                  hi || lo
                                    ? hi
                                      ? "text-rose-600"
                                      : "text-amber-600"
                                    : "text-foreground"
                                }`}
                              >
                                {cell.value}
                                {cell.unit ? ` ${cell.unit}` : ""}
                                {hi && (
                                  <span className="ml-0.5 text-xs">↑</span>
                                )}
                                {lo && (
                                  <span className="ml-0.5 text-xs">↓</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Lab Results Table (per-report detail) ────────────────────────────────────

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
  const [reextracting, setReextracting] = useState(false);
  const [reextractError, setReextractError] = useState<string | null>(null);

  const rows: LabRow[] = Array.isArray(result.extracted_json)
    ? result.extracted_json
    : [];
  const hasCategories = rows.some((r) => r.category);

  async function handleDelete() {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("lab_results").delete().eq("id", result.id);
    router.refresh();
  }

  async function handleReextract() {
    setReextracting(true);
    setReextractError(null);
    try {
      const res = await fetch("/api/reextract-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id }),
      });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else if (data.code === "NO_PDF") {
        setReextractError(
          "PDF not found in storage. Re-upload this report to get categories and lab name."
        );
      } else {
        setReextractError(data.error ?? "Re-extraction failed.");
      }
    } finally {
      setReextracting(false);
    }
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
              {formatDate(result.report_date)}
              {result.source_lab && ` · ${result.source_lab}`}
              {` · ${rows.length} result${rows.length !== 1 ? "s" : ""}`}
              {!hasCategories && " · no categories yet"}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          )}
        </button>
        <div className="ml-4 flex items-center gap-3 shrink-0">
          <button
            onClick={handleReextract}
            disabled={reextracting || deleting}
            className="text-xs text-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
          >
            {reextracting ? "Re-extracting…" : "Re-extract"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || reextracting}
            className="text-xs text-destructive hover:text-destructive/80 disabled:opacity-40 transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
      {reextractError && (
        <div className="px-5 pb-3 -mt-1">
          <p className="text-xs text-destructive">{reextractError}</p>
        </div>
      )}
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
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background p-8 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 ${
          loading ? "pointer-events-none opacity-60" : ""
        }`}
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
  const [reextractingAll, setReextractingAll] = useState(false);

  void userId;

  function handleResults(rows: LabRow[]) {
    setLatestRows(rows);
    router.refresh();
  }

  async function handleReextractAll() {
    setReextractingAll(true);
    for (const r of previousResults) {
      await fetch("/api/reextract-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
    }
    setReextractingAll(false);
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
            <h1 className="text-xl font-semibold text-foreground">
              Lab Results
            </h1>
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
                ({latestRows.length} test
                {latestRows.length !== 1 ? "s" : ""})
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
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                Previous uploads
              </h2>
              <button
                onClick={handleReextractAll}
                disabled={reextractingAll}
                className="text-xs text-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
              >
                {reextractingAll
                  ? "Re-extracting all…"
                  : "Re-extract all"}
              </button>
            </div>
            {previousResults.map((r) => (
              <PreviousCard key={r.id} result={r} />
            ))}
          </section>
        )}

        <TrendSection results={previousResults} />

        <CrossDateTable results={previousResults} />
      </main>
    </div>
  );
}
