-- Widen visit_format to include 'follow_up' alongside 'in_person' and 'virtual'.
alter table medical_visits
  drop constraint medical_visits_visit_format_check;

alter table medical_visits
  add constraint medical_visits_visit_format_check
  check (visit_format in ('in_person', 'virtual', 'follow_up'));
