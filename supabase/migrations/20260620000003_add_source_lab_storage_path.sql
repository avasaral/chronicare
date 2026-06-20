-- Add source_lab (lab/hospital name extracted from PDF) and storage_path
-- (Supabase Storage path for re-extraction) to lab_results.
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS source_lab text;
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS storage_path text;
