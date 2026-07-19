import { getAliasMultiplier, getLegacyAliasesFor } from "@/lib/productAliases";
import { getRestockAdvice } from "@/lib/restockingLogic";
import { getInventory, getProducts, getTransactions } from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

// This route computes advice from live StoreHub + DB data on every request
// (stock levels and sales change constantly) — never cache it, at the
// framework level or via HTTP, or callers can end up seeing numbers from a
// stale build/response that no longer match the current formula.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface RouteParams {
  params: Promise<{ sku: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const storeId =
    request.nextUrl.searchParams.get("storeId") ||
    process.env.NEXT_PUBLIC_STOREHUB_STORE_ID ||
    "";

  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  try {
    // NOTE: StoreHub's `/products?sku=...` filter is silently ignored by
    // their API (it returns the full, unfiltered catalog regardless) — we
    // must fetch everything and find the match ourselves. Previously this
    // used `getProducts({ sku: decodedSku })` and took `products[0]`, which
    // silently picked an ARBITRARY unrelated product whenever the filter
    // was ignored, producing restock advice for the wrong SKU entirely.
    const [products, inventory] = await Promise.all([
      getProducts(),
      getInventory(storeId),
    ]);

    const product = products.find((p) => p.sku === decodedSku);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const inventoryItem = inventory.find((i) => i.productId === product.id);
    let currentStock = inventoryItem?.quantityOnHand ?? 0;

    // Fold any legacy/superseded SKU's remaining stock into this canonical
    // SKU (converted by the alias's unit multiplier — see
    // lib/productAliases.ts), so restock advice reflects the true total
    // on-hand quantity instead of missing what's still sitting under the
    // old SKU.
    for (const alias of getLegacyAliasesFor(decodedSku)) {
      const legacyProduct = products.find((p) => p.sku === alias.legacySku);
      if (!legacyProduct) continue;
      const legacyInv = inventory.find((i) => i.productId === legacyProduct.id);
      currentStock +=
        (legacyInv?.quantityOnHand ?? 0) * alias.unitsPerLegacyUnit;
    }

    // Fallback velocity: total units sold in the last 14 days / 14 — a
    // fixed, simple rolling-average window (matches a weekly/biweekly
    // restock cadence: outright items get bought Mondays every 1–2 weeks,
    // so a 2-week sales window is the most relevant signal for "how much
    // do we typically move before the next buy").
    let fallbackDailyVelocity = 0;
    try {
      const transactions = await getTransactions({ status: "completed" });
      const windowDays = 14;
      const windowStart = Date.now() - windowDays * 24 * 60 * 60 * 1000;

      // Fold in legacy/superseded SKUs (see lib/productAliases.ts) so a
      // discontinued bundle SKU's recent sales still count toward this
      // SKU's velocity, converted to this SKU's unit size.
      const legacySkus = new Set(
        getLegacyAliasesFor(decodedSku).map((a) => a.legacySku),
      );

      let recentQty = 0;
      for (const tx of transactions) {
        const txTime = new Date(tx.timestamp).getTime();
        if (txTime < windowStart) continue;
        for (const item of tx.items) {
          const itemSku = String(item.sku);
          if (itemSku === decodedSku) {
            recentQty += item.quantity || 0;
          } else if (legacySkus.has(itemSku)) {
            recentQty += (item.quantity || 0) * getAliasMultiplier(itemSku);
          }
        }
      }

      fallbackDailyVelocity = recentQty / windowDays;
    } catch (err) {
      console.error("Failed to compute fallback velocity:", err);
    }

    const advice = await getRestockAdvice({
      sku: decodedSku,
      currentStock,
      fallbackDailyVelocity,
    });

    return NextResponse.json(advice, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  } catch (error) {
    console.error("Error computing restock advice:", error);
    return NextResponse.json(
      { error: "Failed to compute restock advice" },
      { status: 500 },
    );
  }
}
