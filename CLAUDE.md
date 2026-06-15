# ChroniCare

Health tracker for families managing complex chronic conditions.
Primary user: Krishna and Vidya tracking their daughter's health (Crohn's disease, on immunosuppressants).
Currently tracking: medication dose changes, daily symptoms, lab results (blood work every 10 days).

## Stack
- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase: auth + postgres + storage (lab PDFs)
- Recharts for charts
- Claude API (claude-haiku-4-5-20251001) for lab PDF extraction
- Vercel for hosting

## Architecture
- All pages under /dashboard, /medications, /symptoms, /labs are protected by middleware
- Middleware in src/proxy.ts (Next.js 16 uses proxy not middleware)
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

### symptom_logs
id, user_id, date, energy, mood, appetite, pain_level, notes
- one entry per user per day
- if entry exists for today: show in edit/update mode

### lab_results
id, user_id, report_date, source_filename, extracted_json (jsonb), created_at
- extracted_json is array of {test_name, value, unit, reference_range, flag}
- PDFs stored in Supabase Storage bucket "lab-reports" (private)

## Key components
- src/components/SignOutButton.tsx — shared logout button used in all page headers
- src/app/medications/MedicationsClient.tsx — all medication UI including cards, forms
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
- /symptoms — daily symptom log (to be renamed Daily Tracker)
- /labs — lab PDF upload and extraction results

## Rules
- RLS on every table
- No PHI stored except in Supabase Storage (PDFs) and extracted JSON
- Deploy to Vercel after every session
- Test with real data — no mock data
