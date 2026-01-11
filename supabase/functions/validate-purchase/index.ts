import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin, getEnv } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";
import { getGoogleAccessToken } from "../_shared/google.ts";
import { recomputeEntitlementForUser } from "../_shared/iap.ts";

type Platform = "ios" | "android";
type ProductType = "subscription" | "non_consumable";

type Body =
  | {
      platform: "ios";
      product_id: string;
      receipt_base64: string;
    }
  | {
      platform: "android";
      product_id: string;
      purchase_token: string;
      package_name: string;
    };

function maxTs(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

async function verifyAppleReceipt(receipt_base64: string): Promise<{
  status: number;
  latestReceiptInfo: any[] | null;
  pendingRenewalInfo: any[] | null;
  receipt: any | null;
}> {
  const sharedSecret = getEnv("APPLE_SHARED_SECRET");
  const payload = {
    "receipt-data": receipt_base64,
    password: sharedSecret,
    "exclude-old-transactions": true,
  };

  const post = async (url: string) => {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await resp.json()) as any;
  };

  // Production first, then retry sandbox if needed (21007)
  const prod = await post("https://buy.itunes.apple.com/verifyReceipt");
  if (prod?.status === 21007) {
    const sandbox = await post("https://sandbox.itunes.apple.com/verifyReceipt");
    return {
      status: sandbox?.status ?? 99999,
      latestReceiptInfo: sandbox?.latest_receipt_info ?? null,
      pendingRenewalInfo: sandbox?.pending_renewal_info ?? null,
      receipt: sandbox?.receipt ?? null,
    };
  }
  return {
    status: prod?.status ?? 99999,
    latestReceiptInfo: prod?.latest_receipt_info ?? null,
    pendingRenewalInfo: prod?.pending_renewal_info ?? null,
    receipt: prod?.receipt ?? null,
  };
}

async function verifyGooglePurchase(args: {
  purchase_token: string;
  package_name: string;
  product_id: string;
  productType: ProductType;
}): Promise<{
  purchase_time: string | null;
  expires_at: string | null;
  status: "active" | "expired" | "canceled" | "refunded";
  raw: unknown;
  order_id: string | null;
}> {
  const serviceAccountJson = getEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  const accessToken = await getGoogleAccessToken({
    serviceAccountJson,
    scope: "https://www.googleapis.com/auth/androidpublisher",
  });

  const base = "https://androidpublisher.googleapis.com/androidpublisher/v3";

  if (args.productType === "subscription") {
    // Subscriptions v3 (legacy) endpoint: requires subscriptionId + token
    const url =
      `${base}/applications/${encodeURIComponent(args.package_name)}` +
      `/purchases/subscriptions/${encodeURIComponent(args.product_id)}` +
      `/tokens/${encodeURIComponent(args.purchase_token)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = (await resp.json()) as any;
    if (!resp.ok) throw new Error(`Google verify subscription failed: ${data?.error?.message ?? resp.status}`);

    const purchase_time = data.startTimeMillis ? new Date(Number(data.startTimeMillis)).toISOString() : null;
    const expires_at = data.expiryTimeMillis ? new Date(Number(data.expiryTimeMillis)).toISOString() : null;
    const now = Date.now();

    let status: "active" | "expired" | "canceled" | "refunded" = "expired";
    if (data.cancelReason != null) status = "canceled";
    if (data.userCancellationTimeMillis != null) status = "canceled";
    if (expires_at && new Date(expires_at).getTime() > now && status !== "canceled") status = "active";

    const order_id = typeof data.orderId === "string" ? data.orderId : null;
    return { purchase_time, expires_at, status, raw: data, order_id };
  }

  // One-time product (non-consumable)
  const url =
    `${base}/applications/${encodeURIComponent(args.package_name)}` +
    `/purchases/products/${encodeURIComponent(args.product_id)}` +
    `/tokens/${encodeURIComponent(args.purchase_token)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = (await resp.json()) as any;
  if (!resp.ok) throw new Error(`Google verify product failed: ${data?.error?.message ?? resp.status}`);

  const purchase_time = data.purchaseTimeMillis ? new Date(Number(data.purchaseTimeMillis)).toISOString() : null;
  const expires_at = null;
  // purchaseState: 0 Purchased, 1 Canceled, 2 Pending (varies by API version)
  let status: "active" | "expired" | "canceled" | "refunded" = "active";
  if (data.purchaseState === 1) status = "canceled";

  const order_id = typeof data.orderId === "string" ? data.orderId : null;
  return { purchase_time, expires_at, status, raw: data, order_id };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = (await req.json()) as Body;
    const platform = body?.platform as Platform;
    const product_id = String((body as any)?.product_id ?? "");
    if (!platform || !["ios", "android"].includes(platform)) {
      return json({ error: "Invalid platform" }, { status: 400, headers: corsHeaders });
    }
    if (!product_id) return json({ error: "Missing product_id" }, { status: 400, headers: corsHeaders });

    const admin = supabaseAdmin();

    const { data: product, error: prodErr } = await admin.from("products").select("id,type").eq("id", product_id).maybeSingle();
    if (prodErr) return json({ error: prodErr.message }, { status: 500, headers: corsHeaders });
    if (!product) return json({ error: "Unknown product_id" }, { status: 400, headers: corsHeaders });
    const productType = product.type as ProductType;

    if (platform === "ios") {
      const receipt_base64 = String((body as any).receipt_base64 ?? "");
      if (!receipt_base64) return json({ error: "Missing receipt_base64" }, { status: 400, headers: corsHeaders });

      const verified = await verifyAppleReceipt(receipt_base64);
      if (verified.status !== 0) return json({ error: `Apple verification failed (status ${verified.status})` }, { status: 400, headers: corsHeaders });

      // Find the most relevant transaction for this product
      const txs = (verified.latestReceiptInfo ?? []).filter((t) => t.product_id === product_id);
      if (!txs.length) return json({ error: "Receipt does not contain this product" }, { status: 400, headers: corsHeaders });

      // Latest by expires_date_ms if subscription, else by purchase_date_ms
      txs.sort((a, b) => Number(b.expires_date_ms ?? b.purchase_date_ms ?? 0) - Number(a.expires_date_ms ?? a.purchase_date_ms ?? 0));
      const t = txs[0];

      const original_transaction_id = String(t.original_transaction_id ?? "");
      const transaction_id = String(t.transaction_id ?? "");
      const purchase_time = t.purchase_date_ms ? new Date(Number(t.purchase_date_ms)).toISOString() : null;
      const expires_at = t.expires_date_ms ? new Date(Number(t.expires_date_ms)).toISOString() : null;

      const now = Date.now();
      const status: "active" | "expired" = productType === "subscription"
        ? (expires_at && new Date(expires_at).getTime() > now ? "active" : "expired")
        : "active";

      const { data: upserted, error: upErr } = await admin
        .from("purchases")
        .upsert(
          {
            user_id: user.id,
            platform,
            product_id,
            original_transaction_id: original_transaction_id || null,
            transaction_id: transaction_id || null,
            receipt_base64,
            purchase_time,
            expires_at,
            status,
            raw: { latest_receipt_info: verified.latestReceiptInfo, pending_renewal_info: verified.pendingRenewalInfo },
          },
          { onConflict: "platform,original_transaction_id" },
        )
        .select("id,expires_at,status")
        .single();
      if (upErr) return json({ error: upErr.message }, { status: 500, headers: corsHeaders });

      await recomputeEntitlementForUser(admin, user.id);
      const { data: ent } = await admin.from("entitlements").select("premium_until").eq("user_id", user.id).maybeSingle();
      return json({ ok: true, entitlement: ent, purchase: upserted }, { headers: corsHeaders });
    }

    // android
    const purchase_token = String((body as any).purchase_token ?? "");
    const package_name = String((body as any).package_name ?? "");
    if (!purchase_token) return json({ error: "Missing purchase_token" }, { status: 400, headers: corsHeaders });
    if (!package_name) return json({ error: "Missing package_name" }, { status: 400, headers: corsHeaders });

    const verified = await verifyGooglePurchase({ purchase_token, package_name, product_id, productType });

    const { data: upserted, error: upErr } = await admin
      .from("purchases")
      .upsert(
        {
          user_id: user.id,
          platform,
          product_id,
          purchase_token,
          package_name,
          order_id: verified.order_id,
          purchase_time: verified.purchase_time,
          expires_at: verified.expires_at,
          status: verified.status,
          raw: verified.raw,
        },
        { onConflict: "platform,purchase_token" },
      )
      .select("id,expires_at,status")
      .single();
    if (upErr) return json({ error: upErr.message }, { status: 500, headers: corsHeaders });

    await recomputeEntitlementForUser(admin, user.id);
    const { data: ent } = await admin.from("entitlements").select("premium_until").eq("user_id", user.id).maybeSingle();
    return json({ ok: true, entitlement: ent, purchase: upserted }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


