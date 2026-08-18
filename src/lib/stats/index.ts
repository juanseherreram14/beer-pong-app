import type { Game, PlayerId, TableData } from "@/types";

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
  const rivalryGames = data.games.filter((game) => data.sessions.find((session) => session.id === game.sessionId)?.mode !== "2v2");
  const nameOf = (id: PlayerId) => data.players.find((player) => player.id === id)?.name ?? (id === "juanse" ? "Juanse" : "Tommy");
  const totalGames = data.games.length;
  const wins = (id: PlayerId) => rivalryGames.filter((g) => g.winnerId === id).length;
  const juanseWins = wins("juanse"); const tommyWins = wins("tommy");
  const sessionWins = (id: PlayerId) => data.sessions.filter((s) => {
    const games = data.games.filter((g) => g.sessionId === s.id && s.mode !== "2v2");
    return games.length > 0 && winsIn(games, id) > winsIn(games, id === "juanse" ? "tommy" : "juanse");
  }).length;
  const maxDebt = Math.max(0, ...data.bets.map((b) => b.currentAmount));
  const biggestBet = [...data.bets].sort((a, b) => b.currentAmount - a.currentAmount)[0];
  const betProgression = biggestBet
    ? data.betEvents.filter((event) => event.betId === biggestBet.id && event.type !== "SETTLED").map((event) => event.amountAfter).filter((amount, index, values) => index === 0 || amount !== values[index - 1])
    : [];
  const shotsPaid = data.debtTransactions.filter((d) => d.status === "PAID").reduce((sum, d) => sum + d.amount, 0);
  const multipliers = data.betEvents.filter((e) => e.multiplier && e.multiplier > 1);
  const initialTotal = data.bets.reduce((sum, b) => sum + b.initialAmount, 0);
  const escalation = data.bets.reduce((sum, b) => sum + Math.max(0, b.currentAmount - b.initialAmount), 0);
  // Transparent index: 8 pts each escalation + 1 per shot added, capped at 100.
  const badIndex = Math.min(100, multipliers.length * 8 + escalation);
  return {
    totalGames, juanseWins, tommyWins, juanseName: nameOf("juanse"), tommyName: nameOf("tommy"), juanseRate: rivalryGames.length ? Math.round(juanseWins / rivalryGames.length * 100) : 0,
    tommyRate: rivalryGames.length ? Math.round(tommyWins / rivalryGames.length * 100) : 0,
    juanseMaxStreak: longestStreak(rivalryGames, "juanse"), tommyMaxStreak: longestStreak(rivalryGames, "tommy"),
    current: currentStreak(rivalryGames), juanseNights: sessionWins("juanse"), tommyNights: sessionWins("tommy"),
    maxDebt, maxBet: maxDebt, shotsWagered: initialTotal, shotsPaid,
    doubles: data.betEvents.filter((e) => e.type === "DOUBLE_OR_NOTHING").length,
    triples: data.betEvents.filter((e) => e.type === "TRIPLE_OR_NOTHING").length,
    recentRivalry: rivalryGames.slice(-8).map((game) => game.winnerId),
    betProgression,
    badIndex, badCopy: badIndex >= 75 ? "Era completamente evitable." : badIndex >= 40 ? "Las matemáticas pidieron salir de ahí." : "Sorprendentemente moderado.",
    leader: juanseWins === tommyWins ? null : { name: nameOf(juanseWins > tommyWins ? "juanse" : "tommy"), margin: Math.abs(juanseWins - tommyWins) },
  };
}

function winsIn(games: Game[], id: PlayerId) { return games.filter((g) => g.winnerId === id).length; }
