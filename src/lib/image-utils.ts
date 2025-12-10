import sharp from 'sharp';
import { logger } from '@/lib/logger';

export interface ImageConversionResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
}

/**
 * Convert an image buffer to WebP format with optimization
 * @param inputBuffer - The original image buffer
 * @param options - Conversion options
 * @returns Promise with conversion result
 */
export async function convertToWebP(
  inputBuffer: Buffer,
  options: {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    maintainAspectRatio?: boolean;
  } = {}
): Promise<ImageConversionResult> {
  const {
    quality = 80,
    maxWidth = 1920,
    maxHeight = 1920,
    maintainAspectRatio = true,
  } = options;

  const originalSize = inputBuffer.length;

  try {
    // Get original image metadata
    const metadata = await sharp(inputBuffer).metadata();
    
    let pipeline = sharp(inputBuffer);
    
    // Resize if larger than max dimensions while maintaining aspect ratio
    if (maintainAspectRatio && (
      (metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight)
    )) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to WebP with quality settings
    const result = await pipeline
      .webp({
        quality,
        effort: 4, // Balance between speed and compression (0-6)
        lossless: false,
      })
      .toBuffer({ resolveWithObject: true });

    const conversionResult: ImageConversionResult = {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      format: 'webp',
      originalSize,
      convertedSize: result.data.length,
      compressionRatio: Math.round((1 - result.data.length / originalSize) * 100),
    };

    logger.debug('Image converted to WebP', {
      originalSize,
      convertedSize: result.data.length,
      compressionRatio: `${conversionResult.compressionRatio}%`,
      dimensions: `${result.info.width}x${result.info.height}`,
    });

    return conversionResult;
  } catch (error: any) {
    logger.error('Error converting image to WebP', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Check if a file is a supported image format for conversion
 */
export function isSupportedImageFormat(mimeType: string): boolean {
  const supportedFormats = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/tiff',
    'image/bmp',
    'image/webp', // Already WebP, but we can still optimize
  ];
  
  return supportedFormats.includes(mimeType.toLowerCase());
}

/**
 * Generate a WebP filename from the original filename
 */
export function generateWebPFilename(originalFilename: string): string {
  const nameWithoutExtension = originalFilename.replace(/\.[^.]+$/, '');
  return `${nameWithoutExtension}.webp`;
}

/**
 * Create optimized thumbnail version of an image
 */
export async function createThumbnail(
  inputBuffer: Buffer,
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): Promise<Buffer> {
  const {
    width = 300,
    height = 300,
    quality = 75,
  } = options;

  try {
    const result = await sharp(inputBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality })
      .toBuffer();

    logger.debug('Thumbnail created', {
      width,
      height,
      size: result.length,
    });

    return result;
  } catch (error: any) {
    logger.error('Error creating thumbnail', {
      error: error.message,
    });
    throw error;
  }
}
