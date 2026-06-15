"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type SymptomLog = {
  id: string;
  date: string;
  energy: number | null;
  mood: number | null;
  appetite: number | null;
  pain_level: number | null;
  notes: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function badgeCls(value: number | null): string {
  if (value === null) return "bg-muted text-muted-foreground";
  if (value >= 4) return "bg-green-100 text-green-800";
  if (value === 3) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function sliderColor(value: number): string {
  if (value >= 4) return "text-green-600";
  if (value === 3) return "text-amber-600";
  return "text-red-600";
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span
          className={`text-sm font-semibold tabular-nums w-8 text-right ${sliderColor(value)}`}
        >
          {value} / 5
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full cursor-pointer accent-primary"
      />
      <div className="flex justify-between px-0.5 text-xs text-muted-foreground select-none">
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
      </div>
    </div>
  );
}

// ─── Today's form ─────────────────────────────────────────────────────────────

function TodayForm({
  todayLog,
  userId,
}: {
  todayLog: SymptomLog | null;
  userId: string;
}) {
  const router = useRouter();
  const isEdit = todayLog !== null;

  const [energy, setEnergy] = useState(todayLog?.energy ?? 3);
  const [mood, setMood] = useState(todayLog?.mood ?? 3);
  const [appetite, setAppetite] = useState(todayLog?.appetite ?? 3);
  const [painLevel, setPainLevel] = useState(todayLog?.pain_level ?? 3);
  const [notes, setNotes] = useState(todayLog?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const supabase = createClient();
    const payload = {
      energy,
      mood,
      appetite,
      pain_level: painLevel,
      notes: notes.trim() || null,
    };

    const { error: err } = isEdit
      ? await supabase
          .from("symptom_logs")
          .update(payload)
          .eq("id", todayLog.id)
      : await supabase.from("symptom_logs").insert({
          user_id: userId,
          date: todayStr(),
          ...payload,
        });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">
          {isEdit ? "Today's log" : "Log today"}
        </h2>
        <span className="text-xs text-muted-foreground">
          {formatDate(todayStr())}
        </span>
      </div>

      <div className="space-y-5">
        <RatingSlider label="Energy" value={energy} onChange={setEnergy} />
        <RatingSlider label="Mood" value={mood} onChange={setMood} />
        <RatingSlider
          label="Appetite"
          value={appetite}
          onChange={setAppetite}
        />
        <RatingSlider
          label="Pain level"
          value={painLevel}
          onChange={setPainLevel}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          rows={3}
          placeholder="How are you feeling today?"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="text-sm text-green-600">
          {isEdit ? "Updated." : "Saved."}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : isEdit ? "Update" : "Save"}
      </Button>
    </form>
  );
}

// ─── Log list ─────────────────────────────────────────────────────────────────

const METRICS = [
  { key: "energy" as const, label: "Energy" },
  { key: "mood" as const, label: "Mood" },
  { key: "appetite" as const, label: "Appetite" },
  { key: "pain_level" as const, label: "Pain" },
];

function LogList({ logs }: { logs: SymptomLog[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("symptom_logs").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="rounded-xl border border-border bg-card p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-foreground shrink-0">
              {formatDate(log.date)}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 flex-wrap">
                {METRICS.map(({ key, label }) => {
                  const val = log[key];
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${badgeCls(val)}`}
                    >
                      {label}: {val ?? "–"}
                    </span>
                  );
                })}
              </div>
              <button
                onClick={() => handleDelete(log.id)}
                className="text-xs text-destructive hover:text-destructive/80 transition-colors shrink-0"
              >
                Delete
              </button>
            </div>
          </div>
          {log.notes && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {log.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────────

const CHART_LINES = [
  { key: "energy", label: "Energy", color: "#3b82f6" },
  { key: "mood", label: "Mood", color: "#8b5cf6" },
  { key: "appetite", label: "Appetite", color: "#22c55e" },
  { key: "pain", label: "Pain", color: "#ef4444" },
] as const;

function SymptomChart({ logs }: { logs: SymptomLog[] }) {
  if (logs.length < 2) return null;

  const chartData = [...logs].reverse().map((log) => ({
    date: formatDateShort(log.date),
    energy: log.energy,
    mood: log.mood,
    appetite: log.appetite,
    pain: log.pain_level,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="font-semibold text-foreground mb-4">14-day trend</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {CHART_LINES.map(({ key, label, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function SymptomsClient({
  userId,
  todayLog,
  logs,
}: {
  userId: string;
  todayLog: SymptomLog | null;
  logs: SymptomLog[];
}) {
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
            <h1 className="text-xl font-semibold text-foreground">Symptoms</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <TodayForm key={todayLog?.id ?? "new"} todayLog={todayLog} userId={userId} />

        {logs.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground">Last 14 days</h2>
            <LogList logs={logs} />
          </section>
        )}

        <SymptomChart logs={logs} />
      </main>
    </div>
  );
}
