import type { Bet, BetEvent, BetEventType, DebtTransaction, PlayerId } from "@/types";
import { createId } from "../id";

export function multiplierEventType(multiplier: number): BetEventType {
  if (multiplier === 2) return "DOUBLE_OR_NOTHING";
  if (multiplier === 3) return "TRIPLE_OR_NOTHING";
  return "CUSTOM_MULTIPLIER";
}

/**
 * A multiplier replaces the amount currently at stake; it never adds a second debt.
 * The player who loses the deciding game is the debtor. This deliberately leaves
 * non-deciding games as score-only events, so future house rules remain possible.
 */
export function raiseBet(bet: Bet, multiplier: number, now = new Date().toISOString()) {
  if (bet.status !== "OPEN") throw new Error("Solo se puede subir una apuesta abierta.");
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error("Usa un multiplicador válido.");
  const amountAfter = Math.round(bet.currentAmount * multiplier * 100) / 100;
  const event: BetEvent = {
    id: createId(), betId: bet.id, type: multiplierEventType(multiplier), multiplier,
    amountBefore: bet.currentAmount, amountAfter, createdAt: now,
  };
  return { bet: { ...bet, currentAmount: amountAfter }, event };
}

export function settleBet(bet: Bet, winnerId: PlayerId, loserId: PlayerId, gameId?: string, now = new Date().toISOString()) {
  if (bet.status !== "OPEN") throw new Error("Esta apuesta ya está cerrada.");
  const closedBet: Bet = {
    ...bet, status: "CLOSED", debtorPlayerId: loserId, creditorPlayerId: winnerId, settledAt: now,
  };
  const event: BetEvent = {
    id: createId(), betId: bet.id, gameId, type: "SETTLED", amountBefore: bet.currentAmount,
    amountAfter: bet.currentAmount, winnerId, loserId, createdAt: now,
  };
  return { bet: closedBet, event };
}

export function makeInitialBet(sessionId: string, amount: number, now = new Date().toISOString()) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("La mesa necesita una cantidad de shots mayor a cero.");
  const bet: Bet = { id: createId(), sessionId, status: "OPEN", initialAmount: amount, currentAmount: amount, unit: "shots", createdAt: now };
  const event: BetEvent = { id: createId(), betId: bet.id, type: "INITIAL", amountBefore: 0, amountAfter: amount, createdAt: now };
  return { bet, event };
}

/** Paying changes the ledger state, never the debt record or its bet-event history. */
export function payDebt(debt: DebtTransaction, now = new Date().toISOString()): DebtTransaction {
  if (debt.status === "PAID") return debt;
  return { ...debt, status: "PAID", paidAt: now };
}
