create table medical_visits (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  visit_date        date        not null,
  provider_name     text        not null,
  provider_specialty text       not null check (provider_specialty in ('GI', 'Primary Care', 'Other')),
  visit_format      text        not null check (visit_format in ('in_person', 'virtual')),
  source_type       text        not null check (source_type in ('pasted_text', 'image_upload')),
  raw_image_path    text,
  extracted_text    text        not null,
  notes             text,
  created_at        timestamptz not null default now()
);

alter table medical_visits enable row level security;

create policy "Users can view own visits"
  on medical_visits for select
  using (auth.uid() = user_id);

create policy "Users can insert own visits"
  on medical_visits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own visits"
  on medical_visits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own visits"
  on medical_visits for delete
  using (auth.uid() = user_id);
