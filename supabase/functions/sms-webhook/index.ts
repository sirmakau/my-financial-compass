import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({
  token: z.string().min(16).max(128).optional(),
  message: z.string().min(1).max(10000).optional(),
  messages: z.array(z.string().max(2000)).max(50).optional(),
  sender: z.string().max(64).optional(),
}).refine((b) => b.message || b.messages?.length, { message: "message or messages required" });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: "invalid_input", message: "Body must be JSON" }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(400, { error: "invalid_input", details: parsed.error.flatten() });

  const token = req.headers.get("x-ledger-key") ?? parsed.data.token;
  if (!token) return json(401, { error: "unauthorized", message: "Missing key" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: key } = await admin.from("sms_webhook_keys").select("user_id").eq("token", token).maybeSingle();
  if (!key) return json(401, { error: "unauthorized", message: "Invalid key" });

  // Accept an array, or one body that may contain several SMS separated by blank lines.
  const list = (parsed.data.messages ?? parsed.data.message!.split(/\n\s*\n/))
    .map((m) => m.trim())
    .filter((m) => m.length >= 10 && /m-?pesa|fuliza|confirmed|ksh/i.test(m));
  if (list.length === 0) return json(200, { ok: true, skipped: "not_financial" });

  let inserted = 0, duplicates = 0;
  for (const body of list) {
    const { error } = await admin.from("sms_inbox").insert({ user_id: key.user_id, body, sender: parsed.data.sender ?? null });
    if (!error) inserted++;
    else if (error.code === "23505") duplicates++;
    else { console.error(error); return json(500, { error: "internal_error" }); }
  }
  return json(200, { ok: true, inserted, duplicates, duplicate: inserted === 0 && duplicates > 0 });
});
