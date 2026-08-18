-- THE TABLE: all monetary-like values mean a number of shots, never dollars.
create extension if not exists "pgcrypto";

create table public.players (
  id text primary key,
  name text not null unique,
  nickname text,
  created_at timestamptz not null default now()
);
create table public.sessions (
  id uuid primary key default gen_random_uuid(), date date not null default current_date,
  venue text not null default 'Shot Me', started_at timestamptz not null default now(),
  ended_at timestamptz, notes text, created_at timestamptz not null default now(),
  mode text not null default '1v1' check(mode in ('1v1','2v2')),
  team_a_player_ids jsonb not null default '["juanse"]'::jsonb,
  team_b_player_ids jsonb not null default '["tommy"]'::jsonb
);
create table public.games (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.sessions(id) on delete cascade,
  sequence integer not null check(sequence > 0), winner_id text not null references public.players(id),
  loser_id text not null references public.players(id), notes text, created_at timestamptz not null default now(),
  constraint different_players check(winner_id <> loser_id), unique(session_id, sequence)
);
create type public.bet_status as enum ('OPEN','CLOSED','SETTLED','CANCELLED');
create type public.bet_event_type as enum ('INITIAL','DOUBLE_OR_NOTHING','TRIPLE_OR_NOTHING','CUSTOM_MULTIPLIER','SETTLED','CANCELLED','MANUAL_ADJUSTMENT');
create table public.bets (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.sessions(id) on delete cascade,
  status public.bet_status not null default 'OPEN', initial_amount numeric(10,2) not null check(initial_amount > 0),
  current_amount numeric(10,2) not null check(current_amount > 0), unit text not null default 'shots' check(unit = 'shots'),
  debtor_player_id text references public.players(id), creditor_player_id text references public.players(id),
  created_at timestamptz not null default now(), settled_at timestamptz,
  constraint debt_has_two_players check((debtor_player_id is null and creditor_player_id is null) or (debtor_player_id <> creditor_player_id))
);
create table public.bet_events (
  id uuid primary key default gen_random_uuid(), bet_id uuid not null references public.bets(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null, type public.bet_event_type not null,
  multiplier numeric(8,3), amount_before numeric(10,2) not null, amount_after numeric(10,2) not null,
  winner_id text references public.players(id), loser_id text references public.players(id), created_at timestamptz not null default now()
);
create type public.debt_status as enum ('OPEN','PAID');
create table public.debt_transactions (
  id uuid primary key default gen_random_uuid(), bet_id uuid not null references public.bets(id),
  debtor_player_id text not null references public.players(id), creditor_player_id text not null references public.players(id),
  amount numeric(10,2) not null check(amount > 0), unit text not null default 'shots' check(unit = 'shots'),
  status public.debt_status not null default 'OPEN', paid_at timestamptz, created_at timestamptz not null default now(),
  constraint different_debt_players check(debtor_player_id <> creditor_player_id)
);
create index games_session_sequence_idx on public.games(session_id, sequence);
create index bets_session_status_idx on public.bets(session_id, status);
create index bet_events_bet_created_idx on public.bet_events(bet_id, created_at);
create index debts_status_created_idx on public.debt_transactions(status, created_at desc);

alter table public.players enable row level security; alter table public.sessions enable row level security; alter table public.games enable row level security; alter table public.bets enable row level security; alter table public.bet_events enable row level security; alter table public.debt_transactions enable row level security;
-- MVP is intentionally private by unlisted URL. Anon access is broad: add auth before exposing it publicly.
create policy "mvp public table access" on public.players for all to anon using (true) with check (true);
create policy "mvp public table access" on public.sessions for all to anon using (true) with check (true);
create policy "mvp public table access" on public.games for all to anon using (true) with check (true);
create policy "mvp public table access" on public.bets for all to anon using (true) with check (true);
create policy "mvp public table access" on public.bet_events for all to anon using (true) with check (true);
create policy "mvp public table access" on public.debt_transactions for all to anon using (true) with check (true);
