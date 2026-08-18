export type PlayerId = "juanse" | "tommy" | string;

export type Player = { id: PlayerId; name: string; nickname?: string };
export type BetStatus = "OPEN" | "CLOSED" | "SETTLED" | "CANCELLED";
export type BetEventType =
  | "INITIAL"
  | "DOUBLE_OR_NOTHING"
  | "TRIPLE_OR_NOTHING"
  | "CUSTOM_MULTIPLIER"
  | "SETTLED"
  | "CANCELLED"
  | "MANUAL_ADJUSTMENT";

export type Session = {
  id: string;
  date: string;
  venue: string;
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type Game = {
  id: string;
  sessionId: string;
  sequence: number;
  winnerId: PlayerId;
  loserId: PlayerId;
  createdAt: string;
  notes?: string | null;
};

export type Bet = {
  id: string;
  sessionId: string;
  status: BetStatus;
  initialAmount: number;
  currentAmount: number;
  unit: "shots";
  debtorPlayerId?: PlayerId | null;
  creditorPlayerId?: PlayerId | null;
  createdAt: string;
  settledAt?: string | null;
};

export type BetEvent = {
  id: string;
  betId: string;
  gameId?: string | null;
  type: BetEventType;
  multiplier?: number | null;
  amountBefore: number;
  amountAfter: number;
  winnerId?: PlayerId | null;
  loserId?: PlayerId | null;
  createdAt: string;
};

export type DebtTransaction = {
  id: string;
  betId: string;
  debtorPlayerId: PlayerId;
  creditorPlayerId: PlayerId;
  amount: number;
  unit: "shots";
  status: "OPEN" | "PAID";
  paidAt?: string | null;
  createdAt: string;
};

export type TableData = {
  players: Player[];
  sessions: Session[];
  games: Game[];
  bets: Bet[];
  betEvents: BetEvent[];
  debtTransactions: DebtTransaction[];
};
