import sharp from 'sharp';
import type { GeneratedThumbnail, ImageProcessor } from './image-processor';

/**
 * sharp-backed {@link ImageProcessor}. Decodes are bounded by `limitInputPixels`
 * (decompression-bomb defense-in-depth — the service also rejects over-cap images
 * before calling this). All derivatives are WebP; animated sources collapse to a
 * static first frame.
 */
export class SharpImageProcessor implements ImageProcessor {
  private readonly limitInputPixels: number;

  constructor(maxMegapixels: number) {
    this.limitInputPixels = maxMegapixels * 1_000_000;
  }

  async makeThumbnails(
    input: Buffer,
    sizes: readonly { label: string; max: number }[],
  ): Promise<GeneratedThumbnail[]> {
    const out: GeneratedThumbnail[] = [];
    for (const size of sizes) {
      try {
        const { data, info } = await sharp(input, { limitInputPixels: this.limitInputPixels })
          .rotate() // honour EXIF orientation
          .resize({ width: size.max, height: size.max, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        out.push({ label: size.label, width: info.width, height: info.height, data });
      } catch {
        // Unprocessable input → no derivatives (caller treats as thumbnails: []).
        return [];
      }
    }
    return out;
  }
}
