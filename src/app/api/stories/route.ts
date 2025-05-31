import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromTokenInNode } from "@/lib/auth";
import { z } from "zod";

const createStorySchema = z.object({
  content: z.string().min(1, "Content is required").max(500, "Content too long"),
  type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
  mediaUrl: z.string().optional().nullable(),
});

// GET - Fetch all active stories
export async function GET() {
  try {
    console.log("[Stories API] Fetching active stories");

    // Get current time to filter expired stories
    const now = new Date();

    const stories = await prisma.story.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gt: now, // Only get stories that haven't expired
        },
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
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limit to 50 most recent stories
    });

    console.log(`[Stories API] Found ${stories.length} active stories`);

    return NextResponse.json({
      success: true,
      stories: stories,
    });
  } catch (error) {
    console.error("[Stories API] Error fetching stories:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch stories",
      },
      { status: 500 }
    );
  }
}

// POST - Create new story (requires authentication)
export async function POST(request: NextRequest) {
  try {
    console.log("[Stories API] Creating new story");

    // Get token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    // Verify user authentication
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token",
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validatedData = createStorySchema.parse(body);

    // Set expiration time to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create the story
    const story = await prisma.story.create({
      data: {
        content: validatedData.content,
        type: validatedData.type,
        mediaUrl: validatedData.mediaUrl,
        userId: user.id,
        expiresAt: expiresAt,
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

    console.log(`[Stories API] Story created successfully:`, story.id);

    return NextResponse.json({
      success: true,
      story: story,
      message: "Story created successfully",
    });
  } catch (error) {
    console.error("[Stories API] Error creating story:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create story",
      },
      { status: 500 }
    );
  }
} 