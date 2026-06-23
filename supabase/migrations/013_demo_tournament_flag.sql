-- Add is_demo flag to tournaments table.
-- When true: TV leaderboard shows restart overlay after completion.
ALTER TABLE tournaments
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
