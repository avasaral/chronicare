create table symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  energy smallint check (energy between 1 and 10),
  mood smallint check (mood between 1 and 10),
  appetite smallint check (appetite between 1 and 10),
  pain_level smallint check (pain_level between 0 and 10),
  notes text,
  created_at timestamptz not null default now()
);

alter table symptom_logs enable row level security;

create policy "Users can select own symptom logs"
  on symptom_logs for select
  using (user_id = auth.uid());

create policy "Users can insert own symptom logs"
  on symptom_logs for insert
  with check (user_id = auth.uid());

create policy "Users can update own symptom logs"
  on symptom_logs for update
  using (user_id = auth.uid());

create policy "Users can delete own symptom logs"
  on symptom_logs for delete
  using (user_id = auth.uid());
