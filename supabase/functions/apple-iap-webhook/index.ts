import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";
import { isUuid, recomputeEntitlementForUser, verifyAppleJws } from "../_shared/iap.ts";

function mapAppleStatus(args: { productType: "subscription" | "non_consumable"; expires_at: string | null }) {
  if (args.productType === "non_consumable") return "active" as const;
  if (!args.expires_at) return "expired" as const;
  return new Date(args.expires_at).getTime() > Date.now() ? ("active" as const) : ("expired" as const);
}

// Apple App Store Server Notifications v2 handler.
// This endpoint must be public (no user JWT); we verify via Apple's JWS signature.
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const admin = supabaseAdmin();
    const body = (await req.json()) as any;
    const signedPayload = String(body?.signedPayload ?? "");
    if (!signedPayload) return json({ error: "Missing signedPayload" }, { status: 400, headers: corsHeaders });

    const payload = await verifyAppleJws<any>(signedPayload);
    const eventId = String(payload?.notificationUUID ?? "");
    if (eventId) {
      // Idempotency: record delivery; if already processed, exit quickly.
      const { data: existingEvent, error: evSelErr } = await admin
        .from("iap_webhook_events")
        .select("processed_at")
        .eq("provider", "apple")
        .eq("event_id", eventId)
        .maybeSingle();
      if (evSelErr) throw new Error(evSelErr.message);
      if (existingEvent?.processed_at) return json({ ok: true }, { headers: corsHeaders });

      const { error: evInsErr } = await admin
        .from("iap_webhook_events")
        .upsert({ provider: "apple", event_id: eventId, raw: payload }, { onConflict: "provider,event_id" });
      if (evInsErr) throw new Error(evInsErr.message);
    }

    const notificationType = String(payload?.notificationType ?? "");
    const subtype = payload?.subtype ? String(payload.subtype) : null;

    // Pull signedTransactionInfo when present (most useful for renewals/changes)
    const signedTransactionInfo = payload?.data?.signedTransactionInfo ? String(payload.data.signedTransactionInfo) : "";
    const transaction = signedTransactionInfo ? await verifyAppleJws<any>(signedTransactionInfo) : null;

    // Best mapping to a user is appAccountToken (we set it client-side).
    const appAccountToken = String(transaction?.appAccountToken ?? "");

    const product_id = String(transaction?.productId ?? payload?.data?.productId ?? "");
    const original_transaction_id = String(transaction?.originalTransactionId ?? payload?.data?.originalTransactionId ?? "");
    const transaction_id = String(transaction?.transactionId ?? "");

    const expires_at = transaction?.expiresDate
      ? new Date(Number(transaction.expiresDate)).toISOString()
      : transaction?.expiresDateMillis
        ? new Date(Number(transaction.expiresDateMillis)).toISOString()
        : null;

    if (!product_id || !original_transaction_id) {
      // Still return 200 so Apple doesn't retry forever; log for debugging.
      console.log("apple-iap-webhook: missing identifiers", { notificationType, subtype, product_id, original_transaction_id });
      return json({ ok: true }, { headers: corsHeaders });
    }

    // Determine product type from DB.
    const { data: prod, error: prodErr } = await admin.from("products").select("id,type").eq("id", product_id).maybeSingle();
    if (prodErr) throw new Error(prodErr.message);
    if (!prod) {
      console.log("apple-iap-webhook: unknown product_id", product_id);
      return json({ ok: true }, { headers: corsHeaders });
    }
    const productType = prod.type as "subscription" | "non_consumable";

    // Attribute to a user: prefer appAccountToken; else fall back to original_transaction_id mapping.
    let user_id: string | null = null;
    if (appAccountToken && isUuid(appAccountToken)) user_id = appAccountToken;
    if (!user_id) {
      const { data: existing, error: exErr } = await admin
        .from("purchases")
        .select("user_id")
        .eq("platform", "ios")
        .eq("original_transaction_id", original_transaction_id)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      user_id = (existing as any)?.user_id ?? null;
    }
    if (!user_id) {
      console.log("apple-iap-webhook: could not map event to user", { original_transaction_id, hasAppAccountToken: Boolean(appAccountToken) });
      return json({ ok: true }, { headers: corsHeaders });
    }

    const status = mapAppleStatus({ productType, expires_at });

    const { error: upErr } = await admin
      .from("purchases")
      .upsert(
        {
          user_id,
          platform: "ios",
          product_id,
          original_transaction_id,
          transaction_id: transaction_id || null,
          expires_at,
          status,
          raw: { notificationType, subtype, payload, transaction },
        },
        { onConflict: "platform,original_transaction_id" },
      );
    if (upErr) throw new Error(upErr.message);

    await recomputeEntitlementForUser(admin, user_id);

    if (eventId) {
      const { error: evUpdErr } = await admin
        .from("iap_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("provider", "apple")
        .eq("event_id", eventId);
      if (evUpdErr) console.error("apple-iap-webhook: failed to mark processed", evUpdErr);
    }
    return json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("apple-iap-webhook error:", msg);
    // Return 200 to avoid Apple retry storms; log is enough for us to debug.
    return json({ ok: false, error: msg }, { status: 200, headers: corsHeaders });
  }
});

