"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mic, X } from "lucide-react";
import SearchBox from "@/components/SearchBox";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  breakfast: string | null;
  morning_snack: string | null;
  lunch: string | null;
  evening_snack: string | null;
  dinner: string | null;
  junk_sugar_flag: boolean | null;
  junk_sugar_details: string | null;
  exercise: string | null;
  slept_at: string | null;
  woke_at: string | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  medication_taken: boolean | null;
  medication_details: string | null;
  school_notes: string | null;
  skills_notes: string | null;
  notes: string | null;
};

// Fields Claude can extract from a Quick Log free-text entry.
export type QuickLogParsed = Partial<
  Pick<
    DailyEntry,
    | "mood"
    | "energy"
    | "pain_level"
    | "stomach_pain"
    | "bloating"
    | "nausea"
    | "loose_stools"
    | "constipation"
    | "bm_frequency"
    | "bm_consistency"
    | "breakfast"
    | "morning_snack"
    | "lunch"
    | "evening_snack"
    | "dinner"
    | "junk_sugar_flag"
    | "exercise"
    | "slept_at"
    | "woke_at"
    | "sleep_quality"
    | "medication_taken"
    | "medication_details"
    | "school_notes"
    | "skills_notes"
    | "notes"
  >
>;

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

// Today back 13 days, descending (most recent first) — 14 dates total.
function last14Dates(): string[] {
  const dates: string[] = [];
  const start = new Date(todayStr() + "T00:00:00Z");
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function calcSleepHours(sleptAt: string, wokeAt: string): number | null {
  if (!sleptAt || !wokeAt) return null;
  const [sh, sm] = sleptAt.split(":").map(Number);
  const [wh, wm] = wokeAt.split(":").map(Number);
  const sleptMins = sh * 60 + sm;
  let wokeMins = wh * 60 + wm;
  if (wokeMins <= sleptMins) wokeMins += 1440; // overnight: add 24 hrs
  return Math.round(((wokeMins - sleptMins) / 60) * 10) / 10;
}

// ─── Design system ────────────────────────────────────────────────────────────

// Shared input classes — text-base prevents iOS auto-zoom on focus
const INPUT =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow";

const TEXTAREA = INPUT + " resize-none";

function SectionCard({
  title,
  bg,
  border,
  children,
}: {
  title: string;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${bg} ${border}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function sliderColor(value: number): string {
  if (value >= 4) return "text-emerald-700";
  if (value === 3) return "text-amber-600";
  return "text-rose-600";
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
        <label className="text-sm font-medium text-foreground/80">{label}</label>
        <span className={`text-sm font-semibold tabular-nums ${sliderColor(value)}`}>
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
        className="w-full h-2 rounded-full cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-[11px] text-foreground/30 select-none px-0.5">
        <span>Low</span>
        <span>High</span>
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
  selectedCls,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  labels?: string[];
  selectedCls: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      <div className="flex gap-1.5">
        {labels.map((l, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`flex-1 py-3.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              value === i
                ? selectedCls
                : "bg-white/60 text-foreground/40 border-black/8 hover:bg-white hover:text-foreground/70"
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
  { n: 6, desc: "Fluffy" },
  { n: 7, desc: "Liquid" },
];

function BristolSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  function btnCls(n: number) {
    if (value !== n)
      return "bg-white/60 text-foreground/40 border-black/8 hover:bg-white hover:text-foreground/70";
    if (n <= 2) return "bg-amber-100 text-amber-800 border-amber-200";
    if (n <= 4) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    return "bg-rose-100 text-rose-800 border-rose-200";
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/80">
        Consistency (Bristol scale)
      </label>
      <div className="flex gap-1">
        {BRISTOL.map(({ n }) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${btnCls(n)}`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-foreground/40">
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
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, display - 1))}
          className="size-11 rounded-xl border border-black/10 bg-white text-foreground text-xl font-medium hover:bg-white/80 active:scale-95 transition-all flex items-center justify-center"
        >
          −
        </button>
        <span className="text-lg font-semibold tabular-nums w-7 text-center text-foreground">
          {value ?? "–"}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, display + 1))}
          className="size-11 rounded-xl border border-black/10 bg-white text-foreground text-xl font-medium hover:bg-white/80 active:scale-95 transition-all flex items-center justify-center"
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
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      <div className="flex rounded-xl border border-black/10 overflow-hidden bg-white/60">
        <button
          type="button"
          onClick={() => onChange(value === true ? null : true)}
          className={`flex-1 py-3.5 text-sm font-semibold transition-all active:scale-95 ${
            value === true
              ? "bg-emerald-100 text-emerald-800"
              : "text-foreground/40 hover:bg-white/80 hover:text-foreground/70"
          }`}
        >
          Yes
        </button>
        <div className="w-px bg-black/8" />
        <button
          type="button"
          onClick={() => onChange(value === false ? null : false)}
          className={`flex-1 py-3.5 text-sm font-semibold transition-all active:scale-95 ${
            value === false
              ? "bg-rose-100 text-rose-800"
              : "text-foreground/40 hover:bg-white/80 hover:text-foreground/70"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

// ─── Quick Log ────────────────────────────────────────────────────────────────

function QuickLogCard({
  onParsed,
}: {
  onParsed: (data: QuickLogParsed) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!text.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/parse-daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Couldn't parse that — please try again.");
        return;
      }

      onParsed(data as QuickLogParsed);
      setText("");
      setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4 bg-indigo-50 border-indigo-100/80">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
          Quick Log
        </p>
        {open && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/70 border border-indigo-200 py-3.5 text-sm font-semibold text-indigo-700 hover:bg-white transition-all active:scale-95"
        >
          <Mic className="size-4" />
          Quick Log — describe her day
        </button>
      ) : (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            className={TEXTAREA}
            rows={5}
            autoFocus
            placeholder="Describe Ananya's day in your own words — symptoms, food, sleep, medication, mood, anything that happened."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="w-full h-12 text-base rounded-xl"
          >
            {loading ? "Parsing…" : "Submit"}
          </Button>
        </div>
      )}
    </div>
  );
}

function QuickLogBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-800">
        Filled from your quick log — review all fields and complete any blanks
        before saving.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ─── Entry Form (today or any past date) ──────────────────────────────────────

function EntryForm({
  entry,
  targetDate,
  userId,
  quickLogPrefill,
}: {
  entry: DailyEntry | null;
  targetDate: string;
  userId: string;
  quickLogPrefill?: QuickLogParsed | null;
}) {
  const router = useRouter();
  const isEdit = entry !== null;
  const e = entry;
  const q = quickLogPrefill;
  const isToday = targetDate === todayStr();

  const [mood, setMood] = useState(e?.mood ?? q?.mood ?? 3);
  const [energy, setEnergy] = useState(e?.energy ?? q?.energy ?? 3);
  const [painLevel, setPainLevel] = useState(e?.pain_level ?? q?.pain_level ?? 3);

  const [stomachPain, setStomachPain] = useState<number | null>(
    e?.stomach_pain ?? q?.stomach_pain ?? null
  );
  const [bloating, setBloating] = useState<number | null>(e?.bloating ?? q?.bloating ?? null);
  const [nausea, setNausea] = useState<number | null>(e?.nausea ?? q?.nausea ?? null);
  const [looseStools, setLooseStools] = useState<number | null>(
    e?.loose_stools ?? q?.loose_stools ?? null
  );
  const [constipation, setConstipation] = useState<number | null>(
    e?.constipation ?? q?.constipation ?? null
  );

  const [bmFrequency, setBmFrequency] = useState<number | null>(
    e?.bm_frequency ?? q?.bm_frequency ?? null
  );
  const [bmConsistency, setBmConsistency] = useState<number | null>(
    e?.bm_consistency ?? q?.bm_consistency ?? null
  );

  const [breakfast, setBreakfast] = useState(e?.breakfast ?? q?.breakfast ?? "");
  const [morningSnack, setMorningSnack] = useState(e?.morning_snack ?? q?.morning_snack ?? "");
  const [lunch, setLunch] = useState(e?.lunch ?? q?.lunch ?? "");
  const [eveningSnack, setEveningSnack] = useState(e?.evening_snack ?? q?.evening_snack ?? "");
  const [dinner, setDinner] = useState(e?.dinner ?? q?.dinner ?? "");
  const [junkSugarFlag, setJunkSugarFlag] = useState<boolean | null>(
    e?.junk_sugar_flag ?? q?.junk_sugar_flag ?? null
  );
  const [junkSugarDetails, setJunkSugarDetails] = useState(e?.junk_sugar_details ?? "");

  const [exercise, setExercise] = useState(e?.exercise ?? q?.exercise ?? "");
  const [sleptAt, setSleptAt] = useState(e?.slept_at ?? q?.slept_at ?? "");
  const [wokeAt, setWokeAt] = useState(e?.woke_at ?? q?.woke_at ?? "");
  const [sleepQuality, setSleepQuality] = useState<number | null>(
    e?.sleep_quality ?? q?.sleep_quality ?? null
  );

  const [medicationTaken, setMedicationTaken] = useState<boolean | null>(
    e?.medication_taken ?? q?.medication_taken ?? null
  );
  const [medicationDetails, setMedicationDetails] = useState(
    e?.medication_details ?? q?.medication_details ?? ""
  );

  const [schoolNotes, setSchoolNotes] = useState(e?.school_notes ?? q?.school_notes ?? "");
  const [skillsNotes, setSkillsNotes] = useState(e?.skills_notes ?? q?.skills_notes ?? "");
  const [notes, setNotes] = useState(e?.notes ?? q?.notes ?? "");

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
      breakfast: breakfast.trim() || null,
      morning_snack: morningSnack.trim() || null,
      lunch: lunch.trim() || null,
      evening_snack: eveningSnack.trim() || null,
      dinner: dinner.trim() || null,
      junk_sugar_flag: junkSugarFlag,
      junk_sugar_details: junkSugarDetails.trim() || null,
      exercise: exercise.trim() || null,
      slept_at: sleptAt || null,
      woke_at: wokeAt || null,
      sleep_hours: calcSleepHours(sleptAt, wokeAt),
      sleep_quality: sleepQuality,
      medication_taken: medicationTaken,
      medication_details: medicationDetails.trim() || null,
      school_notes: schoolNotes.trim() || null,
      skills_notes: skillsNotes.trim() || null,
      notes: notes.trim() || null,
    };

    const { error: err } = isEdit
      ? await supabase.from("daily_tracker").update(payload).eq("id", e!.id)
      : await supabase.from("daily_tracker").insert({
          user_id: userId,
          date: targetDate,
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

  const sleepDuration = calcSleepHours(sleptAt, wokeAt);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Date header */}
      <div className="px-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {isToday ? (isEdit ? "Today's log" : "Log today") : formatDate(targetDate)}
        </h2>
        <span className="text-sm text-foreground/40">{formatDate(targetDate)}</span>
      </div>

      {/* ── Wellbeing ─────────────────────────────────────────── */}
      <SectionCard title="Wellbeing" bg="bg-blue-50" border="border-blue-100/80">
        <RatingSlider label="Energy" value={energy} onChange={setEnergy} />
        <RatingSlider label="Mood" value={mood} onChange={setMood} />
        <RatingSlider label="Pain level" value={painLevel} onChange={setPainLevel} />
      </SectionCard>

      {/* ── GI Symptoms ───────────────────────────────────────── */}
      <SectionCard title="GI Symptoms" bg="bg-rose-50" border="border-rose-100/80">
        <SegmentedSelector
          label="Stomach pain"
          value={stomachPain}
          onChange={setStomachPain}
          selectedCls="bg-rose-200 text-rose-900 border-rose-300"
        />
        <SegmentedSelector
          label="Bloating"
          value={bloating}
          onChange={setBloating}
          selectedCls="bg-rose-200 text-rose-900 border-rose-300"
        />
        <SegmentedSelector
          label="Nausea"
          value={nausea}
          onChange={setNausea}
          selectedCls="bg-rose-200 text-rose-900 border-rose-300"
        />
        <SegmentedSelector
          label="Loose stools"
          value={looseStools}
          onChange={setLooseStools}
          selectedCls="bg-rose-200 text-rose-900 border-rose-300"
        />
        <SegmentedSelector
          label="Constipation"
          value={constipation}
          onChange={setConstipation}
          selectedCls="bg-rose-200 text-rose-900 border-rose-300"
        />
      </SectionCard>

      {/* ── Bowel Movements ───────────────────────────────────── */}
      <SectionCard title="Bowel Movements" bg="bg-amber-50" border="border-amber-100/80">
        <NumberStepper
          label="Frequency today"
          value={bmFrequency}
          onChange={setBmFrequency}
        />
        <BristolSelector value={bmConsistency} onChange={setBmConsistency} />
      </SectionCard>

      {/* ── Food ──────────────────────────────────────────────── */}
      <SectionCard title="Food" bg="bg-emerald-50" border="border-emerald-100/80">
        {(
          [
            ["Breakfast", breakfast, setBreakfast, "What did she have for breakfast?"],
            ["Morning snack", morningSnack, setMorningSnack, "Morning snack…"],
            ["Lunch", lunch, setLunch, "What did she have for lunch?"],
            ["Evening snack", eveningSnack, setEveningSnack, "Evening snack…"],
            ["Dinner", dinner, setDinner, "What did she have for dinner?"],
          ] as [string, string, (v: string) => void, string][]
        ).map(([lbl, val, setter, ph]) => (
          <div key={lbl}>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              {lbl}
            </label>
            <input
              type="text"
              value={val}
              onChange={(ev) => setter(ev.target.value)}
              className={INPUT}
              placeholder={ph}
            />
          </div>
        ))}
        <YesNoSelector
          label="Junk food or sugar?"
          value={junkSugarFlag}
          onChange={setJunkSugarFlag}
        />
        {junkSugarFlag && (
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              What / how much?
            </label>
            <input
              type="text"
              value={junkSugarDetails}
              onChange={(ev) => setJunkSugarDetails(ev.target.value)}
              className={INPUT}
              placeholder="e.g. 2 cookies, juice box…"
            />
          </div>
        )}
      </SectionCard>

      {/* ── Activity & Sleep ──────────────────────────────────── */}
      <SectionCard title="Activity & Sleep" bg="bg-violet-50" border="border-violet-100/80">
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Exercise
          </label>
          <input
            type="text"
            value={exercise}
            onChange={(ev) => setExercise(ev.target.value)}
            className={INPUT}
            placeholder="e.g. 30 min walk, PE class, none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Fell asleep
            </label>
            <input
              type="time"
              value={sleptAt}
              onChange={(ev) => setSleptAt(ev.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Woke up
            </label>
            <input
              type="time"
              value={wokeAt}
              onChange={(ev) => setWokeAt(ev.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        {sleepDuration != null && (
          <p className="text-sm text-foreground/50">
            Sleep duration:{" "}
            <span className="font-semibold text-foreground/80">{sleepDuration} hrs</span>
          </p>
        )}

        <SegmentedSelector
          label="Sleep quality"
          value={sleepQuality}
          onChange={setSleepQuality}
          labels={["Poor", "Fair", "Good", "Great"]}
          selectedCls="bg-violet-200 text-violet-900 border-violet-300"
        />
      </SectionCard>

      {/* ── Medication ────────────────────────────────────────── */}
      <SectionCard title="Medication" bg="bg-sky-50" border="border-sky-100/80">
        <YesNoSelector
          label="Meds taken as prescribed?"
          value={medicationTaken}
          onChange={setMedicationTaken}
        />
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Medications & supplements given
          </label>
          <textarea
            value={medicationDetails}
            onChange={(ev) => setMedicationDetails(ev.target.value)}
            className={TEXTAREA}
            rows={2}
            placeholder="e.g. Azathioprine 50mg, Vitamin D, iron…"
          />
        </div>
      </SectionCard>

      {/* ── School & Skills ───────────────────────────────────── */}
      <SectionCard title="School & Skills" bg="bg-teal-50" border="border-teal-100/80">
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            School notes
          </label>
          <textarea
            value={schoolNotes}
            onChange={(ev) => setSchoolNotes(ev.target.value)}
            className={TEXTAREA}
            rows={2}
            placeholder="How was school today?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Skills & development
          </label>
          <textarea
            value={skillsNotes}
            onChange={(ev) => setSkillsNotes(ev.target.value)}
            className={TEXTAREA}
            rows={2}
            placeholder="New skills, milestones, therapy notes…"
          />
        </div>
      </SectionCard>

      {/* ── Notes ─────────────────────────────────────────────── */}
      <SectionCard title="Notes" bg="bg-slate-50" border="border-slate-200/80">
        <textarea
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          className={TEXTAREA}
          rows={3}
          placeholder="Anything else worth noting…"
        />
      </SectionCard>

      {error && <p className="px-1 text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="px-1 text-sm text-emerald-600 font-medium">
          {isEdit ? "Updated." : "Saved."}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full h-12 text-base rounded-xl">
        {loading
          ? "Saving…"
          : isEdit
          ? isToday ? "Update today's log" : "Update log"
          : isToday ? "Save today's log" : "Save log"}
      </Button>
    </form>
  );
}

// ─── Log List ─────────────────────────────────────────────────────────────────

function pillCls(good: boolean): string {
  return good
    ? "bg-emerald-100 text-emerald-800"
    : "bg-rose-100 text-rose-800";
}

function LogList({
  logs,
  onEdit,
  onLogDay,
}: {
  logs: DailyEntry[];
  onEdit: (entry: DailyEntry) => void;
  onLogDay: (date: string) => void;
}) {
  const router = useRouter();
  const logsByDate = new Map(logs.map((log) => [log.date, log]));

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("daily_tracker").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {last14Dates().map((date) => {
        const log = logsByDate.get(date);

        if (!log) {
          return (
            <div
              key={date}
              className="rounded-2xl border border-dashed border-border bg-card/50 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">
                  {formatDate(date)}
                </p>
                <p className="text-xs text-muted-foreground/60">No entry</p>
              </div>
              <button
                onClick={() => onLogDay(date)}
                className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors shrink-0"
              >
                Log this day
              </button>
            </div>
          );
        }

        return (
          <div
            key={log.id}
            className="rounded-2xl border border-border bg-card p-4 space-y-2"
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
                  onClick={() => onEdit(log)}
                  className="text-xs text-blue-500 hover:text-blue-400 transition-colors shrink-0"
                >
                  Edit
                </button>
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
        );
      })}
    </div>
  );
}

// ─── Trend Charts ────────────────────────────────────────────────────────────

type TrendPoint = Record<string, string | number | null>;

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

type SingleTrend = {
  label: string;
  color: string;
  points: { date: string; displayDate: string; value: number }[];
};

function buildSingleTrend(
  logs: DailyEntry[],
  field: keyof DailyEntry,
  label: string,
  color: string
): SingleTrend | null {
  const points: { date: string; displayDate: string; value: number }[] = [];
  for (const log of logs) {
    const v = log[field];
    if (v != null && typeof v === "number") {
      points.push({ date: log.date, displayDate: formatDateShort(log.date), value: v });
    }
  }
  if (points.length < 2) return null;
  points.sort((a, b) => a.date.localeCompare(b.date));
  return { label, color, points };
}

function MiniChart({ trend }: { trend: SingleTrend }) {
  const { label, color, points } = trend;
  const latestVal = points[points.length - 1].value;

  const allVals = points.map((p) => p.value);
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const pad = Math.max((yMax - yMin) * 0.25, yMax * 0.05, 0.5);
  const domainMin = Math.max(0, yMin - pad);
  const domainMax = yMax + pad;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
        <span className="text-xs font-semibold shrink-0 tabular-nums text-foreground/50">
          {latestVal}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={96}>
        <LineChart
          data={points.map((p) => ({ date: p.displayDate, value: p.value }))}
          margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
        >
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
            formatter={(v: unknown) => [`${v}`, label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const GI_SYMPTOMS = [
  { field: "stomach_pain" as keyof DailyEntry, label: "Stomach pain", color: "#f43f5e" },
  { field: "bloating" as keyof DailyEntry, label: "Bloating", color: "#f97316" },
  { field: "nausea" as keyof DailyEntry, label: "Nausea", color: "#a855f7" },
  { field: "loose_stools" as keyof DailyEntry, label: "Loose stools", color: "#3b82f6" },
  { field: "constipation" as keyof DailyEntry, label: "Constipation", color: "#14b8a6" },
];

function GIMultiLineChart({ logs }: { logs: DailyEntry[] }) {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  const hasAnyData = GI_SYMPTOMS.some((s) => {
    const withData = sorted.filter((l) => l[s.field] != null);
    return withData.length >= 2;
  });
  if (!hasAnyData) return null;

  const data: TrendPoint[] = sorted.map((log) => {
    const point: TrendPoint = {
      date: log.date,
      displayDate: formatDateShort(log.date),
    };
    for (const s of GI_SYMPTOMS) {
      point[s.field] = log[s.field] as number | null;
    }
    return point;
  });

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-2">
      <p className="text-sm font-semibold text-foreground leading-tight">
        GI Symptoms
      </p>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: "8px",
              border: "1px solid #f1f5f9",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              padding: "4px 8px",
            }}
            formatter={(v: unknown, name: unknown) => {
              const n = String(name ?? "");
              const s = GI_SYMPTOMS.find((gs) => gs.field === n);
              return [`${v}`, s?.label ?? n];
            }}
          />
          <Legend
            iconType="line"
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(value: string) => {
              const s = GI_SYMPTOMS.find((gs) => gs.field === value);
              return s?.label ?? value;
            }}
          />
          {GI_SYMPTOMS.map((s) => (
            <Line
              key={s.field}
              type="monotone"
              dataKey={s.field}
              name={s.field}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-foreground/30">
        0 = None · 1 = Mild · 2 = Moderate · 3 = Severe
      </p>
    </div>
  );
}

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

function TrendSection({ logs }: { logs: DailyEntry[] }) {
  if (logs.length < 2) return null;

  const wellbeing = [
    buildSingleTrend(logs, "energy", "Energy", "#3b82f6"),
    buildSingleTrend(logs, "mood", "Mood", "#8b5cf6"),
    buildSingleTrend(logs, "pain_level", "Pain Level", "#f43f5e"),
  ].filter((t): t is SingleTrend => t !== null);

  const bm = [
    buildSingleTrend(logs, "bm_frequency", "BM Frequency", "#f59e0b"),
    buildSingleTrend(logs, "bm_consistency", "BM Consistency (Bristol)", "#ef4444"),
  ].filter((t): t is SingleTrend => t !== null);

  const sleep = [
    buildSingleTrend(logs, "sleep_hours", "Sleep Hours", "#6366f1"),
  ].filter((t): t is SingleTrend => t !== null);

  const hasGI = GI_SYMPTOMS.some((s) => {
    const withData = logs.filter((l) => l[s.field] != null);
    return withData.length >= 2;
  });

  if (wellbeing.length === 0 && !hasGI && bm.length === 0 && sleep.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <h2 className="text-sm font-semibold text-foreground/50 uppercase tracking-wider px-1">
        Trends
      </h2>

      {wellbeing.length > 0 && (
        <div className="space-y-3">
          <CategoryHeader label="Wellbeing" first />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {wellbeing.map((t) => (
              <MiniChart key={t.label} trend={t} />
            ))}
          </div>
        </div>
      )}

      {hasGI && (
        <div className="space-y-3">
          <CategoryHeader label="GI Symptoms" first={wellbeing.length === 0} />
          <GIMultiLineChart logs={logs} />
        </div>
      )}

      {bm.length > 0 && (
        <div className="space-y-3">
          <CategoryHeader label="Bowel Movements" first={wellbeing.length === 0 && !hasGI} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bm.map((t) => (
              <MiniChart key={t.label} trend={t} />
            ))}
          </div>
        </div>
      )}

      {sleep.length > 0 && (
        <div className="space-y-3">
          <CategoryHeader label="Sleep" first={wellbeing.length === 0 && !hasGI && bm.length === 0} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sleep.map((t) => (
              <MiniChart key={t.label} trend={t} />
            ))}
          </div>
        </div>
      )}
    </section>
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
  const [activeEntry, setActiveEntry] = useState<DailyEntry | null>(todayEntry);
  const [activeDate, setActiveDate] = useState<string>(todayStr());
  const [quickLogPrefill, setQuickLogPrefill] = useState<QuickLogParsed | null>(null);
  const [quickLogVersion, setQuickLogVersion] = useState(0);
  const [showQuickLogBanner, setShowQuickLogBanner] = useState(false);

  const isViewingPast = activeDate !== todayStr();

  function handleEdit(entry: DailyEntry) {
    setActiveEntry(entry);
    setActiveDate(entry.date);
    setQuickLogPrefill(null);
    setShowQuickLogBanner(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBackToToday() {
    setActiveEntry(todayEntry);
    setActiveDate(todayStr());
    setQuickLogPrefill(null);
    setShowQuickLogBanner(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleQuickLogParsed(data: QuickLogParsed) {
    setQuickLogPrefill(data);
    setQuickLogVersion((v) => v + 1);
    setShowQuickLogBanner(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLogDay(date: string) {
    setActiveEntry(null);
    setActiveDate(date);
    setQuickLogPrefill(null);
    setShowQuickLogBanner(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7]">
      <header className="border-b border-black/8 bg-white/80 backdrop-blur-sm px-4 py-4 sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Daily Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
            <SearchBox />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-6 pb-10">
        {isViewingPast && (
          <button
            onClick={handleBackToToday}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-400 transition-colors px-1"
          >
            <ArrowLeft className="size-3.5" />
            Back to today
          </button>
        )}

        <QuickLogCard onParsed={handleQuickLogParsed} />

        {showQuickLogBanner && (
          <QuickLogBanner onDismiss={() => setShowQuickLogBanner(false)} />
        )}

        <EntryForm
          key={`${activeEntry?.id ?? `new-${activeDate}`}-${quickLogVersion}`}
          entry={activeEntry}
          targetDate={activeDate}
          userId={userId}
          quickLogPrefill={quickLogPrefill}
        />

        <TrendSection logs={logs} />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground/50 uppercase tracking-wider px-1">
            Last 14 days
          </h2>
          <LogList logs={logs} onEdit={handleEdit} onLogDay={handleLogDay} />
        </section>
      </main>
    </div>
  );
}
