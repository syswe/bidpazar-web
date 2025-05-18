import { prisma } from "./prisma";
import { cookies } from "next/headers";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { jwtVerify, SignJWT, JWTPayload } from "jose";

// App version for token validation
export const APP_VERSION = process.env.APP_VERSION || "1.0.0";

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      username: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    username: string;
  }
}

// Extend the built-in JWT types
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  isAdmin: boolean;
  appVersion: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        // Here you would verify the password
        // For now, we'll just return the user
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    },
  },
};

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  const secret = process.env.JWT_SECRET;
  console.log("[verifyToken] Attempting to verify token (using jose).");
  console.log(
    "[verifyToken] Using JWT_SECRET:",
    secret ? "Exists" : "MISSING or undefined!"
  );

  if (!secret) {
    console.error(
      "[verifyToken] JWT_SECRET is not set in environment variables."
    );
    return null;
  }

  try {
    // Use jose.jwtVerify as it's Edge-compatible
    const secretKey = new TextEncoder().encode(secret);
    const { payload }: { payload: JWTPayload } = await jwtVerify(
      token,
      secretKey
    );
    console.log("[verifyToken] Token successfully decoded:", payload);

    // Explicitly check types after decoding
    const userId = payload.userId as string | undefined;
    const email = payload.email as string | undefined;
    const username = payload.username as string | undefined;
    const isAdmin = payload.isAdmin as boolean | undefined;
    const appVersion = payload.appVersion as string | undefined;

    // Type guard: check required fields (make appVersion optional for backward compatibility)
    const isValidPayload =
      typeof userId === "string" &&
      typeof email === "string" &&
      typeof username === "string" &&
      typeof isAdmin === "boolean";

    if (isValidPayload) {
      console.log("[verifyToken] Payload structure is valid.");

      // Only check version if it exists in the token (backward compatibility)
      if (appVersion && appVersion !== APP_VERSION) {
        console.warn(
          `[verifyToken] Token version mismatch: token=${appVersion}, app=${APP_VERSION}`
        );
        // For now, we'll allow tokens without version or with different versions
        // return null;
      }

      // Now types are confirmed
      return {
        userId: userId,
        email: email,
        username: username,
        isAdmin: isAdmin,
        appVersion: appVersion || APP_VERSION, // Use current version if not in token
      };
    } else {
      console.error(
        "[verifyToken] Invalid JWT payload structure after type checks:",
        { userId, email, username, isAdmin, appVersion }
      );
      return null;
    }
  } catch (error: any) {
    console.error(
      "[verifyToken] Token verification failed (jose):",
      error.message || error
    );
    return null;
  }
}

export async function getUserFromToken(token: string) {
  try {
    const payload = await verifyToken(token);
    if (!payload) {
      console.log("[getUserFromToken] verifyToken returned null");
      return null;
    }

    console.log(
      `[getUserFromToken] Looking for user with ID: ${payload.userId}`
    );
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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

    console.log(`[getUserFromToken] Prisma found user: ${!!user}`);
    return user;
  } catch (error) {
    console.error("[getUserFromToken] Error fetching user from DB:", error);
    return null;
  }
}

// Function specifically for Edge runtime token verification (used by Middleware)
export async function verifyAuthSession(
  token: string
): Promise<JWTPayload | null> {
  const secret = process.env.JWT_SECRET;
  console.log(
    "[verifyAuthSession:Edge] Attempting to verify token (using jose)."
  );
  console.log(
    "[verifyAuthSession:Edge] Using JWT_SECRET:",
    secret ? "Exists" : "MISSING or undefined!"
  );

  if (!secret || !token) {
    // Also check if token is provided
    console.error("[verifyAuthSession:Edge] JWT_SECRET or token is missing.");
    return null;
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload }: { payload: JWTPayload } = await jwtVerify(
      token,
      secretKey,
      {
        algorithms: ["HS256"], // Specify expected algorithm
      }
    );
    console.log(
      "[verifyAuthSession:Edge] Token successfully decoded:",
      payload
    );

    // Basic structure check - does it have at least userId?
    if (typeof payload.userId === "string") {
      console.log(
        "[verifyAuthSession:Edge] Basic payload structure check passed."
      );

      // Check app version only if it exists (backward compatibility)
      if (payload.appVersion && payload.appVersion !== APP_VERSION) {
        console.warn(
          `[verifyAuthSession:Edge] Token version mismatch: token=${payload.appVersion}, app=${APP_VERSION}`
        );
        // For now, allow tokens without version or with different versions
        // return null;
      }

      return payload; // Return the raw jose payload
    } else {
      console.error(
        "[verifyAuthSession:Edge] Invalid payload structure: userId missing or not a string.",
        payload
      );
      return null;
    }
  } catch (error: any) {
    console.error(
      "[verifyAuthSession:Edge] Token verification failed (jose):",
      error.message || error
    );
    // Log specific errors like expiration
    if (error.code === "ERR_JWT_EXPIRED") {
      console.log("[verifyAuthSession:Edge] Token expired.");
    }
    return null;
  }
}

// Function for Node.js runtime: Verifies token AND fetches user data
// Used by API routes, Server Components etc.
export async function getUserFromTokenInNode(token: string) {
  console.log("[getUserFromTokenInNode] Verifying token and fetching user.");
  if (!token) return null;

  try {
    // 1. Verify token using jose (Edge-compatible)
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[getUserFromTokenInNode] JWT_SECRET is missing.");
      return null;
    }

    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    // 2. Check payload structure
    if (!(typeof payload === "object" && typeof payload.userId === "string")) {
      console.error(
        "[getUserFromTokenInNode] Invalid payload structure after verify.",
        payload
      );
      return null;
    }
    console.log(`[getUserFromTokenInNode] Token verified, payload:`, payload);

    // 3. Check app version only if it exists (backward compatibility)
    if (payload.appVersion && payload.appVersion !== APP_VERSION) {
      console.warn(
        `[getUserFromTokenInNode] Token version mismatch: token=${payload.appVersion}, app=${APP_VERSION}`
      );
      // For now, allow tokens without version or with different versions
      // return null;
    }

    // 4. Fetch user from DB
    console.log(
      `[getUserFromTokenInNode] Looking for user with ID: ${payload.userId}`
    );
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: {
        // Select only needed fields
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

    console.log(`[getUserFromTokenInNode] Prisma found user: ${!!user}`);
    return user;
  } catch (error: any) {
    console.error("[getUserFromTokenInNode] Failed:", error.message || error);
    if (error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
      console.log(
        "[getUserFromTokenInNode] Invalid token signature or format."
      );
    } else if (error.code === "ERR_JWT_EXPIRED") {
      console.log("[getUserFromTokenInNode] Token expired.");
    } else {
      console.error(
        "[getUserFromTokenInNode] Error during verification or DB fetch:",
        error
      );
    }
    return null;
  }
}

// Function to create and sign a JWT token
export async function createToken(payload: JwtPayload): Promise<string | null> {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error(
      "[createToken] JWT_SECRET is not set in environment variables."
    );
    return null;
  }

  try {
    const secretKey = new TextEncoder().encode(secret);

    // Create and sign the token using jose
    // Convert our JwtPayload type to a Record<string, any> to satisfy jose's JWTPayload interface
    const jwtPayload: Record<string, any> = {
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
      isAdmin: payload.isAdmin,
      appVersion: payload.appVersion,
    };

    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d") // 7 days expiration
      .sign(secretKey);

    return token;
  } catch (error: any) {
    console.error(
      "[createToken] Failed to create token:",
      error.message || error
    );
    return null;
  }
}
