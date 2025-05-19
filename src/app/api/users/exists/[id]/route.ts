import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = request.nextUrl.pathname;
  console.log(`[API][${url}] GET request received`);

  try {
    // Extract userId from the URL path
    const userId = params.id;

    if (!userId) {
      console.warn(
        `[API][${url}] Bad Request (400): User ID parameter is missing.`
      );
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify authentication
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      console.error(
        `[API][${url}] Unauthorized (401): No authorization header`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      console.error(
        `[API][${url}] Unauthorized (401): Invalid authorization format`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      console.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      console.error(
        `[API][${url}] Not Found (404): User with ID '${userId}' not found.`
      );
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    // User found
    return NextResponse.json({
      exists: true,
      userId: user.id,
    });
  } catch (error: any) {
    console.error(`[API][${url}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
}
