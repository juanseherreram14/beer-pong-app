alter table public.sessions add column if not exists mode text not null default '1v1' check(mode in ('1v1','2v2'));
alter table public.sessions add column if not exists team_a_player_ids jsonb not null default '["juanse"]'::jsonb;
alter table public.sessions add column if not exists team_b_player_ids jsonb not null default '["tommy"]'::jsonb;
