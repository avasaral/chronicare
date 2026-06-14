create table lab_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  source_filename text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);

alter table lab_results enable row level security;

create policy "Users can select own lab results"
  on lab_results for select
  using (user_id = auth.uid());

create policy "Users can insert own lab results"
  on lab_results for insert
  with check (user_id = auth.uid());

create policy "Users can update own lab results"
  on lab_results for update
  using (user_id = auth.uid());

create policy "Users can delete own lab results"
  on lab_results for delete
  using (user_id = auth.uid());
