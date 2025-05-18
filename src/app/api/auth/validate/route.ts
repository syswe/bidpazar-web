import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  verifyToken,
  APP_VERSION,
  createToken,
} from "@/lib/auth";
import { SignJWT } from "jose";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/validate
 * Validates a token and returns the associated user's information
 */
export async function GET(request: NextRequest) {
  logger.info("[API][/api/auth/validate] Processing token validation request");

  try {
    // Check if requested app version matches current version
    const requestedVersion = request.nextUrl.searchParams.get("appVersion");
    if (requestedVersion && requestedVersion !== APP_VERSION) {
      logger.warn(
        `[API][/api/auth/validate] App version mismatch: requested=${requestedVersion}, current=${APP_VERSION}`
      );
      return NextResponse.json(
        { error: "App version mismatch, please refresh the app" },
        { status: 412 } // Precondition Failed
      );
    }

    // Extract the token from the Authorization header
    const authHeader = request.headers.get("Authorization");
    let token: string | null = null;

    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    // If no Authorization header, check for token in cookies
    if (!token) {
      // First check authToken cookie (used by middleware)
      const authTokenCookie = request.cookies.get("authToken");
      if (authTokenCookie?.value) {
        token = authTokenCookie.value;
        logger.info(
          "[API][/api/auth/validate] Found token in authToken cookie"
        );
      } else {
        // Then check the old 'token' cookie format
        const cookieHeader = request.headers.get("cookie");
        if (cookieHeader) {
          const cookies = cookieHeader.split(";").map((c) => c.trim());
          const tokenCookie = cookies.find((c) => c.startsWith("token="));
          if (tokenCookie) {
            token = tokenCookie.substring("token=".length);
            logger.info(
              "[API][/api/auth/validate] Found token in token cookie"
            );
          }
        }
      }
    }

    if (!token) {
      logger.warn("[API][/api/auth/validate] No token found in request");
      return NextResponse.json(
        { error: "Authentication token is missing" },
        { status: 401 }
      );
    }

    logger.info("[API][/api/auth/validate] Verifying token");

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.warn("[API][/api/auth/validate] Invalid or expired token");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Retrieve user information
    try {
      const user = await getUserFromToken(token);

      if (!user) {
        logger.warn("[API][/api/auth/validate] User not found for token");
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Create a new token with the current app version if needed
      let newToken = token;
      if (!payload.appVersion || payload.appVersion !== APP_VERSION) {
        logger.info(
          "[API][/api/auth/validate] Updating token with current app version"
        );

        if (!process.env.JWT_SECRET) {
          logger.error("[API][/api/auth/validate] JWT_SECRET is not defined");
          return NextResponse.json(
            { error: "Server configuration error" },
            { status: 500 }
          );
        }

        // Create new token with current app version using jose
        const jwtPayload = {
          userId: user.id,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin ?? false,
          appVersion: APP_VERSION,
        };

        const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
        newToken = await new SignJWT(jwtPayload)
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("7d")
          .sign(secretKey);
      }

      // Set up response
      const response = NextResponse.json({
        user,
        token: newToken,
      });

      // Set the token in both cookie formats for compatibility
      response.cookies.set({
        name: "authToken",
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      return response;
    } catch (dbError: any) {
      // Check for database connection errors
      const isPrismaConnectionError =
        dbError.message &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused") ||
          dbError.message.includes("Connection timed out"));

      if (isPrismaConnectionError) {
        logger.warn(
          "[API][/api/auth/validate] Database connection error, returning temporary auth error",
          {
            error: dbError.message,
            stack: dbError.stack,
          }
        );

        // Return a specific status code for database connection issues
        // 503 = Service Unavailable
        return NextResponse.json(
          {
            error: "Database service unavailable. Please try again later.",
            code: "DB_UNAVAILABLE",
            temporary: true,
          },
          { status: 503 }
        );
      }

      // Re-throw for other errors
      throw dbError;
    }
  } catch (error) {
    logger.error("[API][/api/auth/validate] Token validation error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }
}
