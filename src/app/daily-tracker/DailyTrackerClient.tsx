"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DailyEntry = {
  id: string;
  date: string;
  mood: number | null;
  energy: number | null;
  pain_level: number | null;
  stomach_pain: number | null;
  bloating: number | null;
  nausea: number | null;
  loose_stools: number | null;
  constipation: number | null;
  bm_frequency: number | null;
  bm_consistency: number | null;
  food_notes: string | null;
  junk_sugar_flag: boolean | null;
  exercise: string | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  medication_taken: boolean | null;
  school_notes: string | null;
  skills_notes: string | null;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function sliderColor(value: number): string {
  if (value >= 4) return "text-green-600";
  if (value === 3) return "text-amber-600";
  return "text-red-600";
}

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
          {value}/5
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-3 rounded-full cursor-pointer accent-primary"
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

const SEVERITY_LABELS = ["None", "Mild", "Moderate", "Severe"];

function SegmentedSelector({
  label,
  value,
  onChange,
  labels = SEVERITY_LABELS,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  labels?: string[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}
      >
        {labels.map((l, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`py-3 rounded-lg text-xs font-medium border transition-colors ${
              value === i
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const BRISTOL = [
  { n: 1, desc: "Hard lumps" },
  { n: 2, desc: "Lumpy log" },
  { n: 3, desc: "Cracked log" },
  { n: 4, desc: "Smooth" },
  { n: 5, desc: "Soft blobs" },
  { n: 6, desc: "Fluffy pieces" },
  { n: 7, desc: "Liquid" },
];

function BristolSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Consistency (Bristol scale)
      </label>
      <div className="flex gap-1">
        {BRISTOL.map(({ n }) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition-colors ${
              value === n
                ? n <= 2
                  ? "bg-amber-500 text-white border-amber-500"
                  : n <= 4
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-red-500 text-white border-red-500"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value != null
          ? `${BRISTOL[value - 1].desc} · ${value <= 2 ? "constipated" : value <= 4 ? "normal" : "loose"}`
          : "1–2 hard · 3–4 normal · 5–7 loose"}
      </p>
    </div>
  );
}

function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const display = value ?? 0;
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, display - 1))}
          className="size-11 rounded-lg border border-border bg-background text-foreground text-xl font-medium hover:bg-muted transition-colors flex items-center justify-center"
        >
          −
        </button>
        <span className="text-base font-semibold tabular-nums w-6 text-center text-foreground">
          {value ?? "–"}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, display + 1))}
          className="size-11 rounded-lg border border-border bg-background text-foreground text-xl font-medium hover:bg-muted transition-colors flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}

function YesNoSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(value === true ? null : true)}
          className={`px-6 py-3 rounded-lg text-sm font-medium border transition-colors ${
            value === true
              ? "bg-green-500 text-white border-green-500"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(value === false ? null : false)}
          className={`px-6 py-3 rounded-lg text-sm font-medium border transition-colors ${
            value === false
              ? "bg-red-500 text-white border-red-500"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

// ─── Today's Form ─────────────────────────────────────────────────────────────

function TodayForm({
  todayEntry,
  userId,
}: {
  todayEntry: DailyEntry | null;
  userId: string;
}) {
  const router = useRouter();
  const isEdit = todayEntry !== null;
  const e = todayEntry;

  const [mood, setMood] = useState(e?.mood ?? 3);
  const [energy, setEnergy] = useState(e?.energy ?? 3);
  const [painLevel, setPainLevel] = useState(e?.pain_level ?? 3);

  const [stomachPain, setStomachPain] = useState<number | null>(e?.stomach_pain ?? null);
  const [bloating, setBloating] = useState<number | null>(e?.bloating ?? null);
  const [nausea, setNausea] = useState<number | null>(e?.nausea ?? null);
  const [looseStools, setLooseStools] = useState<number | null>(e?.loose_stools ?? null);
  const [constipation, setConstipation] = useState<number | null>(e?.constipation ?? null);

  const [bmFrequency, setBmFrequency] = useState<number | null>(e?.bm_frequency ?? null);
  const [bmConsistency, setBmConsistency] = useState<number | null>(e?.bm_consistency ?? null);

  const [foodNotes, setFoodNotes] = useState(e?.food_notes ?? "");
  const [junkSugarFlag, setJunkSugarFlag] = useState<boolean | null>(e?.junk_sugar_flag ?? null);

  const [exercise, setExercise] = useState(e?.exercise ?? "");
  const [sleepHours, setSleepHours] = useState(
    e?.sleep_hours != null ? String(e.sleep_hours) : ""
  );
  const [sleepQuality, setSleepQuality] = useState<number | null>(e?.sleep_quality ?? null);

  const [medicationTaken, setMedicationTaken] = useState<boolean | null>(
    e?.medication_taken ?? null
  );

  const [schoolNotes, setSchoolNotes] = useState(e?.school_notes ?? "");
  const [skillsNotes, setSkillsNotes] = useState(e?.skills_notes ?? "");
  const [notes, setNotes] = useState(e?.notes ?? "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const supabase = createClient();
    const payload = {
      mood,
      energy,
      pain_level: painLevel,
      stomach_pain: stomachPain,
      bloating,
      nausea,
      loose_stools: looseStools,
      constipation,
      bm_frequency: bmFrequency,
      bm_consistency: bmConsistency,
      food_notes: foodNotes.trim() || null,
      junk_sugar_flag: junkSugarFlag,
      exercise: exercise.trim() || null,
      sleep_hours: sleepHours !== "" ? Number(sleepHours) : null,
      sleep_quality: sleepQuality,
      medication_taken: medicationTaken,
      school_notes: schoolNotes.trim() || null,
      skills_notes: skillsNotes.trim() || null,
      notes: notes.trim() || null,
    };

    const { error: err } = isEdit
      ? await supabase.from("daily_tracker").update(payload).eq("id", e!.id)
      : await supabase.from("daily_tracker").insert({
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
      className="rounded-xl border border-border bg-card p-5 space-y-6 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">
          {isEdit ? "Today's log" : "Log today"}
        </h2>
        <span className="text-xs text-muted-foreground">{formatDate(todayStr())}</span>
      </div>

      {/* Wellbeing */}
      <div className="space-y-5">
        <SectionHeader label="Wellbeing" />
        <RatingSlider label="Energy" value={energy} onChange={setEnergy} />
        <RatingSlider label="Mood" value={mood} onChange={setMood} />
        <RatingSlider label="Pain level" value={painLevel} onChange={setPainLevel} />
      </div>

      {/* GI Symptoms */}
      <div className="space-y-4">
        <SectionHeader label="GI Symptoms" />
        <SegmentedSelector
          label="Stomach pain"
          value={stomachPain}
          onChange={setStomachPain}
        />
        <SegmentedSelector label="Bloating" value={bloating} onChange={setBloating} />
        <SegmentedSelector label="Nausea" value={nausea} onChange={setNausea} />
        <SegmentedSelector
          label="Loose stools"
          value={looseStools}
          onChange={setLooseStools}
        />
        <SegmentedSelector
          label="Constipation"
          value={constipation}
          onChange={setConstipation}
        />
      </div>

      {/* Bowel Movements */}
      <div className="space-y-4">
        <SectionHeader label="Bowel Movements" />
        <NumberStepper
          label="Frequency today"
          value={bmFrequency}
          onChange={setBmFrequency}
        />
        <BristolSelector value={bmConsistency} onChange={setBmConsistency} />
      </div>

      {/* Food */}
      <div className="space-y-4">
        <SectionHeader label="Food" />
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            What did she eat today?
          </label>
          <textarea
            value={foodNotes}
            onChange={(e) => setFoodNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
            rows={3}
            placeholder="Meals, snacks…"
          />
        </div>
        <YesNoSelector
          label="Junk food or sugar?"
          value={junkSugarFlag}
          onChange={setJunkSugarFlag}
        />
      </div>

      {/* Activity & Sleep */}
      <div className="space-y-4">
        <SectionHeader label="Activity & Sleep" />
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Exercise
          </label>
          <input
            type="text"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="e.g. 30 min walk, PE class, none"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Sleep last night (hrs)
          </label>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            className="w-20 rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="8"
          />
        </div>
        <SegmentedSelector
          label="Sleep quality"
          value={sleepQuality}
          onChange={setSleepQuality}
          labels={["Poor", "Fair", "Good", "Great"]}
        />
      </div>

      {/* Medication */}
      <div className="space-y-4">
        <SectionHeader label="Medication" />
        <YesNoSelector
          label="Meds taken as prescribed?"
          value={medicationTaken}
          onChange={setMedicationTaken}
        />
      </div>

      {/* School & Skills */}
      <div className="space-y-4">
        <SectionHeader label="School & Skills" />
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            School notes
          </label>
          <textarea
            value={schoolNotes}
            onChange={(e) => setSchoolNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
            rows={2}
            placeholder="How was school today?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Skills & development
          </label>
          <textarea
            value={skillsNotes}
            onChange={(e) => setSkillsNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
            rows={2}
            placeholder="New skills, milestones, therapy notes…"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <SectionHeader label="Notes" />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          rows={3}
          placeholder="Anything else worth noting…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="text-sm text-green-600">{isEdit ? "Updated." : "Saved."}</p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving…" : isEdit ? "Update" : "Save today's log"}
      </Button>
    </form>
  );
}

// ─── Log List ─────────────────────────────────────────────────────────────────

function pillCls(good: boolean): string {
  return good ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
}

function LogList({ logs }: { logs: DailyEntry[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("daily_tracker").delete().eq("id", id);
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
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {log.energy != null && (
                <span
                  className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${pillCls(log.energy >= 4)}`}
                >
                  Energy {log.energy}
                </span>
              )}
              {log.pain_level != null && (
                <span
                  className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${pillCls(log.pain_level <= 2)}`}
                >
                  Pain {log.pain_level}
                </span>
              )}
              {log.medication_taken != null && (
                <span
                  className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${pillCls(log.medication_taken)}`}
                >
                  Meds {log.medication_taken ? "✓" : "✗"}
                </span>
              )}
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

// ─── Page Shell ───────────────────────────────────────────────────────────────

export default function DailyTrackerClient({
  userId,
  todayEntry,
  logs,
}: {
  userId: string;
  todayEntry: DailyEntry | null;
  logs: DailyEntry[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Daily Tracker</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <TodayForm
          key={todayEntry?.id ?? "new"}
          todayEntry={todayEntry}
          userId={userId}
        />

        {logs.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground">Last 14 days</h2>
            <LogList logs={logs} />
          </section>
        )}
      </main>
    </div>
  );
}
