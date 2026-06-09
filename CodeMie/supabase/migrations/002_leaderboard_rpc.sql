create or replace function get_leaderboard(t_id uuid)
returns table (
  team_id uuid,
  team_number int,
  team_name text,
  total_score bigint,
  holes_completed bigint,
  par_total bigint
) language sql stable as $$
  select
    t.id as team_id,
    t.team_number,
    t.team_name,
    coalesce(sum(s.strokes), 0) as total_score,
    count(distinct s.hole_number) as holes_completed,
    coalesce(sum(h.par), 0) as par_total
  from teams t
  left join scores s on s.team_id = t.id and s.tournament_id = t_id and s.is_best_ball = true
  left join holes h on h.tournament_id = t_id and h.hole_number = s.hole_number
  where t.tournament_id = t_id
  group by t.id, t.team_number, t.team_name
  order by (coalesce(sum(s.strokes), 0) - coalesce(sum(h.par), 0)) asc;
$$;
