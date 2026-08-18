import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeInitialBet, payDebt, raiseBet, settleBet } from "./engine";

const at = "2026-08-14T20:00:00.000Z";
describe("THE TABLE bet engine", () => {
  it("keeps an initial 10-shot bet at 10", () => assert.equal(makeInitialBet("night", 10, at).bet.currentAmount, 10));
  it("doubles the amount currently at risk", () => { const { bet } = makeInitialBet("night", 10, at); assert.equal(raiseBet(bet, 2, at).bet.currentAmount, 20); });
  it("triples the amount currently at risk", () => { const { bet } = makeInitialBet("night", 10, at); assert.equal(raiseBet(bet, 3, at).bet.currentAmount, 30); });
  it("keeps a reconstructable chain and assigns one final debt", () => {
    const initial = makeInitialBet("night", 10, at); const doubled = raiseBet(initial.bet, 2, at); const tripled = raiseBet(doubled.bet, 1.5, at);
    const final = settleBet(tripled.bet, "tommy", "juanse", "deciding-game", at);
    assert.deepEqual([initial.event.type, doubled.event.type, tripled.event.type, final.event.type], ["INITIAL", "DOUBLE_OR_NOTHING", "CUSTOM_MULTIPLIER", "SETTLED"]);
    assert.equal(final.bet.currentAmount, 30); assert.equal(final.bet.debtorPlayerId, "juanse");
  });
  it("marks a debt paid without removing it", () => {
    const debt = { id:"debt", betId:"bet", debtorPlayerId:"juanse", creditorPlayerId:"tommy", amount:30, unit:"shots" as const, status:"OPEN" as const, createdAt:at };
    const paid = payDebt(debt, at); assert.equal(paid.status, "PAID"); assert.equal(paid.id, debt.id); assert.equal(paid.amount, 30);
  });
});
