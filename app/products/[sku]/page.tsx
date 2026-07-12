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
        {productMetrics?.restockingSuggestion && (
          <div
            className={`mb-6 rounded-lg p-4 md:p-5 border-l-4 ${
              productMetrics.restockingSuggestion.urgency === "critical"
                ? "bg-red-50 border-red-500"
                : productMetrics.restockingSuggestion.urgency === "high"
                  ? "bg-orange-50 border-orange-500"
                  : productMetrics.restockingSuggestion.urgency === "medium"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-blue-50 border-blue-500"
            }`}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm md:text-base font-bold mb-1 ${
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
                  📦 {productMetrics.restockingSuggestion.reason}
                </div>
                <div className="text-xs md:text-sm text-gray-600">
                  Suggest restocking{" "}
                  <span className="font-semibold">
                    {productMetrics.restockingSuggestion.quantity} units
                  </span>
                  {productMetrics.restockingSuggestion.daysUntilStockout !==
                    undefined && (
                    <>
                      {" "}
                      (will reach warning in ~
                      {
                        productMetrics.restockingSuggestion.daysUntilStockout
                      }{" "}
                      days)
                    </>
                  )}
                </div>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                  productMetrics.restockingSuggestion.urgency === "critical"
                    ? "bg-red-100 text-red-700"
                    : productMetrics.restockingSuggestion.urgency === "high"
                      ? "bg-orange-100 text-orange-700"
                      : productMetrics.restockingSuggestion.urgency === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                }`}
              >
                {productMetrics.restockingSuggestion.urgency.toUpperCase()}
              </span>
            </div>
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
