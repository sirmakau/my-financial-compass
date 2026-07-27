// Deterministic Fuliza helpers — used by the import flow and covered by regression tests.
// These are intentionally pure (no network, no AI) so real SMS fixtures always parse the same way.

export const FULIZA_TOLERANCE = 1.0;

export interface FulizaFacts {
  /** M-Pesa confirmation code shared by the payment SMS and its Fuliza follow-up. */
  ref: string | null;
  /** "Fuliza M-PESA amount is Ksh X" — the amount borrowed to cover the payment. */
  fulizaAmount: number | null;
  /** "Access Fee charged Ksh X". */
  accessFee: number | null;
  /** "Total Fuliza M-PESA outstanding amount is Ksh Y". */
  outstanding: number | null;
  /** "your Fuliza M-PESA limit is Ksh L" / "available Fuliza M-PESA limit is Ksh A". */
  limit: number | null;
  availableLimit: number | null;
  /** Amount swept from M-Pesa to repay Fuliza ("has been used to ... pay your outstanding Fuliza"). */
  repaidAmount: number | null;
  /** True when the SMS is a standalone auto-repay notice (no new borrow). */
  isAutoRepayNotice: boolean;
}

const num = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const v = Number(s.replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
};

const match = (text: string, re: RegExp): string | undefined => re.exec(text)?.[1];

/** Extracts the Fuliza-relevant numbers from a single raw SMS. */
export function extractFulizaFacts(sms: string): FulizaFacts {
  const text = sms.replace(/\s+/g, " ").trim();

  const ref = match(text, /\b([A-Z0-9]{10})\b(?=\s+Confirmed)/) ?? null;
  const fulizaAmount = num(match(text, /Fuliza M-?PESA amount is Ksh\s?([\d,]+(?:\.\d+)?)/i));
  const accessFee = num(match(text, /Access Fee charged Ksh\s?([\d,]+(?:\.\d+)?)/i));
  const outstanding = num(
    match(text, /Total Fuliza M-?PESA outstanding amount is Ksh\s?([\d,]+(?:\.\d+)?)/i),
  );
  const limit = num(match(text, /(?:your|current) Fuliza M-?PESA limit is Ksh\s?([\d,]+(?:\.\d+)?)/i));
  const availableLimit = num(
    match(text, /available Fuliza M-?PESA limit is Ksh\s?([\d,]+(?:\.\d+)?)/i),
  );
  const repaidAmount = num(
    match(
      text,
      /Ksh\s?([\d,]+(?:\.\d+)?)\s+from your M-?PESA has been used to (?:fully |partially )?pay/i,
    ),
  );

  return {
    ref,
    fulizaAmount,
    accessFee,
    outstanding,
    limit,
    availableLimit,
    repaidAmount,
    isAutoRepayNotice: repaidAmount !== null && fulizaAmount === null,
  };
}

/** Extracts facts for every SMS in a pasted batch (blank-line separated). */
export function extractFulizaBatch(text: string): FulizaFacts[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(extractFulizaFacts);
}

/**
 * The outstanding Fuliza debt implied by an SMS, preferring the explicit total and
 * falling back to `limit - availableLimit` when only the limit line is present.
 */
export function impliedOutstanding(f: FulizaFacts): number | null {
  if (f.outstanding !== null) return f.outstanding;
  if (f.limit !== null && f.availableLimit !== null) return +(f.limit - f.availableLimit).toFixed(2);
  return null;
}

export interface FulizaReconcileInput {
  /** Current Fuliza account balance (stored NEGATIVE when in debt). Null when no account exists. */
  fulizaBalance: number | null;
  /** Signed amounts of the fuliza-target rows about to be imported (borrows negative, repays positive). */
  appliedAmounts: number[];
  /** Outstanding total reported by the latest SMS in the batch. */
  reportedOutstanding: number;
  tolerance?: number;
}

export interface FulizaReconcileResult {
  reported: number;
  computed: number;
  diff: number;
  mismatch: boolean;
  hasAccount: boolean;
}

/**
 * Compares the SMS-reported "Total Fuliza outstanding" with the outstanding our data implies.
 * Debt is stored as a negative balance; borrows are negative amounts, repayments positive.
 */
export function reconcileFuliza({
  fulizaBalance,
  appliedAmounts,
  reportedOutstanding,
  tolerance = FULIZA_TOLERANCE,
}: FulizaReconcileInput): FulizaReconcileResult {
  const hasAccount = fulizaBalance !== null && fulizaBalance !== undefined;
  const currentDebt = hasAccount ? -Number(fulizaBalance) : 0;
  const applied = appliedAmounts.reduce((s, a) => s + Number(a || 0), 0);
  const computed = Math.max(0, +(currentDebt - applied).toFixed(2));
  const diff = +(computed - reportedOutstanding).toFixed(2);
  return {
    reported: reportedOutstanding,
    computed,
    diff,
    mismatch: Math.abs(diff) > tolerance,
    hasAccount,
  };
}
