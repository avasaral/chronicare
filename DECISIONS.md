# ChroniCare — Design Decisions

## Documentation

### PRD is repo-canonical
`ChroniCare_PRD_v1.md` lives in the repo root alongside this file and CLAUDE.md (added 2026-06-20, committed manually outside of feature work). The repo copy is the source of truth — any Claude.ai project knowledge copy is downstream and should be refreshed from the repo, not the reverse. If the PRD changes, the change happens in the repo first.

## Architecture decisions

### dose_history as source of truth for current dose
Current dose is always dose_history ORDER BY changed_at DESC LIMIT 1.
medications.dose is kept in sync but dose_history drives display.
Reason: allows adding historical entries in any order without 
corrupting the current dose display.

### Initial dose auto-inserted into dose_history
When a medication is added, an initial dose_history row is created
with the starting dose and start_date.
Reason: ensures dose_history is always complete from day one.

### Inline forms not modals
Edit, add, and change forms open inline on the card.
Reason: modals break on mobile and add unnecessary complexity.

### router.refresh() after mutations
All form submits use router.refresh() to reload server data.
Reason: Next.js App Router pattern — server components re-fetch 
on refresh without full page reload.

### No edit on dose history
Dose history is a medical record — wrong entries should be 
deleted and re-added, not edited silently.
Reason: preserves integrity of the timeline. Audit trail 
to be added in V2.

## Daily Tracker schema decisions

### bm_consistency: Bristol Stool Scale (smallint 1-7)
Chose integer scale over free text.
Reason: Bristol is the clinical standard for Crohn's monitoring; 1-2=constipated, 3-4=normal, 5-7=loose. Trend-analyzable.

### exercise: text (free-form)
Chose free text over boolean+notes or enum.
Reason: "30 min walk" carries more context than a checkbox. Two columns for one thought is unnecessary complexity.

### sleep_quality: smallint 0-3 (Poor/Fair/Good/Great)
Kept consistent with the 0-3 severity scale used across GI fields.
Labels: 0=Poor, 1=Fair, 2=Good, 3=Great — not "none/mild/moderate/severe."

### sleep_hours: auto-calculated and stored (not just computed on display)
sleep_hours is derived from slept_at and woke_at but written to the DB on every save.
Reason: PRD §5.2 requires it to be queryable for the sleep trend chart. Overnight case handled: if woke_at ≤ slept_at, add 24 hrs before computing difference.

### slept_at / woke_at: time type, local timezone, no conversion
Raw time strings as entered by the user. No UTC conversion.
Reason: single-family app, everyone is in the same timezone. Timezone complexity adds no value.

### Meal fields: five separate text fields (not one food_notes blob)
breakfast, morning_snack, lunch, evening_snack, dinner.
Reason: Vidya's feedback after first use — easier to scan and fill per meal, not one undifferentiated block.

### appetite: dropped from daily_tracker
Not in the PRD field list; was in symptom_logs but didn't survive the redesign.

### medication_details: free-form text (V1)
Not cross-referenced against the medications table.
Reason: cross-reference (checkbox list of current meds) deferred to V2 — see backlog.

## UX decisions

### Confirm dialog before all deletes
Simple window.confirm() — not a custom modal.
Reason: speed of implementation, sufficient for V1.

### Side effects shown in amber on medication card
Reason: amber signals "watch for" without being alarming (red).

### One entry per day in symptom log
If today's entry exists, form switches to Update mode. Past entries are also editable inline — clicking "Edit" on a past-day row opens the full form pre-filled, saving as UPDATE WHERE id = entry.id (not INSERT). The unique constraint prevents duplicates regardless.
No audit trail for edits. This is intentional: daily_tracker is a diary-style record where corrections are expected and silently acceptable.
This is a deliberate asymmetry with dose_history, which is delete-only specifically to preserve clinical timeline integrity. See "No edit on dose history" above.
Reason: prevents duplicate entries; inline editing avoids a separate correction flow for a diary-type record.

### Daily Tracker visual design
Reference: Apple Health (soft tinted section cards, generous whitespace) + Streaks (large tap targets, functional color).
- Page background: #f2f2f7 (iOS system gray) — immediately health-app native, not generic white
- Each section is a rounded-2xl card with a distinct soft tint (blue/rose/amber/emerald/violet/sky/teal/slate)
- Section labels: 11px uppercase tracking-widest at 40% opacity — scannable at a glance while scrolling
- Segmented selectors (0-3 fields): py-3.5 buttons (≥44px tap target), muted accent per section
- YesNo: unified pill control with hairline divider, emerald=yes, rose=no — not two floating buttons
- Bristol scale: soft amber/emerald/rose selected states instead of harsh saturated colors
- All inputs use text-base (16px) — prevents iOS Safari auto-zoom on focus (critical for one-handed use)
- Header: sticky, white/80 with backdrop-blur — stays visible while scrolling long form
- Inter font: switched from Geist (which was never properly wired up). Inter chosen for crisper number/label rendering at small sizes. Wired via --font-inter CSS variable.

## Lab extraction decisions

### Category normalization at display layer (not stored)
extracted_json.category is written from Claude's response as-is — never mutated in the DB.
resolveCategory() in LabsClient maps known variants ("LFT", "Liver Function Test", "liver panel", etc.) to canonical strings at render time. Both TrendSection and CrossDateTable call the same resolveCategory() — single implementation, no drift risk.
Reason: Claude's instruction-following is imperfect; categories vary across runs. Re-extracting all rows to normalize stored values re-runs Claude at cost and risks new inconsistencies. Display-layer alias map is free and stable.

### Test name synonym map (display layer only)
testKey() maps fixed clinical equivalences before grouping: SGOT→ast, SGPT→alt, PLT→platelet count, Hb/Hgb→haemoglobin.
Stored test_name in extracted_json is never modified. resolveDisplayName() picks the canonical label (AST, ALT, etc.) for these keys.
Reason: these are fixed, well-known clinical equivalences. Hardcoded — explicitly NOT a general fuzzy-matching solution.
Open item: TC/WBC/DC variants not confirmed in DB; add to map if fragmentation is observed after re-extraction.

### Cross-date table: per-cell flag from each report's own data
Each cell uses that report's own flag field ("normal"/"low"/"high") — not a computed shared reference range.
Reason: reference ranges vary by lab, instrument, and patient age. Using each report's own flag respects the original lab's interpretation.

### Re-extraction: stored path first, time-correlation fallback
/api/reextract-lab prefers row.storage_path. For rows uploaded before migration 20260620000003 (storage_path = null), it lists bucket files and selects the one uploaded within 120 seconds before the DB row's created_at (PDF upload → Claude → DB insert sequence).
Limitation: if PDFs from deleted rows remain in storage, time-based matching may be ambiguous.

### source_lab stored top-level, extracted by Claude
Claude returns {report_date, source_lab, results} shape. source_lab (e.g. "Aster Clinical Lab") is stored in lab_results.source_lab and shown as a subtitle under each date column in the cross-date table.

## Cost decisions

### Claude Haiku for extraction
Switched from Sonnet to Haiku for lab PDF extraction.
Cost: ~$0.08 per PDF vs ~$1.08 with Sonnet.
Quality: sufficient for structured lab data extraction.

### PDFs stored in Supabase Storage (V1)
V2 plan: move to user's own Google Drive / OneDrive.
Reason for V1: simplicity. Reason for V2 change: PHI-local 
architecture — user documents stay in user's own cloud.

## Medical visits decisions

### Separate tables per visit type (medical, therapist, school) instead of one polymorphic table
Each visit type gets its own table (medical_visits first, therapist/school deferred).
Reason: different visit types will have different fields (e.g. therapist notes may need session_type, school may need teacher_name). A polymorphic table with nullable columns for each type leads to unclear constraints and messy queries. Separate tables are clearer now; the cost is a more complex JOIN for the future unified timeline view, which is acceptable since the timeline is explicitly deferred.

### visit_date and provider_name are never auto-trusted from OCR
Claude extracts best-effort suggestions for visit_date and provider_name from uploaded images, but these are always pre-filled as editable fields with a visible "extracted, please confirm" indicator. The user must review before saving.
Reason: OCR accuracy on WhatsApp screenshots and handwritten notes is unreliable for structured fields. A wrong date silently committed would corrupt the visit timeline — the one thing that must be accurate. This is the first ChroniCare feature with a human-in-the-loop OCR confirm step.

### No audit trail for visit edits (same as daily_tracker, unlike dose_history)
medical_visits follows the daily_tracker precedent: editable inline after save, no audit trail needed.
Reason: visit notes are caregiver-curated summaries, not derived clinical timeline values. Corrections are expected and silently acceptable — the user is transcribing/summarizing what a doctor said, not recording a precise medical event like a dose change. dose_history is the exception, not the rule.
Reconsidered when edit-after-save was added, given the accuracy requirement on visit_date/provider_name; decision unchanged — a typo fix is a typo fix, not a clinical event worth auditing.

### CHECK constraints on provider_specialty, visit_format, source_type
medical_visits uses SQL CHECK constraints for its enum-like fields, unlike daily_tracker which relies on UI-only enforcement.
Reason: these are small, stable fixed lists (3, 2, and 2 values respectively) that are unlikely to change. Bad data in these columns would break filtering and display logic. daily_tracker's enum-like fields (severity 0-3, Bristol 1-7) use range CHECKs but not value-list CHECKs because they're numeric scales, not categorical labels. For categorical text fields with a fixed vocabulary, DB-level enforcement prevents bad data from any future API caller.

## V2 backlog
- Mobile-first responsive UI
- Medication cross-reference in Daily Tracker: pull current meds list as checkboxes instead of free-text medication_details field. Not built in V1 — medication_details is free text for now. Future improvement: join daily_tracker.medication_details against medications table and render as pre-populated checklist.
- Provider view (read-only, user controls what's visible)
- Symptom trend chart (Recharts fix)
- Google Drive / OneDrive integration for PHI-local storage
- Edit dose history with audit trail
- Lab appointment reminders
- Timeline view across all events (unified view: visits + labs + daily tracker + dose changes)
- Therapist notes (separate table, near-identical to medical_visits — add session_type, therapist-specific fields)
- School feedback notes (separate table, near-identical to medical_visits — add teacher_name, school-specific fields)
- Visit tagging: link medical_visits to medications or lab_results (e.g. "this visit led to this dose change")
- Image support for lab uploads (JPG/PNG)
- Multi-patient support
