import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { getUserFromTokenInNode } from "@/lib/auth";

// Constants
const STREAM_STATUS = ["SCHEDULED", "LIVE", "ENDED", "CANCELLED"] as const;
type StreamStatus = (typeof STREAM_STATUS)[number];

// Validation schemas
const createStreamSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional(),
  startTime: z
    .string()
    .refine(
      (val) => {
        // Accept ISO date format with or without seconds
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([.]\d+)?(([+-]\d{2}:\d{2})|Z)?$/.test(
          val
        );
      },
      { message: "Invalid datetime format. Expected ISO 8601 format." }
    )
    .optional(),
});

const updateStreamSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional(),
  status: z.enum(STREAM_STATUS).optional(),
  startTime: z
    .string()
    .refine(
      (val) => {
        // Accept ISO date format with or without seconds
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([.]\d+)?(([+-]\d{2}:\d{2})|Z)?$/.test(
          val
        );
      },
      { message: "Invalid datetime format. Expected ISO 8601 format." }
    )
    .optional(),
});

// GET /api/live-streams - List all streams
export async function GET(request: Request) {
  logger.info("API GET /api/live-streams", {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    query: new URL(request.url).searchParams.toString(),
  });
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as StreamStatus | null;
    const userId = searchParams.get("userId");

    const where = {
      ...(status && { status: status }),
      ...(userId && { userId }),
    };

    const streams = await prisma.liveStream.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        listings: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(streams);
  } catch (error: any) {
    // Check for database connection errors
    const isPrismaConnectionError =
      error.message &&
      (error.message.includes("Can't reach database server") ||
        error.message.includes("Connection refused") ||
        error.message.includes("Connection timed out"));

    logger.error("Error fetching streams", {
      error: error.message,
      stack: error.stack,
      isPrismaConnectionError,
      errorCode: error.code,
      name: error.name,
    });

    // For database connection errors, return an empty array instead of an error
    // This allows the front-end to continue functioning for non-logged in users
    if (isPrismaConnectionError) {
      logger.warn(
        "Database connection error, returning empty streams array for non-authenticated route"
      );
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(
      { error: "Failed to fetch streams" },
      { status: 500 }
    );
  }
}

// POST /api/live-streams - Create a new stream
export async function POST(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info("API POST /api/live-streams", { headers, body });
  try {
    // Extract token from authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : request.cookies.get("token")?.value;

    if (!token) {
      logger.warn("API POST /api/live-streams - Missing authentication token");
      return NextResponse.json(
        { error: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn(
        "API POST /api/live-streams - Invalid token or user not found"
      );
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    const validatedData = createStreamSchema.parse(body);

    // Convert the partial date format to a complete ISO datetime if it exists
    if (validatedData.startTime) {
      // Add seconds and timezone if they're missing
      if (
        !validatedData.startTime.includes("Z") &&
        !validatedData.startTime.includes("+")
      ) {
        // If we have "YYYY-MM-DDThh:mm", convert to "YYYY-MM-DDThh:mm:00Z"
        if (validatedData.startTime.length === 16) {
          // YYYY-MM-DDThh:mm format
          validatedData.startTime = `${validatedData.startTime}:00Z`;
        }
      }
    }

    logger.info("Creating stream with validated data", {
      validatedData,
      userId: user.id,
    });

    const stream = await prisma.liveStream.create({
      data: {
        ...validatedData,
        userId: user.id,
        status: "SCHEDULED",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(stream, { status: 201 });
  } catch (error) {
    logger.error("Error creating stream", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create stream" },
      { status: 500 }
    );
  }
}

// PUT /api/live-streams - Update a stream
export async function PUT(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info("API PUT /api/live-streams", { headers, body });
  try {
    // Extract token from authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : request.cookies.get("token")?.value;

    if (!token) {
      logger.warn("API PUT /api/live-streams - Missing authentication token");
      return NextResponse.json(
        { error: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn(
        "API PUT /api/live-streams - Invalid token or user not found"
      );
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    const { id, ...updateData } = body;
    logger.info("Updating stream", { id, updateData });

    if (!id) {
      return NextResponse.json(
        { error: "Stream ID is required" },
        { status: 400 }
      );
    }

    // Check if user owns the stream
    const existingStream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!existingStream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    if (existingStream.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to update this stream" },
        { status: 403 }
      );
    }

    const validatedData = updateStreamSchema.parse(updateData);

    // Convert the partial date format to a complete ISO datetime if it exists
    if (validatedData.startTime) {
      // Add seconds and timezone if they're missing
      if (
        !validatedData.startTime.includes("Z") &&
        !validatedData.startTime.includes("+")
      ) {
        // If we have "YYYY-MM-DDThh:mm", convert to "YYYY-MM-DDThh:mm:00Z"
        if (validatedData.startTime.length === 16) {
          // YYYY-MM-DDThh:mm format
          validatedData.startTime = `${validatedData.startTime}:00Z`;
        }
      }
    }

    const stream = await prisma.liveStream.update({
      where: { id },
      data: validatedData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        listings: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(stream);
  } catch (error) {
    logger.error("Error updating stream", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update stream" },
      { status: 500 }
    );
  }
}
