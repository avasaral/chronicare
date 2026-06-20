# ChroniCare — Design Decisions

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
If today's entry exists, form switches to Update mode.
Reason: prevents duplicate entries and makes the daily 
habit clear.

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

## Cost decisions

### Claude Haiku for extraction
Switched from Sonnet to Haiku for lab PDF extraction.
Cost: ~$0.08 per PDF vs ~$1.08 with Sonnet.
Quality: sufficient for structured lab data extraction.

### PDFs stored in Supabase Storage (V1)
V2 plan: move to user's own Google Drive / OneDrive.
Reason for V1: simplicity. Reason for V2 change: PHI-local 
architecture — user documents stay in user's own cloud.

## V2 backlog
- Mobile-first responsive UI
- Lab trend chart across multiple reports
- Medication cross-reference in Daily Tracker: pull current meds list as checkboxes instead of free-text medication_details field. Not built in V1 — medication_details is free text for now. Future improvement: join daily_tracker.medication_details against medications table and render as pre-populated checklist.
- Doctor visit notes section
- Provider view (read-only, user controls what's visible)
- Symptom trend chart (Recharts fix)
- Google Drive / OneDrive integration for PHI-local storage
- Edit dose history with audit trail
- Lab appointment reminders
- Timeline view across all events
- Therapist and school feedback sections
- Image support for lab uploads (JPG/PNG)
- Multi-patient support
