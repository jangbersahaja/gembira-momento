import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ sku: string }>;
}

/**
 * Returns the raw stock snapshot + restock event history for a SKU, used to
 * render the Stock Level vs Sales chart on the product detail page.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);

  try {
    const [snapshots, restockEvents] = await Promise.all([
      sql`
        SELECT quantity, event_type, captured_at
        FROM stock_snapshots
        WHERE sku = ${decodedSku}
        ORDER BY captured_at ASC
      `,
      sql`
        SELECT quantity, source, occurred_at
        FROM restock_events
        WHERE sku = ${decodedSku}
        ORDER BY occurred_at ASC
      `,
    ]);

    return NextResponse.json({ snapshots, restockEvents });
  } catch (error) {
    console.error("Error fetching stock history:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock history" },
      { status: 500 },
    );
  }
}
