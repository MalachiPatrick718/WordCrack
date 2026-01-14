import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as RNIap from "react-native-iap";
import { supabase } from "../lib/supabase";
import { getJson, setJson } from "../lib/storage";
import { PRODUCTS, type ProductId } from "./products";

async function extractInvokeErrorMessage(err: any): Promise<string> {
  let msg = String(err?.message ?? "Request failed");
  const ctx = (err as any)?.context;
  try {
    // Supabase Functions errors often hide the JSON payload behind "non-2xx".
    if (ctx && typeof ctx.json === "function" && !ctx.bodyUsed) {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
      return JSON.stringify(body);
    }
    if (ctx?.body) {
      const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
      if (parsed?.error) return String(parsed.error);
      if (parsed?.message) return String(parsed.message);
    }
  } catch {
    // ignore
  }
  return msg;
}

async function getIosReceiptBase64ForProduct(productId: string, purchase?: any): Promise<string> {
  // 1) Prefer per-transaction receipt when present
  const direct = String(purchase?.transactionReceipt ?? "");
  if (direct) return direct;

  // 2) Try available purchases (often includes transactionReceipt even when purchase event doesn't)
  try {
    const avail = await RNIap.getAvailablePurchases();
    const match = (avail ?? []).find((p: any) => String(p?.productId ?? "") === productId);
    const r = String((match as any)?.transactionReceipt ?? "");
    if (r) return r;
  } catch {
    // ignore
  }

  // 3) Try purchase history (another source depending on StoreKit version)
  try {
    const hist = await (RNIap as any).getPurchaseHistory?.();
    const match = (hist ?? []).find((p: any) => String(p?.productId ?? "") === productId);
    const r = String((match as any)?.transactionReceipt ?? "");
    if (r) return r;
  } catch {
    // ignore
  }

  // 4) Fall back to app receipt refresh
  try {
    const r = String(await (RNIap as any).getReceiptIOS?.());
    if (r) return r;
  } catch (e: any) {
    const raw = String(e?.message ?? "");
    // Surface a clearer message for the common case where the user dismisses the App Store prompt.
    if (raw.toLowerCase().includes("request canceled") || raw.toLowerCase().includes("request cancelled")) {
      throw new Error("App Store receipt refresh was canceled. Please complete the purchase prompt and try again, or use Restore Purchases.");
    }
    throw e;
  }

  throw new Error("Missing iOS receipt");
}

type IapState = {
  premium: boolean;
  premiumUntil: string | null;
  loading: boolean;
  lastPurchaseError: string | null;
  clearLastPurchaseError: () => void;
  premiumTestEnabled: boolean;
  setPremiumTestEnabled: (enabled: boolean) => Promise<void>;
  reloadProducts: () => Promise<void>;
  productsDebug: {
    lastLoadError: string | null;
    lastLoadedAt: number | null;
    lastCount: number;
  };
  products: Partial<Record<ProductId, {
    productId: ProductId;
    title?: string;
    description?: string;
    localizedPrice?: string;
    price?: string | number;
    priceNumber?: number | null;
    currency?: string | null;
  }>>;
  restore: () => Promise<void>;
  buy: (productId: ProductId, userId: string) => Promise<void>;
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

function parsePriceNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  // Accept common formats like "2.99", "$2.99", "US$2.99", "2,99"
  const cleaned = input.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  // Prefer dot-decimal; fall back to comma-decimal.
  const dot = cleaned.includes(".") ? Number.parseFloat(cleaned.replace(/,/g, "")) : Number.parseFloat(cleaned.replace(",", "."));
  return Number.isFinite(dot) ? dot : null;
}

function extractNumericPrice(p: any): number | null {
  // Android (v5+): pricing phases
  try {
    const offer = p?.subscriptionOfferDetails?.[0];
    const phase = offer?.pricingPhases?.pricingPhaseList?.[0];
    const micros = phase?.priceAmountMicros ?? p?.priceAmountMicros;
    if (micros != null) {
      const n = Number(micros) / 1_000_000;
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }
  // iOS / fallback
  return parsePriceNumber(p?.price);
}

async function fetchIapProducts(): Promise<IapState["products"]> {
  const skus = [PRODUCTS.premium_monthly, PRODUCTS.premium_annual];
  let subs: any[] | undefined;

  // react-native-iap v14+: use fetchProducts({ skus, type: 'subs' })
  try {
    subs = await (RNIap as any).fetchProducts?.({ skus, type: "subs" });
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? "fetchProducts failed");
    throw new Error(msg);
  }

  // Back-compat: react-native-iap older signatures
  // If fetchProducts returned empty and the legacy APIs exist, try them once.
  // (Some environments may have native modules lagging behind JS API.)
  if (!subs?.length) {
    try {
      subs = await (RNIap as any).getSubscriptions?.({ skus });
    } catch {
      // ignore
    }
    if (!subs?.length) {
      try {
        subs = await (RNIap as any).getSubscriptions?.(skus);
      } catch {
        // ignore
      }
    }
    if (!subs?.length) {
      try {
        subs = await (RNIap as any).getProducts?.({ skus });
      } catch {
        // ignore
      }
    }
  }

  const map: IapState["products"] = {};
  for (const p of subs ?? []) {
    // v14 uses `id`, older versions use `productId`
    const id = (p.id ?? p.productId) as ProductId;
    map[id] = {
      productId: id,
      title: p.title,
      description: p.description,
      localizedPrice: p.displayPrice ?? p.localizedPrice ?? p.localizedPriceAndroid ?? p.price,
      price: p.price,
      priceNumber: typeof p.price === "number" ? p.price : extractNumericPrice(p),
      currency: p.currency ?? p.currencyCodeAndroid ?? null,
    };
  }
  return map;
}

export function IapProvider(props: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [lastPurchaseError, setLastPurchaseError] = useState<string | null>(null);
  const [premiumTestEnabled, setPremiumTestEnabledState] = useState(false);
  const [products, setProducts] = useState<IapState["products"]>({});
  const [productsDebug, setProductsDebug] = useState<IapState["productsDebug"]>({
    lastLoadError: null,
    lastLoadedAt: null,
    lastCount: 0,
  });
  const validatingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await RNIap.initConnection();
      } catch (e: any) {
        setProductsDebug({ lastLoadError: String(e?.message ?? e ?? "initConnection failed"), lastLoadedAt: null, lastCount: 0 });
      }
      const test = await getJson<boolean>("mindshift:premiumTest");

      // Best-effort: load localized pricing for paywall UI.
      try {
        const map = await fetchIapProducts();
        if (mounted) {
          setProducts(map);
          setProductsDebug({ lastLoadError: map && Object.keys(map).length ? null : "Store returned 0 products", lastLoadedAt: Date.now(), lastCount: Object.keys(map).length });
        }
      } catch (e: any) {
        if (mounted) {
          setProducts({});
          setProductsDebug({ lastLoadError: String(e?.message ?? e ?? "Product fetch failed"), lastLoadedAt: Date.now(), lastCount: 0 });
        }
      }

      const ent = await refreshEntitlement();
      if (mounted) {
        setPremiumUntil(ent.premiumUntil);
        setPremiumTestEnabledState(Boolean(test));
        setLoading(false);
      }
    })();

    // If the user signs in/out, refresh entitlement so premium state updates immediately.
    const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setPremiumUntil(null);
        return;
      }
      const ent = await refreshEntitlement();
      if (mounted) setPremiumUntil(ent.premiumUntil);
    });

    const subPurchase = RNIap.purchaseUpdatedListener(async (purchase) => {
      if (validatingRef.current) return;
      validatingRef.current = true;
      setLastPurchaseError(null);
      try {
        const product_id = purchase.productId as ProductId;
        if (!Object.values(PRODUCTS).includes(product_id)) return;

        if (Platform.OS === "ios") {
          // Prefer the per-transaction receipt when available to avoid calling getReceiptIOS()
          // (which can throw "Request Canceled" and returns the whole receipt history).
          const receipt_base64 = await getIosReceiptBase64ForProduct(product_id, purchase);
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
      } catch (e: any) {
        const msg = await extractInvokeErrorMessage(e);
        console.error("IAP validation failed:", msg, e);
        setLastPurchaseError(msg);
      } finally {
        validatingRef.current = false;
      }
    });

    const subError = RNIap.purchaseErrorListener((err) => {
      validatingRef.current = false;
      const code = String((err as any)?.code ?? "");
      const message = String((err as any)?.message ?? "");
      if (code === "E_USER_CANCELLED" || code === "E_USER_CANCELLED_ERROR") {
        setLastPurchaseError("Purchase canceled.");
        return;
      }
      if (message) {
        setLastPurchaseError(message);
        return;
      }
      setLastPurchaseError("Purchase failed. Please try again.");
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
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
        const receipt_base64 = await getIosReceiptBase64ForProduct(product_id, p);
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

  const buy = async (productId: ProductId, userId: string) => {
    const isSub = productId === PRODUCTS.premium_monthly || productId === PRODUCTS.premium_annual;
    const type: RNIap.MutationRequestPurchaseArgs["type"] = isSub ? "subs" : "in-app";

    // Helpful guard: if StoreKit can't load the SKU, `requestPurchase` will fail with "SKU not found".
    // Retry loading products once and throw a clearer error if still missing.
    if (Platform.OS === "ios" && isSub && !products?.[productId]) {
      try {
        await RNIap.initConnection();
      } catch {
        // ignore
      }
      let map: IapState["products"] = {};
      try {
        map = await fetchIapProducts();
        setProducts(map);
        setProductsDebug({
          lastLoadError: Object.keys(map).length ? null : "Store returned 0 products",
          lastLoadedAt: Date.now(),
          lastCount: Object.keys(map).length,
        });
      } catch (e: any) {
        setProductsDebug({ lastLoadError: String(e?.message ?? e ?? "Product fetch failed"), lastLoadedAt: Date.now(), lastCount: 0 });
      }
      if (!map?.[productId]) {
        throw new Error(
          "StoreKit couldn’t find this subscription (SKU not found). In App Store Connect, confirm the Paid Apps Agreement is Active and that the subscription products are available for sale under this app (bundle id com.wordcrack.app). It can also take up to ~2 hours after changes for sandbox to propagate.",
        );
      }
    }

    const request =
      Platform.OS === "ios"
        ? ({
            apple: {
              sku: productId,
              andDangerouslyFinishTransactionAutomatically: false,
              // Critical for "seamless": lets Apple S2S notifications map transactions back to a user.
              // Must be a UUID (Supabase auth user_id is a UUID).
              appAccountToken: userId,
            },
          } as any)
        : ({ google: { skus: [productId] } } as any);

    await RNIap.requestPurchase({ type, request });
    // Validation + finishTransaction happen in purchaseUpdatedListener.
  };

  const setPremiumTestEnabled = async (enabled: boolean) => {
    // Dev-only safety: never allow this to be turned on in production builds.
    if (!__DEV__) {
      await setJson("mindshift:premiumTest", false);
      setPremiumTestEnabledState(false);
      return;
    }
    await setJson("mindshift:premiumTest", enabled);
    setPremiumTestEnabledState(enabled);
  };

  const value = useMemo<IapState>(() => {
    return {
      loading,
      premiumUntil,
      lastPurchaseError,
      clearLastPurchaseError: () => setLastPurchaseError(null),
      premiumTestEnabled,
      setPremiumTestEnabled,
      reloadProducts: async () => {
        try {
          await RNIap.initConnection();
        } catch (e: any) {
          setProductsDebug({ lastLoadError: String(e?.message ?? e ?? "initConnection failed"), lastLoadedAt: Date.now(), lastCount: 0 });
        }
        const map = await fetchIapProducts();
        setProducts(map);
        setProductsDebug({ lastLoadError: Object.keys(map).length ? null : "Store returned 0 products", lastLoadedAt: Date.now(), lastCount: Object.keys(map).length });
      },
      productsDebug,
      products,
      premium: (__DEV__ && premiumTestEnabled) || isPremium(premiumUntil),
      restore,
      buy,
    };
  }, [loading, premiumUntil, lastPurchaseError, premiumTestEnabled, products, productsDebug]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}


