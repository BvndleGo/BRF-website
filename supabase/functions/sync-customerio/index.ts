// BRF — sends each new free-pass claim to Customer.io.
// Triggered by a Supabase Database Webhook on INSERT into public.free_passes.
// Customer.io then sends the confirmation email from a campaign triggered by
// the `free_pass_claimed` event.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   CIO_SITE_ID, CIO_TRACK_API_KEY   from Customer.io → Workspace settings → API credentials (Track API)
//   CIO_REGION                       "eu" or "us" (this account is on EU)
//   WEBHOOK_SECRET                   any long random string; also set as the webhook's x-webhook-secret header
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

type PassRecord = {
  id: string;
  created_at: string;
  pass_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  has_bvndle_tag: boolean;
  bvndle_tag: string | null;
  source: string | null;
};

const region = (Deno.env.get("CIO_REGION") ?? "eu").toLowerCase();
const TRACK_BASE = region === "us" ? "https://track.customer.io/api/v1" : "https://track-eu.customer.io/api/v1";
const auth = "Basic " + btoa(`${Deno.env.get("CIO_SITE_ID")}:${Deno.env.get("CIO_TRACK_API_KEY")}`);

async function cio(path: string, method: string, body: unknown) {
  const res = await fetch(`${TRACK_BASE}${path}`, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Customer.io ${method} ${path} → ${res.status}: ${await res.text()}`);
}

export async function syncPass(p: PassRecord) {
  // Email is the person's identifier, so someone already in Customer.io is matched, not duplicated.
  const id = encodeURIComponent(p.email);
  await cio(`/customers/${id}`, "PUT", {
    email: p.email,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: p.phone,
    has_bvndle_tag: p.has_bvndle_tag,
    bvndle_tag: p.bvndle_tag,
    brf_pass_code: p.pass_code,
    brf_2026_free_pass: true,
    brf_signup_source: p.source,
    created_at: Math.floor(new Date(p.created_at).getTime() / 1000),
  });
  await cio(`/customers/${id}/events`, "POST", {
    name: "free_pass_claimed",
    data: {
      pass_code: p.pass_code,
      first_name: p.first_name,
      event: "Bvndle Rewards Festival 2026",
      dates: "11–12 December 2026",
      venue: "Landmark Event Centre, Lagos",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payload = await req.json().catch(() => null);

  // Two modes: a webhook INSERT payload, or {"resync": true} to retry anything not yet synced.
  let records: PassRecord[] = [];
  if (payload?.type === "INSERT" && payload?.record) {
    records = [payload.record];
  } else if (payload?.resync) {
    const { data, error } = await supabase
      .from("free_passes").select("*").is("cio_synced_at", null).order("created_at").limit(500);
    if (error) return new Response(error.message, { status: 500 });
    records = data ?? [];
  } else {
    return new Response("Ignored", { status: 200 });
  }

  const failed: string[] = [];
  for (const r of records) {
    try {
      await syncPass(r);
      await supabase.from("free_passes").update({ cio_synced_at: new Date().toISOString() }).eq("id", r.id);
    } catch (e) {
      console.error(e);
      failed.push(r.id);
    }
  }

  return Response.json({ synced: records.length - failed.length, failed }, { status: failed.length ? 207 : 200 });
});
