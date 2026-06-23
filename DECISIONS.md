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

### All longitudinal lists sort by real-world date, not upload/creation time
daily_tracker sorts by date, lab_results by report_date, medical_visits by visit_date — all descending.
Reason: backfilling an old record should slot it in by its actual date, not jump it to the top. This consistency is also a prerequisite for the future unified timeline (§6.5) to merge records from different tables by their real-world dates.

### follow_up as a visit_format value (same table, not a separate type)
Ad-hoc follow-up communication with a provider (emailed update, phone call) is stored in medical_visits with visit_format = 'follow_up', alongside 'in_person' and 'virtual'.
Reason: follow-ups share all the same fields as visits — date, provider, notes, source type. A separate table would duplicate schema for no structural benefit. Keeping them in one table with one date field means the future unified timeline (§6.5) can pull both visits and follow-ups from a single query with no special-casing.

### Image upload accepts PDF as well as JPG/PNG
The visit-image upload path accepts PDF in addition to JPG/PNG, reusing the
same PDF-handling pattern already proven in lab extraction (extract-lab/route.ts).
Reason: real-world testing showed WhatsApp-delivered visit notes from Dr. Lavenya
arrive as PDFs containing scanned/photographed handwriting, not as raw image
files — this is the normal case for this provider, not an edge case. The OCR
prompt itself is unchanged; only the accepted file type and how it's forwarded
to Claude differs. raw_image_path stores either format under one column —
no separate source_type value was added for PDF vs. image, since conceptually
it's the same path (uploaded document → OCR → confirm).

## Timeline decisions

### Display-layer merge, no new database table
/timeline merges lab_results and medical_visits into a single chronological view at the component level. No new database table was created.
Reason: same rationale class as resolveCategory() and testKey() — the source tables already contain all the data; the timeline is a presentation concern, not a data-model concern. A denormalized timeline table would duplicate data, require sync triggers, and add mutation surface for a read-only view. The component normalizes rows from both queries into a common shape `{ date, type, id, created_at, ...type-specific }`, sorts descending by date with created_at as tiebreaker, and groups by date for rendering.

### Tie-breaking: created_at descending for same-day entries
When multiple entries share the same date, they are sorted by created_at descending (most recently added first).
Reason: deterministic ordering independent of query return order. created_at reflects when the user recorded the event, which is the most useful secondary sort for a caregiver reviewing what was logged.

### Type distinction via icon, not color
Lab cards use the FlaskConical icon and visit cards use the Stethoscope icon (same icons used on the /dashboard summary cards). No new color palette was introduced.
Reason: the existing /labs and /visits pages use identical neutral card styling (border-border bg-card). Inventing a new per-type color scheme for the timeline would diverge from established conventions. Icons are sufficient to distinguish types at a glance.

### Visit preview: first line, truncated at 120 characters
The collapsed visit card shows the first line of extracted_text, capped at 120 characters with an ellipsis.
Reason: judgment call — 120 chars fits comfortably on mobile without wrapping to more than ~2 lines, while giving enough context to identify the visit.

### Empty state wording
"No lab reports or visit notes yet." with links to /labs and /visits.
Reason: judgment call on exact wording — matches the pattern used elsewhere (e.g. dashboard "No medications added yet", "No visits logged yet").

### Labs + visits only (no daily_tracker)
This pass deliberately excludes daily_tracker entries from the timeline.
Reason: explicit scope constraint from the build request. daily_tracker integration is a follow-on.

## Daily Tracker trend chart decisions

### V1 priority — not V2 backlog
PRD §5.2 explicitly calls the Daily Tracker trend chart "core to V1" and "not optional polish." It was incorrectly filed in the V2 backlog below in an earlier session. Corrected and built as V1 scope.

### Field selection
9 chartable dimensions (of the 12 fields listed in PRD §5.1) charted across 4 sections, 7 visual panels total, with GI symptoms combined into one multi-line chart:
- **Wellbeing (3 MiniCharts):** Energy, Mood, Pain Level — each independently clinically meaningful for flare detection.
- **GI Symptoms (1 multi-line chart):** Stomach pain, bloating, nausea, loose stools, constipation — all share the same 0-3 severity scale, so they share one chart with a legend. Five separate panels would be too noisy for a quick mobile scan.
- **Bowel Movements (2 MiniCharts):** BM Frequency, BM Consistency (Bristol) — the two most important objective Crohn's metrics.
- **Sleep (1 MiniChart):** Sleep Hours — disrupted sleep correlates with active disease.

### Fields deliberately excluded
- **Sleep quality (0-3):** Too coarse for a line chart (4 values). Sleep hours captures the meaningful trend.
- **Medication taken (boolean):** Not directly chartable as a trend line. See "Medication adherence indicator" below.
- **Junk/sugar flag (boolean):** Same — binary, not a continuous trend.
- **Text fields (food, exercise, school, skills, notes):** Not numeric, not chartable.
Together with the medication adherence gap below, this accounts for all 12 PRD §5.1 fields: 9 charted, 3 correctly excluded as non-chart-shaped data (1 of which — adherence — is flagged as a real future gap, not just excluded).

### Medication adherence indicator — known gap
medication_taken is a daily boolean. A line chart is the wrong visualization; the clinically useful view is adherence-percentage-per-week (e.g. "5/7 days this week"). This is relevant per PRD §1 — adherence correlated against symptom spikes is one of the core reasons the tool exists. Deferred as a future indicator (not a MiniChart), distinct from this build.

### Rendering threshold
Each chart requires 2+ entries with non-null data for that field — same threshold as lab trends. Entire TrendSection hidden when fewer than 2 logs exist.

### Layout
Placed between the entry form and the 14-day list view. Reuses the same Recharts LineChart + ResponsiveContainer pattern as LabsClient's MiniChart/TrendSection. Category-grouped with section headers matching the form sections.

## Search decisions

### Shared component + single API route (SearchBox + /api/search)
One SearchBox client component used in every page header; one /api/search route as the single source of truth for matching logic. Same lesson as resolveCategory()/testKey() — one implementation, no copy-pasted variants across pages.

### ILIKE over full-text search
Chose case-insensitive ILIKE substring matching (via Supabase PostgREST `.or()` filters) over Postgres full-text search (tsvector/tsquery).
Reason: data volume is tiny (single family; measured 2026-06-22 via direct query: 4 lab reports, 5 daily entries, 4 visits, 3 medications). Full-text search would require a migration (generated tsvector columns + GIN indexes), trigger maintenance, and adds no value at this scale. ILIKE is sufficient and requires no schema changes.
Note: the original version of this entry (written by Claude Code at build time) cited fabricated estimates (~50/~100/~20/~5) that were never queried — corrected after Krishna checked the real counts. Conclusion is unchanged; the numbers backing it were not real until this correction.

### Lab test_name search via TypeScript-side filtering (not SQL)
Lab results' extracted_json (jsonb array) contains test_name that needs keyword matching. PostgREST doesn't support ILIKE within jsonb array elements natively. Rather than adding a Postgres function (migration), all lab_results are fetched and test_name matching is done in TypeScript.
Reason: at this data volume (4 lab reports as of 2026-06-22, see ILIKE-vs-full-text decision above), loading all rows is negligible. Avoids a migration for a presentation-layer concern. source_filename and source_lab are still matched server-side via ILIKE. Revisit if/when §6.4 historical backfill (Sprint 2) substantially increases lab_results volume — this in-memory filtering approach does not scale to hundreds of rows.

### Keyword-only scope (no date range, no fuzzy matching)
Exact substring matching only. No date-range filtering UI. Consistent with the established "hardcoded equivalences only, no general fuzzy matching" principle.

### Result linking — page-level, not record-level
Search results link to the source page (/medications, /daily-tracker, /labs, /visits) but do not deep-link or scroll to a specific record. Scroll-to-record would require query param handling + scroll logic in each page component — deferred as follow-on if needed.

## Lab draw date reminder

### next_lab_draw_date on user_settings table (not on lab_results)
A new `user_settings` table (user_id PK, one row per user) holds `next_lab_draw_date` (date, nullable). Manually set via /labs inline control, shown on /dashboard.
Reason: this is a per-user value, not tied to any specific lab_results row. No existing profile/settings table existed; creating one gives a clean extensible home. Deliberately NOT auto-computed from report_date (PRD §6.1 scope note — manual only).

### Overdue rule: date < today
If `next_lab_draw_date` is set and is before today's date, the dashboard displays it with red/overdue styling (red background, red text, "— overdue" suffix). Normal state uses standard card styling.
No reminder shown at all if no date is set (no nudge — explicitly out of scope).

## V2 backlog
- Mobile-first responsive UI
- Medication cross-reference in Daily Tracker: pull current meds list as checkboxes instead of free-text medication_details field. Not built in V1 — medication_details is free text for now. Future improvement: join daily_tracker.medication_details against medications table and render as pre-populated checklist.
- Provider view (read-only, user controls what's visible)
- Medication adherence weekly indicator (see "Medication adherence indicator — known gap" above)
- Google Drive / OneDrive integration for PHI-local storage
- Edit dose history with audit trail
- ~~Lab appointment reminders~~ — built (narrow scope: single next_lab_draw_date field on user_settings, manual-only). Generic appointments/reminders system remains V2.
- Timeline: add daily_tracker entries, dose changes; add nav link to /timeline
- Therapist notes (separate table, near-identical to medical_visits — add session_type, therapist-specific fields)
- School feedback notes (separate table, near-identical to medical_visits — add teacher_name, school-specific fields)
- Visit tagging: link medical_visits to medications or lab_results (e.g. "this visit led to this dose change")
- ~~Search across medications, daily_tracker, lab_results, medical_visits by name/symptom/date range/keyword (PRD §6.6)~~ — built (keyword substring only, no date-range filtering). Deep-link to specific records and date-range filtering remain follow-ons.
- ~~Image support for lab uploads (JPG/PNG)~~ — revised 2026-06-21: assumed a general Bangalore WhatsApp-image pattern that doesn't match this family's actual labs (PDF-only in practice). Removed as a requirement, not deferred. Re-add only if a real instance of this need appears (e.g. multi-family expansion).
- Multi-patient support

## Sprint 2 — explicitly deferred (not forgotten)

### Full history ingestion (PRD §6.4) — deferred to Sprint 2
Decision (2026-06-21): birth-to-now record backfill is split into two separate
questions that were getting bundled together — (1) what date range to ingest,
and (2) where the source PDFs physically live. (1) is a normal scope call.
(2) is a re-trigger of the §9 PHI-storage-location decision: bulk-uploading
years of archived records (already sitting in Krishna's OneDrive) into Supabase
Storage would substantially grow real PHI volume in Supabase before that
architecture question has been deliberately revisited — even if the date range
is cut to ~3 years (since the family moved to India) rather than true birth-to-now.
Rather than rush a storage-location decision under sprint pressure, §6.4 is held
out of this sprint entirely. Sprint 2 will decide between: (A) ingest via current
Supabase upload pipeline as-is, accepting the volume growth; (B) read/extract
directly from OneDrive via API, storing only extracted JSON in Postgres (pulls
the §9 migration forward, partially); (C) some other split. Definition-of-done
item §11.3 ("at least one real historical record backfilled") is correspondingly
not met this sprint — known and accepted, not an oversight.
