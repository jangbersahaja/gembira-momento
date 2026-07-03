"use client";

import products from "@/data/products";
import transactions from "@/data/transactions";
import { useMemo, useState } from "react";

interface ProductData {
  sku: string;
  name: string;
  cost: number;
  price: number;
  unitsSold: number;
  revenue: number;
}

interface SupplierGroup {
  supplier: string;
  productCount: number;
  totalRevenue: number;
  totalCost: number;
  totalUnits: number;
  products: ProductData[];
}

export default function ProductsClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  // Aggregate product data with transaction counts
  const productGroups = useMemo(() => {
    // First, count units sold per SKU from transactions
    const skuCounts = new Map<string, { units: number; revenue: number }>();

    for (const transaction of transactions) {
      // Each transaction has Item, Quantity, SubTotal
      const sku = typeof transaction === "object" ? transaction.SKU || "" : "";
      const qty =
        typeof transaction === "object" && transaction.Quantity
          ? Number(transaction.Quantity) || 0
          : 0;
      const subTotal =
        typeof transaction === "object" && transaction.SubTotal
          ? Number(transaction.SubTotal) || 0
          : 0;

      if (sku && qty > 0) {
        const current = skuCounts.get(sku) || { units: 0, revenue: 0 };
        current.units += qty;
        current.revenue += subTotal;
        skuCounts.set(sku, current);
      }
    }

    // Group products by supplier
    const groups = new Map<string, SupplierGroup>();

    for (const product of products) {
      const sku = String(product.SKU || "");
      const name = String(product["Product Name"] || "");
      const cost = Number(product.Cost) || 0;
      const price = Number(product["Tax-Exclusive Price"]) || 0;
      const supplier = String(product.Supplier || "");

      const saleData = skuCounts.get(sku) || { units: 0, revenue: 0 };

      const productData: ProductData = {
        sku,
        name,
        cost,
        price,
        unitsSold: saleData.units,
        revenue: saleData.revenue,
      };

      const key = supplier || "No Supplier";

      if (!groups.has(key)) {
        groups.set(key, {
          supplier: key,
          productCount: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalUnits: 0,
          products: [],
        });
      }

      const group = groups.get(key)!;
      group.productCount += 1;
      group.totalRevenue += saleData.revenue;
      group.totalCost += cost * saleData.units;
      group.totalUnits += saleData.units;
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
                  className="w-full bg-linear-to-r from-blue-50 to-blue-100 px-6 py-4 hover:from-blue-100 hover:to-blue-200 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
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
                        </h2>
                        <p className="text-sm text-gray-600">
                          {group.productCount} products • {group.totalUnits}{" "}
                          units sold
                        </p>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="flex gap-8 text-right">
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
                        <p className="text-xs text-gray-600 mb-1">Margin</p>
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
                    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                      {/* Header Row */}
                      <div className="px-6 py-3 bg-gray-50 grid grid-cols-12 gap-4 sticky top-0 text-xs font-semibold text-gray-700">
                        <div className="col-span-1">SKU</div>
                        <div className="col-span-4">Product Name</div>
                        <div className="col-span-1 text-right">Cost</div>
                        <div className="col-span-1 text-right">Price</div>
                        <div className="col-span-1 text-right">Units Sold</div>
                        <div className="col-span-2 text-right">Revenue</div>
                        <div className="col-span-2 text-right">Profit</div>
                      </div>

                      {/* Product Rows */}
                      {group.products.map((product) => (
                        <div
                          key={product.sku}
                          className="px-6 py-3 grid grid-cols-12 gap-4 hover:bg-gray-50 text-sm"
                        >
                          <div className="col-span-1 font-mono text-xs text-gray-600">
                            {product.sku}
                          </div>
                          <div className="col-span-4 text-gray-900 truncate">
                            {product.name}
                          </div>
                          <div className="col-span-1 text-right text-gray-700">
                            RM {formatCurrency(product.cost)}
                          </div>
                          <div className="col-span-1 text-right text-gray-700">
                            RM {formatCurrency(product.price)}
                          </div>
                          <div className="col-span-1 text-right font-semibold">
                            {product.unitsSold}
                          </div>
                          <div className="col-span-2 text-right font-semibold text-blue-700">
                            RM {formatCurrency(product.revenue)}
                          </div>
                          <div
                            className={`col-span-2 text-right font-semibold ${
                              product.revenue -
                                product.cost * product.unitsSold >
                              0
                                ? "text-green-700"
                                : "text-gray-600"
                            }`}
                          >
                            RM{" "}
                            {formatCurrency(
                              product.revenue -
                                product.cost * product.unitsSold,
                            )}
                          </div>
                        </div>
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
