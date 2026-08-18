import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeStats } from "./index";
import type { TableData } from "@/types";

describe("stats", () => it("recalculates head-to-head totals across sessions", () => {
  const data: TableData = { players: [], bets: [], betEvents: [], debtTransactions: [], sessions: [{id:"a",date:"2026-01-01",venue:"Shot Me",startedAt:"",createdAt:""},{id:"b",date:"2026-01-02",venue:"Shot Me",startedAt:"",createdAt:""}], games: [
    {id:"1",sessionId:"a",sequence:1,winnerId:"juanse",loserId:"tommy",createdAt:""},{id:"2",sessionId:"a",sequence:2,winnerId:"tommy",loserId:"juanse",createdAt:""},{id:"3",sessionId:"b",sequence:1,winnerId:"juanse",loserId:"tommy",createdAt:""}
  ]}; const stats = computeStats(data);
  assert.equal(stats.totalGames, 3); assert.equal(stats.juanseWins, 2); assert.equal(stats.juanseNights, 1);
}));
