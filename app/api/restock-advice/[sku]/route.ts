import { getRestockAdvice } from "@/lib/restockingLogic";
import { getInventory, getProducts, getTransactions } from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ sku: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const storeId =
    request.nextUrl.searchParams.get("storeId") ||
    process.env.NEXT_PUBLIC_STOREHUB_STORE_ID ||
    "";

  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  try {
    const [products, inventory] = await Promise.all([
      getProducts({ sku: decodedSku }),
      getInventory(storeId),
    ]);

    const product = products[0];
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const inventoryItem = inventory.find((i) => i.productId === product.id);
    const currentStock = inventoryItem?.quantityOnHand ?? 0;
    const warningLevel = inventoryItem?.warningStock || 0;
    const idealLevel = inventoryItem?.idealStock || warningLevel * 2;

    // Fallback velocity: legacy "last 30 days of transactions / 30" heuristic,
    // used only until enough stock_snapshots exist for this SKU.
    let fallbackDailyVelocity = 0;
    try {
      const transactions = await getTransactions({ status: "completed" });
      let totalQty = 0;
      for (const tx of transactions) {
        for (const item of tx.items) {
          if (String(item.sku) === decodedSku) {
            totalQty += item.quantity || 0;
          }
        }
      }
      fallbackDailyVelocity = totalQty / 30;
    } catch (err) {
      console.error("Failed to compute fallback velocity:", err);
    }

    const advice = await getRestockAdvice({
      sku: decodedSku,
      currentStock,
      warningLevel,
      idealLevel,
      fallbackDailyVelocity,
    });

    return NextResponse.json(advice);
  } catch (error) {
    console.error("Error computing restock advice:", error);
    return NextResponse.json(
      { error: "Failed to compute restock advice" },
      { status: 500 },
    );
  }
}
