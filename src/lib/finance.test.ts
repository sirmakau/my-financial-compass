import { describe, expect, it } from "vitest";
import { calculateFinancialTotals, calculateMpesaAvailable, isFuliza } from "@/lib/finance";

const accounts = [
  { name: "M-Pesa", subtype: null, type: "cash" as const, balance: -600 },
  { name: "M-Pesa Fuliza", subtype: null, type: "debt" as const, balance: -600 },
  { name: "M-Pesa Extra", subtype: null, type: "debt" as const, balance: 1600 },
  { name: "Hustler Fund", subtype: null, type: "debt" as const, balance: 0 },
  { name: "Savings", subtype: null, type: "cash" as const, balance: 5000 },
  { name: "Investment", subtype: null, type: "investment" as const, balance: 2000 },
  { name: "Receivable", subtype: null, type: "receivable" as const, balance: 500 },
];

describe("financial calculations", () => {
  it("counts every debt by absolute balance and excludes Fuliza from net worth debt", () => {
    const totals = calculateFinancialTotals(accounts);

    expect(totals.totalDebt).toBe(2200);
    expect(totals.totalCash).toBe(4400);
    expect(totals.totalInvestments).toBe(2000);
    expect(totals.totalReceivables).toBe(500);
    expect(totals.netWorth).toBe(5300);
  });

  it("identifies Fuliza by name or subtype", () => {
    expect(isFuliza(accounts[1])).toBe(true);
    expect(isFuliza({ name: "Overdraft", subtype: "Fuliza" })).toBe(true);
    expect(isFuliza(accounts[2])).toBe(false);
  });

  it("does not deduct Fuliza twice from a negative M-Pesa balance", () => {
    expect(calculateMpesaAvailable(-600, 600)).toBe(-600);
    expect(calculateMpesaAvailable(1000, 600)).toBe(400);
    expect(calculateMpesaAvailable(1000, 0)).toBe(1000);
  });
});
