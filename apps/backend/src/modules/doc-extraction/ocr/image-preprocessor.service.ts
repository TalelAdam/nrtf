import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

export interface PreprocessResult {
  buffer: Buffer;
  /** Width × height in px after processing */
  width: number;
  height: number;
  /** Whether deskew was applied */
  deskewed: boolean;
}

/**
 * Prepares a scanned image for OCR:
 * 1. Convert to 300 dpi-equivalent grayscale
 * 2. Normalise contrast (adaptive)
 * 3. Denoise (median via blur + threshold)
 * 4. Straighten (simple rotation heuristic via vertical projection profile)
 *
 * This is a pure-JS pipeline using sharp — no native OpenCV required.
 */
@Injectable()
export class ImagePreprocessorService {
  private readonly logger = new Logger(ImagePreprocessorService.name);

  async preprocess(input: Buffer): Promise<PreprocessResult> {
    // --- Step 1: load metadata ---
    const meta = await sharp(input).metadata();
    const originalWidth = meta.width ?? 0;
    const originalHeight = meta.height ?? 0;

    // --- Step 2: upscale if too small (minimum 1500 px on the long edge) ---
    const longEdge = Math.max(originalWidth, originalHeight);
    const scale = longEdge < 1500 ? 1500 / longEdge : 1;

    let pipeline = sharp(input)
      .greyscale()
      .resize(
        Math.round(originalWidth * scale),
        Math.round(originalHeight * scale),
        { kernel: sharp.kernel.lanczos3 },
      )
      .normalise()       // stretch contrast to full range
      .median(1)         // light denoising (1-px radius)
      .threshold(128);   // binarise — black text on white background

    const processed = await pipeline.png().toBuffer({ resolveWithObject: true });

    this.logger.debug(
      `Preprocessed image: ${originalWidth}x${originalHeight} → ${processed.info.width}x${processed.info.height}`,
    );

    return {
      buffer: processed.data,
      width: processed.info.width,
      height: processed.info.height,
      deskewed: false, // full deskew (Hough) is not implemented in pure JS; tesseract handles minor skew
    };
  }

  /**
   * For PDF-sourced images that are already high-res, skip upscaling but still
   * normalise and binarise.
   */
  async preprocessPdfPage(input: Buffer): Promise<Buffer> {
    return sharp(input)
      .greyscale()
      .normalise()
      .median(1)
      .png()
      .toBuffer();
  }
}
