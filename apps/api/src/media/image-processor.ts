export interface GeneratedThumbnail {
  label: string;
  width: number;
  height: number;
  data: Buffer;
}

/** Generates downscaled image derivatives. Framework-free; swappable. */
export interface ImageProcessor {
  /**
   * Produce one WebP derivative per requested size, resize-to-fit (never
   * upscaling). Returns [] for input sharp cannot process.
   */
  makeThumbnails(
    input: Buffer,
    sizes: readonly { label: string; max: number }[],
  ): Promise<GeneratedThumbnail[]>;
}

export const IMAGE_PROCESSOR = Symbol('IMAGE_PROCESSOR');
