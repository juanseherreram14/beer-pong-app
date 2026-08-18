import type { Game, PlayerId, TableData } from "@/types";

const nameOf = (id: PlayerId) => id === "juanse" ? "Juanse" : "Tommy";

function longestStreak(games: Game[], playerId: PlayerId) {
  let run = 0; let best = 0;
  for (const game of games) { run = game.winnerId === playerId ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

export function currentStreak(games: Game[]) {
  const ordered = [...games].sort((a, b) => a.sequence - b.sequence);
  const last = ordered.at(-1);
  if (!last) return null;
  let count = 0;
  for (const game of ordered.reverse()) { if (game.winnerId !== last.winnerId) break; count++; }
  return { playerId: last.winnerId, count };
}

export function computeStats(data: TableData) {
  const totalGames = data.games.length;
  const wins = (id: PlayerId) => data.games.filter((g) => g.winnerId === id).length;
  const juanseWins = wins("juanse"); const tommyWins = wins("tommy");
  const sessionWins = (id: PlayerId) => data.sessions.filter((s) => {
    const games = data.games.filter((g) => g.sessionId === s.id);
    return games.length > 0 && winsIn(games, id) > winsIn(games, id === "juanse" ? "tommy" : "juanse");
  }).length;
  const maxDebt = Math.max(0, ...data.bets.map((b) => b.currentAmount));
  const shotsPaid = data.debtTransactions.filter((d) => d.status === "PAID").reduce((sum, d) => sum + d.amount, 0);
  const multipliers = data.betEvents.filter((e) => e.multiplier && e.multiplier > 1);
  const initialTotal = data.bets.reduce((sum, b) => sum + b.initialAmount, 0);
  const escalation = data.bets.reduce((sum, b) => sum + Math.max(0, b.currentAmount - b.initialAmount), 0);
  // Transparent index: 8 pts each escalation + 1 per shot added, capped at 100.
  const badIndex = Math.min(100, multipliers.length * 8 + escalation);
  return {
    totalGames, juanseWins, tommyWins, juanseRate: totalGames ? Math.round(juanseWins / totalGames * 100) : 0,
    tommyRate: totalGames ? Math.round(tommyWins / totalGames * 100) : 0,
    juanseMaxStreak: longestStreak(data.games, "juanse"), tommyMaxStreak: longestStreak(data.games, "tommy"),
    current: currentStreak(data.games), juanseNights: sessionWins("juanse"), tommyNights: sessionWins("tommy"),
    maxDebt, maxBet: maxDebt, shotsWagered: initialTotal, shotsPaid,
    doubles: data.betEvents.filter((e) => e.type === "DOUBLE_OR_NOTHING").length,
    triples: data.betEvents.filter((e) => e.type === "TRIPLE_OR_NOTHING").length,
    badIndex, badCopy: badIndex >= 75 ? "Era completamente evitable." : badIndex >= 40 ? "Las matemáticas pidieron salir de ahí." : "Sorprendentemente moderado.",
    leader: juanseWins === tommyWins ? null : { name: nameOf(juanseWins > tommyWins ? "juanse" : "tommy"), margin: Math.abs(juanseWins - tommyWins) },
  };
}

function winsIn(games: Game[], id: PlayerId) { return games.filter((g) => g.winnerId === id).length; }
