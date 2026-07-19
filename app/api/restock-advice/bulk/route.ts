import {
  getAliasMultiplier,
  isLegacyAliasSku,
  resolveCanonicalSku,
} from "@/lib/productAliases";
import { getBulkRestockAdvice, RestockAdvice } from "@/lib/restockingLogic";
import { getInventory, getProducts, getTransactions } from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

// Same reasoning as app/api/restock-advice/[sku]/route.ts — must never be
// cached, otherwise /products can show numbers computed by an older
// version of the reorder-point formula than the live per-SKU page.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Bulk restocking advice for every product — used by /products so the list
 * table can show reorder point / urgency without firing one request per
 * SKU. Computes the same fallback velocity + reorder-point model as
 * /api/restock-advice/[sku], just batched.
 */
export async function GET(request: NextRequest) {
  const storeId =
    request.nextUrl.searchParams.get("storeId") ||
    process.env.NEXT_PUBLIC_STOREHUB_STORE_ID ||
    "";

  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  try {
    const [products, inventory, transactions] = await Promise.all([
      getProducts(),
      getInventory(storeId),
      getTransactions({ status: "completed" }).catch((err) => {
        console.error("Failed to fetch transactions for bulk advice:", err);
        return [];
      }),
    ]);

    const inventoryByProductId = new Map(
      inventory.map((i) => [i.productId, i]),
    );

    // Fallback velocity per SKU: total units sold in the last 14 days / 14
    // — a fixed, simple rolling-average window (see
    // app/api/restock-advice/[sku]/route.ts for the reasoning).
    const windowDays = 14;
    const windowStart = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const recentQtyBySku = new Map<string, number>();

    for (const tx of transactions) {
      const txTime = new Date(tx.timestamp).getTime();
      if (txTime < windowStart || !tx.items) continue;
      for (const item of tx.items) {
        const rawSku = String(item.sku || "");
        if (!rawSku) continue;
        const qty = item.quantity || 0;
        if (qty <= 0) continue;
        // Fold legacy/superseded SKUs into their canonical SKU (see
        // lib/productAliases.ts), scaled by the alias's unit multiplier.
        const sku = resolveCanonicalSku(rawSku);
        const effectiveQty = qty * getAliasMultiplier(rawSku);
        recentQtyBySku.set(sku, (recentQtyBySku.get(sku) || 0) + effectiveQty);
      }
    }

    const fallbackVelocityForSku = (sku: string) => {
      const recentQty = recentQtyBySku.get(sku) || 0;
      return recentQty / windowDays;
    };

    const items = products
      .filter((p) => p.sku && !isLegacyAliasSku(p.sku))
      .map((p) => {
        const sku = String(p.sku);
        const inv = inventoryByProductId.get(p.id);
        let currentStock = inv?.quantityOnHand ?? 0;

        // Fold any legacy/superseded SKU's remaining stock into this
        // canonical SKU (converted by the alias's unit multiplier — see
        // lib/productAliases.ts), so restock advice reflects the true
        // total on-hand quantity instead of missing what's still sitting
        // under the old SKU.
        for (const legacyProduct of products) {
          const legacySku = String(legacyProduct.sku || "");
          if (!legacySku || resolveCanonicalSku(legacySku) !== sku) continue;
          if (legacySku === sku) continue;
          const legacyInv = inventoryByProductId.get(legacyProduct.id);
          const legacyStock = legacyInv?.quantityOnHand ?? 0;
          currentStock += legacyStock * getAliasMultiplier(legacySku);
        }

        return {
          sku,
          currentStock,
          fallbackDailyVelocity: fallbackVelocityForSku(sku),
        };
      });

    const adviceMap = await getBulkRestockAdvice(items);
    const result: Record<string, RestockAdvice> = {};
    for (const [sku, advice] of adviceMap.entries()) {
      result[sku] = advice;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  } catch (error) {
    console.error("Error computing bulk restock advice:", error);
    return NextResponse.json(
      { error: "Failed to compute bulk restock advice" },
      { status: 500 },
    );
  }
}
