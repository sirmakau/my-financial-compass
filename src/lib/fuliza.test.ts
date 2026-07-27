import { describe, it, expect } from "vitest";
import {
  extractFulizaFacts,
  extractFulizaBatch,
  impliedOutstanding,
  reconcileFuliza,
  FULIZA_TOLERANCE,
} from "@/lib/fuliza";
import { fulizaFixtures, fulizaBatchText } from "@/test/fixtures/mpesaSms";

describe("Fuliza SMS parsing regression suite", () => {
  for (const fx of fulizaFixtures) {
    it(`parses: ${fx.label}`, () => {
      const f = extractFulizaFacts(fx.sms);
      expect(f.ref).toBe(fx.expect.ref);
      expect(f.fulizaAmount).toBe(fx.expect.fulizaAmount);
      expect(f.accessFee).toBe(fx.expect.accessFee);
      expect(f.outstanding).toBe(fx.expect.outstanding);
      expect(f.isAutoRepayNotice).toBe(fx.expect.isAutoRepayNotice);
      if (fx.expect.limit !== undefined) expect(f.limit).toBe(fx.expect.limit);
      if (fx.expect.availableLimit !== undefined) expect(f.availableLimit).toBe(fx.expect.availableLimit);
      if (fx.expect.repaidAmount !== undefined) expect(f.repaidAmount).toBe(fx.expect.repaidAmount);
      expect(impliedOutstanding(f)).toBe(fx.expect.implied);
    });
  }

  it("splits a pasted batch into one result per SMS", () => {
    const batch = extractFulizaBatch(fulizaBatchText);
    expect(batch).toHaveLength(fulizaFixtures.length);
    expect(batch.map((b) => b.ref)).toEqual(fulizaFixtures.map((f) => f.expect.ref));
  });

  it("never treats an access fee as the borrowed amount", () => {
    const f = extractFulizaFacts(fulizaFixtures[0].sms);
    expect(f.fulizaAmount).not.toBe(f.accessFee);
    expect(f.accessFee).toBeLessThan(f.fulizaAmount!);
  });
});

describe("Fuliza reconciliation", () => {
  it("matches when computed outstanding equals the SMS total", () => {
    // Debt currently 424.11; importing a 65 borrow + 0.65 fee (negative amounts).
    const r = reconcileFuliza({
      fulizaBalance: -423.46,
      appliedAmounts: [-65, -0.65],
      reportedOutstanding: 489.11,
    });
    expect(r.computed).toBe(489.11);
    expect(r.diff).toBe(0);
    expect(r.mismatch).toBe(false);
  });

  it("flags a mismatch beyond the tolerance", () => {
    const r = reconcileFuliza({
      fulizaBalance: -380.31,
      appliedAmounts: [],
      reportedOutstanding: 383.31,
    });
    expect(r.diff).toBe(-3);
    expect(r.mismatch).toBe(true);
  });

  it("accepts rounding drift inside the tolerance", () => {
    const r = reconcileFuliza({
      fulizaBalance: -489.61,
      appliedAmounts: [],
      reportedOutstanding: 489.11,
    });
    expect(Math.abs(r.diff)).toBeLessThanOrEqual(FULIZA_TOLERANCE);
    expect(r.mismatch).toBe(false);
  });

  it("treats repayments as reducing outstanding", () => {
    const r = reconcileFuliza({
      fulizaBalance: -483.31,
      appliedAmounts: [100],
      reportedOutstanding: 383.31,
    });
    expect(r.computed).toBe(383.31);
    expect(r.mismatch).toBe(false);
  });

  it("reports missing account and never goes negative", () => {
    const r = reconcileFuliza({
      fulizaBalance: null,
      appliedAmounts: [500],
      reportedOutstanding: 0,
    });
    expect(r.hasAccount).toBe(false);
    expect(r.computed).toBe(0);
  });

  it("reconciles the real batch against the latest SMS outstanding", () => {
    const facts = extractFulizaBatch(fulizaBatchText);
    const latest = [...facts].reverse().find((f) => impliedOutstanding(f) !== null)!;
    const r = reconcileFuliza({
      fulizaBalance: -383.31,
      appliedAmounts: [],
      reportedOutstanding: impliedOutstanding(latest)!,
    });
    expect(r.mismatch).toBe(false);
  });
});
