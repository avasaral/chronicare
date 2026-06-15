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
- Daily Tracker (rename from Symptoms) with food, sleep, bowel, skills
- Medication adherence daily checkbox
- Lab trend chart across multiple reports
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
