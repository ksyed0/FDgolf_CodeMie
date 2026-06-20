-- Seed tournament (venue/course IDs seeded in migration 007)
insert into tournaments (id, name, slug, date, format, venue_id, course_id, status) values
  ('00000000-0000-0000-0000-000000000001', 'CIBC Capital Markets Golf Tournament 2026', 'cibc-granite-ridge-2026', '2026-06-22', 'best_ball', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'setup');

-- Seed clubs
insert into clubs (name, category, sort_order) values
  ('Driver (1W)', 'wood', 1),
  ('3-Wood', 'wood', 2),
  ('5-Wood', 'wood', 3),
  ('7-Wood', 'wood', 4),
  ('2 Hybrid', 'hybrid', 5),
  ('3 Hybrid', 'hybrid', 6),
  ('4 Hybrid', 'hybrid', 7),
  ('5 Hybrid', 'hybrid', 8),
  ('2 Iron', 'iron', 9),
  ('3 Iron', 'iron', 10),
  ('4 Iron', 'iron', 11),
  ('5 Iron', 'iron', 12),
  ('6 Iron', 'iron', 13),
  ('7 Iron', 'iron', 14),
  ('8 Iron', 'iron', 15),
  ('9 Iron', 'iron', 16),
  ('Pitching Wedge', 'wedge', 17),
  ('Gap Wedge', 'wedge', 18),
  ('Sand Wedge', 'wedge', 19),
  ('Lob Wedge', 'wedge', 20),
  ('Putter', 'putter', 21);

-- Seed Granite Ridge holes (approximate GPS based on course layout)
-- Course center: 43.5184° N, 79.9072° W
insert into holes (course_id, hole_number, par, handicap, pin_lat, pin_lng) values
  ('20000000-0000-0000-0000-000000000001', 1, 4, 7, 43.5191, -79.9085),
  ('20000000-0000-0000-0000-000000000001', 2, 3, 15, 43.5188, -79.9078),
  ('20000000-0000-0000-0000-000000000001', 3, 5, 1, 43.5182, -79.9071),
  ('20000000-0000-0000-0000-000000000001', 4, 4, 9, 43.5176, -79.9063),
  ('20000000-0000-0000-0000-000000000001', 5, 3, 17, 43.5170, -79.9056),
  ('20000000-0000-0000-0000-000000000001', 6, 4, 5, 43.5164, -79.9049),
  ('20000000-0000-0000-0000-000000000001', 7, 4, 3, 43.5158, -79.9042),
  ('20000000-0000-0000-0000-000000000001', 8, 5, 11, 43.5152, -79.9035),
  ('20000000-0000-0000-0000-000000000001', 9, 4, 13, 43.5146, -79.9028),
  ('20000000-0000-0000-0000-000000000001', 10, 4, 8, 43.5193, -79.9060),
  ('20000000-0000-0000-0000-000000000001', 11, 3, 16, 43.5199, -79.9053),
  ('20000000-0000-0000-0000-000000000001', 12, 5, 2, 43.5205, -79.9046),
  ('20000000-0000-0000-0000-000000000001', 13, 4, 10, 43.5211, -79.9039),
  ('20000000-0000-0000-0000-000000000001', 14, 4, 4, 43.5217, -79.9032),
  ('20000000-0000-0000-0000-000000000001', 15, 3, 18, 43.5223, -79.9025),
  ('20000000-0000-0000-0000-000000000001', 16, 4, 6, 43.5229, -79.9018),
  ('20000000-0000-0000-0000-000000000001', 17, 5, 12, 43.5235, -79.9011),
  ('20000000-0000-0000-0000-000000000001', 18, 4, 14, 43.5241, -79.9004);

-- Seed Blue tee boxes for all 18 holes (enables TV longest-drive panel)
-- Tee GPS is approximate; uses pin coords as proxy since course layout is not surveyed.
-- distance_yards is par-based: par 3 ~160yd, par 4 ~380yd, par 5 ~520yd.
-- ON CONFLICT DO NOTHING makes this safe to re-run after supabase db reset.
insert into tee_boxes (hole_id, name, lat, lng, distance_yards)
select h.id, t.name, t.lat, t.lng, t.distance_yards
from (values
  (1,  'Blue', 43.5191, -79.9085, 380),
  (2,  'Blue', 43.5188, -79.9078, 155),
  (3,  'Blue', 43.5182, -79.9071, 520),
  (4,  'Blue', 43.5176, -79.9063, 365),
  (5,  'Blue', 43.5170, -79.9056, 170),
  (6,  'Blue', 43.5164, -79.9049, 395),
  (7,  'Blue', 43.5158, -79.9042, 375),
  (8,  'Blue', 43.5152, -79.9035, 510),
  (9,  'Blue', 43.5146, -79.9028, 355),
  (10, 'Blue', 43.5193, -79.9060, 385),
  (11, 'Blue', 43.5199, -79.9053, 160),
  (12, 'Blue', 43.5205, -79.9046, 530),
  (13, 'Blue', 43.5211, -79.9039, 370),
  (14, 'Blue', 43.5217, -79.9032, 410),
  (15, 'Blue', 43.5223, -79.9025, 175),
  (16, 'Blue', 43.5229, -79.9018, 390),
  (17, 'Blue', 43.5235, -79.9011, 515),
  (18, 'Blue', 43.5241, -79.9004, 400)
) as t(hole_number, name, lat, lng, distance_yards)
join holes h on h.hole_number = t.hole_number
           and h.course_id = '20000000-0000-0000-0000-000000000001'
on conflict (hole_id, name) do nothing;

-- Seed sponsors for the CIBC tournament (logo_url='' shows monogram tile in UI)
insert into sponsors (tournament_id, name, logo_url, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'CIBC Capital Markets', '', 1, true),
  ('00000000-0000-0000-0000-000000000001', 'Deloitte',             '', 2, true),
  ('00000000-0000-0000-0000-000000000001', 'Manulife',             '', 3, true);
