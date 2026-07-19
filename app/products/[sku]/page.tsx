"use client";

import {
  StockVsSalesChart,
  type StockHistoryPoint,
} from "@/components/SalesChart";
import {
  useInventory,
  useProducts,
  useRestockAdvice,
  useStockHistory,
  useTransactions,
} from "@/lib/useStorehubApi";
import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import products from "../../../data/products";

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

  // Get storeId from environment variable
  const storeId = process.env.NEXT_PUBLIC_STOREHUB_STORE_ID || "";

  // Fetch data from API
  const { data: productsData, loading: productsLoading } = useProducts();
  const { data: transactionsData, loading: transactionsLoading } =
    useTransactions();
  const { data: inventoryData } = useInventory(storeId);
  const { data: restockAdviceData } = useRestockAdvice(decodedSku, storeId);
  const { data: stockHistoryData } = useStockHistory(decodedSku);

  // Get product from CSV for supplier info
  const csvProduct = useMemo(() => {
    return products.find((p) => String(p.SKU) === decodedSku);
  }, [decodedSku]);

  // Get product from API data
  const apiProduct = useMemo(() => {
    if (!productsData) return null;
    return (productsData as ApiProduct[]).find(
      (p) => String(p.sku) === decodedSku,
    );
  }, [productsData, decodedSku]);

  // Get inventory from API
  const inventory = useMemo(() => {
    if (!inventoryData || !apiProduct) return null;
    return (inventoryData as InventoryItem[]).find(
      (inv) => inv.productId === apiProduct.id,
    );
  }, [inventoryData, apiProduct]);

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

    // Process API transactions
    for (const tx of transactionsData) {
      // Only count completed transactions
      if (tx.status !== "completed" || !tx.items) {
        continue;
      }

      const txDate = new Date(tx.timestamp);

      for (const item of tx.items) {
        // Match by SKU
        if (String(item.sku) === decodedSku) {
          const quantity = item.quantity || 0;
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
        quantity: string;
        event_type: "clock_in" | "clock_out" | "manual";
        captured_at: string;
      }[];
      restockEvents: {
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

    // Daily sold quantity for this SKU, from StoreHub transactions.
    const soldByDay = new Map<string, number>();
    if (Array.isArray(transactionsData)) {
      for (const tx of transactionsData) {
        if (tx.status !== "completed" || !tx.items) continue;
        const day = new Date(tx.timestamp).toISOString().slice(0, 10);
        let qtyForSku = 0;
        for (const item of tx.items) {
          if (String(item.sku) === decodedSku) qtyForSku += item.quantity || 0;
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

    // Real snapshot values per day (ground truth points — keep latest if
    // multiple snapshots landed on the same day).
    const realStockByDay = new Map<string, number>();
    for (const s of history.snapshots) {
      const d = new Date(s.captured_at);
      const day = d.toISOString().slice(0, 10);
      realStockByDay.set(day, Number(s.quantity)); // relies on snapshots being pre-sorted ascending
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

  const supplierName = csvProduct?.Supplier || "Unknown";

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">
              {apiProduct.name}
            </h1>
            <p className="text-xs md:text-sm text-gray-600 truncate">
              SKU: {apiProduct.sku}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6">
        {/* Product Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-1">Category</p>
            <p className="text-sm md:text-base font-semibold text-gray-900 truncate">
              {apiProduct.category || "Uncategorized"}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
            <p className="text-gray-600 text-xs font-medium mb-1">Supplier</p>
            <p className="text-sm md:text-base font-semibold text-gray-900 truncate">
              {supplierName}
            </p>
          </div>

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
            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {inventory?.quantityOnHand ?? "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">units on hand</p>
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
                      (will reach warning in ~
                      {restockingSuggestion.daysUntilStockout} days)
                    </>
                  )}
                </div>
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
