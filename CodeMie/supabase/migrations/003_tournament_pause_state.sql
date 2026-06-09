-- Add 'paused' to tournament status
-- Must drop and recreate the CHECK constraint — PostgreSQL has no ALTER CONSTRAINT ADD VALUE
alter table tournaments
  drop constraint if exists tournaments_status_check;

alter table tournaments
  add constraint tournaments_status_check
    check (status in ('setup', 'active', 'paused', 'completed'));
