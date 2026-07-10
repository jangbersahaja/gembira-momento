"use client";

import {
  useInventory,
  useProducts,
  useTransactions,
} from "@/lib/useStorehubApi";
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
  warningStock?: number;
  idealStock?: number;
  missingSkuWarning?: boolean; // Flag if product has no SKU
}

interface CategoryGroup {
  category: string;
  categoryType: string;
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Get storeId from environment variable (set in .env.local)
  const storeId = process.env.NEXT_PUBLIC_STOREHUB_STORE_ID || "";

  // Fetch data from API hooks
  const { data: productsData, loading: productsLoading } = useProducts();
  const { data: transactionsData, loading: transactionsLoading } =
    useTransactions();

  // Fetch inventory data if storeId is available
  const { data: inventoryData, loading: inventoryLoading } =
    useInventory(storeId);

  // Aggregate product data with transaction counts
  const categoryGroups = useMemo(() => {
    if (!productsData || !transactionsData) return [];

    // Debug: log the first product to see structure
    if (productsData.length > 0) {
      console.log("First product:", productsData[0]);
    }

    // Create inventory map from API data (if available)
    // Maps productId to inventory level details
    const inventoryMap = new Map<
      string,
      {
        quantityOnHand: number;
        warningStock?: number;
        idealStock?: number;
      }
    >();

    if (inventoryData && Array.isArray(inventoryData)) {
      for (const item of inventoryData) {
        inventoryMap.set(item.productId, {
          quantityOnHand: item.quantityOnHand,
          warningStock: item.warningStock,
          idealStock: item.idealStock,
        });
      }
    }

    // First, count units sold per SKU from transactions
    const skuCounts = new Map<string, { units: number; revenue: number }>();
    // Also track by name as fallback for products without SKU
    const nameCounts = new Map<string, { units: number; revenue: number }>();

    for (const transaction of transactionsData) {
      // Only count item rows (where items exist and status is completed)
      if (!transaction.items || transaction.status !== "completed") {
        continue;
      }

      for (const item of transaction.items) {
        const sku = item.sku || "";
        const qty = item.quantity || 0;
        const itemTotal = item.totalPrice || 0;

        if (qty > 0) {
          // Match by SKU first, fallback to name if no SKU
          if (sku) {
            const current = skuCounts.get(sku) || { units: 0, revenue: 0 };
            current.units += qty;
            current.revenue += itemTotal;
            skuCounts.set(sku, current);
          } else if (item.productName) {
            // Only use name if there's no SKU to avoid double-counting
            const current = nameCounts.get(item.productName) || {
              units: 0,
              revenue: 0,
            };
            current.units += qty;
            current.revenue += itemTotal;
            nameCounts.set(item.productName, current);
          }
        }
      }
    }

    // Group products by category
    const groups = new Map<string, CategoryGroup>();

    for (const product of productsData) {
      const sku = String(product.sku || "");
      const name = String(product.name || "");
      const productId = product.id || "";
      const cost = Number(product.cost) || 0;
      const price = Number(product.unitPrice) || 0;
      const category = String(product.category || "Uncategorized");

      // Try to get sales data by SKU first, fallback to name if no SKU
      let saleData = skuCounts.get(sku) || { units: 0, revenue: 0 };
      if (!sku && name) {
        // No SKU found, try matching by product name
        saleData = nameCounts.get(name) || { units: 0, revenue: 0 };
      }

      // Get stock balance from inventory API if available, fallback to product.quantity
      let stockBalance = Number(product.quantity) || 0;
      let warningStock: number | undefined;
      let idealStock: number | undefined;

      if (productId && inventoryMap.has(productId)) {
        const invData = inventoryMap.get(productId)!;
        stockBalance = invData.quantityOnHand;
        warningStock = invData.warningStock;
        idealStock = invData.idealStock;
      }

      const productData: ProductData = {
        sku,
        name,
        cost,
        price,
        margin: price - cost,
        unitsSold: saleData.units,
        revenue: saleData.revenue,
        stockBalance,
        warningStock,
        idealStock,
        missingSkuWarning: !sku, // Flag products without SKU
      };

      const key = category;

      if (!groups.has(key)) {
        groups.set(key, {
          category: key,
          categoryType: "",
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

    // Sort categories alphabetically, "Uncategorized" last
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.category === "Uncategorized") return 1;
      if (b.category === "Uncategorized") return -1;
      return a.category.localeCompare(b.category);
    });

    // Sort products within each category by name
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
  }, [searchTerm, productsData, transactionsData, inventoryData]);

  const formatCurrency = (value: number) => {
    return value.toFixed(2);
  };

  const toggleSupplier = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  // Loading state
  if (productsLoading || transactionsLoading) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products and sales data...</p>
          {storeId && inventoryLoading && (
            <p className="text-sm text-gray-500 mt-2">
              Fetching inventory levels...
            </p>
          )}
        </div>
      </div>
    );
  }

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
              All products grouped by category with sales data
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar and Toggle */}
      <div className="mx-auto max-w-7xl px-6 py-6 border-b border-gray-200">
        <div className="flex flex-col gap-4">
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

          {/* Group Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGroupByCategory(!groupByCategory)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                groupByCategory
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {groupByCategory ? "✓ Grouped by Category" : "Ungrouped"}
            </button>
            <p className="text-sm text-gray-600">
              {groupByCategory
                ? "Click to view all products ungrouped"
                : "Click to group by category"}
            </p>
          </div>
        </div>
      </div>

      {/* Category Groups or Flat List */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {categoryGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No products found</p>
          </div>
        ) : groupByCategory ? (
          // GROUPED VIEW
          <div className="space-y-6">
            {categoryGroups.map((group) => (
              <div
                key={group.category}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Category Header - Clickable */}
                <button
                  onClick={() => toggleSupplier(group.category)}
                  className="w-full bg-linear-to-r from-blue-50 to-blue-100 px-4 sm:px-6 py-4 hover:from-blue-100 hover:to-blue-200 transition-colors text-left"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <span
                        className={`transform transition-transform ${
                          expandedCategory === group.category
                            ? "rotate-90"
                            : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                      <div>
                        <h2
                          className={`font-bold text-lg ${
                            group.category === "Uncategorized"
                              ? "text-red-700"
                              : "text-blue-700"
                          }`}
                        >
                          {group.category}
                          {group.categoryType && (
                            <span className="ml-2 text-sm font-normal text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {group.categoryType}
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
                {expandedCategory === group.category && (
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
        ) : (
          // FLAT LIST VIEW (UNGROUPED)
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200 max-h-full">
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

              {/* All Products */}
              {categoryGroups.flatMap((group) =>
                group.products.map((product) => (
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
                        <span className="text-gray-600">{product.sku}</span>
                      ) : (
                        <span className="text-orange-600 font-semibold"></span>
                      )}
                    </div>
                    <div className="col-span-3 text-gray-900 truncate">
                      <span className="hover:text-blue-600">
                        {product.name}
                      </span>
                    </div>
                    <div className="col-span-1 text-right font-semibold text-gray-900">
                      {product.stockBalance || "—"}
                    </div>
                    <div className="col-span-1 text-right font-semibold text-gray-700">
                      RM {formatCurrency(product.stockBalance * product.cost)}
                    </div>
                    <div className="col-span-1 text-right text-gray-700">
                      RM {formatCurrency(product.cost)}
                    </div>
                    <div className="col-span-1 text-right text-gray-700">
                      RM {formatCurrency(product.price)}
                    </div>
                    <div
                      className={`col-span-1 text-right font-semibold ${
                        product.margin >= 0 ? "text-green-700" : "text-red-700"
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
                          : product.revenue - product.cost * product.unitsSold >
                              0
                            ? "text-green-700"
                            : "text-red-700"
                      }`}
                    >
                      {product.unitsSold === 0
                        ? "—"
                        : `RM ${formatCurrency(
                            product.revenue - product.cost * product.unitsSold,
                          )}`}
                    </div>
                  </Link>
                )),
              )}
            </div>
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
                {categoryGroups.reduce((sum, g) => sum + g.productCount, 0)}
              </p>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-500">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {groupByCategory ? "Total Categories" : "Showing All Products"}
              </p>
              <p className="text-3xl font-bold text-purple-700">
                {groupByCategory ? categoryGroups.length : "All"}
              </p>
            </div>

            <div className="bg-red-50 p-6 rounded-lg border-l-4 border-red-500">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Products w/o Category
              </p>
              <p className="text-3xl font-bold text-red-700">
                {categoryGroups.find((g) => g.category === "Uncategorized")
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
                  categoryGroups.reduce((sum, g) => sum + g.totalRevenue, 0),
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
