import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure params is awaited before accessing properties
    const { id } = await params;
    
    logger.info('API POST /api/products/[id]/upload', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id },
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length')
    });
    
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      logger.warn('Product upload attempt without authentication token', { productId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    logger.debug('Verifying user authentication for product upload', { productId: id });
    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn('Product upload attempt with invalid token', { productId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    // Check if product exists and belongs to user
    logger.debug('Checking product ownership before upload', { productId: id, userId: user.id });
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      logger.warn('Product not found for upload', { productId: id, userId: user.id });
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    if (existingProduct.userId !== user.id) {
      logger.warn('Unauthorized product upload attempt', { 
        productId: id, 
        requestingUserId: user.id,
        ownerUserId: existingProduct.userId
      });
      return NextResponse.json(
        { error: 'Bu ürüne dosya yükleme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Parse form data with error handling for large files
    let formData;
    try {
      logger.debug('Parsing form data for upload', { productId: id });
      formData = await request.formData();
      logger.debug('Form data parsed successfully', { 
        productId: id,
        formDataEntries: Array.from(formData.entries()).map(([key]) => key)
      });
    } catch (error: any) {
      if (error.message && error.message.includes('size limit')) {
        logger.warn('File size limit exceeded during upload', { 
          productId: id, 
          error: error.message,
          contentLength: request.headers.get('content-length')
        });
        return NextResponse.json(
          { error: 'Dosya boyutu sınırı aşıldı. Lütfen 10MB veya daha küçük dosyalar yükleyin.' },
          { status: 413 }
        );
      }
      logger.error('Error parsing form data for upload', {
        productId: id,
        error: error.message,
        stack: error.stack
      });
      throw error; // Re-throw if it's not a size limit error
    }
    
    const files = formData.getAll('files') as File[];
    logger.debug('Files extracted from form data', { 
      productId: id, 
      fileCount: files.length,
      fileNames: files.map(f => f.name),
      fileSizes: files.map(f => f.size)
    });

    if (!files || files.length === 0) {
      logger.warn('No files provided in upload request', { productId: id });
      return NextResponse.json(
        { error: 'En az bir dosya yüklenmelidir' },
        { status: 400 }
      );
    }

    // Check if any individual file is too large
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        logger.warn('Individual file size limit exceeded', {
          productId: id,
          fileName: file.name,
          fileSize: file.size,
          maxSize: MAX_FILE_SIZE
        });
        return NextResponse.json(
          { error: `Dosya "${file.name}" boyutu sınırı aşıyor. Lütfen 10MB veya daha küçük dosyalar yükleyin.` },
          { status: 413 }
        );
      }
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    logger.debug('Uploads directory path', { uploadsDir });
    const uploadedFiles = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate unique filename
      const extension = file.name.split('.').pop();
      const filename = `${uuidv4()}.${extension}`;
      const path = join(uploadsDir, filename);

      logger.debug('Writing file to disk', { 
        productId: id, 
        originalName: file.name,
        fileName: filename,
        fileSize: buffer.length,
        path
      });

      // Save file
      await writeFile(path, buffer);
      logger.debug('File written successfully', { fileName: filename });

      // Create media record
      logger.debug('Creating media record in database', { 
        productId: id, 
        fileName: filename,
        fileType: file.type
      });
      const media = await prisma.productMedia.create({
        data: {
          productId: id,
          url: `/uploads/${filename}`,
          type: file.type.startsWith('image/') ? 'image' : 'video',
        },
      });

      uploadedFiles.push(media);
      logger.debug('Media record created', { mediaId: media.id, url: media.url });
    }

    logger.info('Files uploaded successfully', { 
      productId: id, 
      count: uploadedFiles.length,
      mediaIds: uploadedFiles.map(f => f.id)
    });

    return NextResponse.json(uploadedFiles, { status: 201 });
  } catch (error: any) {
    logger.error('Error uploading files', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      params: await params.catch(() => ({}))
    });
    return NextResponse.json(
      { error: 'Dosya yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 