-- Medications: add free-text detail field
alter table daily_tracker add column medication_details text;

-- Food: replace single food_notes with per-meal fields + junk detail
alter table daily_tracker drop column food_notes;
alter table daily_tracker add column breakfast          text;
alter table daily_tracker add column morning_snack      text;
alter table daily_tracker add column lunch              text;
alter table daily_tracker add column evening_snack      text;
alter table daily_tracker add column dinner             text;
alter table daily_tracker add column junk_sugar_details text;

-- Sleep: add time inputs (sleep_hours kept — auto-calculated and stored)
alter table daily_tracker add column slept_at time;
alter table daily_tracker add column woke_at  time;
