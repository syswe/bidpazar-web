import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getUserFromToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { finalizeExpiredProductAuctions } from "@/lib/server/productAuctionUtils";

// Schema for product creation
const createProductSchema = z.object({
  title: z.string().min(1, "Başlık gereklidir"),
  description: z.string().min(1, "Açıklama gereklidir"),
  price: z.number().positive("Fiyat pozitif olmalıdır"),
  buyNowPrice: z.number().positive("Hemen al fiyatı pozitif olmalıdır").optional(),
  categoryId: z.string().min(1, "Kategori gereklidir"),
}).refine((data) => {
  if (data.buyNowPrice && data.buyNowPrice <= data.price) {
    return false;
  }
  return true;
}, {
  message: "Hemen al fiyatı, başlangıç fiyatından yüksek olmalıdır",
  path: ["buyNowPrice"],
});

export async function GET(request: Request) {
  logger.info("API GET /api/products", {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    query: Object.fromEntries(new URL(request.url).searchParams.entries()),
  });

  try {
    await finalizeExpiredProductAuctions();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const where: any = {
      isSold: false, // Only show unsold products by default
      // Always filter by active auctions
      auctions: {
        some: {
          status: "ACTIVE",
        },
      },
    };

    if (userId) {
      where.userId = userId;
    }

    logger.debug("Fetching products from database", { where });
    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        media: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            userType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Add images property to each product by filtering media items of type 'image'
    const productsWithImages = products.map((product: any) => ({
      ...product,
      images: product.media?.filter((m: any) => m.type === "image") || [],
    }));

    logger.info("Successfully retrieved products", {
      count: products.length,
      productIds: products.map((p: any) => p.id),
    });

    return NextResponse.json(productsWithImages);
  } catch (error: any) {
    // Check for database connection errors
    const isPrismaConnectionError =
      error.message &&
      (error.message.includes("Can't reach database server") ||
        error.message.includes("Connection refused") ||
        error.message.includes("Connection timed out"));

    logger.error("Error retrieving products from database", {
      error: error.message,
      stack: error.stack,
      url: request.url,
      isPrismaConnectionError,
      errorCode: error.code,
      name: error.name,
    });

    // For database connection errors, return an empty array instead of an error
    // This allows the front-end to continue functioning for non-logged in users
    if (isPrismaConnectionError) {
      logger.warn(
        "Database connection error, returning empty products array for non-authenticated route"
      );
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(
      { error: "Ürünler getirilirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;

  logger.info("API POST /api/products - Request received", {
    url: request.url,
    headers: {
      ...headers,
      authorization: headers.authorization ? "Bearer [REDACTED]" : undefined,
    },
  });

  try {
    body = await request.json();
    logger.debug("Request body for product creation", {
      title: body.title,
      categoryId: body.categoryId,
      hasDescription: !!body.description,
      priceProvided: !!body.price,
    });
  } catch (error) {
    logger.error("Failed to parse request body for product creation", {
      error,
    });
    body = undefined;
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      logger.warn("Product creation attempt without authentication token");
      return NextResponse.json(
        { error: "Kimlik doğrulama gereklidir" },
        { status: 401 }
      );
    }

    logger.debug("Verifying user authentication token");
    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn("Product creation attempt with invalid token");
      return NextResponse.json(
        { error: "Kimlik doğrulama gereklidir" },
        { status: 401 }
      );
    }

    logger.debug("Validating product data", { userId: user.id });
    const validatedData = createProductSchema.parse({
      ...body,
      price: Number(body.price),
    });

    // Check and reset monthly quotas if needed (for SELLER users)
    if (user.userType === 'SELLER') {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          monthlyProductLimit: true,
          productsUsedThisMonth: true,
          quotaResetDate: true
        }
      });

      if (userData) {
        // Check if a month has passed since last reset
        const now = new Date();
        const resetDate = new Date(userData.quotaResetDate);
        const daysSinceReset = (now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceReset >= 30) {
          // Reset monthly usage
          await prisma.user.update({
            where: { id: user.id },
            data: {
              productsUsedThisMonth: 0,
              streamMinutesUsedMonth: 0,
              quotaResetDate: now
            }
          });
          logger.info('Monthly quotas reset', { userId: user.id });
        } else {
          // Check if user has remaining quota
          if (userData.productsUsedThisMonth >= userData.monthlyProductLimit) {
            logger.warn('Product creation blocked - quota exceeded', {
              userId: user.id,
              used: userData.productsUsedThisMonth,
              limit: userData.monthlyProductLimit
            });
            return NextResponse.json(
              { 
                error: 'Aylık ürün ekleme limitiniz doldu',
                details: {
                  used: userData.productsUsedThisMonth,
                  limit: userData.monthlyProductLimit,
                  resetDate: userData.quotaResetDate
                }
              },
              { status: 403 }
            );
          }
        }
      }
    }

    logger.debug("Creating product in database", {
      userId: user.id,
      categoryId: validatedData.categoryId,
    });
    const product = await prisma.product.create({
      data: {
        ...validatedData,
        userId: user.id,
      },
      include: {
        category: true,
        media: true,
      },
    });

    // Increment products used this month for SELLER users
    if (user.userType === 'SELLER') {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          productsUsedThisMonth: {
            increment: 1
          }
        }
      });
      logger.debug('Incremented productsUsedThisMonth', { userId: user.id });
    }

    logger.info("Product created successfully", {
      productId: product.id,
      userId: user.id,
      title: product.title,
    });

    // Notify followers about new product
    try {
      const followers = await prisma.follows.findMany({
        where: { followingId: user.id },
        select: { followerId: true }
      });

      if (followers.length > 0) {
        await prisma.notification.createMany({
          data: followers.map(follower => ({
            userId: follower.followerId,
            type: 'NEW_PRODUCT',
            content: `${user.username} "${product.title}" adlı yeni bir ürün ekledi.`,
            relatedId: product.id
          }))
        });

        logger.info(`Notified ${followers.length} followers about new product`, {
          productId: product.id,
          sellerId: user.id
        });
      }
    } catch (notificationError) {
      // Log error but don't fail the product creation
      logger.error('Error creating product notifications for followers:', notificationError);
    }

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn("Product creation validation error", {
        errors: error.errors,
        body,
      });
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    logger.error("Product creation failed", {
      error: error.message,
      stack: error.stack,
      body: body
        ? {
            title: body.title,
            categoryId: body.categoryId,
            hasDescription: !!body.description,
          }
        : "No body",
    });

    return NextResponse.json(
      { error: "Ürün oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
