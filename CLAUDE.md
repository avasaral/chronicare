# ChroniCare

Health tracker for families managing complex chronic conditions.
Primary user: Krishna and Vidya tracking their daughter's health (Crohn's disease, on immunosuppressants).
Currently tracking: medication dose changes, daily symptoms, lab results (blood work every 10 days), doctor visit notes.

## Stack
- Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase: auth + postgres + storage (lab PDFs, visit images)
- Recharts for charts
- Claude API (claude-haiku-4-5-20251001) for lab PDF extraction + visit image/PDF OCR
- Vercel for hosting
- Inter font (next/font/google) — wired via --font-inter CSS variable in globals.css

## Architecture
- All pages under /dashboard, /medications, /daily-tracker, /labs, /visits are protected by middleware
- Middleware in src/middleware.ts (named middleware.ts despite Next.js 16 proxy convention — works in practice)
- Supabase clients: src/lib/supabase/client.ts (browser) and server.ts (server)
- RLS enabled on all tables — users see only their own rows

## Database tables

### medications
id, user_id, name, dose (numeric), unit, frequency, start_date, notes, side_effects, created_at

### dose_history
id, medication_id, user_id, dose (numeric), changed_at, notes
- current dose = ORDER BY changed_at DESC LIMIT 1
- initial dose inserted automatically when medication is created
- "Log dose change" inserts new row with new dose
- "Add historical" inserts past entry without changing current

### daily_tracker
id, user_id, date, created_at
- mood, energy, pain_level (smallint 1-10, UI uses 1-5 sliders)
- stomach_pain, bloating, nausea, loose_stools, constipation (smallint 0-3: none/mild/moderate/severe)
- bm_frequency (smallint, count for the day)
- bm_consistency (smallint 1-7, Bristol Stool Scale: 1-2 hard, 3-4 normal, 5-7 loose)
- breakfast, morning_snack, lunch, evening_snack, dinner (text, individual meal fields)
- junk_sugar_flag (boolean), junk_sugar_details (text, shown conditionally)
- exercise (text, free-form)
- slept_at, woke_at (time, local — no timezone); sleep_hours (numeric, auto-calculated and stored)
- sleep_quality (smallint 0-3: poor/fair/good/great)
- medication_taken (boolean), medication_details (text, free-form meds + supplements)
- school_notes (text), skills_notes (text)
- notes (text, catch-all)
- one entry per user per day (unique constraint on user_id, date)
- if entry exists for today: show in edit/update mode
- past entries are editable inline (same form, UPDATE against that date's row, no audit trail)

### lab_results
id, user_id, report_date, source_filename, extracted_json (jsonb), created_at, source_lab (text, nullable), storage_path (text, nullable)
- extracted_json is array of {test_name, value, unit, reference_range, flag, category}
- category: one of 12 canonical strings (e.g. "CBC (Complete Blood Count)", "LFT (Liver Function Test)"); normalized at display time via resolveCategory()
- source_lab: lab or hospital name extracted from the PDF by Claude
- storage_path: path in "lab-reports" bucket (e.g. "{user_id}/{uuid}.pdf") — used for re-extraction
- PDFs stored in Supabase Storage bucket "lab-reports" (private)
- Rows uploaded before storage_path tracking have storage_path = null; re-extraction falls back to time-correlation

### user_settings
user_id (PK, FK auth.users), next_lab_draw_date (date, nullable), created_at, updated_at
- One row per user (upsert pattern)
- next_lab_draw_date: manually set by user, not computed from lab_results
- Used on /dashboard to show reminder; overdue = date < today (red styling)

### medical_visits
id, user_id, visit_date (date), provider_name (text), provider_specialty (text), visit_format (text), source_type (text), raw_image_path (text, nullable), extracted_text (text), notes (text, nullable), created_at
- provider_specialty: CHECK constraint — 'GI', 'Primary Care', 'Other'
- visit_format: CHECK constraint — 'in_person', 'virtual', 'follow_up'
- source_type: CHECK constraint — 'pasted_text', 'image_upload'
- raw_image_path: path in "visit-images" bucket (e.g. "{user_id}/{uuid}.jpg" or ".pdf") — retained permanently as reference original
- extracted_text: final reviewed/edited text; pre-filled by Claude OCR for image uploads, pasted directly for text mode
- visit_date and provider_name are never auto-trusted from OCR — always shown as editable pre-filled suggestions
- Images stored in Supabase Storage bucket "visit-images" (private), same RLS pattern as "lab-reports"
- Editable inline after save (same pattern as daily_tracker past-entry editing — UPDATE by id, no audit trail, caregiver-curated content)

## Key components
- src/components/SignOutButton.tsx — shared logout button used in all page headers
- src/app/medications/MedicationsClient.tsx — all medication UI including cards, forms
- src/app/daily-tracker/DailyTrackerClient.tsx — full daily tracker form + trend charts (Recharts); exports DailyEntry type
- src/app/api/extract-lab/route.ts — PDF upload + Claude API extraction
- src/lib/lab-extraction.ts — shared extraction library: LAB_SYSTEM_PROMPT, parseDateFromFilename, parseClaudeResponse
- src/app/api/reextract-lab/route.ts — re-run Claude on a stored PDF; updates row in place (never inserts)
- src/app/labs/LabsClient.tsx — all lab UI: upload, previous results list (with Re-extract + Delete), trend charts, cross-date table
- src/app/api/user-settings/route.ts — GET/PUT for user_settings (next_lab_draw_date); upsert pattern
- src/app/api/extract-visit/route.ts — image/PDF upload + Claude API OCR for visit notes
- src/app/visits/VisitsClient.tsx — visit notes UI: two-mode form (paste text / upload image with OCR confirm step), past visits list with delete
- src/app/timeline/TimelineClient.tsx — read-only unified timeline merging labs + visits, grouped by date, inline expand

## Patterns established
- Inline forms on cards (not modals) — see DoseChangeForm, EditMedicationForm
- Confirm dialog before any delete
- After any mutation: router.refresh() to reload server data
- Auth check at top of every page — redirect to /login if no user
- shadcn/ui components for all form inputs
- No mock or placeholder data anywhere

## Pages
- / → redirects to /dashboard
- /login — email + password auth
- /dashboard — summary view; shows next lab draw date reminder if set (overdue = red styling when past)
- /medications — medication log with dose history
- /daily-tracker — daily tracker (GI, food, sleep, activity, medication, school, skills) + trend charts (wellbeing, GI multi-line, bowel movements, sleep — requires 2+ entries with data)
- /symptoms → redirects to /daily-tracker
- /labs — lab PDF upload; inline next-draw-date control (set/edit/clear); previous results with per-card Re-extract + Delete and "Re-extract all" button; trend charts (category-grouped, requires 2+ distinct report dates); cross-date table (all tests × all report dates, category-grouped)
- /visits — doctor visit notes; two-mode entry (paste text or upload image/PDF with Claude OCR); past visits list with expand/edit/delete; original images/PDFs viewable via signed URLs
- /timeline — read-only unified timeline (labs + visits merged by date), rendered as a vertical spine with type-coded markers (icon-based, not flat cards); no nav link yet, direct URL only; reads from lab_results and medical_visits (no new table)

## Rules
- RLS on every table
- No PHI stored except in Supabase Storage (PDFs) and extracted JSON
- Deploy to Vercel after every session
- Test with real data — no mock data
