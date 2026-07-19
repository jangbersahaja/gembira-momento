/**
 * Parent/variant relationships for products that have multiple SKU variants
 * (e.g. TR012 "Gold Foil Postcard (10)" with variants like
 * TR012-Animal Bear, TR012-Durian, etc).
 *
 * StoreHub's live `/products` API only exposes `isParentProduct` (a bool),
 * not the parent SKU on each variant row. The CSV export we keep in
 * `data/products.ts` (see CSV_SETUP.md / scripts/generateProductsTS.js)
 * *does* carry a "Parent Product SKU" column per variant, so we use that
 * static snapshot purely as relationship metadata — it changes rarely,
 * unlike prices/stock which we always read live from StoreHub.
 *
 * NOTE: some variants were added to StoreHub after the parent SKU already
 * had sales history. Historical transactions made before the split are
 * still recorded against the parent SKU, not the variant — so a parent
 * row can show `unitsSold > 0` even though all current stock lives on its
 * variants. Treat parent-level sales in a variant group as "legacy /
 * unattributed" rather than a genuine competing SKU.
 */
import products from "@/data/products";

export interface VariantInfo {
  parentSku: string; // "" if this SKU is not a variant of anything
  variantLabel: string; // e.g. "Animal Bear" — derived from Variant Value 1
}

const variantInfoBySku = new Map<string, VariantInfo>();
// parentSku -> a clean base product name (variant suffix stripped), taken
// from whichever row we see first for that parent.
const parentDisplayName = new Map<string, string>();

for (const row of products as Record<string, string>[]) {
  const sku = row["SKU"]?.trim();
  if (!sku) continue;

  const parentSku = row["Parent Product SKU"]?.trim() || "";
  const variantLabel = row["Variant Value 1"]?.trim() || "";
  variantInfoBySku.set(sku, { parentSku, variantLabel });

  if (!parentSku) {
    // This row IS a parent (or a standalone product) — remember its name
    // as the group's display name.
    const name = row["Product Name"]?.trim();
    if (name && !parentDisplayName.has(sku)) parentDisplayName.set(sku, name);
  }
}

/** Returns the parent SKU for a variant, or "" if the SKU isn't a variant. */
export function getParentSku(sku: string): string {
  return variantInfoBySku.get(sku)?.parentSku || "";
}

/** Returns the variant's own label (e.g. "Animal Bear"), or "" if none. */
export function getVariantLabel(sku: string): string {
  return variantInfoBySku.get(sku)?.variantLabel || "";
}

/** Best-effort display name for a parent SKU's product group. */
export function getParentDisplayName(parentSku: string): string {
  return parentDisplayName.get(parentSku) || parentSku;
}
