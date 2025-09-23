import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const streams = await prisma.liveStream.findMany({
      where: { userId: payload.userId },
      include: {
        _count: {
          select: {
            listings: true,
            viewers: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(streams);
  } catch (error) {
    console.error("[API][/api/live-streams/user/streams] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user streams" },
      { status: 500 }
    );
  }
}
