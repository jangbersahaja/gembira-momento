"use client";

import products from "@/data/products";
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
  lastTransactionDate?: string; // Last transaction in "X days ago" format
  supplier?: string; // Supplier name from products.ts
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

interface SupplierGroup {
  supplier: string;
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
  const [groupBySupplier, setGroupBySupplier] = useState(false);

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
    const skuCounts = new Map<
      string,
      { units: number; revenue: number; lastDate?: string }
    >();
    // Also track by name as fallback for products without SKU
    const nameCounts = new Map<
      string,
      { units: number; revenue: number; lastDate?: string }
    >();

    for (const transaction of transactionsData) {
      // Only count item rows (where items exist and status is completed)
      if (!transaction.items || transaction.status !== "completed") {
        continue;
      }

      const txDate = transaction.timestamp;

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
            // Update last transaction date
            if (
              !current.lastDate ||
              new Date(txDate) > new Date(current.lastDate)
            ) {
              current.lastDate = txDate;
            }
            skuCounts.set(sku, current);
          } else if (item.productName) {
            // Only use name if there's no SKU to avoid double-counting
            const current = nameCounts.get(item.productName) || {
              units: 0,
              revenue: 0,
            };
            current.units += qty;
            current.revenue += itemTotal;
            // Update last transaction date
            if (
              !current.lastDate ||
              new Date(txDate) > new Date(current.lastDate)
            ) {
              current.lastDate = txDate;
            }
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

      // Format last transaction date
      let lastTransactionDate: string | undefined;
      if (saleData.lastDate) {
        const txDate = new Date(saleData.lastDate);
        const today = new Date();
        // Set Malaysia timezone
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
          (malaysiaNow.getTime() - txDateLocal.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysAgo === 0) {
          lastTransactionDate = "today";
        } else if (daysAgo === 1) {
          lastTransactionDate = "1 day ago";
        } else if (daysAgo > 1) {
          lastTransactionDate = `${daysAgo} days ago`;
        } else {
          lastTransactionDate = "future";
        }
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
        lastTransactionDate,
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

  // Create a supplier map from products.ts
  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const sku = String(product.SKU || "");
      const supplier = String(product.Supplier || "");
      if (sku && supplier) {
        map.set(sku, supplier);
      }
    }
    return map;
  }, []);

  // Aggregate product data grouped by supplier
  const supplierGroups = useMemo(() => {
    if (!productsData || !transactionsData) return [];

    // Create inventory map from API data (if available)
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
    const skuCounts = new Map<
      string,
      { units: number; revenue: number; lastDate?: string }
    >();
    const nameCounts = new Map<
      string,
      { units: number; revenue: number; lastDate?: string }
    >();

    for (const transaction of transactionsData) {
      if (!transaction.items || transaction.status !== "completed") {
        continue;
      }

      const txDate = transaction.timestamp;

      for (const item of transaction.items) {
        const sku = item.sku || "";
        const qty = item.quantity || 0;
        const itemTotal = item.totalPrice || 0;

        if (qty > 0) {
          if (sku) {
            const current = skuCounts.get(sku) || { units: 0, revenue: 0 };
            current.units += qty;
            current.revenue += itemTotal;
            if (
              !current.lastDate ||
              new Date(txDate) > new Date(current.lastDate)
            ) {
              current.lastDate = txDate;
            }
            skuCounts.set(sku, current);
          } else if (item.productName) {
            const current = nameCounts.get(item.productName) || {
              units: 0,
              revenue: 0,
            };
            current.units += qty;
            current.revenue += itemTotal;
            if (
              !current.lastDate ||
              new Date(txDate) > new Date(current.lastDate)
            ) {
              current.lastDate = txDate;
            }
            nameCounts.set(item.productName, current);
          }
        }
      }
    }

    // Group products by supplier
    const groups = new Map<string, SupplierGroup>();

    for (const product of productsData) {
      const sku = String(product.sku || "");
      const name = String(product.name || "");
      const productId = product.id || "";
      const cost = Number(product.cost) || 0;
      const price = Number(product.unitPrice) || 0;

      // Get supplier from map
      const supplier = supplierMap.get(sku) || "Unknown Supplier";

      // Try to get sales data by SKU first, fallback to name if no SKU
      let saleData = skuCounts.get(sku) || { units: 0, revenue: 0 };
      if (!sku && name) {
        saleData = nameCounts.get(name) || { units: 0, revenue: 0 };
      }

      // Format last transaction date
      let lastTransactionDate: string | undefined;
      if (saleData.lastDate) {
        const txDate = new Date(saleData.lastDate);
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
          (malaysiaNow.getTime() - txDateLocal.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysAgo === 0) {
          lastTransactionDate = "today";
        } else if (daysAgo === 1) {
          lastTransactionDate = "1 day ago";
        } else if (daysAgo > 1) {
          lastTransactionDate = `${daysAgo} days ago`;
        } else {
          lastTransactionDate = "future";
        }
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
        missingSkuWarning: !sku,
        lastTransactionDate,
        supplier,
      };

      if (!groups.has(supplier)) {
        groups.set(supplier, {
          supplier,
          productCount: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalUnits: 0,
          totalStockBalance: 0,
          totalStockValue: 0,
          products: [],
        });
      }

      const group = groups.get(supplier)!;
      group.productCount += 1;
      group.totalRevenue += saleData.revenue;
      group.totalCost += cost * saleData.units;
      group.totalUnits += saleData.units;
      group.totalStockBalance += productData.stockBalance;
      group.totalStockValue += productData.stockBalance * cost;
      group.products.push(productData);
    }

    // Sort suppliers alphabetically
    const sortedGroups = Array.from(groups.values()).sort((a, b) =>
      a.supplier.localeCompare(b.supplier),
    );

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
  }, [searchTerm, productsData, transactionsData, inventoryData, supplierMap]);

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
    <div className="w-full bg-gray-50 min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Products
            </h1>

            {/* View Toggle - Compact */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => {
                  setGroupByCategory(!groupByCategory);
                  setGroupBySupplier(false);
                }}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                  groupByCategory
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Category
              </button>
              <button
                onClick={() => {
                  setGroupBySupplier(!groupBySupplier);
                  setGroupByCategory(false);
                }}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                  groupBySupplier
                    ? "bg-green-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Supplier
              </button>
              <button
                onClick={() => {
                  setGroupByCategory(false);
                  setGroupBySupplier(false);
                }}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                  !groupByCategory && !groupBySupplier
                    ? "bg-purple-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-white">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-2 text-gray-400 text-sm">
            🔍
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6">
        {categoryGroups.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-sm">No products found</p>
          </div>
        ) : groupBySupplier ? (
          // SUPPLIER GROUPED VIEW
          <div className="space-y-3">
            {supplierGroups.map((group) => (
              <div
                key={group.supplier}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Supplier Header */}
                <button
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === group.supplier
                        ? null
                        : group.supplier,
                    )
                  }
                  className="w-full bg-linear-to-r from-green-50 to-green-100 px-4 py-3 hover:from-green-100 hover:to-green-200 transition-colors text-left"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        className={`text-lg transform transition-transform shrink-0 ${
                          expandedCategory === group.supplier
                            ? "rotate-90"
                            : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-green-700 text-sm md:text-base truncate">
                          {group.supplier}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {group.productCount} items • {group.totalUnits} sold
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-xs md:text-sm">
                      <p className="font-semibold text-gray-900">
                        RM {formatCurrency(group.totalStockValue)}
                      </p>
                      <p className="text-gray-500">
                        {group.totalStockBalance} units
                      </p>
                    </div>
                  </div>
                </button>

                {/* Products */}
                {expandedCategory === group.supplier && (
                  <div className="border-t border-gray-200 divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    {group.products.map((product) => (
                      <Link
                        key={product.sku + product.name}
                        href={`/products/${encodeURIComponent(product.sku)}`}
                        className={`px-4 py-2.5 text-xs grid gap-2 transition-colors ${
                          product.missingSkuWarning
                            ? "bg-orange-50 hover:bg-orange-100"
                            : product.unitsSold === 0
                              ? "bg-yellow-50 hover:bg-yellow-100"
                              : "hover:bg-gray-50"
                        }`}
                        style={{
                          gridTemplateColumns:
                            "minmax(80px, 0.8fr) minmax(150px, 1.5fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(90px, 0.9fr)",
                        }}
                      >
                        <div className="font-mono text-gray-600 truncate">
                          {product.sku || "—"}
                        </div>
                        <div className="text-gray-900 truncate font-medium">
                          {product.name}
                        </div>
                        <div className="text-right text-gray-700">
                          RM {formatCurrency(product.price)}
                        </div>
                        <div className="text-right text-gray-600">
                          RM {formatCurrency(product.cost)}
                        </div>
                        <div className="text-right text-gray-600 truncate">
                          {product.stockBalance}
                        </div>
                        <div className="text-right font-semibold text-gray-900 truncate">
                          {product.unitsSold}
                        </div>
                        <div className="text-right text-gray-600 truncate">
                          {product.lastTransactionDate || "—"}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}  
          </div>
        ) : groupByCategory ? (
          // CATEGORY GROUPED VIEW
          <div className="space-y-3">
            {categoryGroups.map((group) => (
              <div
                key={group.category}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleSupplier(group.category)}
                  className="w-full bg-linear-to-r from-blue-50 to-blue-100 px-4 py-3 hover:from-blue-100 hover:to-blue-200 transition-colors text-left"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        className={`text-lg transform transition-transform shrink-0 ${
                          expandedCategory === group.category
                            ? "rotate-90"
                            : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                      <div className="min-w-0">
                        <h3
                          className={`font-bold text-sm md:text-base truncate ${
                            group.category === "Uncategorized"
                              ? "text-red-700"
                              : "text-blue-700"
                          }`}
                        >
                          {group.category}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {group.productCount} items • {group.totalUnits} sold
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-xs md:text-sm">
                      <p className="font-semibold text-gray-900">
                        RM {formatCurrency(group.totalStockValue)}
                      </p>
                      <p className="text-gray-500">
                        {group.totalStockBalance} units
                      </p>
                    </div>
                  </div>
                </button>

                {/* Products */}
                {expandedCategory === group.category && (
                  <div className="border-t border-gray-200 divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    {group.products.map((product) => (
                      <Link
                        key={product.sku + product.name}
                        href={`/products/${encodeURIComponent(product.sku)}`}
                        className={`px-4 py-2.5 text-xs grid gap-2 transition-colors ${
                          product.missingSkuWarning
                            ? "bg-orange-50 hover:bg-orange-100"
                            : product.unitsSold === 0
                              ? "bg-yellow-50 hover:bg-yellow-100"
                              : "hover:bg-gray-50"
                        }`}
                        style={{
                          gridTemplateColumns:
                            "minmax(80px, 0.8fr) minmax(150px, 1.5fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(90px, 0.9fr)",
                        }}
                      >
                        <div className="font-mono text-gray-600 truncate">
                          {product.sku || "—"}
                        </div>
                        <div className="text-gray-900 truncate font-medium">
                          {product.name}
                        </div>
                        <div className="text-right text-gray-700">
                          RM {formatCurrency(product.price)}
                        </div>
                        <div className="text-right text-gray-600">
                          RM {formatCurrency(product.cost)}
                        </div>
                        <div className="text-right text-gray-600 truncate">
                          {product.stockBalance}
                        </div>
                        <div className="text-right font-semibold text-gray-900 truncate">
                          {product.unitsSold}
                        </div>
                        <div className="text-right text-gray-600 truncate">
                          {product.lastTransactionDate || "—"}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}  
          </div>
        ) : (
          // FLAT LIST VIEW
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-100 max-h-screen overflow-y-auto">
              {/* Header */}
              <div
                className="px-4 py-2.5 bg-gray-50 grid gap-2 sticky top-0 text-xs font-semibold text-gray-700"
                style={{
                  gridTemplateColumns: "minmax(80px, 0.8fr) minmax(150px, 1.5fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(90px, 0.9fr)"
                }}
              >
                <div>SKU</div>
                <div>Product</div>
                <div className="text-right">Price</div>
                <div className="text-right">Cost</div>
                <div className="text-right">Stock</div>
                <div className="text-right">Sold</div>
                <div className="text-right">Last Sale</div>
              </div>

              {/* Products */}
              {categoryGroups.flatMap((group) =>
                group.products.map((product) => (
                  <Link
                    key={product.sku + product.name}
                    href={`/products/${encodeURIComponent(product.sku)}`}
                    className={`px-4 py-2.5 text-xs grid gap-2 transition-colors ${
                      product.missingSkuWarning
                        ? "bg-orange-50 hover:bg-orange-100"
                        : product.unitsSold === 0
                          ? "bg-yellow-50 hover:bg-yellow-100"
                          : "hover:bg-gray-50"
                    }`}
                    style={{
                      gridTemplateColumns: "minmax(80px, 0.8fr) minmax(150px, 1.5fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(90px, 0.9fr)"
                    }}
                  >
                    <div className="font-mono text-gray-600 truncate">
                      {product.sku || "—"}
                    </div>
                    <div className="text-gray-900 truncate font-medium">
                      {product.name}
                    </div>
                    <div className="text-right text-gray-700">
                      RM {formatCurrency(product.price)}
                    </div>
                    <div className="text-right text-gray-600">
                      RM {formatCurrency(product.cost)}
                    </div>
                    <div className="text-right text-gray-600 truncate">
                      {product.stockBalance}
                    </div>
                    <div className="text-right font-semibold text-gray-900 truncate">
                      {product.unitsSold}
                    </div>
                    <div className="text-right text-gray-600 truncate">
                      {product.lastTransactionDate || "—"}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              Total Products
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {categoryGroups.reduce((sum, g) => sum + g.productCount, 0)}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              {groupByCategory ? "Categories" : "Groups"}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {groupByCategory
                ? categoryGroups.length
                : groupBySupplier
                  ? supplierGroups.length
                  : "—"}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              Total Stock
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {categoryGroups.reduce((sum, g) => sum + g.totalStockBalance, 0)}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              Stock Value
            </p>
            <p className="text-2xl font-bold text-green-700">
              RM{" "}
              {formatCurrency(
                categoryGroups.reduce((sum, g) => sum + g.totalStockValue, 0),
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
