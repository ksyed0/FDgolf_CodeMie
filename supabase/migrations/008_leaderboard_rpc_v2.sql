-- supabase/migrations/008_leaderboard_rpc_v2.sql
-- Update get_leaderboard() to join holes via course_id (was tournament_id)

create or replace function get_leaderboard(p_tournament_id uuid)
returns table (
  team_id uuid,
  team_number int,
  team_name text,
  total_score bigint,
  holes_completed bigint,
  par_total bigint
) language sql stable as $$
  with trn as (
    select course_id from tournaments where id = p_tournament_id
  )
  select
    t.id as team_id,
    t.team_number,
    t.team_name,
    coalesce(sum(s.strokes), 0) as total_score,
    count(distinct s.hole_number) as holes_completed,
    coalesce(sum(h.par), 0) as par_total
  from teams t
  cross join trn
  left join scores s on s.team_id = t.id
    and s.tournament_id = p_tournament_id
    and s.is_best_ball = true
  left join holes h on h.course_id = trn.course_id
    and h.hole_number = s.hole_number
  where t.tournament_id = p_tournament_id
  group by t.id, t.team_number, t.team_name
  order by (coalesce(sum(s.strokes), 0) - coalesce(sum(h.par), 0)) asc;
$$;
