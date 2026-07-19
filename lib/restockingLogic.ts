/**
 * Restocking advisory engine.
 *
 * Data sources (in priority order):
 *  1. `stock_snapshots` — quantity-on-hand captured automatically once a
 *     day at 8pm (see app/api/cron/capture-snapshots), regardless of staff
 *     clock-in/clock-out times. This gives a real, day-by-day depletion
 *     curve per SKU.
 *  2. `restock_events` — known stock-ups (purchase orders, stock takes,
 *     stock returns), used to separate "sold" depletion from "restocked"
 *     jumps when reading the snapshot curve, and to estimate typical
 *     restock lead time / order size per supplier.
 *  3. Fallback: legacy 30-day transaction average (previous behaviour),
 *     used only while a SKU has fewer than 2 snapshots on record yet.
 */
import { sql } from "@/lib/db";
import { getAliasMultiplier, getLegacyAliasesFor } from "@/lib/productAliases";

export type Urgency = "critical" | "high" | "medium" | "low" | "none";

export interface RestockAdvice {
  shouldRestock: boolean;
  quantity: number;
  urgency: Urgency;
  daysUntilStockout?: number;
  reason: string;
  dailySalesVelocity: number;
  /** Stock level at which a reorder should be triggered. */
  reorderPoint: number;
  /** Recommended stock level to reach after restocking. */
  targetStock: number;
  /** Estimated restock lead time (days) used to compute the above. */
  leadTimeDays: number;
  /** Extra days of cover the target stock provides beyond lead time + buffer. */
  coverageDays: number;
  dataSource: "snapshots" | "estimated";
  snapshotCount: number;
  lastSnapshotAt?: string;
}

interface StockSnapshotRow {
  quantity: string; // numeric comes back as string from pg
  event_type: "clock_in" | "clock_out" | "manual" | "daily";
  captured_at: string;
}

interface RestockEventRow {
  quantity: string;
  occurred_at: string;
}

// Tunable defaults — used when there isn't enough history to estimate them
// per-SKU. Kept as named constants so they're easy to adjust in one place.
const DEFAULT_LEAD_TIME_DAYS = 7;
const MIN_LEAD_TIME_DAYS = 2;
const MAX_LEAD_TIME_DAYS = 30;
const SAFETY_BUFFER_DAYS = 3;
const COVERAGE_DAYS = 14;

/**
 * Compute a daily "units sold per day" velocity from a chronological list
 * of stock snapshots, ignoring any interval where stock went UP (that's a
 * restock, not a sale) or where a known restock_event happened in between
 * (so we don't misread "big jump then normal decline" as a sales spike).
 */
function computeVelocityFromSnapshots(
  snapshots: StockSnapshotRow[],
  restockEvents: RestockEventRow[],
): { velocity: number; consumedDays: number } {
  if (snapshots.length < 2) return { velocity: 0, consumedDays: 0 };

  let totalConsumed = 0;
  let totalDays = 0;

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const prevQty = Number(prev.quantity);
    const currQty = Number(curr.quantity);
    const prevTime = new Date(prev.captured_at).getTime();
    const currTime = new Date(curr.captured_at).getTime();
    const days = (currTime - prevTime) / (1000 * 60 * 60 * 24);
    if (days <= 0) continue;

    // Was there a restock recorded in this window? If so, skip this
    // interval for velocity purposes — the jump isn't a sales signal.
    const restockedInWindow = restockEvents.some((r) => {
      const t = new Date(r.occurred_at).getTime();
      return t > prevTime && t <= currTime && Number(r.quantity) > 0;
    });

    const delta = prevQty - currQty; // positive = stock went down (sold)
    if (delta > 0 && !restockedInWindow) {
      totalConsumed += delta;
      totalDays += days;
    }
    // if delta <= 0 (stock flat or went up) we simply don't count it toward velocity
  }

  if (totalDays === 0) return { velocity: 0, consumedDays: 0 };
  return { velocity: totalConsumed / totalDays, consumedDays: totalDays };
}

/**
 * Estimate this SKU's typical restock lead time from the average gap
 * between historical restock events (purchase orders / stock takes /
 * detected restocks). Falls back to DEFAULT_LEAD_TIME_DAYS when there
 * aren't at least 2 restock events to measure a gap from, and clamps the
 * result to a sane range so one weird outlier doesn't skew everything.
 */
function estimateLeadTimeDays(restockEvents: RestockEventRow[]): number {
  const restockTimestamps = restockEvents
    .filter((r) => Number(r.quantity) > 0)
    .map((r) => new Date(r.occurred_at).getTime())
    .sort((a, b) => a - b);

  if (restockTimestamps.length < 2) return DEFAULT_LEAD_TIME_DAYS;

  const gapsDays: number[] = [];
  for (let i = 1; i < restockTimestamps.length; i++) {
    const gap =
      (restockTimestamps[i] - restockTimestamps[i - 1]) / (1000 * 60 * 60 * 24);
    if (gap > 0) gapsDays.push(gap);
  }
  if (gapsDays.length === 0) return DEFAULT_LEAD_TIME_DAYS;

  const avgGap = gapsDays.reduce((sum, g) => sum + g, 0) / gapsDays.length;
  return Math.min(MAX_LEAD_TIME_DAYS, Math.max(MIN_LEAD_TIME_DAYS, avgGap));
}

export async function getRestockAdvice(params: {
  sku: string;
  currentStock: number;
  fallbackDailyVelocity: number;
}): Promise<RestockAdvice> {
  const { sku, currentStock, fallbackDailyVelocity } = params;

  // Fold in any legacy SKUs that have been superseded by this one (e.g. a
  // discontinued bundle SKU now sold under a different piece-count SKU —
  // see lib/productAliases.ts) so their historical stock/restock signal
  // still contributes to this product's velocity, converted to this SKU's
  // unit size.
  const legacyAliases = getLegacyAliasesFor(sku);
  const skusToFetch = [sku, ...legacyAliases.map((a) => a.legacySku)];

  let snapshots: StockSnapshotRow[] = [];
  let restockEvents: RestockEventRow[] = [];

  try {
    const rawSnapshots = (await sql`
      SELECT sku, quantity, event_type, captured_at
      FROM stock_snapshots
      WHERE sku = ANY(${skusToFetch})
      ORDER BY captured_at ASC
    `) as unknown as (StockSnapshotRow & { sku: string })[];
    const rawRestockEvents = (await sql`
      SELECT sku, quantity, occurred_at
      FROM restock_events
      WHERE sku = ANY(${skusToFetch})
      ORDER BY occurred_at ASC
    `) as unknown as (RestockEventRow & { sku: string })[];

    snapshots = rawSnapshots
      .map((row) => {
        const multiplier = getAliasMultiplier(row.sku);
        return multiplier === 1
          ? row
          : { ...row, quantity: String(Number(row.quantity) * multiplier) };
      })
      .sort(
        (a, b) =>
          new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
      );
    restockEvents = rawRestockEvents
      .map((row) => {
        const multiplier = getAliasMultiplier(row.sku);
        return multiplier === 1
          ? row
          : { ...row, quantity: String(Number(row.quantity) * multiplier) };
      })
      .sort(
        (a, b) =>
          new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
      );
  } catch (err) {
    console.error(`[restockingLogic] DB query failed for sku=${sku}:`, err);
  }

  return computeAdvice(
    currentStock,
    fallbackDailyVelocity,
    snapshots,
    restockEvents,
  );
}

/**
 * Compute restocking advice for MANY SKUs at once using just two DB queries
 * total (instead of two-per-SKU) — used by the /products list page so it
 * can show reorder point / urgency for every row without N+1 requests.
 */
export async function getBulkRestockAdvice(
  items: { sku: string; currentStock: number; fallbackDailyVelocity: number }[],
): Promise<Map<string, RestockAdvice>> {
  const result = new Map<string, RestockAdvice>();
  if (items.length === 0) return result;

  const canonicalSkus = items.map((i) => i.sku).filter(Boolean);
  if (canonicalSkus.length === 0) return result;

  // Also pull in any legacy SKUs aliased to one of these canonical SKUs
  // (see lib/productAliases.ts) so their history contributes here instead
  // of being computed as if it were a separate, unrelated product.
  const legacySkus = canonicalSkus.flatMap((sku) =>
    getLegacyAliasesFor(sku).map((a) => a.legacySku),
  );
  const skus = [...canonicalSkus, ...legacySkus];

  let allSnapshots: (StockSnapshotRow & { sku: string })[] = [];
  let allRestockEvents: (RestockEventRow & { sku: string })[] = [];

  try {
    allSnapshots = (await sql`
      SELECT sku, quantity, event_type, captured_at
      FROM stock_snapshots
      WHERE sku = ANY(${skus})
      ORDER BY captured_at ASC
    `) as unknown as (StockSnapshotRow & { sku: string })[];

    allRestockEvents = (await sql`
      SELECT sku, quantity, occurred_at
      FROM restock_events
      WHERE sku = ANY(${skus})
      ORDER BY occurred_at ASC
    `) as unknown as (RestockEventRow & { sku: string })[];
  } catch (err) {
    console.error("[restockingLogic] Bulk DB query failed:", err);
  }

  // Group every row under its CANONICAL sku (resolving legacy aliases and
  // scaling quantity by the alias's unit multiplier), then merge/sort by
  // time so a canonical SKU's velocity reflects its full merged history.
  const snapshotsBySku = new Map<string, StockSnapshotRow[]>();
  for (const row of allSnapshots) {
    const multiplier = getAliasMultiplier(row.sku);
    const canonicalSku =
      canonicalSkus.find((s) =>
        getLegacyAliasesFor(s).some((a) => a.legacySku === row.sku),
      ) || row.sku;
    const scaledRow =
      multiplier === 1
        ? row
        : { ...row, quantity: String(Number(row.quantity) * multiplier) };
    const list = snapshotsBySku.get(canonicalSku) || [];
    list.push(scaledRow);
    snapshotsBySku.set(canonicalSku, list);
  }
  for (const list of snapshotsBySku.values()) {
    list.sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    );
  }

  const restockEventsBySku = new Map<string, RestockEventRow[]>();
  for (const row of allRestockEvents) {
    const multiplier = getAliasMultiplier(row.sku);
    const canonicalSku =
      canonicalSkus.find((s) =>
        getLegacyAliasesFor(s).some((a) => a.legacySku === row.sku),
      ) || row.sku;
    const scaledRow =
      multiplier === 1
        ? row
        : { ...row, quantity: String(Number(row.quantity) * multiplier) };
    const list = restockEventsBySku.get(canonicalSku) || [];
    list.push(scaledRow);
    restockEventsBySku.set(canonicalSku, list);
  }
  for (const list of restockEventsBySku.values()) {
    list.sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );
  }

  for (const item of items) {
    const advice = computeAdvice(
      item.currentStock,
      item.fallbackDailyVelocity,
      snapshotsBySku.get(item.sku) || [],
      restockEventsBySku.get(item.sku) || [],
    );
    result.set(item.sku, advice);
  }

  return result;
}

function computeAdvice(
  currentStock: number,
  fallbackDailyVelocity: number,
  snapshots: StockSnapshotRow[],
  restockEvents: RestockEventRow[],
): RestockAdvice {
  let dailySalesVelocity: number;
  let dataSource: "snapshots" | "estimated";

  if (snapshots.length >= 2) {
    const { velocity } = computeVelocityFromSnapshots(snapshots, restockEvents);
    // If snapshot history is too sparse to produce a signal yet, blend with
    // the transaction-based fallback rather than reporting 0.
    dailySalesVelocity = velocity > 0 ? velocity : fallbackDailyVelocity;
    dataSource = velocity > 0 ? "snapshots" : "estimated";
  } else {
    dailySalesVelocity = fallbackDailyVelocity;
    dataSource = "estimated";
  }

  const leadTimeDays = estimateLeadTimeDays(restockEvents);
  const reorderPoint = dailySalesVelocity * (leadTimeDays + SAFETY_BUFFER_DAYS);
  const targetStock =
    dailySalesVelocity * (leadTimeDays + SAFETY_BUFFER_DAYS + COVERAGE_DAYS);

  const lastSnapshot = snapshots[snapshots.length - 1];

  // No sales history at all — can't estimate demand, so don't pretend to.
  if (dailySalesVelocity <= 0) {
    const outOfStock = currentStock <= 0;
    return {
      shouldRestock: outOfStock,
      quantity: 0,
      urgency: outOfStock ? "high" : "none",
      reason: outOfStock
        ? "Out of stock, but no recent sales history to size a reorder — check manually"
        : "Not enough sales history yet to estimate restocking needs",
      dailySalesVelocity: 0,
      reorderPoint: 0,
      targetStock: 0,
      leadTimeDays,
      coverageDays: COVERAGE_DAYS,
      dataSource,
      snapshotCount: snapshots.length,
      lastSnapshotAt: lastSnapshot?.captured_at,
    };
  }

  const daysUntilStockout = Math.max(
    0,
    Math.floor(currentStock / dailySalesVelocity),
  );

  let urgency: Urgency = "none";
  let reason = `Stock healthy — ~${daysUntilStockout} days of cover left`;

  if (currentStock <= 0) {
    urgency = "critical";
    reason = "Out of stock";
  } else if (currentStock <= reorderPoint * 0.5) {
    urgency = "critical";
    reason = `Critically low — only ~${daysUntilStockout} day(s) of stock left`;
  } else if (currentStock <= reorderPoint) {
    urgency = "high";
    reason = `Below reorder point — ~${daysUntilStockout} days of stock left`;
  } else {
    const daysUntilReorderPoint = Math.floor(
      (currentStock - reorderPoint) / dailySalesVelocity,
    );
    if (daysUntilReorderPoint <= 7) {
      urgency = "medium";
      reason = `Will hit reorder point in ~${daysUntilReorderPoint} days`;
    } else if (daysUntilReorderPoint <= 14) {
      urgency = "low";
      reason = `Will hit reorder point in ~${daysUntilReorderPoint} days`;
    }
  }

  const restockQuantity = Math.max(0, targetStock - currentStock);
  const shouldRestock = currentStock <= reorderPoint && restockQuantity > 0;

  return {
    shouldRestock,
    quantity: Math.ceil(restockQuantity),
    urgency,
    daysUntilStockout,
    reason,
    dailySalesVelocity,
    reorderPoint: Math.round(reorderPoint),
    targetStock: Math.round(targetStock),
    leadTimeDays: Math.round(leadTimeDays),
    coverageDays: COVERAGE_DAYS,
    dataSource,
    snapshotCount: snapshots.length,
    lastSnapshotAt: lastSnapshot?.captured_at,
  };
}
