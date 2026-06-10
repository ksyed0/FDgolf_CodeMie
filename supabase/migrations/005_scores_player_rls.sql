-- Allow players to write scores for themselves and teammates.
-- Mirrors the "Players insert own/team shots" policies on the shots table.

create policy "Players insert own score" on scores
  for insert
  with check (
    player_id in (
      select id from players where auth_user_id = auth.uid()
    )
  );

create policy "Players insert team score" on scores
  for insert
  with check (
    player_id in (
      select p.id
      from players p
      join players me on me.auth_user_id = auth.uid()
      where p.team_id = me.team_id
    )
  );

create policy "Players update team score" on scores
  for update
  using (
    player_id in (
      select p.id
      from players p
      join players me on me.auth_user_id = auth.uid()
      where p.team_id = me.team_id
    )
  );
