"use client";

import {
  getAliasMultiplier,
  isLegacyAliasSku,
  resolveCanonicalSku,
} from "@/lib/productAliases";
import {
  getParentDisplayName,
  getParentSku,
  getVariantLabel,
} from "@/lib/productVariants";
import {
  useBulkRestockAdvice,
  useInventory,
  useProducts,
  useSuppliers,
  useTransactions,
} from "@/lib/useStorehubApi";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

interface ProductData {
  sku: string;
  name: string;
  category: string;
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
  supplier: string;
  lowStock: boolean;
  // DB-backed restocking advice (see lib/restockingLogic.ts), merged in via
  // the bulk endpoint — undefined until that request resolves or when a
  // SKU has no sales history yet to size a reorder.
  reorderPoint?: number;
  restockQty?: number;
  restockUrgency?: "critical" | "high" | "medium" | "low" | "none";
  // Parent/variant relationship (see lib/productVariants.ts). `parentSku`
  // is "" for standalone products or for a parent row itself.
  parentSku: string;
  variantLabel: string;
  isVariantParent: boolean;
  // True when this row IS the parent SKU of a product that has variants,
  // yet still shows unitsSold > 0 — almost always legacy sales recorded
  // before the variants existed, not genuine parent-level demand.
  isLegacyParentSale: boolean;
}

interface ProductGroup {
  key: string;
  label: string;
  productCount: number;
  totalRevenue: number;
  totalCost: number;
  totalUnits: number;
  totalStockBalance: number;
  totalStockValue: number;
  products: ProductData[];
  /** Sum of unitsSold sitting on the parent SKU row of a variant group —
   *  i.e. legacy sales that pre-date the variant split and can't be
   *  attributed to a specific variant. Only meaningful in the variant view. */
  legacyUnattributedUnits?: number;
}

interface ApiProduct {
  id?: string;
  sku?: string;
  name?: string;
  category?: string;
  unitPrice?: number | string;
  cost?: number | string;
  quantity?: number | string;
}

const formatCurrency = (value: number) => value.toFixed(2);

const gridCols =
  "minmax(70px, 0.7fr) minmax(150px, 1.5fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(110px, 1fr) minmax(90px, 0.9fr)";

const urgencyBadgeClasses = (
  urgency?: "critical" | "high" | "medium" | "low" | "none",
) => {
  switch (urgency) {
    case "critical":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-orange-100 text-orange-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "low":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-500";
  }
};

const rowClasses = (product: ProductData) =>
  product.missingSkuWarning
    ? "bg-orange-50 hover:bg-orange-100"
    : product.lowStock
      ? "bg-red-50 hover:bg-red-100"
      : product.unitsSold === 0
        ? "bg-yellow-100 hover:bg-yellow-200"
        : "hover:bg-gray-50";

const cardClasses = (product: ProductData) =>
  product.missingSkuWarning
    ? "border-orange-200 bg-orange-50 hover:bg-orange-100"
    : product.lowStock
      ? "border-red-200 bg-red-50 hover:bg-red-100"
      : product.unitsSold === 0
        ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200"
        : "border-gray-200 bg-white hover:bg-gray-50";

// Shared row renderer used by all three views (flat / category / supplier)
// to avoid triplicated JSX. Defined at module scope (not inside the page
// component) so React doesn't recreate the component type on every render.
function DesktopRow({ product }: { product: ProductData }) {
  return (
    <Link
      href={`/products/${encodeURIComponent(product.sku)}`}
      className={`grid gap-2 px-4 py-2.5 text-xs transition-colors border-b border-gray-100 ${rowClasses(product)}`}
      style={{ gridTemplateColumns: gridCols }}
    >
      <div className="font-mono text-gray-600 truncate flex items-center gap-1">
        {product.sku || "—"}
        {product.lowStock && (
          <span
            title="Low stock"
            className="inline-block text-[10px] font-bold px-1 rounded bg-red-500 text-white"
          >
            LOW
          </span>
        )}
        {product.isLegacyParentSale && (
          <span
            title="Sales recorded before this product's variants existed — can't be attributed to a specific variant"
            className="inline-block text-[10px] font-bold px-1 rounded bg-amber-400 text-amber-900"
          >
            LEGACY
          </span>
        )}
      </div>
      <div className="text-gray-900 truncate font-medium">{product.name}</div>
      <div className="text-right text-gray-700">
        RM {formatCurrency(product.price)}
      </div>
      <div className="text-right text-gray-600">
        RM {formatCurrency(product.cost)}
      </div>
      <div className="text-right text-gray-700 font-medium">
        {product.stockBalance}
      </div>
      <div className="text-right text-gray-900 font-semibold">
        {product.unitsSold}
      </div>
      <div className="text-right">
        {product.restockUrgency && product.restockUrgency !== "none" ? (
          <span
            className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${urgencyBadgeClasses(product.restockUrgency)}`}
            title={`Reorder point: ${product.reorderPoint} units`}
          >
            +{product.restockQty} {product.restockUrgency.toUpperCase()}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>
      <div className="text-right text-gray-600 text-xs">
        {product.lastTransactionDate || "—"}
      </div>
    </Link>
  );
}

function MobileCard({ product }: { product: ProductData }) {
  return (
    <Link
      href={`/products/${encodeURIComponent(product.sku)}`}
      className={`block p-3 rounded-lg transition-colors border ${cardClasses(product)}`}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-gray-500 text-xs flex items-center gap-1">
            {product.sku || "—"}
            {product.lowStock && (
              <span className="inline-block text-[10px] font-bold px-1 rounded bg-red-500 text-white">
                LOW
              </span>
            )}
            {product.isLegacyParentSale && (
              <span
                title="Sales recorded before this product's variants existed"
                className="inline-block text-[10px] font-bold px-1 rounded bg-amber-400 text-amber-900"
              >
                LEGACY
              </span>
            )}
          </div>
          <div className="text-gray-900 font-semibold truncate">
            {product.name}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-gray-900 font-bold text-sm">
            {product.unitsSold}
          </div>
          <div className="text-gray-500 text-xs">sold</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        <div>
          <div className="text-gray-500">Price</div>
          <div className="text-gray-900 font-medium">
            RM {formatCurrency(product.price)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Cost</div>
          <div className="text-gray-700 font-medium">
            RM {formatCurrency(product.cost)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Stock</div>
          <div className="text-gray-700 font-medium">
            {product.stockBalance}
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
        <span>Last: {product.lastTransactionDate || "—"}</span>
        {product.restockUrgency && product.restockUrgency !== "none" && (
          <span
            className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${urgencyBadgeClasses(product.restockUrgency)}`}
          >
            +{product.restockQty} {product.restockUrgency.toUpperCase()}
          </span>
        )}
      </div>
    </Link>
  );
}

function ProductTableHeader() {
  return (
    <div
      className="grid gap-2 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-700 border-b border-gray-200"
      style={{ gridTemplateColumns: gridCols }}
    >
      <div>SKU</div>
      <div>Product</div>
      <div className="text-right">Price</div>
      <div className="text-right">Cost</div>
      <div className="text-right">Stock</div>
      <div className="text-right">Sold</div>
      <div className="text-right">Restock</div>
      <div className="text-right">Last Sale</div>
    </div>
  );
}

function GroupSection({
  group,
  accent,
  isExpanded,
  onToggle,
}: {
  group: ProductGroup;
  accent: "blue" | "green" | "amber";
  isExpanded: boolean;
  onToggle: (key: string) => void;
}) {
  const gradient =
    accent === "blue"
      ? "from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200"
      : accent === "amber"
        ? "from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200"
        : "from-green-50 to-green-100 hover:from-green-100 hover:to-green-200";
  const textColor =
    accent === "blue"
      ? "text-blue-700"
      : accent === "amber"
        ? "text-amber-700"
        : "text-green-700";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <button
        onClick={() => onToggle(group.key)}
        aria-expanded={isExpanded}
        className={`w-full bg-linear-to-r ${gradient} px-4 py-3 transition-colors text-left`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span
              className={`text-lg transform transition-transform shrink-0 ${isExpanded ? "rotate-90" : "rotate-0"}`}
            >
              ▶
            </span>
            <div className="min-w-0">
              <h3
                className={`font-bold text-sm md:text-base truncate ${
                  group.label === "Uncategorized" ? "text-red-700" : textColor
                }`}
              >
                {group.label}
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                {group.productCount} items • {group.totalUnits} sold
                {!!group.legacyUnattributedUnits &&
                  group.legacyUnattributedUnits > 0 && (
                    <span
                      className="ml-1 text-amber-700"
                      title="Sales recorded on the parent SKU before variants existed — can't be attributed to a specific variant"
                    >
                      ⚠ {group.legacyUnattributedUnits} legacy/unattributed
                    </span>
                  )}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 text-xs md:text-sm">
            <p className="font-semibold text-gray-900">
              RM {formatCurrency(group.totalStockValue)}
            </p>
            <p className="text-gray-500">{group.totalStockBalance} units</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="md:border-t md:border-gray-200 md:divide-y md:divide-gray-100">
          <div className="hidden md:block">
            <ProductTableHeader />
            {group.products.map((product) => (
              <DesktopRow key={product.sku + product.name} product={product} />
            ))}
          </div>
          <div className="md:hidden space-y-2 px-3 py-3">
            {group.products.map((product) => (
              <MobileCard key={product.sku + product.name} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type ViewMode = "all" | "category" | "supplier" | "variant";
type SortKey = "name" | "price" | "cost" | "stock" | "sold" | "margin";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

function formatRelativeDays(daysAgo: number) {
  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "1 day ago";
  if (daysAgo > 1) return `${daysAgo} days ago`;
  return "future";
}

function daysAgoFrom(dateStr: string) {
  const txDate = new Date(dateStr);
  const today = new Date();
  const malaysiaOffset = 8 * 60;
  const utcOffset = today.getTimezoneOffset();
  const offsetDifference = malaysiaOffset + utcOffset;
  const malaysiaNow = new Date(today.getTime() + offsetDifference * 60 * 1000);
  malaysiaNow.setHours(0, 0, 0, 0);

  const txDateLocal = new Date(txDate.getTime() + offsetDifference * 60 * 1000);
  txDateLocal.setHours(0, 0, 0, 0);

  return Math.floor(
    (malaysiaNow.getTime() - txDateLocal.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default function ProductsClient() {
  // Support deep-linking in from the product detail page, e.g.
  // /products?category=Bag or /products?supplier=Inaranur
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";
  const initialSupplier = searchParams.get("supplier") || "";

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(initialSupplier ? [initialSupplier] : []),
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialSupplier ? "supplier" : "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  // Get storeId from environment variable (set in .env.local)
  const storeId = process.env.NEXT_PUBLIC_STOREHUB_STORE_ID || "";

  // Fetch data from API hooks
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
  const { data: inventoryData, loading: inventoryLoading } =
    useInventory(storeId);
  const { data: suppliersData } = useSuppliers();
  const { data: bulkRestockData } = useBulkRestockAdvice(storeId);

  // Build the full, flat product list once (sales, inventory, supplier all
  // merged in) — grouping/sorting/filtering below all derive from this.
  const allProducts = useMemo<ProductData[]>(() => {
    if (!productsData || !transactionsData) return [];

    const inventoryMap = new Map<
      string,
      { quantityOnHand: number; warningStock?: number; idealStock?: number }
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

    const skuCounts = new Map<
      string,
      { units: number; revenue: number; lastDate?: string }
    >();
    const nameCounts = new Map<
      string,
      { units: number; revenue: number; lastDate?: string }
    >();

    for (const transaction of transactionsData) {
      if (!transaction.items || transaction.status !== "completed") continue;
      const txDate = transaction.timestamp;

      for (const item of transaction.items) {
        const rawSku = item.sku || "";
        const qty = item.quantity || 0;
        const itemTotal = item.totalPrice || 0;
        if (qty <= 0) continue;

        // Fold legacy/superseded SKUs into their canonical SKU (see
        // lib/productAliases.ts) — e.g. a discontinued 6-pack SKU's sales
        // get converted to piece-equivalent units of the SKU that replaced
        // it, so history isn't split across two "different" products.
        const sku = resolveCanonicalSku(rawSku);
        const unitMultiplier = rawSku ? getAliasMultiplier(rawSku) : 1;
        const effectiveQty = qty * unitMultiplier;

        const bucket = sku ? skuCounts : item.productName ? nameCounts : null;
        const bucketKey = sku || item.productName;
        if (!bucket || !bucketKey) continue;

        const current = bucket.get(bucketKey) || { units: 0, revenue: 0 };
        current.units += effectiveQty;
        current.revenue += itemTotal;
        if (
          !current.lastDate ||
          new Date(txDate) > new Date(current.lastDate)
        ) {
          current.lastDate = txDate;
        }
        bucket.set(bucketKey, current);
      }
    }

    const supplierMap = suppliersData || {};

    const rows = (productsData as ApiProduct[]).map((product) => {
      const sku = String(product.sku || "");
      const name = String(product.name || "");
      const productId = product.id || "";
      const cost = Number(product.cost) || 0;
      const price = Number(product.unitPrice) || 0;
      const category = String(product.category || "Uncategorized");

      let saleData = skuCounts.get(sku) || { units: 0, revenue: 0 };
      if (!sku && name) {
        saleData = nameCounts.get(name) || { units: 0, revenue: 0 };
      }

      let lastTransactionDate: string | undefined;
      if (saleData.lastDate) {
        lastTransactionDate = formatRelativeDays(
          daysAgoFrom(saleData.lastDate),
        );
      }

      let stockBalance = Number(product.quantity) || 0;
      let warningStock: number | undefined;
      let idealStock: number | undefined;

      if (productId && inventoryMap.has(productId)) {
        const invData = inventoryMap.get(productId)!;
        stockBalance = invData.quantityOnHand;
        warningStock = invData.warningStock;
        idealStock = invData.idealStock;
      }

      const lowStock =
        warningStock !== undefined && stockBalance <= warningStock;

      const parentSku = getParentSku(sku);
      const variantLabel = getVariantLabel(sku);

      const advice = (
        bulkRestockData as Record<
          string,
          {
            reorderPoint: number;
            quantity: number;
            urgency: "critical" | "high" | "medium" | "low" | "none";
          }
        > | null
      )?.[sku];

      return {
        sku,
        name,
        category,
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
        supplier: supplierMap[sku] || "Unknown Supplier",
        lowStock,
        reorderPoint: advice?.reorderPoint,
        restockQty: advice?.quantity,
        restockUrgency: advice?.urgency,
        parentSku,
        variantLabel,
        isVariantParent: false, // resolved below, once we have the full list
        isLegacyParentSale: false,
      };
    });

    // Fold any legacy/superseded SKU's remaining stock into its canonical
    // SKU (converted by the alias's unit multiplier — see
    // lib/productAliases.ts), then drop the legacy row entirely: it's not
    // a distinct product, just an old code name for the same item, so it
    // should never show up as its own line.
    const rowBySku = new Map(rows.map((r) => [r.sku, r]));
    for (const row of rows) {
      if (!isLegacyAliasSku(row.sku)) continue;
      const canonical = rowBySku.get(resolveCanonicalSku(row.sku));
      if (canonical) {
        canonical.stockBalance +=
          row.stockBalance * getAliasMultiplier(row.sku);
      }
    }
    return rows.filter((r) => !isLegacyAliasSku(r.sku));
  }, [
    productsData,
    transactionsData,
    inventoryData,
    suppliersData,
    bulkRestockData,
  ]);

  // Second pass: now that we have the full flat list, mark which SKUs are
  // themselves a parent (i.e. some other product's parentSku points at
  // them) and flag "legacy" sales sitting on a parent row that has variants
  // — sales recorded before the variant split, which can't be attributed
  // to any single variant (see lib/productVariants.ts).
  const productsResolved = useMemo<ProductData[]>(() => {
    const parentSkus = new Set(
      allProducts.map((p) => p.parentSku).filter(Boolean),
    );
    return allProducts.map((p) => {
      const isVariantParent = parentSkus.has(p.sku);
      return {
        ...p,
        isVariantParent,
        isLegacyParentSale: isVariantParent && p.unitsSold > 0,
      };
    });
  }, [allProducts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of productsResolved) set.add(p.category);
    return Array.from(set).sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
  }, [productsResolved]);

  const sortProducts = (list: ProductData[]) => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "price":
          return (a.price - b.price) * dir;
        case "cost":
          return (a.cost - b.cost) * dir;
        case "stock":
          return (a.stockBalance - b.stockBalance) * dir;
        case "sold":
          return (a.unitsSold - b.unitsSold) * dir;
        case "margin":
          return (a.margin - b.margin) * dir;
        case "name":
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    });
  };

  // Apply search / category / low-stock filters to the flat product list.
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = productsResolved;

    // A parent SKU that has variants is just a container row once split —
    // hide it everywhere (flat/category/supplier/variant views alike)
    // unless it still carries legacy/unattributed sales worth surfacing
    // (see isLegacyParentSale in lib/productVariants.ts).
    list = list.filter((p) => !p.isVariantParent || p.isLegacyParentSale);

    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term),
      );
    }
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (lowStockOnly) {
      list = list.filter((p) => p.lowStock);
    }
    return list;
  }, [productsResolved, searchTerm, categoryFilter, lowStockOnly]);

  const sortedFlatProducts = useMemo(
    () => sortProducts(filteredProducts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredProducts, sortKey, sortDir],
  );

  const pagedFlatProducts = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedFlatProducts.slice(start, start + PAGE_SIZE);
  }, [sortedFlatProducts, page]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedFlatProducts.length / PAGE_SIZE),
  );

  const buildGroups = (groupFn: (p: ProductData) => string): ProductGroup[] => {
    const groups = new Map<string, ProductGroup>();
    for (const product of filteredProducts) {
      const key = groupFn(product);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: key,
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
      group.totalRevenue += product.revenue;
      group.totalCost += product.cost * product.unitsSold;
      group.totalUnits += product.unitsSold;
      group.totalStockBalance += product.stockBalance;
      group.totalStockValue += product.stockBalance * product.cost;
      if (product.isLegacyParentSale) {
        group.legacyUnattributedUnits =
          (group.legacyUnattributedUnits || 0) + product.unitsSold;
      }
      group.products.push(product);
    }

    const sorted = Array.from(groups.values()).sort((a, b) => {
      if (a.label === "Uncategorized") return 1;
      if (b.label === "Uncategorized") return -1;
      return a.label.localeCompare(b.label);
    });
    for (const group of sorted) {
      group.products = sortProducts(group.products);
    }
    return sorted;
  };

  const categoryGroups = useMemo(
    () => buildGroups((p) => p.category),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredProducts, sortKey, sortDir],
  );

  const supplierGroups = useMemo(
    () => buildGroups((p) => p.supplier),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredProducts, sortKey, sortDir],
  );

  // Variant groups: bundle a parent SKU together with all its variants
  // (e.g. TR012 + TR012-Animal Bear, TR012-Durian, ...) so you can compare
  // which variant is actually moving. Standalone products (no variants)
  // each get their own single-item group. See lib/productVariants.ts.
  const variantGroups = useMemo(() => {
    const groups = buildGroups((p) =>
      p.parentSku ? p.parentSku : p.isVariantParent ? p.sku : `__solo:${p.sku}`,
    );
    for (const group of groups) {
      if (group.key.startsWith("__solo:")) {
        group.label = group.products[0]?.name || group.key;
      } else {
        group.label = getParentDisplayName(group.key);
        // Hide the parent SKU's own row once it has variants — it's just
        // a container in this view, not a sellable line, UNLESS it has
        // legacy/unattributed sales worth surfacing (see isLegacyParentSale
        // in lib/productVariants.ts).
        group.products = group.products.filter(
          (p) => !p.isVariantParent || p.isLegacyParentSale,
        );
        group.productCount = group.products.length;
      }
      // Sort variants within a group by units sold (best movers first) so
      // the whole point of grouping — spotting the fast vs slow variant —
      // is visible at a glance, regardless of the page-level sort setting.
      group.products = [...group.products].sort(
        (a, b) => b.unitsSold - a.unitsSold,
      );
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts, sortKey, sortDir]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loading = productsLoading || transactionsLoading;
  const fetchError = productsError || transactionsError;

  // Loading state
  if (loading) {
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

  // Error state
  if (fetchError) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">
            Couldn&apos;t load products
          </h1>
          <p className="text-sm text-gray-600">
            {fetchError.message ||
              "Something went wrong while fetching product data. Please try again."}
          </p>
        </div>
      </div>
    );
  }

  const totalProducts = filteredProducts.length;
  const totalStock = filteredProducts.reduce(
    (sum, p) => sum + p.stockBalance,
    0,
  );
  const totalStockValue = filteredProducts.reduce(
    (sum, p) => sum + p.stockBalance * p.cost,
    0,
  );

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* Sticky Header — offset below the site-wide Header (see --app-header-height in components/Header.tsx) so the two don't collide/overlap on scroll */}
      <div
        className="sticky z-40 bg-white border-b border-gray-200 shadow-sm"
        style={{ top: "var(--app-header-height, 64px)" }}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Products
            </h1>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("all")}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                  viewMode === "all"
                    ? "bg-purple-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setViewMode("category")}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                  viewMode === "category"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Category
              </button>
              <button
                onClick={() => setViewMode("supplier")}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                  viewMode === "supplier"
                    ? "bg-green-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Supplier
              </button>
              <button
                onClick={() => setViewMode("variant")}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                  viewMode === "variant"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Variants
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Sort Bar */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-white space-y-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-2 text-gray-400 text-sm">
            🔍
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(0);
            }}
            className="px-2.5 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-2.5 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
            <option value="cost">Sort: Cost</option>
            <option value="stock">Sort: Stock</option>
            <option value="sold">Sort: Units Sold</option>
            <option value="margin">Sort: Margin</option>
          </select>

          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="px-2.5 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>

          <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(0);
              }}
            />
            Low stock only
          </label>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6">
        {totalProducts === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-sm">
              No products match your filters
            </p>
          </div>
        ) : viewMode === "supplier" ? (
          <div className="space-y-3">
            {supplierGroups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                accent="green"
                isExpanded={expandedGroups.has(group.key)}
                onToggle={toggleGroup}
              />
            ))}
          </div>
        ) : viewMode === "variant" ? (
          <div className="space-y-3">
            {variantGroups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                accent="amber"
                isExpanded={expandedGroups.has(group.key)}
                onToggle={toggleGroup}
              />
            ))}
          </div>
        ) : viewMode === "category" ? (
          <div className="space-y-3">
            {categoryGroups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                accent="blue"
                isExpanded={expandedGroups.has(group.key)}
                onToggle={toggleGroup}
              />
            ))}
          </div>
        ) : (
          // FLAT LIST VIEW (paginated)
          <>
            <div className="md:bg-white md:border md:border-gray-200 md:rounded-lg md:overflow-hidden">
              {/* Desktop: header stays sticky to the TOP OF THIS SCROLL PANEL
                  (not the page) — avoids fragile offset math against the
                  page-level sticky headers, which caused the header to drift
                  and overlap data rows. */}
              <div className="hidden md:block  overflow-y-auto">
                <div className="sticky top-0 z-10">
                  <ProductTableHeader />
                </div>
                <div className="divide-y divide-gray-100">
                  {pagedFlatProducts.map((product) => (
                    <DesktopRow
                      key={product.sku + product.name}
                      product={product}
                    />
                  ))}
                </div>
              </div>

              <div className="md:hidden space-y-2 px-3 py-3">
                {pagedFlatProducts.map((product) => (
                  <MobileCard
                    key={product.sku + product.name}
                    product={product}
                  />
                ))}
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <span className="text-gray-600">
                  Page {page + 1} of {totalPages} ({sortedFlatProducts.length}{" "}
                  products)
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              Total Products
            </p>
            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              {viewMode === "category"
                ? "Categories"
                : viewMode === "supplier"
                  ? "Suppliers"
                  : viewMode === "variant"
                    ? "Product Groups"
                    : "Groups"}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {viewMode === "category"
                ? categoryGroups.length
                : viewMode === "supplier"
                  ? supplierGroups.length
                  : viewMode === "variant"
                    ? variantGroups.length
                    : "—"}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              Total Stock
            </p>
            <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
            <p className="text-gray-600 text-xs font-medium mb-1">
              Stock Value
            </p>
            <p className="text-2xl font-bold text-green-700">
              RM {formatCurrency(totalStockValue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
