"use client";

import {
  StockVsSalesChart,
  type StockHistoryPoint,
} from "@/components/SalesChart";
import {
  getLegacyAliasesFor,
  isLegacyAliasSku,
  resolveCanonicalSku,
} from "@/lib/productAliases";
import {
  useInventory,
  useProducts,
  useRestockAdvice,
  useStockHistory,
  useSuppliers,
  useTransactions,
} from "@/lib/useStorehubApi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

interface PageProps {
  params: Promise<{
    sku: string;
  }>;
}

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: number;
  cost: number;
}

interface InventoryItem {
  productId: string;
  quantityOnHand: number;
  warningStock?: number;
  idealStock?: number;
}

export default function ProductDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const { sku } = use(params);
  const decodedSku = decodeURIComponent(sku);

  // If this SKU has been superseded/merged into another (see
  // lib/productAliases.ts), redirect straight to the canonical SKU's page
  // instead of showing stale, now-merged data under the old code.
  useEffect(() => {
    if (isLegacyAliasSku(decodedSku)) {
      router.replace(
        `/products/${encodeURIComponent(resolveCanonicalSku(decodedSku))}`,
      );
    }
  }, [decodedSku, router]);

  // Quick-jump search state — lets staff hop to any other product without
  // going back to /products.
  const [jumpQuery, setJumpQuery] = useState("");
  const [jumpOpen, setJumpOpen] = useState(false);

  // Get storeId from environment variable
  const storeId = process.env.NEXT_PUBLIC_STOREHUB_STORE_ID || "";

  // Fetch data from API
  const {
    data: productsData,
    loading: productsLoading,
    error: productsError,
  } = useProducts();
  const {
    data: transactionsData,
    loading: transactionsLoading,
    error: transactionsError,
  } = useTransactions();
  const { data: inventoryData } = useInventory(storeId);
  const { data: restockAdviceData } = useRestockAdvice(decodedSku, storeId);
  const { data: stockHistoryData } = useStockHistory(decodedSku);
  const { data: suppliersData } = useSuppliers();

  // Get product from API data
  const apiProduct = useMemo(() => {
    if (!productsData) return null;
    return (productsData as ApiProduct[]).find(
      (p) => String(p.sku) === decodedSku,
    );
  }, [productsData, decodedSku]);

  // Full product list sorted by name — powers Prev/Next navigation and the
  // quick-jump search, so staff can hop between products without going back
  // to /products.
  const sortedProductList = useMemo(() => {
    if (!productsData) return [] as ApiProduct[];
    return (productsData as ApiProduct[])
      .filter((p) => p.sku)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productsData]);

  const currentIndex = useMemo(
    () => sortedProductList.findIndex((p) => String(p.sku) === decodedSku),
    [sortedProductList, decodedSku],
  );

  const prevProduct =
    currentIndex > 0 ? sortedProductList[currentIndex - 1] : null;
  const nextProduct =
    currentIndex >= 0 && currentIndex < sortedProductList.length - 1
      ? sortedProductList[currentIndex + 1]
      : null;

  const jumpMatches = useMemo(() => {
    const term = jumpQuery.trim().toLowerCase();
    if (!term) return [];
    return sortedProductList
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          String(p.sku).toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [jumpQuery, sortedProductList]);

  const goToProduct = (targetSku: string) => {
    setJumpQuery("");
    setJumpOpen(false);
    router.push(`/products/${encodeURIComponent(targetSku)}`);
  };

  // Get inventory from API — folds in any legacy/superseded SKU's remaining
  // stock (converted by its unit multiplier — see lib/productAliases.ts) so
  // the displayed "Current Stock" reflects the true combined total instead
  // of missing what's still sitting under an old SKU.
  const inventory = useMemo(() => {
    if (!inventoryData || !apiProduct || !productsData) return null;
    const items = inventoryData as InventoryItem[];
    const base = items.find((inv) => inv.productId === apiProduct.id);
    if (!base) return null;

    let quantityOnHand = base.quantityOnHand;
    for (const alias of getLegacyAliasesFor(decodedSku)) {
      const legacyProduct = (productsData as ApiProduct[]).find(
        (p) => String(p.sku) === alias.legacySku,
      );
      if (!legacyProduct) continue;
      const legacyInv = items.find((inv) => inv.productId === legacyProduct.id);
      quantityOnHand +=
        (legacyInv?.quantityOnHand ?? 0) * alias.unitsPerLegacyUnit;
    }

    return { ...base, quantityOnHand };
  }, [inventoryData, apiProduct, productsData, decodedSku]);

  // Get product metrics from API transactions
  const productMetrics = useMemo(() => {
    if (!apiProduct || !transactionsData || !Array.isArray(transactionsData))
      return null;

    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let transactionCount = 0;
    let lastTransactionDate: string | null = null;
    const monthlyData = new Map<
      string,
      { qty: number; revenue: number; cost: number }
    >();

    const cost = Number(apiProduct.cost) || 0;

    // Fold in any legacy/superseded SKU (see lib/productAliases.ts) so its
    // sales history counts toward this product's totals, converted to this
    // SKU's unit size (e.g. a discontinued 6-pack's sales become
    // piece-equivalent units).
    const legacySkuMultipliers = new Map(
      getLegacyAliasesFor(decodedSku).map((a) => [
        a.legacySku,
        a.unitsPerLegacyUnit,
      ]),
    );

    // Process API transactions
    for (const tx of transactionsData) {
      // Only count completed transactions
      if (tx.status !== "completed" || !tx.items) {
        continue;
      }

      const txDate = new Date(tx.timestamp);

      for (const item of tx.items) {
        // Match by SKU — either this exact SKU, or a legacy SKU that's
        // been merged into it (scaled by its unit multiplier).
        const itemSku = String(item.sku);
        const isExactMatch = itemSku === decodedSku;
        const legacyMultiplier = legacySkuMultipliers.get(itemSku);
        if (isExactMatch || legacyMultiplier !== undefined) {
          const rawQuantity = item.quantity || 0;
          const quantity = isExactMatch
            ? rawQuantity
            : rawQuantity * (legacyMultiplier || 1);
          const itemTotal = item.totalPrice || 0;

          totalQuantity += quantity;
          totalRevenue += itemTotal;
          totalCost += cost * quantity;
          transactionCount += 1;

          // Track last transaction
          if (!lastTransactionDate || new Date(lastTransactionDate) < txDate) {
            lastTransactionDate = tx.timestamp;
          }

          // Monthly breakdown
          const month =
            txDate.getFullYear() +
            "-" +
            String(txDate.getMonth() + 1).padStart(2, "0");
          if (!monthlyData.has(month)) {
            monthlyData.set(month, { qty: 0, revenue: 0, cost: 0 });
          }
          const current = monthlyData.get(month)!;
          current.qty += quantity;
          current.revenue += itemTotal;
          current.cost += cost * quantity;
        }
      }
    }

    const profit = totalRevenue - totalCost;
    const margin =
      totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : "0.0";
    const avgPrice =
      totalQuantity > 0 ? (totalRevenue / totalQuantity).toFixed(2) : "0.00";

    // Format last transaction date
    let lastTransactionFormatted = null;
    if (lastTransactionDate) {
      const txDate = new Date(lastTransactionDate);
      const today = new Date();
      const malaysiaOffset = 8 * 60;
      const utcOffset = today.getTimezoneOffset();
      const offsetDifference = malaysiaOffset + utcOffset;
      const malaysiaNow = new Date(
        today.getTime() + offsetDifference * 60 * 1000,
      );
      malaysiaNow.setHours(0, 0, 0, 0);

      const txDateLocal = new Date(
        txDate.getTime() + offsetDifference * 60 * 1000,
      );
      txDateLocal.setHours(0, 0, 0, 0);

      const daysAgo = Math.floor(
        (malaysiaNow.getTime() - txDateLocal.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysAgo === 0) {
        lastTransactionFormatted = "today";
      } else if (daysAgo === 1) {
        lastTransactionFormatted = "1 day ago";
      } else if (daysAgo > 1) {
        lastTransactionFormatted = `${daysAgo} days ago`;
      } else {
        lastTransactionFormatted = "future";
      }
    }

    return {
      totalQuantity,
      totalRevenue,
      totalCost,
      profit,
      margin,
      transactionCount,
      avgPrice,
      lastTransactionDate: lastTransactionFormatted,
      monthlyData: Array.from(monthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          ...data,
        })),
    };
  }, [apiProduct, decodedSku, transactionsData]);

  // DB-backed restocking advice (see lib/restockingLogic.ts). Uses stock
  // snapshots captured automatically at shift clock-in/out; falls back to a
  // legacy transaction-average estimate server-side until enough snapshots
  // exist for this SKU.
  const restockingSuggestion = restockAdviceData as {
    shouldRestock: boolean;
    quantity: number;
    urgency: "critical" | "high" | "medium" | "low" | "none";
    daysUntilStockout?: number;
    reason: string;
    reorderPoint: number;
    targetStock: number;
    leadTimeDays: number;
    coverageDays: number;
    dataSource: "snapshots" | "estimated";
    snapshotCount: number;
  } | null;

  // Build a full DAILY stock-on-hand curve for the Stock Level vs Sales
  // chart, using transactions to fill in every day — not just the sparse
  // days that happen to have a captured clock-in/out snapshot.
  //
  // How: anchor on the most recent real snapshot (ground truth), then walk
  // backward day-by-day: stock(day) = stock(day+1) - restocked(day+1) + sold(day+1)
  // i.e. "undo" that day's net change to recover the previous day's ending
  // stock. Restock deltas (from purchase orders + auto-detected shift
  // stocking events) are used quietly here purely to keep the reconstruction
  // accurate — they are not drawn as a separate series, per the simplified
  // "Stock on Hand vs Sales" view.
  const stockChartData = useMemo<StockHistoryPoint[]>(() => {
    const history = stockHistoryData as {
      snapshots: {
        sku: string;
        quantity: string;
        event_type: "clock_in" | "clock_out" | "manual";
        captured_at: string;
      }[];
      restockEvents: {
        sku: string;
        quantity: string;
        source: string;
        occurred_at: string;
      }[];
    } | null;

    if (!history || history.snapshots.length === 0) return [];

    const formatLabel = (day: string) => {
      const d = new Date(`${day}T00:00:00Z`);
      return d.toLocaleDateString("en-MY", { month: "short", day: "numeric" });
    };

    // Daily sold quantity for this SKU, from StoreHub transactions. Also
    // folds in any legacy/superseded SKU's sales (see
    // lib/productAliases.ts), scaled by its unit multiplier, so the chart
    // reflects one continuous sales history across the SKU merge.
    const legacyMultipliersForChart = new Map(
      getLegacyAliasesFor(decodedSku).map((a) => [
        a.legacySku,
        a.unitsPerLegacyUnit,
      ]),
    );
    const soldByDay = new Map<string, number>();
    if (Array.isArray(transactionsData)) {
      for (const tx of transactionsData) {
        if (tx.status !== "completed" || !tx.items) continue;
        const day = new Date(tx.timestamp).toISOString().slice(0, 10);
        let qtyForSku = 0;
        for (const item of tx.items) {
          const itemSku = String(item.sku);
          if (itemSku === decodedSku) {
            qtyForSku += item.quantity || 0;
          } else if (legacyMultipliersForChart.has(itemSku)) {
            qtyForSku +=
              (item.quantity || 0) *
              (legacyMultipliersForChart.get(itemSku) || 1);
          }
        }
        if (qtyForSku > 0) {
          soldByDay.set(day, (soldByDay.get(day) || 0) + qtyForSku);
        }
      }
    }

    // Daily net restock delta (purchase orders, stock takes/returns, and
    // auto-detected shift stocking events) — used only for reconstruction math.
    const restockedByDay = new Map<string, number>();
    for (const r of history.restockEvents) {
      const day = new Date(r.occurred_at).toISOString().slice(0, 10);
      restockedByDay.set(
        day,
        (restockedByDay.get(day) || 0) + Number(r.quantity),
      );
    }

    // Real snapshot values per day. The API merges snapshots from this SKU
    // AND any legacy/superseded SKU (see lib/productAliases.ts) already
    // scaled to this SKU's unit size — but they're still separate physical
    // SKU codes, so on any given day the TRUE combined on-hand stock is the
    // SUM of each SKU's most-recently-known value, not just whichever
    // SKU's snapshot happens to land on that exact day. Naively overwriting
    // a single map with the last-seen snapshot (regardless of which SKU it
    // came from) was producing wrong/jumpy combined totals whenever both
    // SKUs had snapshots on the same day, or once the legacy SKU stopped
    // reporting after being discontinued.
    const snapshotsBySku = new Map<string, { day: string; qty: number }[]>();
    for (const s of history.snapshots) {
      const day = new Date(s.captured_at).toISOString().slice(0, 10);
      const list = snapshotsBySku.get(s.sku) || [];
      list.push({ day, qty: Number(s.quantity) });
      snapshotsBySku.set(s.sku, list);
    }
    for (const list of snapshotsBySku.values()) {
      list.sort((a, b) => a.day.localeCompare(b.day));
    }

    // Forward-fill: latest known quantity for `sku` at or before `day`.
    const valueAsOf = (sku: string, day: string): number | undefined => {
      const list = snapshotsBySku.get(sku);
      if (!list) return undefined;
      let result: number | undefined;
      for (const entry of list) {
        if (entry.day > day) break;
        result = entry.qty;
      }
      return result;
    };

    // A day counts as a "real snapshot" checkpoint if ANY sku has one that
    // day; its combined value is the sum of every sku's forward-filled
    // quantity as of that day.
    const allSkusWithSnapshots = Array.from(snapshotsBySku.keys());
    const checkpointDays = new Set(
      history.snapshots.map((s) =>
        new Date(s.captured_at).toISOString().slice(0, 10),
      ),
    );
    const realStockByDay = new Map<string, number>();
    for (const day of checkpointDays) {
      let total = 0;
      let hasAny = false;
      for (const sku of allSkusWithSnapshots) {
        const val = valueAsOf(sku, day);
        if (val !== undefined) {
          total += val;
          hasAny = true;
        }
      }
      if (hasAny) realStockByDay.set(day, total);
    }

    // Anchor = most recent real snapshot day.
    const sortedSnapshotDays = Array.from(realStockByDay.keys()).sort();
    const anchorDay = sortedSnapshotDays[sortedSnapshotDays.length - 1];
    const anchorStock = realStockByDay.get(anchorDay)!;

    // Earliest day we have ANY signal for (sales, restocks, or a snapshot) —
    // that's how far back we reconstruct the curve.
    const allDays = new Set<string>([
      ...soldByDay.keys(),
      ...restockedByDay.keys(),
      ...realStockByDay.keys(),
    ]);
    const earliestDay = Array.from(allDays).sort()[0] || anchorDay;

    // Walk every calendar day from earliest → anchor, reconstructing stock
    // backward from the anchor. Prefer a real snapshot value when one exists
    // for that exact day (re-anchors / corrects drift).
    const dayStock = new Map<string, number>();
    dayStock.set(anchorDay, anchorStock);

    const oneDayMs = 24 * 60 * 60 * 1000;
    let cursor = new Date(`${anchorDay}T00:00:00Z`).getTime();
    const earliestTime = new Date(`${earliestDay}T00:00:00Z`).getTime();
    let runningStock = anchorStock;

    while (cursor > earliestTime) {
      const currentDay = new Date(cursor).toISOString().slice(0, 10);
      const prevCursor = cursor - oneDayMs;
      const prevDay = new Date(prevCursor).toISOString().slice(0, 10);

      // Undo currentDay's net change to get prevDay's ending stock.
      const soldThatDay = soldByDay.get(currentDay) || 0;
      const restockedThatDay = restockedByDay.get(currentDay) || 0;
      runningStock = runningStock - restockedThatDay + soldThatDay;

      // Prefer a real snapshot if one exists for prevDay (corrects drift).
      const real = realStockByDay.get(prevDay);
      if (real !== undefined) runningStock = real;

      dayStock.set(prevDay, runningStock);
      cursor = prevCursor;
    }

    const points: StockHistoryPoint[] = Array.from(allDays)
      .sort()
      .filter((day) => dayStock.has(day) || soldByDay.has(day))
      .map((day) => ({
        label: formatLabel(day),
        timestamp: new Date(`${day}T00:00:00Z`).getTime(),
        stock: dayStock.get(day) ?? null,
        sold: soldByDay.get(day) ?? null,
        isActualSnapshot: realStockByDay.has(day),
      }));

    // Only display the most recent 30 days — the reconstruction above still
    // walks the FULL history internally (needed for an accurate running
    // stock total), we just trim what's rendered.
    const cutoff = Date.now() - 30 * oneDayMs;
    return points.filter((p) => p.timestamp >= cutoff);
  }, [stockHistoryData, transactionsData, decodedSku]);

  if (productsLoading || transactionsLoading) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (productsError || transactionsError) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">
            Couldn&apos;t load this product
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            {(productsError || transactionsError)?.message ||
              "Something went wrong while fetching product data. Please try again."}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (!apiProduct) {
    return (
      <div className="w-full bg-white min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <button
            onClick={() => router.back()}
            className="mb-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            ← Back
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Product Not Found
            </h1>
            <p className="text-gray-600">
              The product with SKU &ldquo;{decodedSku}&rdquo; could not be
              found.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString("en-MY");
  };

  const supplierName =
    (suppliersData && suppliersData[decodedSku]) || "Unknown";

  const isLowStock =
    inventory?.warningStock !== undefined &&
    inventory?.quantityOnHand !== undefined &&
    inventory.quantityOnHand <= inventory.warningStock;

  const stockPercent =
    inventory?.idealStock && inventory.idealStock > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((inventory.quantityOnHand ?? 0) / inventory.idealStock) * 100,
          ),
        )
      : null;

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* Sticky Header — offset below the site-wide Header (see
          --app-header-height in components/Header.tsx) so the two don't
          collide/overlap on scroll */}
      <div
        className="sticky z-20 bg-white border-b border-gray-200 shadow-sm"
        style={{ top: "var(--app-header-height, 64px)" }}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          <button
            onClick={() => router.back()}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
          >
            ← Back
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate flex items-center gap-2">
              {apiProduct.name}
              {isLowStock && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
                  LOW STOCK
                </span>
              )}
            </h1>
            <button
              onClick={() => {
                if (apiProduct.sku) {
                  navigator.clipboard?.writeText(apiProduct.sku);
                }
              }}
              title="Copy SKU"
              className="text-xs md:text-sm text-gray-600 hover:text-gray-900 truncate"
            >
              SKU: {apiProduct.sku} 📋
            </button>
          </div>

          {/* Prev / Next quick nav — cycles alphabetically through all products */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                prevProduct && goToProduct(String(prevProduct.sku))
              }
              disabled={!prevProduct}
              title={
                prevProduct
                  ? `Previous: ${prevProduct.name}`
                  : "No previous product"
              }
              className="px-2.5 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <button
              onClick={() =>
                nextProduct && goToProduct(String(nextProduct.sku))
              }
              disabled={!nextProduct}
              title={
                nextProduct ? `Next: ${nextProduct.name}` : "No next product"
              }
              className="px-2.5 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>

          {/* Quick-jump search — hop to any other product without leaving this page */}
          <div className="relative w-40 sm:w-56 md:w-72 shrink-0">
            <input
              type="text"
              value={jumpQuery}
              onChange={(e) => {
                setJumpQuery(e.target.value);
                setJumpOpen(true);
              }}
              onFocus={() => setJumpOpen(true)}
              onBlur={() => setTimeout(() => setJumpOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && jumpMatches.length > 0) {
                  goToProduct(String(jumpMatches[0].sku));
                } else if (e.key === "Escape") {
                  setJumpOpen(false);
                }
              }}
              placeholder="Jump to product..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {jumpOpen && jumpMatches.length > 0 && (
              <div className="absolute right-0 mt-1 w-64 sm:w-80 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                {jumpMatches.map((p) => (
                  <button
                    key={p.sku}
                    onMouseDown={() => goToProduct(String(p.sku))}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {p.sku}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {jumpOpen && jumpQuery.trim() && jumpMatches.length === 0 && (
              <div className="absolute right-0 mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-30 px-3 py-2 text-sm text-gray-500">
                No matches
              </div>
            )}
          </div>
        </div>

        {/* Mobile Prev/Next row (hidden on sm+, shown alongside search above) */}
        <div className="sm:hidden flex items-center justify-between gap-2 px-4 pb-3">
          <button
            onClick={() => prevProduct && goToProduct(String(prevProduct.sku))}
            disabled={!prevProduct}
            className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed truncate"
          >
            ← {prevProduct ? prevProduct.name : "Prev"}
          </button>
          <button
            onClick={() => nextProduct && goToProduct(String(nextProduct.sku))}
            disabled={!nextProduct}
            className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed truncate"
          >
            {nextProduct ? nextProduct.name : "Next"} →
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6">
        {/* Product Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Link
            href={`/products?category=${encodeURIComponent(apiProduct.category || "Uncategorized")}`}
            className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <p className="text-gray-600 text-xs font-medium mb-1">Category</p>
            <p className="text-sm md:text-base font-semibold text-blue-700 truncate">
              {apiProduct.category || "Uncategorized"}
            </p>
          </Link>

          <Link
            href={`/products?supplier=${encodeURIComponent(supplierName)}`}
            className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 hover:border-green-300 hover:shadow-md transition-all"
          >
            <p className="text-gray-600 text-xs font-medium mb-1">Supplier</p>
            <p className="text-sm md:text-base font-semibold text-green-700 truncate">
              {supplierName}
            </p>
          </Link>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-1">Price</p>
            <p className="text-base md:text-lg font-bold text-blue-600">
              RM {formatCurrency(Number(apiProduct.unitPrice) || 0)}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-1">Cost</p>
            <p className="text-base md:text-lg font-bold text-red-600">
              RM {formatCurrency(Number(apiProduct.cost) || 0)}
            </p>
          </div>
        </div>

        {/* Stock & Performance Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-2">
              Current Stock
            </p>
            <p
              className={`text-2xl md:text-3xl font-bold ${isLowStock ? "text-red-600" : "text-gray-900"}`}
            >
              {inventory?.quantityOnHand ?? "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">units on hand</p>
            {stockPercent !== null && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isLowStock ? "bg-red-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${stockPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Ideal: {inventory?.idealStock}
                  {inventory?.warningStock !== undefined &&
                    ` • Warning: ${inventory.warningStock}`}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-2">Total Sold</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {productMetrics
                ? formatNumber(productMetrics.totalQuantity)
                : "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">units</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-2">
              Total Revenue
            </p>
            <p className="text-lg md:text-2xl font-bold text-green-600">
              RM{" "}
              {productMetrics
                ? formatCurrency(productMetrics.totalRevenue)
                : "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">net sales</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-2">Margin</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">
              {productMetrics ? `${productMetrics.margin}%` : "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">profit margin</p>
          </div>
        </div>

        {/* Restocking Alert */}
        {restockingSuggestion && (
          <div
            className={`mb-6 rounded-lg p-4 md:p-5 border-l-4 ${
              restockingSuggestion.urgency === "critical"
                ? "bg-red-50 border-red-500"
                : restockingSuggestion.urgency === "high"
                  ? "bg-orange-50 border-orange-500"
                  : restockingSuggestion.urgency === "medium"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-blue-50 border-blue-500"
            }`}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm md:text-base font-bold mb-1 ${
                    restockingSuggestion.urgency === "critical"
                      ? "text-red-700"
                      : restockingSuggestion.urgency === "high"
                        ? "text-orange-700"
                        : restockingSuggestion.urgency === "medium"
                          ? "text-yellow-700"
                          : "text-blue-700"
                  }`}
                >
                  📦 {restockingSuggestion.reason || "Stock healthy"}
                </div>
                <div className="text-xs md:text-sm text-gray-600">
                  Suggest restocking{" "}
                  <span className="font-semibold">
                    {restockingSuggestion.quantity} units
                  </span>
                  {restockingSuggestion.daysUntilStockout !== undefined && (
                    <>
                      {" "}
                      (~{restockingSuggestion.daysUntilStockout} days of cover
                      left)
                    </>
                  )}
                </div>
                {restockingSuggestion.reorderPoint > 0 && (
                  <div className="text-[11px] text-gray-400 mt-1">
                    Reorder point: {restockingSuggestion.reorderPoint} units •
                    Target after restock: {restockingSuggestion.targetStock}{" "}
                    units • Est. lead time: {restockingSuggestion.leadTimeDays}{" "}
                    days
                  </div>
                )}
                <div className="text-[11px] text-gray-400 mt-1">
                  {restockingSuggestion.dataSource === "snapshots"
                    ? `Based on ${restockingSuggestion.snapshotCount} shift stock snapshots`
                    : "Estimated from sales history — will improve as shift stock snapshots accumulate"}
                </div>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                  restockingSuggestion.urgency === "critical"
                    ? "bg-red-100 text-red-700"
                    : restockingSuggestion.urgency === "high"
                      ? "bg-orange-100 text-orange-700"
                      : restockingSuggestion.urgency === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                }`}
              >
                {restockingSuggestion.urgency.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Stock Level vs Sales Chart */}
        {stockChartData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 mb-6">
            <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">
              Stock on Hand vs Sales (Last 30 Days)
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Blue line (left axis) = daily stock on hand — bold dots are real
              captured snapshots, light dots are reconstructed backward from
              sales. Red bars (right axis) = units sold that day. Separate
              scales keep fast-moving items readable even when stock count is
              much larger than daily sales. A steady decline shows normal
              depletion; a jump back up reflects a real restock captured at a
              shift clock-in/out.
            </p>
            <StockVsSalesChart data={stockChartData} />
          </div>
        )}
        {stockChartData.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 mb-6 text-center text-sm text-gray-500">
            No stock snapshot history yet for this SKU. Snapshots are captured
            automatically at every staff clock-in/out — check back after the
            next shift.
          </div>
        )}

        {/* Financial Breakdown */}
        {productMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
              <p className="text-gray-600 text-xs font-medium mb-2">
                Total Cost
              </p>
              <p className="text-lg md:text-xl font-bold text-red-600">
                RM {formatCurrency(productMetrics.totalCost)}
              </p>
              <p className="text-xs text-gray-500 mt-1">COGS</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
              <p className="text-gray-600 text-xs font-medium mb-2">
                Total Profit
              </p>
              <p className="text-lg md:text-xl font-bold text-green-600">
                RM {formatCurrency(productMetrics.profit)}
              </p>
              <p className="text-xs text-gray-500 mt-1">net profit</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
              <p className="text-gray-600 text-xs font-medium mb-2">
                Avg Price
              </p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                RM {productMetrics.avgPrice}
              </p>
              <p className="text-xs text-gray-500 mt-1">per unit</p>
            </div>
          </div>
        )}

        {/* Last Transaction */}
        {productMetrics?.lastTransactionDate && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs font-medium mb-1">
                  Last Transaction
                </p>
                <p className="text-base md:text-lg font-semibold text-gray-900">
                  {productMetrics.lastTransactionDate}
                </p>
              </div>
              <div className="text-2xl">🕐</div>
            </div>
          </div>
        )}

        {/* Monthly Breakdown Table */}
        {productMetrics && productMetrics.monthlyData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm md:text-base font-bold text-gray-900">
                Monthly Performance
              </h3>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 md:px-6 py-3 font-semibold text-gray-700">
                      Month
                    </th>
                    <th className="text-right px-4 md:px-6 py-3 font-semibold text-gray-700">
                      Units Sold
                    </th>
                    <th className="text-right px-4 md:px-6 py-3 font-semibold text-gray-700">
                      Revenue
                    </th>
                    <th className="text-right px-4 md:px-6 py-3 font-semibold text-gray-700">
                      Cost
                    </th>
                    <th className="text-right px-4 md:px-6 py-3 font-semibold text-gray-700">
                      Profit
                    </th>
                    <th className="text-right px-4 md:px-6 py-3 font-semibold text-gray-700">
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productMetrics.monthlyData.map(
                    ({ month, qty, revenue, cost }) => {
                      const profit = revenue - cost;
                      const margin =
                        revenue > 0
                          ? ((profit / revenue) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr key={month} className="hover:bg-gray-50">
                          <td className="text-left px-4 md:px-6 py-3 font-medium text-gray-900">
                            {month}
                          </td>
                          <td className="text-right px-4 md:px-6 py-3 text-gray-700">
                            {qty}
                          </td>
                          <td className="text-right px-4 md:px-6 py-3 text-gray-700">
                            RM {formatCurrency(revenue)}
                          </td>
                          <td className="text-right px-4 md:px-6 py-3 text-gray-700">
                            RM {formatCurrency(cost)}
                          </td>
                          <td className="text-right px-4 md:px-6 py-3 font-medium text-green-600">
                            RM {formatCurrency(profit)}
                          </td>
                          <td className="text-right px-4 md:px-6 py-3 text-gray-600">
                            {margin}%
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-gray-100">
              {productMetrics.monthlyData.map(
                ({ month, qty, revenue, cost }) => {
                  const profit = revenue - cost;
                  const margin =
                    revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={month} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-gray-900">{month}</p>
                        <p className="text-sm font-bold text-green-600">
                          RM {formatCurrency(profit)}
                        </p>
                      </div>
                      <div className="space-y-1.5 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Units:</span>
                          <span className="font-medium text-gray-900">
                            {qty}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Revenue:</span>
                          <span className="font-medium text-gray-900">
                            RM {formatCurrency(revenue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cost:</span>
                          <span className="font-medium text-gray-900">
                            RM {formatCurrency(cost)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-gray-200">
                          <span>Margin:</span>
                          <span className="font-medium text-gray-900">
                            {margin}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
