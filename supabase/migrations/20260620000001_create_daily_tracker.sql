-- Step 1: Rename symptom_logs → symptom_logs_deprecated (preserves all existing data)
alter table symptom_logs rename to symptom_logs_deprecated;

-- Step 2: Create daily_tracker with all new fields
create table daily_tracker (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  date        date        not null,
  created_at  timestamptz not null default now(),

  -- Existing fields — same type/scale as symptom_logs
  mood        smallint    check (mood between 1 and 10),
  energy      smallint    check (energy between 1 and 10),
  pain_level  smallint    check (pain_level between 0 and 10),

  -- GI symptoms (0=none, 1=mild, 2=moderate, 3=severe)
  stomach_pain  smallint  check (stomach_pain between 0 and 3),
  bloating      smallint  check (bloating between 0 and 3),
  nausea        smallint  check (nausea between 0 and 3),
  loose_stools  smallint  check (loose_stools between 0 and 3),
  constipation  smallint  check (constipation between 0 and 3),

  -- Bowel movements
  bm_frequency    smallint check (bm_frequency >= 0),
  bm_consistency  smallint check (bm_consistency between 1 and 7),
  -- Bristol Stool Scale: 1-2=hard/constipated, 3-4=normal, 5-7=soft/loose/liquid

  -- Food
  food_notes     text,
  junk_sugar_flag boolean,

  -- Activity & sleep
  exercise      text,
  sleep_hours   numeric(4,1) check (sleep_hours >= 0 and sleep_hours <= 24),
  sleep_quality smallint     check (sleep_quality between 0 and 3),

  -- Medication adherence
  medication_taken boolean,

  -- School & skills
  school_notes text,
  skills_notes text,

  -- Catch-all
  notes text,

  -- One row per user per day
  unique (user_id, date)
);

-- Step 3: Enable RLS (same pattern as symptom_logs)
alter table daily_tracker enable row level security;

create policy "Users can select own daily tracker entries"
  on daily_tracker for select
  using (user_id = auth.uid());

create policy "Users can insert own daily tracker entries"
  on daily_tracker for insert
  with check (user_id = auth.uid());

create policy "Users can update own daily tracker entries"
  on daily_tracker for update
  using (user_id = auth.uid());

create policy "Users can delete own daily tracker entries"
  on daily_tracker for delete
  using (user_id = auth.uid());

-- Step 4: Migrate existing rows — mood/energy/pain_level/notes mapped directly;
-- appetite dropped (not in new schema); all new fields left null for historical rows
insert into daily_tracker (id, user_id, date, mood, energy, pain_level, notes, created_at)
select id, user_id, date, mood, energy, pain_level, notes, created_at
from symptom_logs_deprecated;
