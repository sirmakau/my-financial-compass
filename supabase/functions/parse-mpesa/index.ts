// Parses raw M-Pesa SMS messages into structured transactions using Lovable AI.
// Returns suggested transactions WITHOUT inserting them — the client confirms first.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ParsedTxn {
  mpesa_ref: string | null;
  type: "receive" | "send" | "paybill" | "buygoods" | "withdraw" | "deposit" | "airtime" | "fee" | "reversal" | "other";
  amount: number;       // signed: positive = inflow, negative = outflow
  counterparty: string | null;
  occurred_at: string;  // ISO
  description: string;
  suggested_category: string;
  raw_message: string;
  confidence: number;   // 0-1
  notes?: string;
}

const SYSTEM = `You are an expert M-Pesa SMS parser for Kenyan personal finance.
Given raw M-Pesa SMS messages, extract structured transactions.

RULES:
- One message may contain ONE transaction. Skip balance/promo/non-transactional messages by omitting them.
- "amount" must be signed: money received is POSITIVE, money sent/paid/withdrawn/charged is NEGATIVE.
- "mpesa_ref" is the M-Pesa confirmation code (e.g. "QGH7X8K9LM"). Null if absent.
- "occurred_at" must be ISO 8601 with timezone +03:00 (Africa/Nairobi). If only date+time given, assume +03:00.
- "counterparty" is the other party (sender, recipient, paybill business, till name). Null if not applicable.
- "suggested_category" must be one of the user's categories supplied in the user message. Pick the BEST fit. Use "Other" if unsure.
- "type" classifies the M-Pesa action.
- "confidence" reflects parsing certainty (0-1).
- "raw_message" must be the EXACT original SMS text for that transaction.
- Be conservative — never invent amounts or counterparties. If unclear, lower confidence and add a "notes" field explaining ambiguity.`;

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
                      type: { type: "string", enum: ["receive","send","paybill","buygoods","withdraw","deposit","airtime","fee","reversal","other"] },
                      amount: { type: "number" },
                      counterparty: { type: ["string", "null"] },
                      occurred_at: { type: "string" },
                      description: { type: "string" },
                      suggested_category: { type: "string" },
                      raw_message: { type: "string" },
                      confidence: { type: "number" },
                      notes: { type: "string" },
                    },
                    required: ["mpesa_ref","type","amount","counterparty","occurred_at","description","suggested_category","raw_message","confidence"],
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
