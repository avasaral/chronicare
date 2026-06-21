# ChroniCare — Sprint Log

5-day sprint to bring V1 (Daily Tracker) + V2 (historical record/archive) to genuine daily-use functionality, building on the existing live ChroniCare codebase. See `ChroniCare_PRD_v1.md` for full scope.

Each entry: what shipped, what broke, what's next. Keep it short — 3 lines is the target, not a paragraph. The point is continuity across sessions, not documentation for its own sake.

---

## Day 0 — 2026-06-20 (Setup)
**Shipped:** Converged PRD from 3 prior attempts (ChroniCare, HealthLog, CareWeave) + latest reflection. Created ChroniCare — Build Claude Project with system prompt. Uploaded PRD, CLAUDE.md, DECISIONS.md as project knowledge.
**Broke:** N/A — planning day, no code touched.
**Next:** Day 1 — pick the first concrete build target from PRD §5 (Daily Tracker expansion) or §6.1 (lab trend chart), based on what's fastest to get Vidya using daily.

---

## Day 1 — 2026-06-20
**Shipped:** Dropped symptom_logs, created daily_tracker (GI severity 
0-3, BM frequency/Bristol scale, 5 meal slots, medication boolean+detail, 
sleep time-in/out with auto-calculated hours, school/skills notes). 
Renamed Symptoms → Daily Tracker. Visual restyle (Apple Health calm 
palette + Streaks tap-speed). Vidya tested final version — liked it. 
Committed and pushed.
**Broke:** Original migration plan (rename+copy old symptom_logs) 
scrapped — no historical data needed, started fresh. Caught a potential 
check-constraint mismatch on old data before it ran (moot once table 
was dropped instead).
**Next:** Lab trend chart (§6.1) or unified timeline (§6.5) — lab trend 
chart likely the better Day 2 target, more contained scope, reuses 
existing extraction pipeline.

---

## Day 2 — 2026-06-21
**Shipped:** Lab trend charts + cross-date table (§6.1), category-grouped 
(fixed canonical list, display-layer normalized via resolveCategory()). 
Added source_lab + storage_path to lab_results. Re-extraction tooling 
(per-row + "re-extract all") to backfill category onto existing reports. 
Test name normalization: case-insensitive + hardcoded synonym map 
(SGOT→AST, SGPT→ALT, etc.) — known clinical equivalences only, not 
general fuzzy matching. Daily Tracker: past-day entries now editable 
inline (same form, silent overwrite, no audit trail — deliberate, 
documented contrast with dose_history). PRD committed to repo as 
canonical (manual commit, untouched today).
**Broke:** /labs briefly showed no data after schema changes (rows 
extracted pre-category-field weren't backfiled cleanly — resolved via 
re-extraction). Found and fixed a real bug during end-of-day doc audit: 
CrossDateTable's category fallback wrote raw category instead of 
resolveCategory() output, the one path where table/chart could've 
silently diverged — fixed before docs were written.
**Next:** Confirm unified timeline (§6.5) is still blocked on doctor 
visit notes (§6.3) not yet existing as a data source — likely build 
§6.3 next rather than timeline directly. Parked: general fuzzy/semantic 
test-name matching (e.g. "CRP" vs "C-Reactive Protein") still unsolved, 
needs real examples if they surface.

---

## Day 3 — 2026-06-21
**Shipped:** Medical visit notes (§6.3, medical visits only — therapist/school
deliberately deferred). New `medical_visits` table + `/visits` page: two entry
modes (paste text for email follow-ups, image/PDF upload for WhatsApp/handwritten
notes via Claude Haiku OCR with mandatory human-confirm step before save — first
extract-then-review pattern in the app, contrast with labs' direct-save).
visit_date/provider_name always human-confirmed, never auto-trusted from OCR,
even though Claude pre-fills both as a suggestion. provider_specialty (GI/Primary
Care/Other) and visit_format (in_person/virtual/follow_up) as DB-level CHECK
constraints — deliberate deviation from daily_tracker's UI-only enum enforcement,
reasoning documented in DECISIONS.md. Edit-after-save added (no audit trail,
same precedent as daily_tracker). Dashboard card showing last visit. Sort order
fixed across all three lists (daily_tracker, lab_results, medical_visits) to use
each record's real-world date field, not upload/creation time — prerequisite
for §6.5 to work correctly later.
**Broke:** Initial build only accepted JPG/PNG for upload; real-world WhatsApp
notes from Dr. Lavenya arrive as PDFs (scanned handwriting), not images — 100%
of her notes, not an edge case. Fixed same-session by extending the upload path
to PDF, reusing the existing lab-extraction PDF pattern. Lab results were
sorting by upload timestamp, not report_date — would have broken historical
backfill ordering; caught and fixed same session, before backfill testing began.
**Next:** Therapist/school notes as near-identical follow-on to medical_visits
(same OCR-confirm pattern, separate table per visit-type decision). §6.5 unified
timeline now realistically unblocked — visits, follow-ups, and labs all sort
consistently by real date; still not started. Continue dogfooding with real
visit history from Dr. Lavenya, especially testing OCR accuracy on handwriting
over more samples. Three small doc-accuracy fixes applied end-of-day (missing
PDF-decision entry in DECISIONS.md, two stale wording lines in CLAUDE.md) —
worth a habit check: re-read both docs end-of-session before re-upload, not
just trust each prompt's own "update the docs" step in isolation.

---

## Day 4 — 2026-06-21
**Shipped:** Unified timeline (§6.5), scoped to labs + visits only (daily_tracker
deferred). Display-layer merge of lab_results + medical_visits, no new table —
same rationale class as resolveCategory()/testKey(). Vertical list grouped by
date, read-only inline expand (no edit/delete from this view). Built as a plain
list first per deliberate de-scope from PRD's "zoomable" wording — anticipated
value, not yet validated by Vidya, so kept the bet small. Restyled to a vertical
spine with type-coded markers (icon-based) after initial review. Unlinked from
nav — direct URL only, pending real-world test before wider exposure.
**Broke:** Nothing — no new table, no new mutation paths, lowest-risk build
of the sprint so far. 
**Next:** Decide whether /timeline earns a nav link after more real use, or
whether zoom/pan is worth building once the merge logic has proven itself.
Therapist/school notes (deferred from Day 3) still open. daily_tracker
integration into timeline still pending — explicitly out of scope this pass.

---

## Day 5 — [date]
**Shipped:**
**Broke:**
**Next:**

---

## Running backlog (things raised mid-sprint, not yet actioned)
*(Add here anything that comes up that's clearly valuable but not today's target — keeps scope discipline without losing ideas.)*

-
