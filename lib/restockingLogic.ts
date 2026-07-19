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

export type Urgency = "critical" | "high" | "medium" | "low" | "none";

export interface RestockAdvice {
  shouldRestock: boolean;
  quantity: number;
  urgency: Urgency;
  daysUntilStockout?: number;
  reason: string;
  dailySalesVelocity: number;
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

export async function getRestockAdvice(params: {
  sku: string;
  currentStock: number;
  warningLevel: number;
  idealLevel: number;
  fallbackDailyVelocity: number;
}): Promise<RestockAdvice> {
  const { sku, currentStock, warningLevel, idealLevel, fallbackDailyVelocity } =
    params;

  let snapshots: StockSnapshotRow[] = [];
  let restockEvents: RestockEventRow[] = [];

  try {
    snapshots = (await sql`
      SELECT quantity, event_type, captured_at
      FROM stock_snapshots
      WHERE sku = ${sku}
      ORDER BY captured_at ASC
    `) as unknown as StockSnapshotRow[];

    restockEvents = (await sql`
      SELECT quantity, occurred_at
      FROM restock_events
      WHERE sku = ${sku}
      ORDER BY occurred_at ASC
    `) as unknown as RestockEventRow[];
  } catch (err) {
    console.error(`[restockingLogic] DB query failed for sku=${sku}:`, err);
  }

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

  let urgency: Urgency = "none";
  let daysUntilStockout: number | undefined;
  let reason = "";

  if (currentStock <= warningLevel / 2) {
    urgency = "critical";
    reason = "Stock critically low";
  } else if (currentStock < warningLevel) {
    urgency = "high";
    reason = "Stock below warning level";
  } else if (dailySalesVelocity > 0) {
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

  const restockQuantity = Math.max(0, idealLevel - currentStock);
  const lastSnapshot = snapshots[snapshots.length - 1];

  return {
    shouldRestock: urgency !== "none" && restockQuantity > 0,
    quantity: Math.ceil(restockQuantity),
    urgency,
    daysUntilStockout,
    reason,
    dailySalesVelocity,
    dataSource,
    snapshotCount: snapshots.length,
    lastSnapshotAt: lastSnapshot?.captured_at,
  };
}
