-- Allow anonymous/public read access to shots.
-- Required for the TV leaderboard stats panel (fetchShotStats) which runs as
-- an unauthenticated browser client. Shot data (club, hole, GPS) is
-- tournament-display information — no sensitive personal data exposed.
CREATE POLICY "Public read shots"
  ON shots FOR SELECT
  USING (true);
