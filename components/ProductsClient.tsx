"use client";

import products from "@/data/products";
import transactions from "@/data/transactions";
import Link from "next/link";
import { useMemo, useState } from "react";

interface ProductData {
  sku: string;
  name: string;
  cost: number;
  price: number;
  margin: number;
  unitsSold: number;
  revenue: number;
  stockBalance: number;
  missingSkuWarning?: boolean; // Flag if product has no SKU
}

interface SupplierGroup {
  supplier: string;
  supplyType: string; // "(Consignment)" or "(Outright)" or empty
  productCount: number;
  totalRevenue: number;
  totalCost: number;
  totalUnits: number;
  totalStockBalance: number;
  totalStockValue: number;
  products: ProductData[];
}

export default function ProductsClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  // Helper function to normalize supplier name and extract supply type
  const normalizeSupplier = (supplierStr: string) => {
    if (!supplierStr) return { base: "No Supplier", type: "" };

    const consignmentMatch = supplierStr.match(/^(.+?)\s*\(Consignment\)$/i);
    if (consignmentMatch) {
      return { base: consignmentMatch[1].trim(), type: "(Consignment)" };
    }

    const outrightMatch = supplierStr.match(/^(.+?)\s*\(Outright\)$/i);
    if (outrightMatch) {
      return { base: outrightMatch[1].trim(), type: "(Outright)" };
    }

    return { base: supplierStr, type: "" };
  };

  // Aggregate product data with transaction counts
  const productGroups = useMemo(() => {
    // First, count units sold per SKU from transactions
    const skuCounts = new Map<string, { units: number; revenue: number }>();
    // Also track by name as fallback for products without SKU
    const nameCounts = new Map<string, { units: number; revenue: number }>();

    for (const transaction of transactions) {
      // Only count item rows (where Item is not empty and is a Sale, not cancelled)
      const item =
        typeof transaction === "object" ? transaction.Item || "" : "";
      const txType =
        typeof transaction === "object" ? transaction["Transaction Type"] : "";
      const isCancelled =
        typeof transaction === "object" ? transaction.Is_Cancelled : "";

      // Skip non-item rows or cancelled transactions
      if (!item || txType !== "Sale" || isCancelled === "True") {
        continue;
      }

      const sku = typeof transaction === "object" ? transaction.SKU || "" : "";
      const qty =
        typeof transaction === "object" && transaction.Quantity
          ? Number(transaction.Quantity) || 0
          : 0;
      const subTotal =
        typeof transaction === "object" && transaction.SubTotal
          ? Number(transaction.SubTotal) || 0
          : 0;
      const discount =
        typeof transaction === "object" && transaction.Discount
          ? Number(transaction.Discount) || 0
          : 0;
      const netSales = Math.abs(subTotal) - Math.abs(discount);

      if (qty > 0) {
        // Match by SKU first, fallback to name if no SKU
        if (sku) {
          const current = skuCounts.get(sku) || { units: 0, revenue: 0 };
          current.units += qty;
          current.revenue += netSales;
          skuCounts.set(sku, current);
        } else if (item) {
          // Only use name if there's no SKU to avoid double-counting
          const current = nameCounts.get(item) || { units: 0, revenue: 0 };
          current.units += qty;
          current.revenue += netSales;
          nameCounts.set(item, current);
        }
      }
    }

    // Group products by supplier
    const groups = new Map<string, SupplierGroup>();

    for (const product of products) {
      const sku = String(product.SKU || "");
      const name = String(product["Product Name"] || "");
      const cost = Number(product.Cost) || 0;
      const price = Number(product["Tax-Exclusive Price"]) || 0;
      const supplierRaw = String(product.Supplier || "");

      // Normalize supplier name to extract base name and supply type
      const { base: supplierBase, type: supplyType } =
        normalizeSupplier(supplierRaw);

      // Try to get sales data by SKU first, fallback to name if no SKU
      let saleData = skuCounts.get(sku) || { units: 0, revenue: 0 };
      if (!sku && name) {
        // No SKU found, try matching by product name
        saleData = nameCounts.get(name) || { units: 0, revenue: 0 };
      }

      const productData: ProductData = {
        sku,
        name,
        cost,
        price,
        margin: price - cost,
        unitsSold: saleData.units,
        revenue: saleData.revenue,
        stockBalance: Number(product["Gembira Momento_Quantity"]) || 0,
        missingSkuWarning: !sku, // Flag products without SKU
      };

      const key = supplierBase; // Use normalized base name as key

      if (!groups.has(key)) {
        groups.set(key, {
          supplier: key,
          supplyType: supplyType, // Store the supply type
          productCount: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalUnits: 0,
          totalStockBalance: 0,
          totalStockValue: 0,
          products: [],
        });
      }

      const group = groups.get(key)!;
      group.productCount += 1;
      group.totalRevenue += saleData.revenue;
      group.totalCost += cost * saleData.units;
      group.totalUnits += saleData.units;
      group.totalStockBalance += productData.stockBalance;
      group.totalStockValue += productData.stockBalance * cost;
      group.products.push(productData);
    }

    // Sort suppliers: "No Supplier" first, then alphabetically
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.supplier === "No Supplier") return -1;
      if (b.supplier === "No Supplier") return 1;
      return a.supplier.localeCompare(b.supplier);
    });

    // Sort products within each supplier by name
    for (const group of sortedGroups) {
      group.products.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Filter by search term
    if (searchTerm.trim() === "") {
      return sortedGroups;
    }

    const term = searchTerm.toLowerCase();
    return sortedGroups
      .map((group) => ({
        ...group,
        products: group.products.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.products.length > 0);
  }, [searchTerm]);

  const formatCurrency = (value: number) => {
    return value.toFixed(2);
  };

  const toggleSupplier = (supplier: string) => {
    setExpandedSupplier(expandedSupplier === supplier ? null : supplier);
  };

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header Section */}
      <div className="mx-auto max-w-7xl px-6 py-12 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              Products Inventory
            </h1>
            <p className="text-gray-600">
              All products grouped by supplier with sales data
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mx-auto max-w-7xl px-6 py-6 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-4 top-3 text-gray-400">🔍</span>
        </div>
      </div>

      {/* Supplier Groups */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {productGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No products found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {productGroups.map((group) => (
              <div
                key={group.supplier}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Supplier Header - Clickable */}
                <button
                  onClick={() => toggleSupplier(group.supplier)}
                  className="w-full bg-linear-to-r from-blue-50 to-blue-100 px-4 sm:px-6 py-4 hover:from-blue-100 hover:to-blue-200 transition-colors text-left"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <span
                        className={`transform transition-transform ${
                          expandedSupplier === group.supplier
                            ? "rotate-90"
                            : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                      <div>
                        <h2
                          className={`font-bold text-lg ${
                            group.supplier === "No Supplier"
                              ? "text-red-700"
                              : "text-blue-700"
                          }`}
                        >
                          {group.supplier}
                          {group.supplyType && (
                            <span className="ml-2 text-sm font-normal text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {group.supplyType}
                            </span>
                          )}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {group.productCount} products • {group.totalUnits}{" "}
                          units sold
                        </p>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-8 text-right">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Stock</p>
                        <p className="font-semibold text-gray-900">
                          {group.totalStockBalance}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">
                          Stock Value
                        </p>
                        <p className="font-semibold text-gray-900">
                          RM {formatCurrency(group.totalStockValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Revenue</p>
                        <p className="font-semibold text-gray-900">
                          RM {formatCurrency(group.totalRevenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Cost</p>
                        <p className="font-semibold text-gray-900">
                          RM {formatCurrency(group.totalCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Profit</p>
                        <p
                          className={`font-semibold ${
                            group.totalRevenue > 0
                              ? "text-green-700"
                              : "text-gray-900"
                          }`}
                        >
                          RM{" "}
                          {formatCurrency(group.totalRevenue - group.totalCost)}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Products List - Expandable */}
                {expandedSupplier === group.supplier && (
                  <div className="bg-white border-t border-gray-200">
                    <div className="divide-y divide-gray-200 max-h-96 overflow-auto">
                      {/* Header Row */}
                      <div className="min-w-[1100px] px-4 sm:px-6 py-3 bg-gray-50 grid grid-cols-15 gap-3 sticky top-0 text-xs font-semibold text-gray-700">
                        <div className="col-span-1">SKU</div>
                        <div className="col-span-3">Product Name</div>
                        <div className="col-span-1 text-right">Stock</div>
                        <div className="col-span-1 text-right">Stock Value</div>
                        <div className="col-span-1 text-right">Cost</div>
                        <div className="col-span-1 text-right">Price</div>
                        <div className="col-span-1 text-right">Margin</div>
                        <div className="col-span-1 text-right">Units Sold</div>
                        <div className="col-span-2 text-right">Revenue</div>
                        <div className="col-span-2 text-right">Profit</div>
                      </div>

                      {/* Product Rows */}
                      {group.products.map((product) => (
                        <Link
                          key={product.sku + product.name}
                          href={`/products/${encodeURIComponent(product.sku)}`}
                          className={`min-w-[1100px] px-4 sm:px-6 py-3 grid grid-cols-15 gap-3 text-sm transition-colors ${
                            product.missingSkuWarning
                              ? "bg-orange-50 hover:bg-orange-100 border-l-2 border-orange-400"
                              : product.unitsSold === 0
                                ? "bg-yellow-50 hover:bg-yellow-100"
                                : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="col-span-1 font-mono text-xs">
                            {product.sku ? (
                              <span className="text-gray-600">
                                {product.sku}
                              </span>
                            ) : (
                              <span className="text-orange-600 font-semibold"></span>
                            )}
                          </div>
                          <div className="col-span-3 text-gray-900 truncate">
                            <span className="hover:text-blue-600">
                              {product.name}
                            </span>
                            {product.missingSkuWarning && (
                              <span className="ml-2 text-xs bg-orange-200 text-orange-900 px-2 py-1 rounded">
                                ⚠ No SKU
                              </span>
                            )}
                            {product.unitsSold === 0 &&
                              !product.missingSkuWarning && (
                                <span className="ml-2 text-xs bg-yellow-200 text-yellow-900 px-2 py-1 rounded">
                                  No sales
                                </span>
                              )}
                          </div>
                          <div className="col-span-1 text-right font-semibold text-gray-900">
                            {product.stockBalance || "—"}
                          </div>
                          <div className="col-span-1 text-right font-semibold text-gray-700">
                            RM{" "}
                            {formatCurrency(
                              product.stockBalance * product.cost,
                            )}
                          </div>
                          <div className="col-span-1 text-right text-gray-700">
                            RM {formatCurrency(product.cost)}
                          </div>
                          <div className="col-span-1 text-right text-gray-700">
                            RM {formatCurrency(product.price)}
                          </div>
                          <div
                            className={`col-span-1 text-right font-semibold ${
                              product.margin >= 0
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            RM {formatCurrency(product.margin)}
                          </div>
                          <div className="col-span-1 text-right font-semibold">
                            {product.unitsSold}
                          </div>
                          <div className="col-span-2 text-right font-semibold text-blue-700">
                            RM {formatCurrency(product.revenue)}
                          </div>
                          <div
                            className={`col-span-2 text-right font-semibold ${
                              product.unitsSold === 0
                                ? "text-gray-400"
                                : product.revenue -
                                      product.cost * product.unitsSold >
                                    0
                                  ? "text-green-700"
                                  : "text-red-700"
                            }`}
                          >
                            {product.unitsSold === 0
                              ? "—"
                              : `RM ${formatCurrency(
                                  product.revenue -
                                    product.cost * product.unitsSold,
                                )}`}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Total Products
              </p>
              <p className="text-3xl font-bold text-blue-700">
                {products.length}
              </p>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-500">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Total Suppliers
              </p>
              <p className="text-3xl font-bold text-purple-700">
                {
                  productGroups.filter((g) => g.supplier !== "No Supplier")
                    .length
                }
              </p>
            </div>

            <div className="bg-red-50 p-6 rounded-lg border-l-4 border-red-500">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Products w/o Supplier
              </p>
              <p className="text-3xl font-bold text-red-700">
                {productGroups.find((g) => g.supplier === "No Supplier")
                  ?.productCount || 0}
              </p>
            </div>

            <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-500">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Total Revenue (TTM)
              </p>
              <p className="text-3xl font-bold text-green-700">
                RM{" "}
                {formatCurrency(
                  productGroups.reduce((sum, g) => sum + g.totalRevenue, 0),
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
