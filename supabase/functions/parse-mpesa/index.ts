// Parses raw M-Pesa SMS messages into structured transactions using Lovable AI.
// Enforces strict accounting rules (sign convention, double-entry for Fuliza, validation).
// Returns suggested transactions WITHOUT inserting them — the client confirms first.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ParsedTxn {
  mpesa_ref: string | null;
  type: "receive" | "send" | "paybill" | "buygoods" | "withdraw" | "deposit" | "airtime" | "fee" | "reversal" | "fuliza_borrow" | "fuliza_repay" | "other";
  amount: number;       // signed: positive = inflow, negative = outflow
  counterparty: string | null;
  occurred_at: string;  // ISO 8601 with +03:00
  description: string;
  suggested_category: string;
  raw_message: string;
  confidence: number;   // 0-1
  target: "mpesa" | "fuliza";
  fuliza_outstanding?: number | null;
  notes?: string;
}

interface ParseResult {
  transactions: ParsedTxn[];
  warnings: string[];
  errors: string[];
}

const SYSTEM = `You are a strict M-Pesa SMS parser and validator for Kenyan personal finance.

NON-NEGOTIABLE ACCOUNTING RULES:
1. SIGN CONVENTION
   - Inflow (money in)  → POSITIVE amount
   - Outflow (money out) → NEGATIVE amount
   - Send / paybill / buygoods / withdrawal / airtime / fee → NEGATIVE
   - Receive / deposit / reversal-credit → POSITIVE

2. FULIZA = DEBT ACCOUNT (NOT CASH). Always use DOUBLE-ENTRY:
   - When Fuliza tops up a payment shortfall: emit BOTH
       a) the M-Pesa cash leg on target=mpesa with NEGATIVE amount (outflow on cash) — but ONLY if the SMS itself is the underlying purchase. If the SMS is the standalone Fuliza notification, do NOT invent the underlying purchase; the user imports it from its own SMS.
       b) the Fuliza debt leg on target=fuliza with NEGATIVE amount (debt grows). type=fuliza_borrow.
       c) any access fee as a SEPARATE row: target=fuliza, type=fee, NEGATIVE amount, suggested_category="Fees & Charges", description="Fuliza access fee".
   - When an inflow auto-repays Fuliza (SMS says "X has been used to fully/partially pay your outstanding Fuliza"): emit BOTH
       a) the receive on target=mpesa, POSITIVE amount.
       b) a fuliza_repay on target=fuliza, POSITIVE amount equal to the portion applied (debt shrinks).
   - NEVER emit only one side of a Fuliza event. If the SMS is ambiguous about the cash leg, add a warning rather than inventing.

3. FEES are ALWAYS SEPARATE rows with suggested_category="Fees & Charges" and NEGATIVE amount. Do not bundle a fee into the principal transaction.

EXTRACTION REQUIREMENTS (per row):
- mpesa_ref: M-Pesa confirmation code (e.g. "QGH7X8K9LM"). REQUIRED — if missing, omit the row and add an error.
- occurred_at: ISO 8601 with +03:00 (Africa/Nairobi). If date is ambiguous (no year, unparseable), omit the row and add an error "Ambiguous date: <snippet>".
- type: one of receive|send|paybill|buygoods|withdraw|deposit|airtime|fee|reversal|fuliza_borrow|fuliza_repay|other. If unknowable, omit and add an error.
- amount: signed number, never zero. If missing, omit and add an error.
- counterparty: other party name; null if not applicable. If unclear, set null and add a warning.
- target: "mpesa" or "fuliza" per rules above.
- fuliza_outstanding: capture the "Total Fuliza M-PESA outstanding amount" if explicitly present (positive number); else null.
- suggested_category: pick the BEST fit from the user-supplied category list. Use "Other" if unsure. Specific mappings:
    supermarket/shop/food → "Food & Groceries" (or closest available)
    uber/bolt/boda/matatu/fare → "Transport"
    paybill utility (KPLC, water, internet, DSTV) → "Utilities" or "Bills"
    salary/payroll/received from employer → "Income"/"Salary"
    fuliza fee / access fee / transaction cost → "Fees & Charges"
    airtime/data bundle → "Airtime & Data"
- confidence: 0–1. Clear structured SMS >0.9; partial 0.6–0.8; guessing <0.5.
- raw_message: EXACT original SMS text for that row (repeat for split rows).
- notes: short string explaining ambiguity, when relevant.

WARNING CONDITIONS (push string to "warnings"):
- Fuliza implied but cash leg not explicit
- Counterparty unclear
- suggested_category confidence < 0.7
- Same mpesa_ref appears more than once across the input (possible duplicate SMS pasted twice)

ERROR CONDITIONS (push string to "errors", row OMITTED):
- Amount missing or zero
- mpesa_ref missing
- Date invalid/ambiguous
- Transaction type unknown

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
                      type: { type: "string", enum: ["receive","send","paybill","buygoods","withdraw","deposit","airtime","fee","reversal","fuliza_borrow","fuliza_repay","other"] },
                      amount: { type: "number" },
                      counterparty: { type: ["string", "null"] },
                      occurred_at: { type: "string" },
                      description: { type: "string" },
                      suggested_category: { type: "string" },
                      raw_message: { type: "string" },
                      confidence: { type: "number" },
                      target: { type: "string", enum: ["mpesa","fuliza"] },
                      fuliza_outstanding: { type: ["number", "null"] },
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
      if (!t.amount || Number.isNaN(Number(t.amount))) { errors.push(`Row dropped: invalid amount for ${t.mpesa_ref}`); continue; }
      const d = new Date(t.occurred_at);
      if (Number.isNaN(d.getTime())) { errors.push(`Row dropped: invalid date for ${t.mpesa_ref}`); continue; }
      // Sign-convention guard: outflow types must be negative; inflow types positive.
      const outflow = ["send","paybill","buygoods","withdraw","airtime","fee","fuliza_borrow"];
      const inflow = ["receive","deposit","fuliza_repay"];
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
