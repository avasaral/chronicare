create table medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dose numeric not null,
  unit text not null,
  frequency text not null,
  start_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table medications enable row level security;

create policy "Users can select own medications"
  on medications for select
  using (user_id = auth.uid());

create policy "Users can insert own medications"
  on medications for insert
  with check (user_id = auth.uid());

create policy "Users can update own medications"
  on medications for update
  using (user_id = auth.uid());

create policy "Users can delete own medications"
  on medications for delete
  using (user_id = auth.uid());
