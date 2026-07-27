// Real M-Pesa / Fuliza SMS fixtures captured from the user's phone.
// Amounts and refs are kept verbatim so parsing regressions are caught immediately.

export interface SmsFixture {
  label: string;
  sms: string;
  expect: {
    ref: string | null;
    fulizaAmount: number | null;
    accessFee: number | null;
    outstanding: number | null;
    limit?: number | null;
    availableLimit?: number | null;
    repaidAmount?: number | null;
    isAutoRepayNotice: boolean;
    /** Outstanding implied by the SMS (explicit total, or limit − available). */
    implied: number | null;
  };
}

export const fulizaFixtures: SmsFixture[] = [
  {
    label: "airtime borrow with 0.05 access fee",
    sms:
      "UE4R52WC46 Confirmed. Fuliza M-PESA amount is Ksh 5.00. Access Fee charged Ksh 0.05. " +
      "Total Fuliza M-PESA outstanding amount is Ksh554.03 due on 01/06/26. " +
      "To check daily charges, Dial *334#OK Select Query Charges",
    expect: {
      ref: "UE4R52WC46",
      fulizaAmount: 5,
      accessFee: 0.05,
      outstanding: 554.03,
      isAutoRepayNotice: false,
      implied: 554.03,
    },
  },
  {
    label: "paybill borrow follow-up notice",
    sms:
      "UFMR58LZ55 Confirmed. Fuliza M-PESA amount is Ksh 65.00. Access Fee charged Ksh 0.65. " +
      "Total Fuliza M-PESA outstanding amount is Ksh489.11 due on 01/06/26.",
    expect: {
      ref: "UFMR58LZ55",
      fulizaAmount: 65,
      accessFee: 0.65,
      outstanding: 489.11,
      isAutoRepayNotice: false,
      implied: 489.11,
    },
  },
  {
    label: "large borrow with comma-formatted outstanding",
    sms:
      "UFOR58QL37 Confirmed. Fuliza M-PESA amount is Ksh 120.00. Access Fee charged Ksh 1.20. " +
      "Total Fuliza M-PESA outstanding amount is Ksh1,203.45 due on 01/06/26.",
    expect: {
      ref: "UFOR58QL37",
      fulizaAmount: 120,
      accessFee: 1.2,
      outstanding: 1203.45,
      isAutoRepayNotice: false,
      implied: 1203.45,
    },
  },
  {
    label: "standalone partial auto-repay notice",
    sms:
      "UFOR58QF2D Confirmed. Ksh100.00 from your M-PESA has been used to partially pay your " +
      "outstanding Fuliza M-PESA. Available Fuliza M-PESA limit is Ksh216.69.",
    expect: {
      ref: "UFOR58QF2D",
      fulizaAmount: null,
      accessFee: null,
      outstanding: null,
      availableLimit: 216.69,
      repaidAmount: 100,
      isAutoRepayNotice: true,
      implied: null,
    },
  },
  {
    label: "auto-repay notice with limit + available (implies outstanding)",
    sms:
      "UFQR58YTAJ Confirmed. Ksh50.00 from your M-PESA has been used to partially pay your " +
      "outstanding Fuliza M-PESA. Your Fuliza M-PESA limit is Ksh600.00. " +
      "Available Fuliza M-PESA limit is Ksh216.69.",
    expect: {
      ref: "UFQR58YTAJ",
      fulizaAmount: null,
      accessFee: null,
      outstanding: null,
      limit: 600,
      availableLimit: 216.69,
      repaidAmount: 50,
      isAutoRepayNotice: true,
      implied: 383.31,
    },
  },
  {
    label: "plain payment SMS (no Fuliza involvement)",
    sms:
      "UFOR58QGKZ Confirmed. Ksh65.00 paid to JACKSON MWAURA. on 20/5/26 at 1:04 PM. " +
      "New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00.",
    expect: {
      ref: "UFOR58QGKZ",
      fulizaAmount: null,
      accessFee: null,
      outstanding: null,
      isAutoRepayNotice: false,
      implied: null,
    },
  },
];

/** The whole batch as a user would paste it. */
export const fulizaBatchText = fulizaFixtures.map((f) => f.sms).join("\n\n");
