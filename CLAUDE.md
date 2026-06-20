# ChroniCare

Health tracker for families managing complex chronic conditions.
Primary user: Krishna and Vidya tracking their daughter's health (Crohn's disease, on immunosuppressants).
Currently tracking: medication dose changes, daily symptoms, lab results (blood work every 10 days).

## Stack
- Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase: auth + postgres + storage (lab PDFs)
- Recharts for charts
- Claude API (claude-haiku-4-5-20251001) for lab PDF extraction
- Vercel for hosting
- Inter font (next/font/google) — wired via --font-inter CSS variable in globals.css

## Architecture
- All pages under /dashboard, /medications, /daily-tracker, /labs are protected by middleware
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

### lab_results
id, user_id, report_date, source_filename, extracted_json (jsonb), created_at
- extracted_json is array of {test_name, value, unit, reference_range, flag}
- PDFs stored in Supabase Storage bucket "lab-reports" (private)

## Key components
- src/components/SignOutButton.tsx — shared logout button used in all page headers
- src/app/medications/MedicationsClient.tsx — all medication UI including cards, forms
- src/app/daily-tracker/DailyTrackerClient.tsx — full daily tracker form; exports DailyEntry type
- src/app/api/extract-lab/route.ts — PDF upload + Claude API extraction

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
- /dashboard — summary view
- /medications — medication log with dose history
- /daily-tracker — daily tracker (GI, food, sleep, activity, medication, school, skills)
- /symptoms → redirects to /daily-tracker
- /labs — lab PDF upload and extraction results

## Rules
- RLS on every table
- No PHI stored except in Supabase Storage (PDFs) and extracted JSON
- Deploy to Vercel after every session
- Test with real data — no mock data
