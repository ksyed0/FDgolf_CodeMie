-- Add optional course field to tournaments
-- Used when a venue has multiple courses (e.g. North Course, South Course)
alter table tournaments add column if not exists course text;
