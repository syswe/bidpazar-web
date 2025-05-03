import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params;
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

    // Get the media and its associated product
    const media = await prisma.productMedia.findUnique({
      where: { id: mediaId },
      include: {
        product: true,
      },
    });

    if (!media) {
      return NextResponse.json(
        { error: 'Medya bulunamadı' },
        { status: 404 }
      );
    }

    // Check if user owns the product
    if (media.product.userId !== user.id) {
      return NextResponse.json(
        { error: 'Bu medyayı silme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Delete the media
    await prisma.productMedia.delete({
      where: { id: mediaId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('Medya silinirken hata:', error);
    return NextResponse.json(
      { error: 'Medya silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 