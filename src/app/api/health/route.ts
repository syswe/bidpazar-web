import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Basic health check - you can add more sophisticated checks here
    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
      },
      { status: 500 }
    );
  }
}
