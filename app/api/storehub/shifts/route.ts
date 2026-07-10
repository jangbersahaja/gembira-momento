import { getShifts } from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "scheduled" ||
      statusParam === "completed" ||
      statusParam === "cancelled"
        ? statusParam
        : undefined;

    const shifts = await getShifts({
      employeeId,
      startDate,
      endDate,
      status,
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 },
    );
  }
}
