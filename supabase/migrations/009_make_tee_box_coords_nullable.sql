-- Tee box GPS is informational only — no scoring logic depends on it
alter table tee_boxes alter column lat drop not null;
alter table tee_boxes alter column lng drop not null;
