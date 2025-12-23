import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

// Sample users with proper fields
const sampleUsers = [
  {
    id: "user1",
    username: "johndoe",
    name: "John Doe",
    email: "john@example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "user2",
    username: "janedoe",
    name: "Jane Doe",
    email: "jane@example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "user3",
    username: "bobsmith",
    name: "Bob Smith",
    email: "bob@example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "user4",
    username: "alicejones",
    name: "Alice Jones",
    email: "alice@example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "user5",
    username: "sarahlee",
    name: "Sarah Lee",
    email: "sarah@example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] GET request received`, {
    headers: Object.fromEntries(req.headers.entries()),
    url: req.url,
    query: req.nextUrl.searchParams.toString(),
  });

  try {
    // Extract token from authorization header
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      logger.error(`[API][${url}] Unauthorized (401): No authorization header`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.error(
        `[API][${url}] Unauthorized (401): Invalid authorization format`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];
    logger.debug(`[API][${url}] Token found`, { hasToken: !!token });

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin for full user list
    const isAdmin = payload.isAdmin === true;

    // Get query parameters for filtering and pagination
    const searchQuery = req.nextUrl.searchParams.get("search") || "";
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    logger.info(`[API][${url}] Fetching users`, {
      isAdmin,
      searchQuery,
      page,
      limit,
    });

    // Build search condition
    const searchCondition = searchQuery
      ? {
          OR: [
            {
              username: {
                contains: searchQuery,
                mode: "insensitive" as const,
              },
            },
            {
              name: {
                contains: searchQuery,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: searchQuery,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {};

    // Fetch users with proper filters - admins can see all, regular users see limited data
    const users = await prisma.user.findMany({
      where: {
        ...searchCondition,
        // Optional: Add additional filters if needed
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: isAdmin, // Only include email for admins
        isVerified: isAdmin, // Only include verification status for admins
        isAdmin: isAdmin, // Only include admin status for admins
        userType: isAdmin, // Only include user type for admins
        isPopularStreamer: isAdmin,
        isFavoriteSeller: isAdmin,
        createdAt: true,
        updatedAt: true,
        // Quota fields - only for admins
        monthlyProductLimit: isAdmin,
        monthlyStreamMinutes: isAdmin,
        productsUsedThisMonth: isAdmin,
        streamMinutesUsedMonth: isAdmin,
        quotaResetDate: isAdmin,
        _count: {
          select: {
            products: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get total count for pagination
    const totalCount = await prisma.user.count({
      where: searchCondition,
    });

    logger.info(`[API][${url}] Successfully fetched users`, {
      count: users.length,
      totalCount,
    });

    return NextResponse.json({
      users,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    logger.error(`[API][${url}] Unexpected error in GET handler`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST handler to create a new user (admin only)
export async function POST(req: NextRequest) {
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] POST request received`);

  try {
    // Extract token from authorization header
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      logger.error(`[API][${url}] Unauthorized (401): No authorization header`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.error(
        `[API][${url}] Unauthorized (401): Invalid authorization format`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin
    if (!payload.isAdmin) {
      logger.error(`[API][${url}] Forbidden (403): User is not an admin`);
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();

    // Validate required fields
    if (!body.username || !body.email || !body.password) {
      logger.error(`[API][${url}] Bad request (400): Missing required fields`);
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: body.username }, { email: body.email }],
      },
    });

    if (existingUser) {
      logger.error(
        `[API][${url}] Conflict (409): Username or email already exists`
      );
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 }
      );
    }

    // Hash the password
    const hashedPassword = await hash(body.password, 10);

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        password: hashedPassword,
        name: body.name || null,
        isAdmin: body.isAdmin || false,
        userType: body.userType || "MEMBER", // Default to MEMBER if not specified
        isVerified: true, // Admin-created users are automatically verified
      },
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = newUser;

    logger.info(`[API][${url}] User created successfully`, {
      userId: newUser.id,
    });

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    logger.error(`[API][${url}] Unexpected error in POST handler`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
