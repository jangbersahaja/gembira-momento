import { getStores } from "@/lib/storehubApi";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const stores = await getStores();

    return NextResponse.json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json(
      { error: "Failed to fetch stores" },
      { status: 500 },
    );
  }
}
