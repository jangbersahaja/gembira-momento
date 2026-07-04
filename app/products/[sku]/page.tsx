"use client";

import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import products from "../../../data/products";
import transactions from "../../../data/transactions";

interface PageProps {
  params: Promise<{
    sku: string;
  }>;
}

export default function ProductDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const { sku } = use(params);
  const decodedSku = decodeURIComponent(sku);

  const product = useMemo(() => {
    return products.find((p) => String(p.SKU) === decodedSku);
  }, [decodedSku]);

  const productMetrics = useMemo(() => {
    if (!product) return null;

    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let transactionCount = 0;
    const monthlyData = new Map<
      string,
      { qty: number; revenue: number; cost: number }
    >();

    // Process transactions
    for (const tx of transactions) {
      // Only count item rows (where Item is not empty and is a Sale, not cancelled)
      const txName = String(tx.Item || "");
      const txType = String(tx["Transaction Type"] || "");
      const isCancelled = String(tx.Is_Cancelled || "");

      // Skip non-item rows or cancelled transactions
      if (!txName || txType !== "Sale" || isCancelled === "True") {
        continue;
      }

      const txSku = String(tx.SKU || "");
      const productName = String(product["Product Name"] || "");

      // Match by SKU or product name
      if (txSku === decodedSku || txName === productName) {
        const quantity =
          typeof tx.Quantity === "number"
            ? tx.Quantity
            : Number(tx.Quantity) || 0;
        const subtotal =
          typeof tx.SubTotal === "number"
            ? tx.SubTotal
            : Number(tx.SubTotal) || 0;
        const discount =
          typeof tx.Discount === "number"
            ? tx.Discount
            : Number(tx.Discount) || 0;
        const revenue = Math.abs(subtotal) - Math.abs(discount);

        const cost =
          (typeof product.Cost === "number"
            ? product.Cost
            : Number(product.Cost) || 0) * quantity;

        totalQuantity += quantity;
        totalRevenue += revenue;
        totalCost += cost;
        transactionCount += 1;

        // Monthly breakdown
        const timeStr = String(tx.Time || "");
        const dateMatch = timeStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          const [, month, , year] = dateMatch;
          const monthKey = `${year}-${month.padStart(2, "0")}`;

          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, { qty: 0, revenue: 0, cost: 0 });
          }
          const current = monthlyData.get(monthKey)!;
          current.qty += quantity;
          current.revenue += revenue;
          current.cost += cost;
        }
      }
    }

    const profit = totalRevenue - totalCost;
    const margin =
      totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : "0.0";
    const avgPrice =
      totalQuantity > 0 ? (totalRevenue / totalQuantity).toFixed(2) : "0.00";

    return {
      totalQuantity,
      totalRevenue,
      totalCost,
      profit,
      margin,
      transactionCount,
      avgPrice,
      monthlyData: Array.from(monthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          ...data,
        })),
    };
  }, [product, decodedSku]);

  if (!product) {
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
              {product["Product Name"]}
            </h1>
            <p className="text-lg text-gray-600">SKU: {product.SKU}</p>
          </div>

          <div className="md:text-right">
            <div className="text-sm text-gray-500 mb-2">Category</div>
            <p className="text-xl font-semibold text-slate-900">
              {product.Category || "Uncategorized"}
            </p>
          </div>

          <div className="md:text-right">
            <div className="text-sm text-gray-500 mb-2">Supplier</div>
            <p className="text-xl font-semibold text-slate-900">
              {product.Supplier || "Unknown"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Product Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border bg-blue-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">Price</div>
            <div className="text-2xl font-bold text-blue-700">
              RM{" "}
              {formatCurrency(
                typeof product["Tax-Exclusive Price"] === "number"
                  ? product["Tax-Exclusive Price"]
                  : Number(product["Tax-Exclusive Price"]) || 0,
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-red-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">Cost</div>
            <div className="text-2xl font-bold text-red-700">
              RM{" "}
              {formatCurrency(
                typeof product.Cost === "number"
                  ? product.Cost
                  : Number(product.Cost) || 0,
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-green-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Unit Margin
            </div>
            <div className="text-2xl font-bold text-green-700">
              RM{" "}
              {formatCurrency(
                (typeof product["Tax-Exclusive Price"] === "number"
                  ? product["Tax-Exclusive Price"]
                  : Number(product["Tax-Exclusive Price"]) || 0) -
                  (typeof product.Cost === "number"
                    ? product.Cost
                    : Number(product.Cost) || 0),
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-purple-50 p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Current Stock
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {product["Gembira Momento_Quantity"] !== "" &&
              product["Gembira Momento_Quantity"] !== undefined
                ? product["Gembira Momento_Quantity"]
                : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-2">units</div>
          </div>
        </div>

        {/* Stock Status Section */}
        {(product["Gembira Momento_Warning Stock Level"] !== "" ||
          product["Gembira Momento_Ideal Stock Level"] !== "" ||
          product["Inventory Type"]) && (
          <div className="mb-8 rounded-lg border bg-linear-to-r from-amber-50 to-orange-50 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Stock Management
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg bg-white p-4 border border-amber-200">
                <div className="text-sm font-medium text-gray-600 mb-1">
                  Current Stock
                </div>
                <div className="text-2xl font-bold text-amber-700">
                  {product["Gembira Momento_Quantity"] !== "" &&
                  product["Gembira Momento_Quantity"] !== undefined
                    ? product["Gembira Momento_Quantity"]
                    : "—"}
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 border border-orange-200">
                <div className="text-sm font-medium text-gray-600 mb-1">
                  Warning Level
                </div>
                <div className="text-2xl font-bold text-orange-700">
                  {product["Gembira Momento_Warning Stock Level"] !== "" &&
                  product["Gembira Momento_Warning Stock Level"] !== undefined
                    ? product["Gembira Momento_Warning Stock Level"]
                    : "—"}
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 border border-green-200">
                <div className="text-sm font-medium text-gray-600 mb-1">
                  Ideal Stock Level
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {product["Gembira Momento_Ideal Stock Level"] !== "" &&
                  product["Gembira Momento_Ideal Stock Level"] !== undefined
                    ? product["Gembira Momento_Ideal Stock Level"]
                    : "—"}
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 border border-slate-200">
                <div className="text-sm font-medium text-gray-600 mb-1">
                  Inventory Type
                </div>
                <div className="text-2xl font-bold text-slate-700">
                  {product["Inventory Type"] || "—"}
                </div>
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
