import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getUserFromToken } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Schema for product creation
const createProductSchema = z.object({
  title: z.string().min(1, "Başlık gereklidir"),
  description: z.string().min(1, "Açıklama gereklidir"),
  price: z.number().positive("Fiyat pozitif olmalıdır"),
  categoryId: z.string().min(1, "Kategori gereklidir"),
});

export async function GET(request: Request) {
  logger.info("API GET /api/products", {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    query: Object.fromEntries(new URL(request.url).searchParams.entries()),
  });

  try {
    logger.debug("Fetching all products from database");
    const products = await prisma.product.findMany({
      include: {
        category: true,
        media: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    // Add images property to each product by filtering media items of type 'image'
    const productsWithImages = products.map((product) => ({
      ...product,
      images: product.media?.filter((m) => m.type === "image") || [],
    }));

    logger.info("Successfully retrieved products", {
      count: products.length,
      productIds: products.map((p) => p.id),
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

    logger.info("Product created successfully", {
      productId: product.id,
      userId: user.id,
      title: product.title,
    });

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
