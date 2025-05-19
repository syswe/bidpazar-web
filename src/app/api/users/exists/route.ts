import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const url = request.nextUrl.pathname;
  console.log(`[API][${url}] POST request received`);

  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      console.warn(
        `[API][${url}] Bad Request (400): Username parameter is missing.`
      );
      return NextResponse.json(
        { error: "Username is required" },
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

    // Check if user exists by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, name: true },
    });

    if (!user) {
      console.error(
        `[API][${url}] Not Found (404): User with username '${username}' not found.`
      );
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    // User found
    return NextResponse.json({
      exists: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  } catch (error: any) {
    console.error(`[API][${url}] Unexpected error in POST handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
}
