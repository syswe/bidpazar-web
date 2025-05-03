import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';

// Schema for search query
const searchQuerySchema = z.object({
  query: z.string().min(1, 'Arama terimi gereklidir'),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    // Get search parameters from URL
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Validate search parameters
    const validatedData = searchQuerySchema.parse({
      query,
      page,
      limit,
    });

    // Calculate pagination
    const skip = (validatedData.page - 1) * validatedData.limit;

    // Search users
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: validatedData.query, mode: 'insensitive' } },
            { name: { contains: validatedData.query, mode: 'insensitive' } },
            { email: { contains: validatedData.query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: validatedData.limit,
        orderBy: { username: 'asc' },
      }),
      prisma.user.count({
        where: {
          OR: [
            { username: { contains: validatedData.query, mode: 'insensitive' } },
            { name: { contains: validatedData.query, mode: 'insensitive' } },
            { email: { contains: validatedData.query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        total,
        page: validatedData.page,
        limit: validatedData.limit,
        totalPages: Math.ceil(total / validatedData.limit),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Kullanıcı araması yapılırken hata:', error);
    return NextResponse.json(
      { error: 'Kullanıcı araması yapılırken bir hata oluştu' },
      { status: 500 }
    );
  }
} 