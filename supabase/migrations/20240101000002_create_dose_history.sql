create table dose_history (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dose numeric not null,
  changed_at timestamptz not null default now(),
  notes text
);

alter table dose_history enable row level security;

create policy "Users can select own dose history"
  on dose_history for select
  using (user_id = auth.uid());

create policy "Users can insert own dose history"
  on dose_history for insert
  with check (user_id = auth.uid());

create policy "Users can update own dose history"
  on dose_history for update
  using (user_id = auth.uid());

create policy "Users can delete own dose history"
  on dose_history for delete
  using (user_id = auth.uid());
