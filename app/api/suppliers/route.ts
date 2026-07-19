import products from "@/data/products";
import { NextResponse } from "next/server";

/**
 * Returns a lightweight SKU -> Supplier lookup map derived from the
 * CSV-generated data/products.ts catalog. This is the ONLY place that file
 * should be imported — it never runs in the browser, so the large generated
 * catalog (thousands of extra CSV fields) stays server-side and only the
 * small { sku: supplier } map is shipped to clients.
 */
export async function GET() {
  try {
    const map: Record<string, string> = {};
    for (const product of products) {
      const sku = String(product["SKU"] || "").trim();
      const supplier = String(product["Supplier"] || "").trim();
      if (sku && supplier) {
        map[sku] = supplier;
      }
    }
    return NextResponse.json(map);
  } catch (error) {
    console.error("Error building supplier lookup:", error);
    return NextResponse.json(
      { error: "Failed to load supplier data" },
      { status: 500 },
    );
  }
}
