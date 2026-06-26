import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { SharpImageProcessor } from './sharp-image-processor';

let png: Buffer;
beforeAll(async () => {
  png = await sharp({
    create: { width: 1000, height: 800, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer();
});

describe('SharpImageProcessor', () => {
  const processor = new SharpImageProcessor(40);
  const sizes = [
    { label: 'thumb', max: 400 },
    { label: 'medium', max: 1024 },
  ] as const;

  it('produces one WebP derivative per size, bounded to the max edge', async () => {
    const out = await processor.makeThumbnails(png, sizes);
    expect(out.map((t) => t.label)).toEqual(['thumb', 'medium']);
    const thumb = out[0];
    expect(Math.max(thumb.width, thumb.height)).toBeLessThanOrEqual(400);
    // WebP magic: bytes 0-3 'RIFF', 8-11 'WEBP'.
    expect(thumb.data.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(thumb.data.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });

  it('does not upscale beyond the source size', async () => {
    const out = await processor.makeThumbnails(png, sizes);
    const medium = out[1];
    // Source is 1000px wide < 1024 max → output stays 1000, not enlarged.
    expect(medium.width).toBe(1000);
  });

  it('returns [] for non-image bytes', async () => {
    const out = await processor.makeThumbnails(Buffer.from('not an image'), sizes);
    expect(out).toEqual([]);
  });
});
