import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "npm:jose@5.9.6";
import { getGoogleAccessToken } from "./google.ts";

type ProductType = "subscription" | "non_consumable";

type AppleJwsKeySet = {
  keys: JWK[];
};

let appleKeysCache: { prod: JWK[]; sandbox: JWK[]; fetchedAt: number } | null = null;
const APPLE_KEYS_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchAppleJwsKeys(): Promise<{ prod: JWK[]; sandbox: JWK[] }> {
  const now = Date.now();
  if (appleKeysCache && now - appleKeysCache.fetchedAt < APPLE_KEYS_TTL_MS) {
    return { prod: appleKeysCache.prod, sandbox: appleKeysCache.sandbox };
  }

  // Apple App Store Server Notifications v2 public keys (JWS)
  // Docs: Apple provides rotating public keys for verifying signedPayload and signedTransactionInfo.
  const fetchSet = async (url: string): Promise<JWK[]> => {
    const resp = await fetch(url);
    const data = (await resp.json()) as any;
    const keys = (data as AppleJwsKeySet)?.keys ?? [];
    if (!Array.isArray(keys) || !keys.length) throw new Error("Apple JWS keys missing/invalid");
    return keys;
  };

  // Production + Sandbox have distinct keysets.
  // We cache both and select by JWT kid when verifying.
  const prodUrl = "https://api.storekit.itunes.apple.com/inApps/v1/notifications/jwsPublicKeys";
  const sandboxUrl = "https://api.storekit-sandbox.itunes.apple.com/inApps/v1/notifications/jwsPublicKeys";

  const prod = await fetchSet(prodUrl);
  const sandbox = await fetchSet(sandboxUrl);
  appleKeysCache = { prod, sandbox, fetchedAt: now };
  return { prod, sandbox };
}

export async function verifyAppleJws<T = any>(token: string): Promise<T> {
  const keys = await fetchAppleJwsKeys();
  const hdr = decodeProtectedHeader(token);
  const kid = String((hdr as any)?.kid ?? "");
  const fromProd = keys.prod.find((k: any) => String(k.kid ?? "") === kid);
  const fromSandbox = keys.sandbox.find((k: any) => String(k.kid ?? "") === kid);
  const jwk = fromProd ?? fromSandbox ?? keys.prod[0] ?? keys.sandbox[0];
  if (!jwk) throw new Error("Apple JWS key not found");
  const key = await importJWK(jwk, jwk.alg as any);
  const { payload } = await jwtVerify(token, key, {
    // Apple payloads do not use aud/iss in a consistent way across all objects.
    // We primarily rely on signature verification.
  });
  return payload as any as T;
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function maxTs(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export async function recomputeEntitlementForUser(admin: any, user_id: string) {
  // If user has any active non-consumable, grant "forever".
  const { data: rows, error } = await admin
    .from("purchases")
    .select("expires_at,status,products(type)")
    .eq("user_id", user_id);
  if (error) throw new Error(error.message);

  let premium_until: string | null = null;
  for (const r of rows ?? []) {
    const type = (r as any)?.products?.type as "subscription" | "non_consumable" | undefined;
    const status = String((r as any)?.status ?? "");
    if (status !== "active") continue;
    if (type === "non_consumable") {
      premium_until = new Date(Date.UTC(2999, 0, 1)).toISOString();
      break;
    }
    premium_until = maxTs(premium_until, (r as any)?.expires_at ?? null);
  }

  const { error: entErr } = await admin
    .from("entitlements")
    .upsert({ user_id, premium_until }, { onConflict: "user_id" });
  if (entErr) throw new Error(entErr.message);
}

export function decodeBase64Json(inputB64: string): any {
  const json = atob(inputB64);
  return JSON.parse(json);
}

export async function verifyGooglePlaySubscription(args: {
  purchase_token: string;
  package_name: string;
  product_id: string;
  productType: ProductType;
  google_service_account_json: string;
}): Promise<{
  purchase_time: string | null;
  expires_at: string | null;
  status: "active" | "expired" | "canceled" | "refunded";
  raw: unknown;
  order_id: string | null;
}> {
  const accessToken = await getGoogleAccessToken({
    serviceAccountJson: args.google_service_account_json,
    scope: "https://www.googleapis.com/auth/androidpublisher",
  });

  const base = "https://androidpublisher.googleapis.com/androidpublisher/v3";

  if (args.productType === "subscription") {
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

  const url =
    `${base}/applications/${encodeURIComponent(args.package_name)}` +
    `/purchases/products/${encodeURIComponent(args.product_id)}` +
    `/tokens/${encodeURIComponent(args.purchase_token)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = (await resp.json()) as any;
  if (!resp.ok) throw new Error(`Google verify product failed: ${data?.error?.message ?? resp.status}`);

  const purchase_time = data.purchaseTimeMillis ? new Date(Number(data.purchaseTimeMillis)).toISOString() : null;
  const expires_at = null;
  let status: "active" | "expired" | "canceled" | "refunded" = "active";
  if (data.purchaseState === 1) status = "canceled";
  const order_id = typeof data.orderId === "string" ? data.orderId : null;
  return { purchase_time, expires_at, status, raw: data, order_id };
}

