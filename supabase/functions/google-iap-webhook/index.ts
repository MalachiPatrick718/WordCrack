import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, getEnv } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";
import { recomputeEntitlementForUser, verifyGooglePlaySubscription } from "../_shared/iap.ts";

function requireWebhookSecret(req: Request) {
  const secret = getEnv("GOOGLE_RTDN_WEBHOOK_SECRET");
  const got = req.headers.get("x-webhook-secret") ?? "";
  if (!secret) throw new Error("Missing GOOGLE_RTDN_WEBHOOK_SECRET");
  if (got !== secret) throw new Error("Invalid webhook secret");
}

// Google Play RTDN (Pub/Sub push) handler.
// We secure it with a shared secret header (x-webhook-secret) for simplicity.
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    requireWebhookSecret(req);

    const admin = supabaseAdmin();
    const body = (await req.json()) as any;
    const eventId = String(body?.message?.messageId ?? "");
    if (eventId) {
      const { data: existingEvent, error: evSelErr } = await admin
        .from("iap_webhook_events")
        .select("processed_at")
        .eq("provider", "google")
        .eq("event_id", eventId)
        .maybeSingle();
      if (evSelErr) throw new Error(evSelErr.message);
      if (existingEvent?.processed_at) return json({ ok: true }, { headers: corsHeaders });

      const { error: evInsErr } = await admin
        .from("iap_webhook_events")
        .upsert({ provider: "google", event_id: eventId, raw: body }, { onConflict: "provider,event_id" });
      if (evInsErr) throw new Error(evInsErr.message);
    }

    const b64 = String(body?.message?.data ?? "");
    if (!b64) return json({ error: "Missing Pub/Sub message.data" }, { status: 400, headers: corsHeaders });

    const decoded = JSON.parse(atob(b64)) as any;
    const subNotif = decoded?.subscriptionNotification ?? decoded?.oneTimeProductNotification ?? null;
    if (!subNotif) return json({ ok: true }, { headers: corsHeaders });

    const purchase_token = String(subNotif.purchaseToken ?? "");
    const product_id = String(subNotif.subscriptionId ?? subNotif.sku ?? "");
    const package_name = String(decoded?.packageName ?? decoded?.package_name ?? "");
    if (!purchase_token || !product_id || !package_name) {
      console.log("google-iap-webhook: missing identifiers", { purchase_token: !!purchase_token, product_id, package_name });
      return json({ ok: true }, { headers: corsHeaders });
    }

    const { data: prod, error: prodErr } = await admin.from("products").select("id,type").eq("id", product_id).maybeSingle();
    if (prodErr) throw new Error(prodErr.message);
    if (!prod) {
      console.log("google-iap-webhook: unknown product_id", product_id);
      return json({ ok: true }, { headers: corsHeaders });
    }

    // Map to user using existing purchase_token.
    const { data: existing, error: exErr } = await admin
      .from("purchases")
      .select("user_id")
      .eq("platform", "android")
      .eq("purchase_token", purchase_token)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing?.user_id) {
      console.log("google-iap-webhook: purchase not found for token", purchase_token);
      return json({ ok: true }, { headers: corsHeaders });
    }

    const verified = await verifyGooglePlaySubscription({
      purchase_token,
      package_name,
      product_id,
      productType: prod.type as any,
      google_service_account_json: getEnv("GOOGLE_SERVICE_ACCOUNT_JSON"),
    });

    const { error: upErr } = await admin
      .from("purchases")
      .upsert(
        {
          user_id: existing.user_id,
          platform: "android",
          product_id,
          purchase_token,
          package_name,
          order_id: verified.order_id,
          purchase_time: verified.purchase_time,
          expires_at: verified.expires_at,
          status: verified.status,
          raw: { decoded, verified: verified.raw },
        },
        { onConflict: "platform,purchase_token" },
      );
    if (upErr) throw new Error(upErr.message);

    await recomputeEntitlementForUser(admin, existing.user_id);

    if (eventId) {
      const { error: evUpdErr } = await admin
        .from("iap_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("provider", "google")
        .eq("event_id", eventId);
      if (evUpdErr) console.error("google-iap-webhook: failed to mark processed", evUpdErr);
    }
    return json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("google-iap-webhook error:", msg);
    // Return 200 so Pub/Sub doesn't retry endlessly while we debug.
    return json({ ok: false, error: msg }, { status: 200, headers: corsHeaders });
  }
});

