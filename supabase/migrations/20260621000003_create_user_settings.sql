-- User-level settings (one row per user)
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_lab_draw_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

create policy "Users can view own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update
  using (auth.uid() = user_id);
