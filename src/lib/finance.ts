export type FinancialAccount = {
  type: "cash" | "investment" | "debt" | "receivable";
  balance: number | string | null;
  name: string;
  subtype: string | null;
};

export const isFuliza = (account: Pick<FinancialAccount, "name" | "subtype">): boolean =>
  /fuliza/i.test(account.name) || /fuliza/i.test(account.subtype ?? "");

const amount = (balance: FinancialAccount["balance"]): number => Number(balance) || 0;

export const calculateFinancialTotals = (accounts: FinancialAccount[]) => {
  const totalCash = accounts
    .filter((a) => a.type === "cash")
    .reduce((sum, a) => sum + amount(a.balance), 0);
  const totalInvestments = accounts
    .filter((a) => a.type === "investment")
    .reduce((sum, a) => sum + amount(a.balance), 0);
  const totalReceivables = accounts
    .filter((a) => a.type === "receivable")
    .reduce((sum, a) => sum + amount(a.balance), 0);
  const totalDebt = accounts
    .filter((a) => a.type === "debt")
    .reduce((sum, a) => sum + Math.abs(amount(a.balance)), 0);
  const externalDebt = accounts
    .filter((a) => a.type === "debt" && !isFuliza(a))
    .reduce((sum, a) => sum + Math.abs(amount(a.balance)), 0);

  return {
    totalCash,
    totalInvestments,
    totalReceivables,
    totalDebt,
    externalDebt,
    netWorth: totalCash + totalInvestments + totalReceivables - externalDebt,
  };
};

export const calculateMpesaAvailable = (
  cash: number,
  fulizaOwed: number,
): number => (cash < 0 ? cash : cash - fulizaOwed);
