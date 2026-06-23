"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Upload,
  ClipboardPaste,
  Camera,
  ImageIcon,
} from "lucide-react";
import SearchBox from "@/components/SearchBox";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";
import type { MedicalVisit } from "./page";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const INPUT =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow";
const TEXTAREA = INPUT + " resize-none";
const SELECT = INPUT + " appearance-none";

const SPECIALTIES = [
  { value: "GI", label: "GI" },
  { value: "Primary Care", label: "Primary Care" },
  { value: "Other", label: "Other" },
];

const FORMATS = [
  { value: "in_person", label: "In-person" },
  { value: "virtual", label: "Virtual" },
  { value: "follow_up", label: "Follow-up" },
];

// ─── Visit Card ───────────────────────────────────────────────────────────────

function VisitCard({ visit }: { visit: MedicalVisit }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState(visit.visit_date);
  const [editProvider, setEditProvider] = useState(visit.provider_name);
  const [editSpecialty, setEditSpecialty] = useState(visit.provider_specialty);
  const [editFormat, setEditFormat] = useState(visit.visit_format);
  const [editText, setEditText] = useState(visit.extracted_text);
  const [editNotes, setEditNotes] = useState(visit.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this visit note? This cannot be undone."))
      return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("medical_visits").delete().eq("id", visit.id);
    router.refresh();
  }

  async function loadImage() {
    if (imageUrl || !visit.raw_image_path) return;
    setImageLoading(true);
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("visit-images")
      .createSignedUrl(visit.raw_image_path, 300);
    if (data?.signedUrl) setImageUrl(data.signedUrl);
    setImageLoading(false);
  }

  function startEditing() {
    setEditDate(visit.visit_date);
    setEditProvider(visit.provider_name);
    setEditSpecialty(visit.provider_specialty);
    setEditFormat(visit.visit_format);
    setEditText(visit.extracted_text);
    setEditNotes(visit.notes ?? "");
    setSaveError(null);
    setEditing(true);
    setExpanded(true);
  }

  async function handleEditSave() {
    if (!editProvider.trim()) {
      setSaveError("Provider name is required.");
      return;
    }
    if (!editText.trim()) {
      setSaveError("Visit notes text is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("medical_visits")
      .update({
        visit_date: editDate,
        provider_name: editProvider.trim(),
        provider_specialty: editSpecialty,
        visit_format: editFormat,
        extracted_text: editText.trim(),
        notes: editNotes.trim() || null,
      })
      .eq("id", visit.id);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const formatLabel =
    visit.visit_format === "in_person"
      ? "In-person"
      : visit.visit_format === "follow_up"
        ? "Follow-up"
        : "Virtual";
  const entryLabel = visit.visit_format === "follow_up" ? "Follow-up" : "Visit";

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="flex items-center px-5 py-4">
        <button
          onClick={() => {
            if (!editing) {
              setExpanded((v) => !v);
              if (!expanded && visit.raw_image_path) loadImage();
            }
          }}
          className="flex-1 flex items-center justify-between gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {entryLabel} · {visit.provider_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(visit.visit_date)} · {visit.provider_specialty} ·{" "}
              {formatLabel}
              {visit.source_type === "image_upload" && " · 📷"}
            </span>
          </div>
          {!editing &&
            (expanded ? (
              <ChevronUp className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            ))}
        </button>
        <div className="ml-4 flex items-center gap-3 shrink-0">
          {!editing && (
            <button
              onClick={startEditing}
              className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting || editing}
            className="text-xs text-destructive hover:text-destructive/80 disabled:opacity-40 transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 block mb-1.5">
              Visit notes
            </label>
            <textarea
              className={TEXTAREA}
              rows={6}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Visit date
              </label>
              <input
                type="date"
                className={INPUT}
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Provider
              </label>
              <input
                type="text"
                className={INPUT}
                value={editProvider}
                onChange={(e) => setEditProvider(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Specialty
              </label>
              <select
                className={SELECT}
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
              >
                {SPECIALTIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Format
              </label>
              <select
                className={SELECT}
                value={editFormat}
                onChange={(e) => setEditFormat(e.target.value)}
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80 block mb-1.5">
              Additional notes{" "}
              <span className="text-foreground/40 font-normal">optional</span>
            </label>
            <textarea
              className={TEXTAREA}
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleEditSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-foreground text-background py-3 text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-medium text-foreground/60 hover:bg-muted/30 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && !editing && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
          <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {visit.extracted_text}
          </div>

          {visit.notes && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-1">
                Notes
              </p>
              <p className="text-sm text-foreground">{visit.notes}</p>
            </div>
          )}

          {visit.raw_image_path && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                Original document
              </p>
              {imageLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              ) : imageUrl ? (
                visit.raw_image_path.endsWith(".pdf") ? (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-blue-500 hover:text-blue-400 hover:bg-muted/50 transition-colors"
                  >
                    <ImageIcon className="size-4" />
                    Open original PDF
                  </a>
                ) : (
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={imageUrl}
                      alt="Original visit note"
                      className="max-w-full max-h-96 rounded-lg border border-border object-contain"
                    />
                  </a>
                )
              ) : (
                <button
                  onClick={loadImage}
                  className="text-sm text-blue-500 hover:text-blue-400"
                >
                  Load original
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Visit Form ───────────────────────────────────────────────────────────

function NewVisitForm({ onSaved }: { onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceType, setSourceType] = useState<"pasted_text" | "image_upload">(
    "pasted_text"
  );

  // Form fields
  const [visitDate, setVisitDate] = useState(todayStr());
  const [providerName, setProviderName] = useState("");
  const [providerSpecialty, setProviderSpecialty] = useState("GI");
  const [visitFormat, setVisitFormat] = useState("in_person");
  const [extractedText, setExtractedText] = useState("");
  const [notes, setNotes] = useState("");
  const [rawImagePath, setRawImagePath] = useState<string | null>(null);

  // OCR state
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);
  const [prefilled, setPrefilled] = useState<{
    visit_date: boolean;
    provider_name: boolean;
    extracted_text: boolean;
  }>({ visit_date: false, provider_name: false, extracted_text: false });

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function resetForm() {
    setVisitDate(todayStr());
    setProviderName("");
    setProviderSpecialty("GI");
    setVisitFormat("in_person");
    setExtractedText("");
    setNotes("");
    setRawImagePath(null);
    setOcrDone(false);
    setPrefilled({
      visit_date: false,
      provider_name: false,
      extracted_text: false,
    });
    setExtractError(null);
    setSaveError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleImageUpload(file: File) {
    setExtractError(null);
    setExtracting(true);
    setOcrDone(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-visit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error ?? "Extraction failed.");
        return;
      }

      setRawImagePath(data.raw_image_path);

      const pf = { visit_date: false, provider_name: false, extracted_text: false };

      if (data.extracted_text) {
        setExtractedText(data.extracted_text);
        pf.extracted_text = true;
      }
      if (data.visit_date) {
        setVisitDate(data.visit_date);
        pf.visit_date = true;
      }
      if (data.provider_name) {
        setProviderName(data.provider_name);
        pf.provider_name = true;
      }

      setPrefilled(pf);
      setOcrDone(true);
    } catch {
      setExtractError("Network error. Please try again.");
    } finally {
      setExtracting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!providerName.trim()) {
      setSaveError("Provider name is required.");
      return;
    }
    if (!extractedText.trim()) {
      setSaveError("Visit notes text is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaveError("Not authenticated.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("medical_visits").insert({
      user_id: user.id,
      visit_date: visitDate,
      provider_name: providerName.trim(),
      provider_specialty: providerSpecialty,
      visit_format: visitFormat,
      source_type: sourceType,
      raw_image_path: rawImagePath,
      extracted_text: extractedText.trim(),
      notes: notes.trim() || null,
    });

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
    onSaved();
  }

  const prefilledHint = (field: keyof typeof prefilled) =>
    prefilled[field] ? (
      <span className="text-[11px] text-amber-600 font-medium ml-2">
        extracted, please confirm
      </span>
    ) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-5">
      <h2 className="font-semibold text-foreground">Log visit</h2>

      {/* Source type toggle */}
      <div className="flex rounded-xl border border-black/10 overflow-hidden">
        <button
          onClick={() => {
            setSourceType("pasted_text");
            setOcrDone(false);
            setRawImagePath(null);
            setPrefilled({ visit_date: false, provider_name: false, extracted_text: false });
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            sourceType === "pasted_text"
              ? "bg-foreground text-background"
              : "bg-white text-foreground/60 hover:bg-muted/30"
          }`}
        >
          <ClipboardPaste className="size-4" />
          Paste text
        </button>
        <button
          onClick={() => setSourceType("image_upload")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-l border-black/10 ${
            sourceType === "image_upload"
              ? "bg-foreground text-background"
              : "bg-white text-foreground/60 hover:bg-muted/30"
          }`}
        >
          <Camera className="size-4" />
          Upload image
        </button>
      </div>

      {/* Image upload zone */}
      {sourceType === "image_upload" && !ocrDone && (
        <>
          <label
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background p-8 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 ${
              extracting ? "pointer-events-none opacity-60" : ""
            }`}
            onClick={() => !extracting && inputRef.current?.click()}
          >
            <Upload className="size-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">
              {extracting
                ? "Reading visit note…"
                : "Click to upload an image or PDF"}
            </span>
            {extracting && (
              <span className="inline-block size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </label>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
        </>
      )}

      {extractError && (
        <p className="text-sm text-destructive">{extractError}</p>
      )}

      {/* Form fields — shown always for paste mode, after OCR for image mode */}
      {(sourceType === "pasted_text" || ocrDone) && (
        <div className="space-y-4">
          {/* Visit notes text */}
          <div>
            <label className="text-sm font-medium text-foreground/80 block mb-1.5">
              Visit notes {prefilledHint("extracted_text")}
            </label>
            <textarea
              className={TEXTAREA}
              rows={6}
              placeholder="Paste visit summary, email follow-up, or doctor's notes here…"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
            />
          </div>

          {/* Date + Provider row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Visit date {prefilledHint("visit_date")}
              </label>
              <input
                type="date"
                className={INPUT}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Provider {prefilledHint("provider_name")}
              </label>
              <input
                type="text"
                className={INPUT}
                placeholder="Dr. Name"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
              />
            </div>
          </div>

          {/* Specialty + Format row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Specialty
              </label>
              <select
                className={SELECT}
                value={providerSpecialty}
                onChange={(e) => setProviderSpecialty(e.target.value)}
              >
                {SPECIALTIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 block mb-1.5">
                Format
              </label>
              <select
                className={SELECT}
                value={visitFormat}
                onChange={(e) => setVisitFormat(e.target.value)}
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-foreground/80 block mb-1.5">
              Additional notes{" "}
              <span className="text-foreground/40 font-normal">optional</span>
            </label>
            <textarea
              className={TEXTAREA}
              rows={2}
              placeholder="Your own observations, questions for next visit…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-foreground text-background py-3 text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save visit"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VisitsClient({
  userId,
  visits,
}: {
  userId: string;
  visits: MedicalVisit[];
}) {
  const router = useRouter();

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
            <h1 className="text-xl font-semibold text-foreground">
              Visit Notes
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <SearchBox />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <NewVisitForm onSaved={() => router.refresh()} />

        {visits.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground">Past visits</h2>
            {visits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
