/**
 * Vercel Cron endpoint — polls StoreHub timesheets for new clock-in / clock-out
 * events, captures a stock snapshot (per SKU) for each new event, and
 * auto-detects restocking that happened DURING a shift.
 *
 * Why capture at both clock-in AND clock-out:
 * StoreHub has no "stock received" webhook/event. But we can infer it:
 * for a completed shift, `expectedStockAtClockOut = stockAtClockIn - unitsSoldDuringShift`.
 * If the ACTUAL stock at clock-out is higher than that, someone must have
 * physically added stock to the shelf during the shift — a "stocking event".
 * The surplus (actual - expected) is the estimated quantity restocked, and
 * gets written to `restock_events` (source: 'detected') automatically, so
 * historical CSV imports are no longer needed going forward.
 *
 * StoreHub has no webhook for shift events either, so we poll on a schedule
 * (see vercel.json) with a rolling lookback window, and dedupe
 * already-processed events via the `processed_shift_events` table.
 *
 * Secured with CRON_SECRET — Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * automatically when the env var is set.
 */
import { sql } from "@/lib/db";
import {
  getInventory,
  getProducts,
  getTimesheets,
  getTransactions,
  type Timesheet,
} from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

// How far back to look for new clock in/out events each run. Should be
// comfortably larger than the cron interval to tolerate missed/delayed runs.
const LOOKBACK_HOURS = 3;

// Minimum surplus (units) before we treat a clock-in→clock-out stock delta
// as a genuine restock rather than rounding noise / a missed sale.
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
    const lookbackStart = new Date(
      now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000,
    );

    // Timesheets API only accepts date-level (YYYY-MM-DD) filters, so fetch
    // the whole day(s) covering the lookback window and filter precisely in code.
    const timesheets = await getTimesheets({
      storeId,
      from: toDateOnly(lookbackStart),
      to: toDateOnly(now),
    });

    // Build the list of candidate shift events (clock_in / clock_out) inside
    // the lookback window.
    type Candidate = {
      shiftKey: string;
      employeeId: string;
      eventType: "clock_in" | "clock_out";
      capturedAt: string;
    };
    const candidates: Candidate[] = [];

    for (const t of timesheets) {
      if (t.clockInTime) {
        const time = new Date(t.clockInTime).getTime();
        if (time >= lookbackStart.getTime() && time <= now.getTime()) {
          candidates.push({
            shiftKey: `${t.employeeId}_in_${t.clockInTime}`,
            employeeId: t.employeeId,
            eventType: "clock_in",
            capturedAt: t.clockInTime,
          });
        }
      }
      if (t.clockOutTime) {
        const time = new Date(t.clockOutTime).getTime();
        if (time >= lookbackStart.getTime() && time <= now.getTime()) {
          candidates.push({
            shiftKey: `${t.employeeId}_out_${t.clockOutTime}`,
            employeeId: t.employeeId,
            eventType: "clock_out",
            capturedAt: t.clockOutTime,
          });
        }
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        processed: 0,
        message: "No new shift events",
      });
    }

    // Filter out already-processed events.
    const newCandidates: Candidate[] = [];
    for (const c of candidates) {
      const existing = await sql`
        SELECT 1 FROM processed_shift_events WHERE shift_key = ${c.shiftKey}
      `;
      if (existing.length === 0) newCandidates.push(c);
    }

    if (newCandidates.length === 0) {
      return NextResponse.json({
        processed: 0,
        message: "All events already processed",
      });
    }

    // Fetch current inventory + product list ONCE for this run (respects
    // StoreHub's 3 req/sec rate limit) and reuse across all new events.
    const [inventory, products] = await Promise.all([
      getInventory(storeId),
      getProducts({ limit: 500 }),
    ]);

    const productIdToSku = new Map(products.map((p) => [p.id, p.sku]));

    let snapshotsInserted = 0;

    for (const candidate of newCandidates) {
      for (const item of inventory) {
        const sku = productIdToSku.get(item.productId);
        if (!sku) continue;

        try {
          await sql`
            INSERT INTO stock_snapshots (sku, product_id, store_id, quantity, event_type, employee_id, shift_key, captured_at)
            VALUES (${sku}, ${item.productId}, ${storeId}, ${item.quantityOnHand}, ${candidate.eventType}, ${candidate.employeeId}, ${candidate.shiftKey}, ${candidate.capturedAt})
            ON CONFLICT (sku, shift_key) DO NOTHING
          `;
          snapshotsInserted += 1;
        } catch (err) {
          console.error(
            `[capture-snapshots] failed to insert snapshot for sku=${sku}`,
            err,
          );
        }
      }

      await sql`
        INSERT INTO processed_shift_events (shift_key, employee_id, event_type)
        VALUES (${candidate.shiftKey}, ${candidate.employeeId}, ${candidate.eventType})
        ON CONFLICT (shift_key) DO NOTHING
      `;
    }

    // --- Stocking event detection ---
    // For every shift whose clock-out we just captured (and that has a
    // matching clock-in time on the same timesheet record), compare the
    // actual clock-out stock against what sales alone would predict.
    const detectedEvents = await detectStockingEvents({
      newCandidates,
      timesheets,
    });

    return NextResponse.json({
      processed: newCandidates.length,
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

async function detectStockingEvents(params: {
  newCandidates: {
    shiftKey: string;
    employeeId: string;
    eventType: "clock_in" | "clock_out";
    capturedAt: string;
  }[];
  timesheets: Timesheet[];
}): Promise<number> {
  const { newCandidates, timesheets } = params;

  // Only look at shifts whose clock-OUT was newly captured this run — that's
  // the moment we have a complete clock-in→clock-out window to evaluate.
  const newClockOuts = newCandidates.filter((c) => c.eventType === "clock_out");
  if (newClockOuts.length === 0) return 0;

  let detectedCount = 0;

  for (const clockOutCandidate of newClockOuts) {
    const shift = timesheets.find(
      (t) =>
        t.employeeId === clockOutCandidate.employeeId &&
        t.clockOutTime === clockOutCandidate.capturedAt,
    );
    if (!shift || !shift.clockInTime) continue; // no matching clock-in on record

    const clockInShiftKey = `${shift.employeeId}_in_${shift.clockInTime}`;
    const clockOutShiftKey = `${shift.employeeId}_out_${shift.clockOutTime}`;

    const [clockInRows, clockOutRows] = await Promise.all([
      sql`SELECT sku, quantity FROM stock_snapshots WHERE shift_key = ${clockInShiftKey}`,
      sql`SELECT sku, quantity FROM stock_snapshots WHERE shift_key = ${clockOutShiftKey}`,
    ]);

    if (clockInRows.length === 0 || clockOutRows.length === 0) continue;

    const qtyAtClockIn = new Map<string, number>(
      clockInRows.map((r) => [r.sku as string, Number(r.quantity)]),
    );
    const qtyAtClockOut = new Map<string, number>(
      clockOutRows.map((r) => [r.sku as string, Number(r.quantity)]),
    );

    // Units sold per SKU across ALL employees during this shift window (the
    // whole store's stock moves regardless of who rang up the sale).
    let soldDuringShift = new Map<string, number>();
    try {
      const transactions = await getTransactions({
        startDate: shift.clockInTime,
        endDate: shift.clockOutTime,
        status: "completed",
      });
      soldDuringShift = new Map();
      for (const tx of transactions) {
        for (const item of tx.items) {
          soldDuringShift.set(
            item.sku,
            (soldDuringShift.get(item.sku) || 0) + (item.quantity || 0),
          );
        }
      }
    } catch (err) {
      console.error(
        `[capture-snapshots] failed to fetch transactions for shift ${clockOutShiftKey}:`,
        err,
      );
      continue; // can't reliably detect without sales data for this window
    }

    for (const [sku, qtyIn] of qtyAtClockIn.entries()) {
      const qtyOut = qtyAtClockOut.get(sku);
      if (qtyOut === undefined) continue;

      const sold = soldDuringShift.get(sku) || 0;
      const expectedQtyOut = qtyIn - sold;
      const surplus = qtyOut - expectedQtyOut;

      if (surplus >= STOCKING_EVENT_THRESHOLD) {
        try {
          await sql`
            INSERT INTO restock_events (sku, quantity, source, reference_id, occurred_at, notes)
            VALUES (${sku}, ${surplus}, 'detected', ${clockOutShiftKey}, ${shift.clockOutTime}, ${`Auto-detected: stock rose more than sales alone would explain during shift ${shift.clockInTime} → ${shift.clockOutTime}`})
            ON CONFLICT (sku, source, reference_id) DO NOTHING
          `;
          detectedCount += 1;
        } catch (err) {
          console.error(
            `[capture-snapshots] failed to insert detected restock for sku=${sku}`,
            err,
          );
        }
      }
    }
  }

  return detectedCount;
}
