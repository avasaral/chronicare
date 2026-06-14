# ChroniCare

Health tracker for my daughter with complex medical needs.
Currently tracking: medication dose changes, daily symptoms, lab results (blood work every 10 days due to immunosuppressant dose change).

## Stack
- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase: auth + postgres + storage
- Recharts for charts
- Claude API (claude-sonnet-4-6) for lab PDF extraction

## Supabase tables (to be created)
- medications: id, user_id, name, dose, unit, frequency, start_date, notes, created_at
- dose_history: id, medication_id, user_id, dose, changed_at, notes
- symptom_logs: id, user_id, date, energy, mood, appetite, pain_level, notes
- lab_results: id, user_id, report_date, source_filename, extracted_json, created_at

## Rules
- RLS on every table — users see only their own rows
- No placeholder data in production — real data from day one
- Deploy to Vercel after every session
