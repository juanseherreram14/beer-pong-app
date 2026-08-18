"use client";

import { createClient } from "@supabase/supabase-js";
import { makeInitialBet, payDebt, raiseBet, settleBet } from "@/lib/bets/engine";
import { createId } from "@/lib/id";
import type { DebtTransaction, Game, NightSetup, Session, TableData } from "@/types";

const KEY = "the-table-local-data-v1";
export const baseData: TableData = { players: [{ id: "juanse", name: "Juanse" }, { id: "tommy", name: "Tommy" }], sessions: [], games: [], bets: [], betEvents: [], debtTransactions: [] };
const now = () => new Date().toISOString();
const uid = createId;

function hasSupabase() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
function client() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }

export async function loadData(): Promise<TableData> {
  if (!hasSupabase()) {
    const saved = window.localStorage.getItem(KEY); return saved ? JSON.parse(saved) as TableData : baseData;
  }
  const supabase = client();
  const [players, sessions, games, bets, events, debts] = await Promise.all([
    supabase.from("players").select("*").order("name"), supabase.from("sessions").select("*").order("started_at", { ascending: false }),
    supabase.from("games").select("*").order("sequence"), supabase.from("bets").select("*").order("created_at"),
    supabase.from("bet_events").select("*").order("created_at"), supabase.from("debt_transactions").select("*").order("created_at"),
  ]);
  if ([players, sessions, games, bets, events, debts].some((r) => r.error)) throw new Error("La mesa no pudo cargar los registros.");
  return {
    players: players.data!.map((p) => ({ id: p.id, name: p.name, nickname: p.nickname })),
    sessions: sessions.data!.map((s) => ({ id: s.id, date: s.date, venue: s.venue, startedAt: s.started_at, endedAt: s.ended_at, notes: s.notes, createdAt: s.created_at, mode: s.mode, teamAPlayerIds: s.team_a_player_ids, teamBPlayerIds: s.team_b_player_ids })),
    games: games.data!.map((g) => ({ id: g.id, sessionId: g.session_id, sequence: g.sequence, winnerId: g.winner_id, loserId: g.loser_id, createdAt: g.created_at, notes: g.notes })),
    bets: bets.data!.map((b) => ({ id: b.id, sessionId: b.session_id, status: b.status, initialAmount: Number(b.initial_amount), currentAmount: Number(b.current_amount), unit: b.unit, debtorPlayerId: b.debtor_player_id, creditorPlayerId: b.creditor_player_id, createdAt: b.created_at, settledAt: b.settled_at })),
    betEvents: events.data!.map((e) => ({ id: e.id, betId: e.bet_id, gameId: e.game_id, type: e.type, multiplier: e.multiplier, amountBefore: Number(e.amount_before), amountAfter: Number(e.amount_after), winnerId: e.winner_id, loserId: e.loser_id, createdAt: e.created_at })),
    debtTransactions: debts.data!.map((d) => ({ id: d.id, betId: d.bet_id, debtorPlayerId: d.debtor_player_id, creditorPlayerId: d.creditor_player_id, amount: Number(d.amount), unit: d.unit, status: d.status, paidAt: d.paid_at, createdAt: d.created_at })),
  };
}

/**
 * UI actions are optimistic. The data set only grows or transitions state in this
 * MVP, so idempotent upserts provide a simple, retry-safe transport boundary.
 * A future offline queue can replay these same records by id.
 */
export async function saveData(data: TableData) {
  if (!hasSupabase()) { window.localStorage.setItem(KEY, JSON.stringify(data)); return data; }
  const supabase = client();
  const write = async (request: PromiseLike<{ error: unknown }>) => { if ((await request).error) throw new Error("La mesa no pudo guardar los registros."); };
  // Foreign-key order matters on a brand-new project.
  await write(supabase.from("players").upsert(data.players.map((p) => ({ id: p.id, name: p.name, nickname: p.nickname }))));
  await write(supabase.from("sessions").upsert(data.sessions.map((s) => ({ id: s.id, date: s.date, venue: s.venue, started_at: s.startedAt, ended_at: s.endedAt, notes: s.notes, created_at: s.createdAt, mode: s.mode ?? "1v1", team_a_player_ids: s.teamAPlayerIds ?? ["juanse"], team_b_player_ids: s.teamBPlayerIds ?? ["tommy"] }))));
  await write(supabase.from("games").upsert(data.games.map((g) => ({ id: g.id, session_id: g.sessionId, sequence: g.sequence, winner_id: g.winnerId, loser_id: g.loserId, notes: g.notes, created_at: g.createdAt }))));
  await write(supabase.from("bets").upsert(data.bets.map((b) => ({ id: b.id, session_id: b.sessionId, status: b.status, initial_amount: b.initialAmount, current_amount: b.currentAmount, unit: b.unit, debtor_player_id: b.debtorPlayerId, creditor_player_id: b.creditorPlayerId, created_at: b.createdAt, settled_at: b.settledAt }))));
  await write(supabase.from("bet_events").upsert(data.betEvents.map((e) => ({ id: e.id, bet_id: e.betId, game_id: e.gameId, type: e.type, multiplier: e.multiplier, amount_before: e.amountBefore, amount_after: e.amountAfter, winner_id: e.winnerId, loser_id: e.loserId, created_at: e.createdAt }))));
  await write(supabase.from("debt_transactions").upsert(data.debtTransactions.map((d) => ({ id: d.id, bet_id: d.betId, debtor_player_id: d.debtorPlayerId, creditor_player_id: d.creditorPlayerId, amount: d.amount, unit: d.unit, status: d.status, paid_at: d.paidAt, created_at: d.createdAt }))));
  return data;
}

export function createNight(data: TableData, venue: string, amount: number, setup: NightSetup) {
  const time = now(); const roster = [...setup.teamA, ...setup.teamB];
  const session: Session = { id: uid(), date: time.slice(0, 10), venue: venue.trim() || "Shot Me", startedAt: time, createdAt: time, mode: setup.mode, teamAPlayerIds: setup.teamA.map((player) => player.id), teamBPlayerIds: setup.teamB.map((player) => player.id) };
  const { bet, event } = makeInitialBet(session.id, amount, time);
  const players = [...data.players]; roster.forEach((player) => { const index = players.findIndex((existing) => existing.id === player.id); if (index >= 0) players[index] = { ...players[index], name: player.name.trim() || "Sin nombre" }; else players.push({ id: player.id, name: player.name.trim() || "Sin nombre" }); });
  return { ...data, players, sessions: [session, ...data.sessions.map((s) => s.endedAt ? s : { ...s, endedAt: time })], bets: [...data.bets, bet], betEvents: [...data.betEvents, event] };
}

export function recordGame(data: TableData, sessionId: string, winnerId: string, loserId: string, decidingBet = false) {
  const games = data.games.filter((g) => g.sessionId === sessionId); const createdAt = now();
  const game: Game = { id: uid(), sessionId, sequence: games.length + 1, winnerId, loserId, createdAt };
  let next: TableData = { ...data, games: [...data.games, game] };
  const active = next.bets.find((b) => b.sessionId === sessionId && b.status === "OPEN");
  if (decidingBet && active) {
    const settled = settleBet(active, winnerId, loserId, game.id, createdAt);
    const debt: DebtTransaction = { id: uid(), betId: active.id, debtorPlayerId: loserId, creditorPlayerId: winnerId, amount: active.currentAmount, unit: "shots", status: "OPEN", createdAt };
    next = { ...next, bets: next.bets.map((b) => b.id === active.id ? settled.bet : b), betEvents: [...next.betEvents, settled.event], debtTransactions: [...next.debtTransactions, debt] };
  }
  return next;
}

export function multiplyActiveBet(data: TableData, sessionId: string, multiplier: number) {
  const active = data.bets.find((b) => b.sessionId === sessionId && b.status === "OPEN"); if (!active) throw new Error("No hay una apuesta abierta.");
  const raised = raiseBet(active, multiplier); return { ...data, bets: data.bets.map((b) => b.id === active.id ? raised.bet : b), betEvents: [...data.betEvents, raised.event] };
}

export function markPaid(data: TableData, id: string): TableData {
  const paidAt = now();
  return {
    ...data,
    debtTransactions: data.debtTransactions.map((d): DebtTransaction => d.id === id ? payDebt(d, paidAt) : d),
    bets: data.bets.map((b) => data.debtTransactions.some((d) => d.id === id && d.betId === b.id) ? { ...b, status: "SETTLED" as const } : b),
  };
}
