// Parses raw M-Pesa SMS messages into structured transactions using Lovable AI.
// Returns suggested transactions WITHOUT inserting them — the client confirms first.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ParsedTxn {
  mpesa_ref: string | null;
  type: "receive" | "send" | "paybill" | "buygoods" | "withdraw" | "deposit" | "airtime" | "fee" | "reversal" | "fuliza_borrow" | "fuliza_repay" | "other";
  amount: number;       // signed: positive = inflow, negative = outflow
  counterparty: string | null;
  occurred_at: string;  // ISO
  description: string;
  suggested_category: string;
  raw_message: string;
  confidence: number;   // 0-1
  target: "mpesa" | "fuliza"; // which account this txn should land in
  fuliza_outstanding?: number | null; // total Fuliza outstanding reported in SMS, if any
  notes?: string;
}

const SYSTEM = `You are an expert M-Pesa SMS parser for Kenyan personal finance.
Given raw M-Pesa SMS messages, extract structured transactions.

RULES:
- One SMS may produce ONE OR MORE transactions. Skip balance/promo/non-transactional messages by omitting them.
- "amount" must be signed: money received is POSITIVE, money sent/paid/withdrawn/charged is NEGATIVE.
- "mpesa_ref" is the M-Pesa confirmation code (e.g. "QGH7X8K9LM"). Null if absent.
- "occurred_at" must be ISO 8601 with timezone +03:00 (Africa/Nairobi). If only date+time given, assume +03:00. If the SMS has no timestamp (e.g. Fuliza summary line), use the timestamp of the related transaction or now.
- "counterparty" is the other party (sender, recipient, paybill business, till name, "Fuliza M-PESA", etc). Null if not applicable.
- "suggested_category" must be one of the user's categories supplied in the user message. Pick the BEST fit. Use "Other" if unsure.
  - Fuliza borrow/top-up → "Loan Repayment" is wrong; use "Fees & Charges" only for the access fee. The borrow itself has no expense category — set "Transfer".
  - Fuliza repayment (auto-deducted from incoming M-Pesa) → "Transfer".
  - Airtime purchases → "Airtime & Data".
- "type" classifies the M-Pesa action. Use "fuliza_borrow" when M-Pesa tops up a shortfall via Fuliza, and "fuliza_repay" when an inflow auto-settles outstanding Fuliza.
- "target" routes the transaction to an account: "mpesa" for normal cash-account moves; "fuliza" for changes to the Fuliza debt balance (borrow increases debt → NEGATIVE amount on the fuliza account; repay decreases debt → POSITIVE amount).
- "fuliza_outstanding": if the SMS explicitly states a "Total Fuliza M-PESA outstanding amount", capture it as a positive number. Otherwise null.
- "confidence" reflects parsing certainty (0-1).
- "raw_message" must be the EXACT original SMS text for that transaction (repeat it for each split row).
- Be conservative — never invent amounts or counterparties. If unclear, lower confidence and add a "notes" field explaining ambiguity.

FULIZA SPLITTING (IMPORTANT):
A single SMS like:
"UE4R52WC46 Confirmed. Fuliza M-PESA amount is Ksh 5.00. Access Fee charged Ksh 0.05. Total Fuliza M-PESA outstanding amount is Ksh554.03 ..."
means M-Pesa borrowed Ksh 5.00 on the user's behalf to complete a payment, and charged a Ksh 0.05 access fee.
Emit TWO rows (do NOT emit the underlying purchase — that comes in its own SMS):
  1. type=fuliza_borrow, target=fuliza, amount=-5.00, suggested_category="Transfer", description="Fuliza borrow", fuliza_outstanding=554.03
  2. type=fee,           target=fuliza, amount=-0.05, suggested_category="Fees & Charges", description="Fuliza access fee", fuliza_outstanding=554.03
Both share the same mpesa_ref.

For an inflow that auto-repays Fuliza (SMS mentions "X has been used to fully/partially pay your outstanding Fuliza"):
Emit the receive on target=mpesa AND a positive fuliza_repay on target=fuliza for the amount applied.`;

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
            description: "Emit the parsed M-Pesa transactions",
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
              },
              required: ["transactions"],
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
    if (!toolCall) return json({ transactions: [] satisfies ParsedTxn[] });
    const args = JSON.parse(toolCall.function.arguments ?? "{}");
    const transactions: ParsedTxn[] = Array.isArray(args.transactions) ? args.transactions : [];

    return json({ transactions });
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
