/**
 * Manual SKU merge/alias config.
 *
 * Unlike parent/variant relationships (lib/productVariants.ts), which come
 * from StoreHub's CSV export, this is for cases where a product was
 * discontinued/renamed/restructured in StoreHub and staff manually started
 * using a different SKU for what is, in reality, the exact same physical
 * product — just sold in a different unit size.
 *
 * Example: SH0100 "STRIP KEYCHAIN" used to be sold as a bundle of 6. It's
 * now discontinued and the same keychains are sold individually under
 * SH0053 "PS Keychain (5)". Historical stock/sales recorded against SH0100
 * should be folded into SH0053 (converted to piece-equivalent units) so
 * reporting, stock levels, and restock advice all reflect ONE product
 * instead of splitting its history across two unrelated-looking SKUs.
 *
 * Add new entries here whenever this happens again — no other code needs
 * to change, everything that reads `resolveCanonicalSku` / the merge
 * helpers below picks it up automatically.
 */
export interface SkuAlias {
  /** The old/discontinued SKU whose history should be folded in. */
  legacySku: string;
  /** The SKU currently used for this product going forward. */
  canonicalSku: string;
  /**
   * How many canonical units one legacy unit equals. E.g. legacySku sold
   * as a 6-pack, canonicalSku now sold per piece -> 6. Use 1 if the units
   * are the same size and only the SKU/code changed.
   */
  unitsPerLegacyUnit: number;
  note?: string;
}

export const SKU_ALIASES: SkuAlias[] = [
  {
    legacySku: "SH0100",
    canonicalSku: "SH0053",
    unitsPerLegacyUnit: 6,
    note: "STRIP KEYCHAIN (bundle of 6) discontinued; now sold as individual PS Keychain (5) pieces under SH0053.",
  },
];

const aliasByLegacySku = new Map(SKU_ALIASES.map((a) => [a.legacySku, a]));
const legacySkusByCanonical = new Map<string, SkuAlias[]>();
for (const alias of SKU_ALIASES) {
  const list = legacySkusByCanonical.get(alias.canonicalSku) || [];
  list.push(alias);
  legacySkusByCanonical.set(alias.canonicalSku, list);
}

/** True if this SKU has been superseded by another (should never be shown as its own row). */
export function isLegacyAliasSku(sku: string): boolean {
  return aliasByLegacySku.has(sku);
}

/** Resolves a legacy SKU to the canonical SKU it should be merged into (or itself if not aliased). */
export function resolveCanonicalSku(sku: string): string {
  return aliasByLegacySku.get(sku)?.canonicalSku || sku;
}

/** All legacy SKUs (with their unit multiplier) that fold into this canonical SKU. */
export function getLegacyAliasesFor(canonicalSku: string): SkuAlias[] {
  return legacySkusByCanonical.get(canonicalSku) || [];
}

/** Unit multiplier to apply when converting a legacy SKU's quantity into canonical units. */
export function getAliasMultiplier(legacySku: string): number {
  return aliasByLegacySku.get(legacySku)?.unitsPerLegacyUnit || 1;
}
