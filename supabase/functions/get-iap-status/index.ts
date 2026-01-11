import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

type PurchaseRow = {
  platform: "ios" | "android";
  product_id: string;
  status: string;
  purchase_time: string | null;
  expires_at: string | null;
  updated_at?: string | null;
  original_transaction_id?: string | null;
  transaction_id?: string | null;
  order_id?: string | null;
  package_name?: string | null;
  purchase_token?: string | null;
  raw_meta?: { notificationType?: string; subtype?: string } | null;
};

// Debug/status endpoint for validating subscription flows in dev/TestFlight.
// Returns only non-sensitive fields (no receipts / tokens).
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const admin = supabaseAdmin();

    const { data: ent, error: entErr } = await admin
      .from("entitlements")
      .select("premium_until,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (entErr) return json({ error: entErr.message }, { status: 500, headers: corsHeaders });

    const { data: purchases, error: pErr } = await admin
      .from("purchases")
      .select(
        "platform,product_id,status,purchase_time,expires_at,updated_at,original_transaction_id,transaction_id,order_id,package_name,raw",
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10);
    if (pErr) return json({ error: pErr.message }, { status: 500, headers: corsHeaders });

    const safePurchases: PurchaseRow[] = (purchases ?? []).map((r: any) => {
      const raw = r?.raw ?? null;
      const rawMeta =
        raw && typeof raw === "object"
          ? {
              notificationType: raw?.notificationType ?? raw?.payload?.notificationType ?? undefined,
              subtype: raw?.subtype ?? raw?.payload?.subtype ?? undefined,
            }
          : null;
      return {
        platform: r.platform,
        product_id: r.product_id,
        status: r.status,
        purchase_time: r.purchase_time ?? null,
        expires_at: r.expires_at ?? null,
        updated_at: r.updated_at ?? null,
        original_transaction_id: r.original_transaction_id ?? null,
        transaction_id: r.transaction_id ?? null,
        order_id: r.order_id ?? null,
        package_name: r.package_name ?? null,
        raw_meta: rawMeta,
      };
    });

    return json(
      {
        ok: true,
        entitlement: { premium_until: ent?.premium_until ?? null, updated_at: ent?.updated_at ?? null },
        purchases: safePurchases,
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});

