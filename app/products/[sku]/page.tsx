"use client";

import {
  useInventory,
  useProducts,
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

    // Calculate restocking suggestion
    let restockingSuggestion: {
      shouldRestock: boolean;
      quantity: number;
      urgency: "critical" | "high" | "medium" | "low" | "none";
      daysUntilStockout?: number;
      reason: string;
    } | null = null;

    if (inventory) {
      const currentStock = inventory.quantityOnHand;
      const warningLevel = inventory.warningStock || 0;
      const idealLevel = inventory.idealStock || warningLevel * 2;

      // Calculate daily sales velocity from last 30 days
      const last30Days = Array.from(monthlyData.values());
      const dailySalesVelocity =
        last30Days.length > 0
          ? last30Days.reduce((sum, d) => sum + d.qty, 0) / 30
          : 0;

      let urgency: "critical" | "high" | "medium" | "low" | "none" = "none";
      let daysUntilStockout: number | undefined;
      let reason = "";

      // Determine urgency based on current stock vs warning level
      if (currentStock <= warningLevel / 2) {
        urgency = "critical";
        reason = "Stock critically low";
      } else if (currentStock < warningLevel) {
        urgency = "high";
        reason = "Stock below warning level";
      } else if (dailySalesVelocity > 0) {
        // Estimate days until warning level at current velocity
        const stockAboveWarning = currentStock - warningLevel;
        daysUntilStockout = Math.ceil(stockAboveWarning / dailySalesVelocity);

        if (daysUntilStockout <= 7) {
          urgency = "medium";
          reason = `Will reach warning level in ~${daysUntilStockout} days`;
        } else if (daysUntilStockout <= 14) {
          urgency = "low";
          reason = `Will reach warning level in ~${daysUntilStockout} days`;
        }
      }

      // Calculate restocking quantity (restock to ideal level if defined)
      const restockQuantity = Math.max(0, idealLevel - currentStock);

      restockingSuggestion = {
        shouldRestock: urgency !== "none" && restockQuantity > 0,
        quantity: Math.ceil(restockQuantity),
        urgency,
        daysUntilStockout,
        reason,
      };
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
      restockingSuggestion,
      monthlyData: Array.from(monthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          ...data,
        })),
    };
  }, [apiProduct, decodedSku, transactionsData, inventory]);

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
    <div className="w-full bg-white min-h-screen">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 py-12 border-b border-gray-200">
        <button
          onClick={() => router.back()}
          className="mb-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          ← Back
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              {apiProduct.name}
            </h1>
            <p className="text-lg text-gray-600">SKU: {apiProduct.sku}</p>
          </div>

          <div className="md:text-right">
            <div className="text-sm text-gray-500 mb-2">Category</div>
            <p className="text-xl font-semibold text-slate-900">
              {apiProduct.category || "Uncategorized"}
            </p>
          </div>

          <div className="md:text-right">
            <div className="text-sm text-gray-500 mb-2">Supplier</div>
            <p className="text-xl font-semibold text-slate-900">
              {supplierName}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Product Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="rounded-lg border bg-blue-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">Price</div>
            <div className="text-2xl font-bold text-blue-700">
              RM {formatCurrency(Number(apiProduct.unitPrice) || 0)}
            </div>
          </div>

          <div className="rounded-lg border bg-red-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">Cost</div>
            <div className="text-2xl font-bold text-red-700">
              RM {formatCurrency(Number(apiProduct.cost) || 0)}
            </div>
          </div>

          <div className="rounded-lg border bg-green-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Unit Margin
            </div>
            <div className="text-2xl font-bold text-green-700">
              RM{" "}
              {formatCurrency(
                (Number(apiProduct.unitPrice) || 0) -
                  (Number(apiProduct.cost) || 0),
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-purple-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">Stock</div>
            <div className="text-2xl font-bold text-purple-700">
              {inventory?.quantityOnHand ?? "—"}
            </div>
            <div className="text-xs text-gray-500 mt-2">units</div>
          </div>

          <div className="rounded-lg border bg-orange-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Last Transaction
            </div>
            <div className="text-2xl font-bold text-orange-700">
              {productMetrics?.lastTransactionDate ?? "—"}
            </div>
          </div>
        </div>

        {/* Restocking Suggestion Alert */}
        {productMetrics?.restockingSuggestion && (
          <div
            className={`mb-8 rounded-lg p-6 border-l-4 ${
              productMetrics.restockingSuggestion.urgency === "critical"
                ? "bg-red-50 border-red-500"
                : productMetrics.restockingSuggestion.urgency === "high"
                  ? "bg-orange-50 border-orange-500"
                  : productMetrics.restockingSuggestion.urgency === "medium"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-blue-50 border-blue-500"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={`text-lg font-semibold mb-2 ${
                    productMetrics.restockingSuggestion.urgency === "critical"
                      ? "text-red-700"
                      : productMetrics.restockingSuggestion.urgency === "high"
                        ? "text-orange-700"
                        : productMetrics.restockingSuggestion.urgency ===
                            "medium"
                          ? "text-yellow-700"
                          : "text-blue-700"
                  }`}
                >
                  📦 Restocking Suggestion
                </div>
                <p className="text-gray-700 mb-3">
                  {productMetrics.restockingSuggestion.reason}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Quantity to Restock
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {productMetrics.restockingSuggestion.quantity} units
                    </p>
                  </div>
                  {productMetrics.restockingSuggestion.daysUntilStockout !==
                    undefined && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        Days Until Warning Level
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        ~{productMetrics.restockingSuggestion.daysUntilStockout}{" "}
                        days
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div
                className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap ${
                  productMetrics.restockingSuggestion.urgency === "critical"
                    ? "bg-red-100 text-red-700"
                    : productMetrics.restockingSuggestion.urgency === "high"
                      ? "bg-orange-100 text-orange-700"
                      : productMetrics.restockingSuggestion.urgency === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                }`}
              >
                {productMetrics.restockingSuggestion.urgency.toUpperCase()}{" "}
                PRIORITY
              </div>
            </div>
          </div>
        )}

        {/* Sales Performance */}
        {productMetrics && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Sales Performance
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    Total Sold
                  </div>
                  <div className="text-3xl font-bold text-slate-900">
                    {formatNumber(productMetrics.totalQuantity)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">units</div>
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    Total Revenue
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    RM {formatCurrency(productMetrics.totalRevenue)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">net sales</div>
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    Total Cost
                  </div>
                  <div className="text-3xl font-bold text-red-600">
                    RM {formatCurrency(productMetrics.totalCost)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">COGS</div>
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    Total Profit
                  </div>
                  <div className="text-3xl font-bold text-green-600">
                    RM {formatCurrency(productMetrics.profit)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {productMetrics.margin}% margin
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    Avg Price
                  </div>
                  <div className="text-3xl font-bold text-slate-900">
                    RM {productMetrics.avgPrice}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">per unit</div>
                </div>
              </div>
            </div>

            {/* Monthly Breakdown */}
            {productMetrics.monthlyData.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Monthly Breakdown
                </h2>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-6 py-3 font-medium">Month</th>
                        <th className="px-6 py-3 font-medium">Units Sold</th>
                        <th className="px-6 py-3 font-medium">Revenue RM</th>
                        <th className="px-6 py-3 font-medium">Cost RM</th>
                        <th className="px-6 py-3 font-medium">Profit RM</th>
                        <th className="px-6 py-3 font-medium">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {productMetrics.monthlyData.map(
                        ({ month, qty, revenue, cost }) => {
                          const profit = revenue - cost;
                          const margin =
                            revenue > 0
                              ? ((profit / revenue) * 100).toFixed(1)
                              : "0.0";
                          return (
                            <tr key={month} className="hover:bg-gray-50">
                              <td className="px-6 py-3 font-medium text-gray-900">
                                {month}
                              </td>
                              <td className="px-6 py-3">{qty}</td>
                              <td className="px-6 py-3">
                                RM {formatCurrency(revenue)}
                              </td>
                              <td className="px-6 py-3">
                                RM {formatCurrency(cost)}
                              </td>
                              <td className="px-6 py-3 font-medium text-green-600">
                                RM {formatCurrency(profit)}
                              </td>
                              <td className="px-6 py-3 text-gray-500">
                                {margin}%
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
