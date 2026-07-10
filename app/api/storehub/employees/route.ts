import { getEmployees } from "@/lib/storehubApi";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modifiedSince = searchParams.get("modifiedSince") || undefined;

    const employees = await getEmployees({
      modifiedSince: modifiedSince || undefined,
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}
