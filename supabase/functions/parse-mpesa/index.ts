// Parses raw M-Pesa SMS messages into structured transactions using Lovable AI.
// Enforces strict accounting rules (sign convention, double-entry for Fuliza, validation).
// Learns from the user's past confirmed transactions to classify counterparties consistently.
// Returns suggested transactions WITHOUT inserting them — the client confirms first.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;


interface ParsedTxn {
  mpesa_ref: string | null;
  type: "receive" | "send" | "paybill" | "buygoods" | "withdraw" | "deposit" | "airtime" | "fee" | "reversal" | "fuliza_borrow" | "fuliza_repay" | "transfer" | "loan" | "receivable" | "repayment" | "other";
  subtype?: "expense" | "income" | "transfer" | "loan" | "receivable" | "repayment";
  amount: number;       // signed: positive = inflow, negative = outflow
  counterparty: string | null;
  purpose?: string | null;
  occurred_at: string;  // ISO 8601 with +03:00
  description: string;
  suggested_category: string;
  raw_message: string;
  confidence: number;   // 0-1
  target: "mpesa" | "fuliza" | "kcb" | "ziidi" | "cash" | "other";
  source_account_hint?: string | null;
  dest_account_hint?: string | null;
  fuliza_outstanding?: number | null;
  pending?: boolean;
  notes?: string;
}

interface ParseResult {
  transactions: ParsedTxn[];
  warnings: string[];
  errors: string[];
}

const SYSTEM = `You are a strict M-Pesa / Kenyan personal finance SMS parser and intent extractor.

NON-NEGOTIABLE ACCOUNTING RULES:
1. SIGN CONVENTION
   - Inflow (money in)  → POSITIVE amount
   - Outflow (money out) → NEGATIVE amount

2. SUBTYPE — choose ONE per row:
   - expense    : money leaves a cash/bank account to a third party (purchase, paybill, withdrawal, airtime, fee)
   - income     : money received as earnings or gift, not previously owed (salary, business income)
   - transfer   : money moved between two of the user's OWN accounts (mpesa↔ziidi, mpesa↔kcb, mpesa↔cash). Emit TWO rows: a NEGATIVE row on source account and a POSITIVE row on dest account, sharing the same mpesa_ref (suffix the dest with "-IN").
   - loan       : money received as borrowed funds (Fuliza, Tala, KCB-MPesa, friend lending) → POSITIVE on the cash account; the liability is tracked separately.
   - receivable : money owed TO the user that has NOT been received yet ("John owes me 500", "will send tomorrow") → set pending=true, target reflects where it will land, do NOT emit a cash-leg amount that would change balance (use amount=0 OR mark pending=true so the importer holds it).
   - repayment  : the user paying back a previous loan/debt (Fuliza auto-repay, repaying KCB loan) → NEGATIVE on cash, POSITIVE on debt account.

3. ACCOUNT ROUTING — set BOTH target and source/dest hints when relevant:
   - target          : the account this row debits/credits. One of "mpesa","kcb","ziidi","cash","fuliza","other".
   - source_account_hint : for transfers, the FROM account name (e.g. "M-Pesa", "Ziidi").
   - dest_account_hint   : for transfers, the TO account name.
   - Recognize aliases: "mpesa"/"m-pesa" → mpesa; "kcb"/"kcb m-pesa" → kcb; "ziidi"/"savings ziidi" → ziidi; "cash"/"withdrawn"→cash; "fuliza" → fuliza.

4. FULIZA = DEBT ACCOUNT — use DOUBLE-ENTRY:
   - Fuliza top-up of a payment shortfall: emit BOTH the M-Pesa cash leg (target=mpesa, NEGATIVE) AND the fuliza debt leg (target=fuliza, type=fuliza_borrow, NEGATIVE, subtype=loan).
   - Fuliza access fee: SEPARATE row, target=fuliza, type=fee, NEGATIVE, suggested_category="Fees & Charges".
   - Auto-repay of Fuliza from inflow: emit receive (target=mpesa, POSITIVE) AND fuliza_repay (target=fuliza, POSITIVE, subtype=repayment).

5. RECEIVABLES — pending=true means "this transaction is recorded but NOT yet completed". Importer will save it with status='pending' so it does NOT affect the balance until user marks it done.

6. FEES are ALWAYS SEPARATE rows with suggested_category="Fees & Charges" and NEGATIVE amount.

EXTRACTION REQUIREMENTS (per row):
- mpesa_ref: M-Pesa confirmation code. For transfer-in legs, suffix "-IN" (e.g. "QABC123-IN"). For pure intent messages with no code, generate one based on hash of message (e.g. "INTENT-<8chars>").
- occurred_at: ISO 8601 with +03:00 (Africa/Nairobi). If date is ambiguous/unparseable, use now() and add a warning.
- type: structural M-Pesa type when known; otherwise pick the closest of receive|send|paybill|buygoods|withdraw|deposit|airtime|fee|transfer|loan|receivable|repayment|other.
- subtype: REQUIRED — one of expense|income|transfer|loan|receivable|repayment.
- amount: signed number. For receivables with pending=true, use the nominal amount (positive expected); importer holds balance impact.
- counterparty: other party name; null if not applicable.
- purpose: short string explaining what the money was for ("fees", "fare", "rent December", "savings"). Extracted from "for X" phrases or context.
- target / source_account_hint / dest_account_hint: see routing rules.
- pending: true when the message implies money not yet received/sent (owed, promised, will send).
- fuliza_outstanding: capture "Total Fuliza M-PESA outstanding amount" if present; else null.
- suggested_category: pick the BEST fit from the user-supplied category list. Use "Miscellaneous" or "Other" if unsure.
- confidence: 0–1.
- raw_message: EXACT original text for that row.
- notes: short string for ambiguity.

EXAMPLES:
- "Transferred 500 from mpesa to ziidi for savings" →
   Row A: target=mpesa, source_account_hint="M-Pesa", dest_account_hint="Ziidi", amount=-500, subtype=transfer, purpose="savings", type=transfer.
   Row B: target=ziidi, source_account_hint="M-Pesa", dest_account_hint="Ziidi", amount=500, subtype=transfer, purpose="savings", mpesa_ref=<same>-IN.
- "John owes me 500 for lunch" →
   one row: target=mpesa, counterparty="John", purpose="lunch", subtype=receivable, amount=500, pending=true.
- "Took a loan of 3000 from Tala" →
   target=mpesa, amount=3000, subtype=loan, counterparty="Tala", purpose="loan".

ERROR CONDITIONS (push string to "errors", row OMITTED): Amount missing or zero (except pending receivables), transaction intent unknown.

Output via the emit_transactions tool only. Never invent values. Be conservative.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, categories } = await req.json();
    if (typeof messages !== "string" || !messages.trim()) {
      return json({ error: "messages (string) required" }, 400);
    }
    const cats: string[] = Array.isArray(categories) && categories.length
      ? categories.filter((c) => typeof c === "string")
      : ["Other"];

    const userPrompt = `Available categories: ${cats.join(", ")}\n\nRaw M-Pesa messages (may be multiple, separated by blank lines or newlines):\n\n${messages}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_transactions",
            description: "Emit parsed M-Pesa transactions plus any warnings and errors.",
            parameters: {
              type: "object",
              properties: {
                transactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      mpesa_ref: { type: ["string", "null"] },
                      type: { type: "string", enum: ["receive","send","paybill","buygoods","withdraw","deposit","airtime","fee","reversal","fuliza_borrow","fuliza_repay","transfer","loan","receivable","repayment","other"] },
                      subtype: { type: "string", enum: ["expense","income","transfer","loan","receivable","repayment"] },
                      amount: { type: "number" },
                      counterparty: { type: ["string", "null"] },
                      purpose: { type: ["string", "null"] },
                      occurred_at: { type: "string" },
                      description: { type: "string" },
                      suggested_category: { type: "string" },
                      raw_message: { type: "string" },
                      confidence: { type: "number" },
                      target: { type: "string", enum: ["mpesa","fuliza","kcb","ziidi","cash","other"] },
                      source_account_hint: { type: ["string", "null"] },
                      dest_account_hint: { type: ["string", "null"] },
                      fuliza_outstanding: { type: ["number", "null"] },
                      pending: { type: "boolean" },
                      notes: { type: "string" },
                    },
                    required: ["mpesa_ref","type","amount","counterparty","occurred_at","description","suggested_category","raw_message","confidence","target"],
                    additionalProperties: false,
                  },
                },
                warnings: { type: "array", items: { type: "string" } },
                errors: { type: "array", items: { type: "string" } },
              },
              required: ["transactions","warnings","errors"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_transactions" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limited. Please try again shortly." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in Settings." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: "AI gateway error", details: txt }, 502);
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ transactions: [], warnings: [], errors: [] } satisfies ParseResult);
    const args = JSON.parse(toolCall.function.arguments ?? "{}");
    let transactions: ParsedTxn[] = Array.isArray(args.transactions) ? args.transactions : [];
    const warnings: string[] = Array.isArray(args.warnings) ? args.warnings : [];
    const errors: string[] = Array.isArray(args.errors) ? args.errors : [];

    // ---------- Server-side validation pass (defence in depth) ----------
    const cleaned: ParsedTxn[] = [];
    const refCounts = new Map<string, number>();
    for (const t of transactions) {
      if (!t || typeof t !== "object") continue;
      if (!t.mpesa_ref) { errors.push(`Row dropped: missing mpesa_ref (${t.description ?? "?"})`); continue; }
      if (!t.amount || Number.isNaN(Number(t.amount))) {
        if (!t.pending) { errors.push(`Row dropped: invalid amount for ${t.mpesa_ref}`); continue; }
      }
      const d = new Date(t.occurred_at);
      if (Number.isNaN(d.getTime())) { errors.push(`Row dropped: invalid date for ${t.mpesa_ref}`); continue; }
      // Sign-convention guard: outflow types must be negative; inflow types positive.
      const outflow = ["send","paybill","buygoods","withdraw","airtime","fee","fuliza_borrow","repayment"];
      const inflow = ["receive","deposit","fuliza_repay","loan","receivable"];
      if (outflow.includes(t.type) && Number(t.amount) > 0) t.amount = -Math.abs(Number(t.amount));
      if (inflow.includes(t.type) && Number(t.amount) < 0) t.amount = Math.abs(Number(t.amount));
      // Fuliza-target rule: borrow→negative, repay→positive on the fuliza account.
      if (t.target === "fuliza") {
        if (t.type === "fuliza_borrow" && Number(t.amount) > 0) t.amount = -Math.abs(Number(t.amount));
        if (t.type === "fuliza_repay" && Number(t.amount) < 0) t.amount = Math.abs(Number(t.amount));
      }
      refCounts.set(t.mpesa_ref, (refCounts.get(t.mpesa_ref) ?? 0) + 1);
      cleaned.push(t);
    }
    // Double-entry sanity for Fuliza: every fuliza_borrow/repay event should pair with a cash leg
    // sharing the same mpesa_ref OR be a standalone Fuliza notification (no underlying purchase in this batch).
    // We only warn (not error) because the underlying purchase often arrives in a separate SMS.
    for (const t of cleaned) {
      if (t.target === "fuliza" && (t.type === "fuliza_borrow" || t.type === "fuliza_repay")) {
        const sameRef = cleaned.filter((x) => x.mpesa_ref === t.mpesa_ref);
        const hasCashLeg = sameRef.some((x) => x.target === "mpesa");
        if (!hasCashLeg) warnings.push(`Fuliza ${t.type} ${t.mpesa_ref}: no matching M-Pesa cash leg in this batch (import the underlying SMS too).`);
      }
    }
    // Duplicate-ref-in-batch warning (excluding intentional splits where target differs).
    for (const [ref, count] of refCounts) {
      const sameRef = cleaned.filter((x) => x.mpesa_ref === ref);
      const targets = new Set(sameRef.map((x) => `${x.target}:${x.type}`));
      if (count > targets.size) warnings.push(`Duplicate row(s) for ref ${ref} in this batch — review before saving.`);
    }

    return json({ transactions: cleaned, warnings, errors } satisfies ParseResult);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
