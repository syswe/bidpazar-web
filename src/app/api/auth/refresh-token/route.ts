import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { cookies } from "next/headers";
import { getUserFromToken, verifyToken, APP_VERSION } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    logger.info(
      "[API] POST /api/auth/refresh-token - Attempting to refresh token"
    );

    // Extract token from request
    let token = req.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      // Try to get token from cookies
      token = req.cookies.get("token")?.value;
    }

    if (!token) {
      logger.warn("[API] Refresh token failed - No token provided");
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    if (!process.env.JWT_SECRET) {
      logger.error("[API] JWT_SECRET is not defined");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify the token
    try {
      const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secretKey);

      const userId = payload.userId as string;
      const email = payload.email as string;
      const username = payload.username as string;
      const isAdmin = payload.isAdmin as boolean;

      if (!userId) {
        logger.warn(
          "[API] Token validation failed - Missing userId in payload"
        );
        return NextResponse.json(
          { message: "Invalid token payload" },
          { status: 401 }
        );
      }

      // Fetch the user to ensure they still exist
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          phoneNumber: true,
          isVerified: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        logger.warn("[API] Refresh token failed - User not found");
        return NextResponse.json(
          { message: "User not found" },
          { status: 404 }
        );
      }

      // Generate a new token
      const jwtPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin ?? false,
        appVersion: APP_VERSION,
      };

      const newToken = await new SignJWT(jwtPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secretKey);

      // Create response
      const response = NextResponse.json({
        message: "Token refreshed successfully",
        token: newToken,
        user: user,
      });

      // Set cookie
      response.cookies.set("token", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      logger.info(
        "[API] Token refreshed successfully for user:",
        user.username
      );
      return response;
    } catch (error) {
      logger.error("[API] Token verification failed:", error);
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
  } catch (error) {
    logger.error("[API] Error refreshing token:", error);
    return NextResponse.json(
      { message: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
