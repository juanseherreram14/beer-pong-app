import type { TableData } from "@/types";
import { createNight, multiplyActiveBet, recordGame } from "./repository";

export function demoData(): TableData {
  let data = createNight({ players: [{ id: "juanse", name: "Juanse" }, { id: "tommy", name: "Tommy" }], sessions: [], games: [], bets: [], betEvents: [], debtTransactions: [] }, "Shot Me", 10);
  const session = data.sessions[0];
  data = recordGame(data, session.id, "juanse");
  data = multiplyActiveBet(data, session.id, 2);
  data = recordGame(data, session.id, "tommy");
  data = multiplyActiveBet(data, session.id, 1.5);
  return recordGame(data, session.id, "tommy", true);
}
