"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, Plus, ArrowLeft, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type DoseHistoryEntry = {
  id: string;
  dose: number;
  changed_at: string;
  notes: string | null;
};

type Medication = {
  id: string;
  name: string;
  dose: number;
  unit: string;
  frequency: string;
  start_date: string;
  notes: string | null;
  created_at: string;
  // Pre-computed server-side: dose_history ORDER BY changed_at DESC LIMIT 1,
  // falling back to medications.dose when history is empty.
  current_dose: number;
  dose_history: DoseHistoryEntry[];
};

const UNITS = ["mg", "ml", "tablet", "drops"] as const;
const FREQUENCIES = [
  "once daily",
  "twice daily",
  "three times daily",
  "as needed",
] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const field =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1">
      {children}
    </label>
  );
}

// ─── Log dose change (today's change) ────────────────────────────────────────
// Inserts the NEW dose into dose_history with today's date.
// Also updates medications.dose to keep it in sync.
// The new entry becomes "current" because it has the most recent changed_at.

function DoseChangeForm({
  medication,
  userId,
  onDone,
}: {
  medication: Medication;
  userId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [dose, setDose] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const newDose = Number(dose);

    const { error: histErr } = await supabase.from("dose_history").insert({
      medication_id: medication.id,
      user_id: userId,
      dose: newDose,
      changed_at: todayStr(),
      notes: notes.trim() || null,
    });

    if (histErr) {
      setError(histErr.message);
      setLoading(false);
      return;
    }

    const { error: medErr } = await supabase
      .from("medications")
      .update({ dose: newDose })
      .eq("id", medication.id);

    if (medErr) {
      setError(medErr.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-muted/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Log dose change</p>
        <span className="text-xs text-muted-foreground">Effective today</span>
      </div>

      <div>
        <FieldLabel>New dose ({medication.unit})</FieldLabel>
        <input
          type="number"
          required
          min="0"
          step="any"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          className={field}
          placeholder="0"
        />
      </div>

      <div>
        <FieldLabel>Notes (optional)</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${field} resize-none`}
          rows={2}
          placeholder="Reason for change…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving…" : "Save change"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Add historical dose ──────────────────────────────────────────────────────
// Inserts a past dose entry with a custom date.
// Never touches medications.dose — does not change what "current" displays.

function AddHistoricalDoseForm({
  medication,
  userId,
  onDone,
}: {
  medication: Medication;
  userId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [dose, setDose] = useState("");
  const [changedAt, setChangedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error: histErr } = await supabase.from("dose_history").insert({
      medication_id: medication.id,
      user_id: userId,
      dose: Number(dose),
      changed_at: changedAt,
      notes: notes.trim() || null,
    });

    if (histErr) {
      setError(histErr.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-muted/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Add historical dose</p>
        <span className="text-xs text-muted-foreground">Past entry — won&apos;t change current dose</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Dose ({medication.unit})</FieldLabel>
          <input
            type="number"
            required
            min="0"
            step="any"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className={field}
            placeholder="0"
          />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <input
            type="date"
            required
            value={changedAt}
            onChange={(e) => setChangedAt(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Notes (optional)</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${field} resize-none`}
          rows={2}
          placeholder="e.g. Starting dose, pre-transplant…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving…" : "Add to history"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Medication card ──────────────────────────────────────────────────────────

type ActiveForm = "change" | "historical" | null;

function MedicationCard({
  medication,
  userId,
}: {
  medication: Medication;
  userId: string;
}) {
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [showHistory, setShowHistory] = useState(false);

  // dose_history arrives pre-sorted DESC from the server query.
  // Sort again client-side as a safety net — localeCompare on ISO strings
  // is stable and doesn't depend on Date parsing.
  const sortedHistory = [...medication.dose_history].sort((a, b) =>
    b.changed_at.localeCompare(a.changed_at)
  );

  // current_dose is computed server-side (dose_history ORDER BY changed_at DESC LIMIT 1,
  // fallback to medications.dose). Never derived from client-side sort.
  const currentDose = medication.current_dose;

  function toggleForm(form: ActiveForm) {
    setActiveForm((prev) => (prev === form ? null : form));
    setShowHistory(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-card-foreground truncate">
            {medication.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentDose} {medication.unit} &middot; {medication.frequency}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Started {formatDate(medication.start_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleForm("change")}
          >
            <Plus />
            Log dose change
          </Button>
          <Button
            variant={activeForm === "historical" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => toggleForm("historical")}
          >
            <Clock />
            Add historical
          </Button>
        </div>
      </div>

      {medication.notes && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
          {medication.notes}
        </p>
      )}

      {activeForm === "change" && (
        <DoseChangeForm
          medication={medication}
          userId={userId}
          onDone={() => setActiveForm(null)}
        />
      )}

      {activeForm === "historical" && (
        <AddHistoricalDoseForm
          medication={medication}
          userId={userId}
          onDone={() => setActiveForm(null)}
        />
      )}

      {sortedHistory.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHistory ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            {sortedHistory.length} dose record
            {sortedHistory.length !== 1 ? "s" : ""}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {sortedHistory.map((entry, i) => (
                <div key={entry.id}>
                  <div className="flex items-baseline gap-1.5 text-sm flex-wrap">
                    <span className="font-medium text-foreground">
                      {entry.dose} {medication.unit}
                    </span>
                    {i === 0 && (
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-px">
                        current
                      </span>
                    )}
                    <span className="text-muted-foreground/50">&middot;</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(entry.changed_at)}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add medication form ──────────────────────────────────────────────────────

function AddMedicationForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("mg");
  const [frequency, setFrequency] =
    useState<(typeof FREQUENCIES)[number]>("once daily");
  const [startDate, setStartDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDose("");
    setUnit("mg");
    setFrequency("once daily");
    setStartDate(todayStr());
    setNotes("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { data: medData, error: medErr } = await supabase
      .from("medications")
      .insert({
        user_id: userId,
        name: name.trim(),
        dose: Number(dose),
        unit,
        frequency,
        start_date: startDate,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (medErr) {
      setError(medErr.message);
      setLoading(false);
      return;
    }

    const { error: histErr } = await supabase.from("dose_history").insert({
      medication_id: medData.id,
      user_id: userId,
      dose: Number(dose),
      changed_at: startDate,
      notes: "Initial dose",
    });

    if (histErr) {
      setError(histErr.message);
      setLoading(false);
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add medication
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Add medication</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <FieldLabel>Medication name</FieldLabel>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
            placeholder="e.g. Tacrolimus"
          />
        </div>

        <div>
          <FieldLabel>Current dose</FieldLabel>
          <input
            type="number"
            required
            min="0"
            step="any"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className={field}
            placeholder="0"
          />
        </div>

        <div>
          <FieldLabel>Unit</FieldLabel>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}
            className={field}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Frequency</FieldLabel>
          <select
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as (typeof FREQUENCIES)[number])
            }
            className={field}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Start date</FieldLabel>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={field}
          />
        </div>

        <div className="sm:col-span-2">
          <FieldLabel>Notes (optional)</FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${field} resize-none`}
            rows={3}
            placeholder="Any notes about this medication…"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save medication"}
      </Button>
    </form>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function MedicationsClient({
  userId,
  initialMedications,
}: {
  userId: string;
  initialMedications: Medication[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Medications</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <AddMedicationForm userId={userId} />

        {initialMedications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No medications yet. Add one above.
          </p>
        ) : (
          <div className="space-y-4">
            {initialMedications.map((med) => (
              <MedicationCard key={med.id} medication={med} userId={userId} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
