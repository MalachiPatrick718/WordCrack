import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as RNIap from "react-native-iap";
import { supabase } from "../lib/supabase";
import { getJson, setJson } from "../lib/storage";
import { PRODUCTS, type ProductId } from "./products";

type IapState = {
  premium: boolean;
  premiumUntil: string | null;
  loading: boolean;
  premiumTestEnabled: boolean;
  setPremiumTestEnabled: (enabled: boolean) => Promise<void>;
  products: Partial<Record<ProductId, { productId: ProductId; title?: string; description?: string; localizedPrice?: string; price?: string | number }>>;
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
  const [premiumTestEnabled, setPremiumTestEnabledState] = useState(false);
  const [products, setProducts] = useState<IapState["products"]>({});
  const validatingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await RNIap.initConnection();
      } catch {
        // ignore
      }
      const test = await getJson<boolean>("wordcrack:premiumTest");

      // Best-effort: load localized pricing for paywall UI.
      try {
        const subs = await (RNIap as any).getSubscriptions?.({ skus: [PRODUCTS.premium_monthly, PRODUCTS.premium_annual] });
        const map: IapState["products"] = {};
        for (const p of subs ?? []) {
          const id = p.productId as ProductId;
          map[id] = {
            productId: id,
            title: p.title,
            description: p.description,
            localizedPrice: p.localizedPrice ?? p.localizedPriceAndroid ?? p.price,
            price: p.price,
          };
        }
        if (mounted) setProducts(map);
      } catch {
        // ignore
      }

      const ent = await refreshEntitlement();
      if (mounted) {
        setPremiumUntil(ent.premiumUntil);
        setPremiumTestEnabledState(Boolean(test));
        setLoading(false);
      }
    })();

    const subPurchase = RNIap.purchaseUpdatedListener(async (purchase) => {
      if (validatingRef.current) return;
      validatingRef.current = true;
      try {
        const product_id = purchase.productId as ProductId;
        if (!Object.values(PRODUCTS).includes(product_id)) return;

        if (Platform.OS === "ios") {
          // Prefer the per-transaction receipt when available to avoid calling getReceiptIOS()
          // (which can throw "Request Canceled" and returns the whole receipt history).
          const receipt_base64 = (purchase as any)?.transactionReceipt ?? "";
          if (!receipt_base64) throw new Error("Missing iOS transaction receipt");
          const { error } = await supabase.functions.invoke("validate-purchase", {
            body: { platform: "ios", product_id, receipt_base64 },
          });
          if (error) throw error;
        } else {
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

        const ent = await refreshEntitlement();
        setPremiumUntil(ent.premiumUntil);
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
      const purchases = await RNIap.getAvailablePurchases();
      for (const p of purchases ?? []) {
        const product_id = (p.productId ?? "") as ProductId;
        if (!Object.values(PRODUCTS).includes(product_id)) continue;
        const receipt_base64 = (p as any)?.transactionReceipt ?? "";
        if (!receipt_base64) continue;
        const { error } = await supabase.functions.invoke("validate-purchase", {
          body: { platform: "ios", product_id, receipt_base64 },
        });
        if (error) throw error;
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
    // Validation + finishTransaction happen in purchaseUpdatedListener.
  };

  const setPremiumTestEnabled = async (enabled: boolean) => {
    // Dev-only safety: never allow this to be turned on in production builds.
    if (!__DEV__) {
      await setJson("wordcrack:premiumTest", false);
      setPremiumTestEnabledState(false);
      return;
    }
    await setJson("wordcrack:premiumTest", enabled);
    setPremiumTestEnabledState(enabled);
  };

  const value = useMemo<IapState>(() => {
    return {
      loading,
      premiumUntil,
      premiumTestEnabled,
      setPremiumTestEnabled,
      products,
      premium: (__DEV__ && premiumTestEnabled) || isPremium(premiumUntil),
      restore,
      buy,
    };
  }, [loading, premiumUntil, premiumTestEnabled, products]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}


