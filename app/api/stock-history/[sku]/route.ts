import { sql } from "@/lib/db";
import { getAliasMultiplier, getLegacyAliasesFor } from "@/lib/productAliases";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ sku: string }>;
}

interface SnapshotRow {
  sku: string;
  quantity: string;
  event_type: "clock_in" | "clock_out" | "manual" | "daily";
  captured_at: string;
}

interface RestockEventRow {
  sku: string;
  quantity: string;
  source: string;
  occurred_at: string;
}

/**
 * Returns the raw stock snapshot + restock event history for a SKU, used to
 * render the Stock Level vs Sales chart on the product detail page.
 *
 * Also folds in any legacy/superseded SKU's history (see
 * lib/productAliases.ts) — e.g. a discontinued bundle SKU's snapshots are
 * converted to this SKU's unit size and merged in, so the chart shows one
 * continuous history instead of splitting it across two SKUs.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const legacySkus = getLegacyAliasesFor(decodedSku).map((a) => a.legacySku);
  const skusToFetch = [decodedSku, ...legacySkus];

  try {
    const [rawSnapshots, rawRestockEvents] = await Promise.all([
      sql`
        SELECT sku, quantity, event_type, captured_at
        FROM stock_snapshots
        WHERE sku = ANY(${skusToFetch})
        ORDER BY captured_at ASC
      ` as unknown as Promise<SnapshotRow[]>,
      sql`
        SELECT sku, quantity, source, occurred_at
        FROM restock_events
        WHERE sku = ANY(${skusToFetch})
        ORDER BY occurred_at ASC
      ` as unknown as Promise<RestockEventRow[]>,
    ]);

    const scaleAndSort = <
      T extends { sku: string; quantity: string },
      K extends keyof T,
    >(
      rows: T[],
      timeKey: K,
    ) =>
      rows
        .map((row) => {
          const multiplier = getAliasMultiplier(row.sku);
          return multiplier === 1
            ? row
            : { ...row, quantity: String(Number(row.quantity) * multiplier) };
        })
        .sort(
          (a, b) =>
            new Date(a[timeKey] as unknown as string).getTime() -
            new Date(b[timeKey] as unknown as string).getTime(),
        );

    const snapshots = scaleAndSort(rawSnapshots, "captured_at");
    const restockEvents = scaleAndSort(rawRestockEvents, "occurred_at");

    return NextResponse.json({ snapshots, restockEvents });
  } catch (error) {
    console.error("Error fetching stock history:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock history" },
      { status: 500 },
    );
  }
}
