import { NextResponse } from 'next/server';
import { getUserFromTokenInNode } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { convertToWebP, isSupportedImageFormat } from '@/lib/image-utils';

export async function POST(request: Request) {
  try {
    logger.info('API POST /api/stories/upload', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length')
    });
    
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      logger.warn('Story upload attempt without authentication token');
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    logger.debug('Verifying user authentication for story upload');
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('Story upload attempt with invalid token');
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    // Parse form data with error handling for large files
    let formData;
    try {
      logger.debug('Parsing form data for story upload');
      formData = await request.formData();
      logger.debug('Form data parsed successfully');
    } catch (error: any) {
      if (error.message && error.message.includes('size limit')) {
        logger.warn('File size limit exceeded during story upload', { 
          error: error.message,
          contentLength: request.headers.get('content-length')
        });
        return NextResponse.json(
          { error: 'Dosya boyutu sınırı aşıldı. Lütfen 5MB veya daha küçük dosyalar yükleyin.' },
          { status: 413 }
        );
      }
      logger.error('Error parsing form data for story upload', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
    
    const file = formData.get('file') as File | null;
    
    logger.debug('File extracted from form data', { 
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    });

    if (!file) {
      logger.warn('No file provided in story upload request');
      return NextResponse.json(
        { error: 'Bir dosya yüklenmelidir' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      logger.warn('Invalid file type for story upload', {
        fileName: file.name,
        fileType: file.type
      });
      return NextResponse.json(
        { error: 'Sadece görsel dosyaları yüklenebilir' },
        { status: 400 }
      );
    }

    // Check file size (5MB limit for stories)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      logger.warn('File size limit exceeded for story upload', {
        fileName: file.name,
        fileSize: file.size,
        maxSize: MAX_FILE_SIZE
      });
      return NextResponse.json(
        { error: `Dosya "${file.name}" boyutu sınırı aşıyor. Lütfen 5MB veya daha küçük dosyalar yükleyin.` },
        { status: 413 }
      );
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    logger.debug('Uploads directory path', { uploadsDir });

    const bytes = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes) as Buffer;
    let filename: string;

    // Convert image to WebP if supported
    if (isSupportedImageFormat(file.type)) {
      try {
        logger.debug('Converting story image to WebP', {
          originalName: file.name,
          originalSize: buffer.length,
          mimeType: file.type,
        });

        const conversionResult = await convertToWebP(buffer, {
          quality: 85,
          maxWidth: 1080,  // Story images optimized for mobile
          maxHeight: 1920,
        });

        buffer = conversionResult.buffer;
        filename = `${uuidv4()}.webp`;

        logger.info('Story image converted to WebP successfully', {
          originalName: file.name,
          originalSize: conversionResult.originalSize,
          convertedSize: conversionResult.convertedSize,
          compressionRatio: `${conversionResult.compressionRatio}%`,
          dimensions: `${conversionResult.width}x${conversionResult.height}`,
          newFilename: filename,
        });
      } catch (conversionError: any) {
        // If conversion fails, save original file
        logger.warn('WebP conversion failed, saving original file', {
          originalName: file.name,
          error: conversionError.message,
        });
        const extension = file.name.split('.').pop();
        filename = `${uuidv4()}.${extension}`;
      }
    } else {
      // Non-image or unsupported format - save as-is
      const extension = file.name.split('.').pop();
      filename = `${uuidv4()}.${extension}`;
    }

    const path = join(uploadsDir, filename);

    logger.debug('Writing story file to disk', { 
      originalName: file.name,
      fileName: filename,
      fileSize: buffer.length,
      path
    });

    // Save file
    await writeFile(path, buffer);
    logger.debug('Story file written successfully', { fileName: filename });

    const mediaUrl = `/uploads/${filename}`;

    logger.info('Story file uploaded successfully', { 
      fileName: filename,
      mediaUrl,
      fileSize: buffer.length,
      userId: user.id
    });

    return NextResponse.json({ 
      success: true,
      mediaUrl,
      fileName: filename
    }, { status: 201 });
  } catch (error: any) {
    logger.error('Error uploading story file', {
      error: error.message,
      stack: error.stack,
      url: request.url
    });
    return NextResponse.json(
      { error: 'Dosya yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 