import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as RNIap from "react-native-iap";
import { supabase } from "../lib/supabase";
import { PRODUCTS, type ProductId } from "./products";

type IapState = {
  premium: boolean;
  premiumUntil: string | null;
  loading: boolean;
  restore: () => Promise<void>;
  buy: (productId: ProductId) => Promise<void>;
};

const Ctx = createContext<IapState | null>(null);

export function useIap(): IapState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useIap must be used within IapProvider");
  return v;
}

async function refreshEntitlement(): Promise<{ premiumUntil: string | null }> {
  const { data, error } = await supabase.from("entitlements").select("premium_until").maybeSingle();
  if (error) return { premiumUntil: null };
  return { premiumUntil: data?.premium_until ?? null };
}

function isPremium(premiumUntil: string | null): boolean {
  if (!premiumUntil) return false;
  return new Date(premiumUntil).getTime() > Date.now();
}

export function IapProvider(props: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const validatingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await RNIap.initConnection();
      } catch {
        // ignore
      }
      const ent = await refreshEntitlement();
      if (mounted) {
        setPremiumUntil(ent.premiumUntil);
        setLoading(false);
      }
    })();

    const subPurchase = RNIap.purchaseUpdatedListener(async (purchase) => {
      if (validatingRef.current) return;
      validatingRef.current = true;
      try {
        const product_id = purchase.productId as ProductId;
        if (!Object.values(PRODUCTS).includes(product_id)) return;

        if (Platform.OS === "android") {
          const p = purchase as RNIap.PurchaseAndroid;
          const purchase_token = p.purchaseToken ?? "";
          const package_name = p.packageNameAndroid ?? "";
          if (!purchase_token || !package_name) throw new Error("Missing purchase token/package name");
          const { error } = await supabase.functions.invoke("validate-purchase", {
            body: { platform: "android", product_id, purchase_token, package_name },
          });
          if (error) throw error;
        }

        await RNIap.finishTransaction({ purchase, isConsumable: false });

        // NOTE (iOS): we intentionally do NOT call getReceiptIOS() here.
        // It can throw "Request Canceled" on app startup / non-user-initiated flows.
        // iOS entitlement is verified during explicit user actions (Buy/Restore).
        if (Platform.OS === "android") {
          const ent = await refreshEntitlement();
          setPremiumUntil(ent.premiumUntil);
        }
      } finally {
        validatingRef.current = false;
      }
    });

    const subError = RNIap.purchaseErrorListener(() => {
      validatingRef.current = false;
    });

    return () => {
      mounted = false;
      subPurchase.remove();
      subError.remove();
      void RNIap.endConnection();
    };
  }, []);

  const restore = async () => {
    if (Platform.OS === "ios") {
      let receipt_base64 = "";
      try {
        receipt_base64 = await RNIap.getReceiptIOS();
      } catch {
        // User canceled / StoreKit unavailable – treat as no-op restore
        return;
      }
      for (const product_id of Object.values(PRODUCTS)) {
        const { error } = await supabase.functions.invoke("validate-purchase", {
          body: { platform: "ios", product_id, receipt_base64 },
        });
        if (error) {
          // ignore missing-product errors; surface only real server failures
          const msg = (error as any)?.message ?? "";
          if (!String(msg).toLowerCase().includes("receipt does not contain")) throw error;
        }
      }
    } else {
      const purchases = await RNIap.getAvailablePurchases();
      for (const p of purchases) {
        const product_id = (p.productId ?? "") as ProductId;
        if (!Object.values(PRODUCTS).includes(product_id)) continue;

        const purchase_token = (p.purchaseToken ?? "") as string;
        const package_name = (p as RNIap.PurchaseAndroid).packageNameAndroid ?? "";
        if (!purchase_token || !package_name) continue;

        const { error } = await supabase.functions.invoke("validate-purchase", {
          body: { platform: "android", product_id, purchase_token, package_name },
        });
        if (error) throw error;
      }
    }

    const ent = await refreshEntitlement();
    setPremiumUntil(ent.premiumUntil);
  };

  const buy = async (productId: ProductId) => {
    const isSub = productId === PRODUCTS.premium_monthly || productId === PRODUCTS.premium_annual;
    const type: RNIap.MutationRequestPurchaseArgs["type"] = isSub ? "subs" : "in-app";
    const request =
      Platform.OS === "ios"
        ? ({ apple: { sku: productId, andDangerouslyFinishTransactionAutomatically: false } } as any)
        : ({ google: { skus: [productId] } } as any);

    await RNIap.requestPurchase({ type, request });

    // Best-effort: validate the most recent transaction after purchase.
    // In production, you typically listen to purchaseUpdatedListener and validate immediately.
    await restore();
  };

  const value = useMemo<IapState>(() => {
    return {
      loading,
      premiumUntil,
      premium: isPremium(premiumUntil),
      restore,
      buy,
    };
  }, [loading, premiumUntil]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}


