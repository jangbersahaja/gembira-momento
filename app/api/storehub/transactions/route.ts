import { getTransactions } from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "completed" ||
      statusParam === "cancelled" ||
      statusParam === "pending"
        ? statusParam
        : undefined;

    const transactions = await getTransactions({
      startDate,
      endDate,
      employeeId,
      status,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}
