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

## Day 3 — [date]
**Shipped:**
**Broke:**
**Next:**

---

## Day 4 — [date]
**Shipped:**
**Broke:**
**Next:**

---

## Day 5 — [date]
**Shipped:**
**Broke:**
**Next:**

---

## Running backlog (things raised mid-sprint, not yet actioned)
*(Add here anything that comes up that's clearly valuable but not today's target — keeps scope discipline without losing ideas.)*

-
