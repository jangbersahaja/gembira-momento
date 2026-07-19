/**
 * Vercel Cron endpoint — captures ONE stock snapshot per SKU, once a day.
 *
 * Runs once daily at 8pm Malaysia time (12:00 UTC), regardless of staff
 * clock-in/clock-out times (see vercel.json: "0 12 * * *"). Vercel's Hobby
 * plan only allows once-per-day cron invocations, so this deliberately keeps
 * things simple: no lookback window, no shift/timesheet dependency.
 *
 * Each run:
 *  1. Fetches current inventory + product list for the store.
 *  2. Inserts one `stock_snapshots` row per SKU with today's date as the
 *     dedupe key (`shift_key` column holds YYYY-MM-DD — re-running the cron
 *     on the same day is a no-op via ON CONFLICT DO NOTHING).
 *  3. Auto-detects restocking by comparing today's snapshot against the most
 *     recent PRIOR snapshot for each SKU, adjusted for units sold in between:
 *     if stock is higher than sales alone would explain, the surplus is
 *     recorded as a `restock_events` row (source: 'detected').
 *
 * Secured with CRON_SECRET — Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * automatically when the env var is set.
 */
import { sql } from "@/lib/db";
import { getInventory, getProducts, getTransactions } from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

// Minimum surplus (units) before we treat a day-over-day stock increase as a
// genuine restock rather than rounding noise / a missed sale.
const STOCKING_EVENT_THRESHOLD = 1;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow (e.g. local/manual testing)
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = process.env.NEXT_PUBLIC_STOREHUB_STORE_ID || "";
  if (!storeId) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_STOREHUB_STORE_ID is not configured" },
      { status: 500 },
    );
  }

  try {
    const now = new Date();
    const today = toDateOnly(now);

    // Fetch current inventory + product list ONCE for this run (respects
    // StoreHub's 3 req/sec rate limit).
    const [inventory, products] = await Promise.all([
      getInventory(storeId),
      getProducts({ limit: 500 }),
    ]);

    const productIdToSku = new Map(products.map((p) => [p.id, p.sku]));

    let snapshotsInserted = 0;
    const todaySnapshots = new Map<string, number>();

    for (const item of inventory) {
      const sku = productIdToSku.get(item.productId);
      if (!sku) continue;

      todaySnapshots.set(sku, item.quantityOnHand);

      try {
        const result = await sql`
          INSERT INTO stock_snapshots (sku, product_id, store_id, quantity, event_type, shift_key, captured_at)
          VALUES (${sku}, ${item.productId}, ${storeId}, ${item.quantityOnHand}, 'daily', ${today}, ${now.toISOString()})
          ON CONFLICT (sku, shift_key) DO NOTHING
          RETURNING id
        `;
        if (result.length > 0) snapshotsInserted += 1;
      } catch (err) {
        console.error(
          `[capture-snapshots] failed to insert snapshot for sku=${sku}`,
          err,
        );
      }
    }

    const detectedEvents = await detectRestocking({
      today,
      todaySnapshots,
    });

    return NextResponse.json({
      date: today,
      snapshotsInserted,
      stockingEventsDetected: detectedEvents,
    });
  } catch (error) {
    console.error("[capture-snapshots] error:", error);
    return NextResponse.json(
      { error: "Failed to capture stock snapshots" },
      { status: 500 },
    );
  }
}

/**
 * Compares today's snapshot against the most recent PRIOR snapshot for each
 * SKU. If stock rose by more than sales during that gap would explain, the
 * surplus is recorded as an auto-detected restock event.
 */
async function detectRestocking(params: {
  today: string;
  todaySnapshots: Map<string, number>;
}): Promise<number> {
  const { today, todaySnapshots } = params;

  if (todaySnapshots.size === 0) return 0;

  // Most recent snapshot per SKU strictly before today.
  const priorRows = await sql`
    SELECT DISTINCT ON (sku) sku, quantity, captured_at
    FROM stock_snapshots
    WHERE shift_key < ${today}
    ORDER BY sku, captured_at DESC
  `;

  if (priorRows.length === 0) return 0; // nothing to compare against yet

  const priorBySku = new Map<string, { quantity: number; capturedAt: string }>(
    priorRows.map((r) => [
      r.sku as string,
      { quantity: Number(r.quantity), capturedAt: r.captured_at as string },
    ]),
  );

  // Fetch sales since the earliest prior snapshot once, then bucket per SKU.
  const earliestPrior = priorRows.reduce((min, r) => {
    const t = new Date(r.captured_at as string).getTime();
    return t < min ? t : min;
  }, Infinity);

  const soldSincePrior = new Map<string, number>();
  try {
    const transactions = await getTransactions({
      startDate: new Date(earliestPrior).toISOString(),
      endDate: new Date().toISOString(),
      status: "completed",
    });
    for (const tx of transactions) {
      for (const item of tx.items) {
        soldSincePrior.set(
          item.sku,
          (soldSincePrior.get(item.sku) || 0) + (item.quantity || 0),
        );
      }
    }
  } catch (err) {
    console.error(
      "[capture-snapshots] failed to fetch transactions for restock detection:",
      err,
    );
    return 0; // can't reliably detect without sales data
  }

  let detectedCount = 0;

  for (const [sku, todayQty] of todaySnapshots.entries()) {
    const prior = priorBySku.get(sku);
    if (!prior) continue;

    const sold = soldSincePrior.get(sku) || 0;
    const expectedQty = prior.quantity - sold;
    const surplus = todayQty - expectedQty;

    if (surplus >= STOCKING_EVENT_THRESHOLD) {
      try {
        const result = await sql`
          INSERT INTO restock_events (sku, quantity, source, reference_id, occurred_at, notes)
          VALUES (${sku}, ${surplus}, 'detected', ${today}, ${new Date().toISOString()}, ${`Auto-detected: stock rose more than sales alone would explain since ${prior.capturedAt}`})
          ON CONFLICT (sku, source, reference_id) DO NOTHING
          RETURNING id
        `;
        if (result.length > 0) detectedCount += 1;
      } catch (err) {
        console.error(
          `[capture-snapshots] failed to insert detected restock for sku=${sku}`,
          err,
        );
      }
    }
  }

  return detectedCount;
}
