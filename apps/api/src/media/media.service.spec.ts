import type { Media, MediaRepository } from '@cmstack-ts/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageProcessor } from './image-processor';
import { MediaService, type UploadFile, extensionForMime } from './media.service';
import type { StorageDriver } from './storage';

/** A real PNG whose header `image-size` can read (1000x800, under the guard). */
async function makeTinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 1000, height: 800, channels: 3, background: '#abc' } })
    .png()
    .toBuffer();
}

describe('extensionForMime', () => {
  it('maps each allowed MIME type to a safe extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('.jpg');
    expect(extensionForMime('image/png')).toBe('.png');
    expect(extensionForMime('image/gif')).toBe('.gif');
    expect(extensionForMime('image/webp')).toBe('.webp');
    expect(extensionForMime('application/pdf')).toBe('.pdf');
  });

  it('never derives a dangerous extension from an unknown/forged MIME type', () => {
    // A polyglot attack relies on getting a .html (or similar) extension; the
    // map returns empty for anything not explicitly allowed.
    expect(extensionForMime('text/html')).toBe('');
    expect(extensionForMime('image/svg+xml')).toBe('');
    expect(extensionForMime('application/octet-stream')).toBe('');
  });
});

function mediaRow(over: Partial<Media> = {}): Media {
  return {
    id: 'm1',
    filename: 'k.pdf',
    originalName: 'doc.pdf',
    mimeType: 'application/pdf',
    size: 10,
    width: null,
    height: null,
    alt: null,
    title: null,
    caption: null,
    url: '/uploads/k.pdf',
    uploaderId: 'u1',
    thumbnails: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...over,
  };
}

let media: Record<keyof MediaRepository, Mock>;
let storage: Record<keyof StorageDriver, Mock>;
let processor: { makeThumbnails: Mock };
let service: MediaService;

beforeEach(() => {
  media = {
    create: vi.fn(),
    findById: vi.fn(),
    findFilename: vi.fn(),
    listAndCount: vi.fn(),
    update: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  storage = { save: vi.fn(), delete: vi.fn(), pathFor: vi.fn(), root: vi.fn() };
  // Default: no derivatives produced (individual tests override).
  processor = { makeThumbnails: vi.fn().mockResolvedValue([]) };
  service = new MediaService(
    media as unknown as MediaRepository,
    storage as unknown as StorageDriver,
    processor as unknown as ImageProcessor,
  );
});

const pdf: UploadFile = {
  originalname: 'doc.pdf',
  mimetype: 'application/pdf',
  size: 10,
  buffer: Buffer.from('%PDF-1.4 hello'),
};

/** Invocation order of a mock's first call (1-based; 0 if never called). */
const order = (m: Mock): number => m.mock.invocationCallOrder[0] ?? 0;
/** First argument of a mock's first call. */
const firstArg = (m: Mock): string => m.mock.calls[0]?.[0] as string;

describe('MediaService.upload', () => {
  it('saves the file to storage BEFORE writing the row, with a MIME-derived key', async () => {
    media.create.mockResolvedValue(mediaRow());
    await service.upload(pdf, 'u1');

    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(media.create).toHaveBeenCalledTimes(1);
    expect(order(storage.save)).toBeLessThan(order(media.create));

    const key = firstArg(storage.save);
    expect(key.endsWith('.pdf')).toBe(true);
    expect(media.create).toHaveBeenCalledWith(
      expect.objectContaining({ filename: key, url: `/uploads/${key}`, uploaderId: 'u1' }),
    );
  });

  it('rolls back the stored file (delete with the same key) when the row write fails', async () => {
    media.create.mockRejectedValue(new Error('db down'));
    await expect(service.upload(pdf, 'u1')).rejects.toThrow('db down');

    expect(storage.delete).toHaveBeenCalledWith(firstArg(storage.save));
  });
});

describe('MediaService.upload thumbnails', () => {
  it('generates derivatives, stores them, and records the thumbnails JSON', async () => {
    processor.makeThumbnails.mockResolvedValue([
      { label: 'thumb', width: 400, height: 320, data: Buffer.from('a') },
      { label: 'medium', width: 1000, height: 800, data: Buffer.from('bb') },
    ]);
    media.create.mockImplementation((d) =>
      Promise.resolve({
        id: 'm1',
        alt: null,
        title: null,
        caption: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...d,
      }),
    );
    const png = await makeTinyPng();
    const res = await service.upload(
      { originalname: 'a.png', mimetype: 'image/png', size: png.length, buffer: png },
      'u1',
    );
    // original + 2 derivatives saved
    expect(storage.save).toHaveBeenCalledTimes(3);
    expect(res.thumbnails).toHaveLength(2);
    expect(res.thumbnails[0]).toMatchObject({
      label: 'thumb',
      width: 400,
      url: expect.stringContaining('-thumb.webp'),
    });
  });

  it('rejects an image above the megapixel guard before saving', async () => {
    const huge = await sharp({
      create: { width: 8000, height: 6000, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    await expect(
      service.upload(
        { originalname: 'h.png', mimetype: 'image/png', size: huge.length, buffer: huge },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException); // 48 MP > 40 MP default
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('still uploads with thumbnails: [] when generation fails (fault-isolated)', async () => {
    processor.makeThumbnails.mockRejectedValue(new Error('boom'));
    media.create.mockImplementation((d) =>
      Promise.resolve({
        id: 'm2',
        alt: null,
        title: null,
        caption: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...d,
      }),
    );
    const png = await makeTinyPng();
    const res = await service.upload(
      { originalname: 'a.png', mimetype: 'image/png', size: png.length, buffer: png },
      'u1',
    );
    expect(res.thumbnails).toEqual([]);
    expect(storage.save).toHaveBeenCalledTimes(1); // only the original
  });

  it('rolls back the original AND every derivative when the row write fails', async () => {
    processor.makeThumbnails.mockResolvedValue([
      { label: 'thumb', width: 400, height: 320, data: Buffer.from('a') },
    ]);
    storage.save.mockResolvedValue(undefined);
    media.create.mockRejectedValue(new Error('db down'));
    const png = await makeTinyPng();
    await expect(
      service.upload(
        { originalname: 'a.png', mimetype: 'image/png', size: png.length, buffer: png },
        'u1',
      ),
    ).rejects.toThrow('db down');
    const original = storage.save.mock.calls[0]?.[0] as string;
    expect(storage.delete).toHaveBeenCalledWith(original);
    expect(storage.delete).toHaveBeenCalledWith(`${original.replace(/\.png$/, '')}-thumb.webp`);
  });

  it('remove deletes the original and every derivative key', async () => {
    media.findFilename.mockResolvedValue({
      filename: 'k.png',
      thumbnails: [{ label: 'thumb', width: 1, height: 1, url: '/uploads/k-thumb.webp', size: 1 }],
    });
    media.hardDelete.mockResolvedValue(undefined);
    await service.remove('m1');
    expect(storage.delete).toHaveBeenCalledWith('k.png');
    expect(storage.delete).toHaveBeenCalledWith('k-thumb.webp');
  });
});

describe('MediaService.remove', () => {
  it('deletes the stored file BEFORE the row, using the looked-up filename', async () => {
    media.findFilename.mockResolvedValue({ filename: 'stored.png' });
    await service.remove('m1');

    expect(storage.delete).toHaveBeenCalledWith('stored.png');
    expect(media.hardDelete).toHaveBeenCalledWith('m1');
    expect(order(storage.delete)).toBeLessThan(order(media.hardDelete));
  });

  it('throws NotFound and touches neither storage nor the row when absent', async () => {
    media.findFilename.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(media.hardDelete).not.toHaveBeenCalled();
  });
});

describe('MediaService.update', () => {
  it('checks existence then updates only the provided metadata fields', async () => {
    media.exists.mockResolvedValue(true);
    media.update.mockResolvedValue(mediaRow({ alt: 'pic' }));
    await service.update('m1', { alt: 'pic' });
    expect(media.update).toHaveBeenCalledWith('m1', { alt: 'pic' });
  });

  it('throws NotFound when the media is absent', async () => {
    media.exists.mockResolvedValue(false);
    await expect(service.update('missing', { alt: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(media.update).not.toHaveBeenCalled();
  });
});

describe('MediaService.upload validation', () => {
  // 1x1 transparent PNG
  const PNG_1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64',
  );

  it('measures image dimensions and stores them', async () => {
    media.create.mockResolvedValue(mediaRow({ mimeType: 'image/png', width: 1, height: 1 }));
    await service.upload(
      { originalname: 'a.png', mimetype: 'image/png', size: PNG_1x1.length, buffer: PNG_1x1 },
      'u1',
    );
    expect(media.create.mock.calls[0]?.[0]).toMatchObject({ width: 1, height: 1 });
  });

  it('rejects bytes that are not a valid image', async () => {
    await expect(
      service.upload(
        { originalname: 'x.png', mimetype: 'image/png', size: 3, buffer: Buffer.from('no!') },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects a PDF whose magic bytes are wrong', async () => {
    await expect(
      service.upload(
        {
          originalname: 'x.pdf',
          mimetype: 'application/pdf',
          size: 4,
          buffer: Buffer.from('XXXX'),
        },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported content type', async () => {
    await expect(
      service.upload(
        { originalname: 'x.txt', mimetype: 'text/plain', size: 1, buffer: Buffer.from('x') },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
