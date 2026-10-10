import { describe, expect, it, vi } from 'vitest';

import {
  COOK_PHOTO_LIMITS,
  compressImage,
  compressionAttempts,
  fitWithin,
  PhotoTooLargeError,
  type CompressionAttempt,
} from './compress.ts';

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

describe('fitWithin', () => {
  it('scales the long side down to 1600 px keeping the aspect ratio', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4000, 1000, 1600)).toEqual({ width: 1600, height: 400 });
  });

  it('never upscales a small photo', () => {
    expect(fitWithin(1200, 900, 1600)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });
});

describe('compressionAttempts', () => {
  it('starts at 1600 px and JPEG 80%, then lowers quality, then the size', () => {
    const attempts = compressionAttempts(4032, 3024);
    expect(attempts[0]).toEqual({ width: 1600, height: 1200, quality: 0.8 });
    expect(attempts.slice(1, 3)).toEqual([
      { width: 1600, height: 1200, quality: 0.7 },
      { width: 1600, height: 1200, quality: 0.6 },
    ]);
    expect(attempts[3]).toEqual({ width: 1280, height: 960, quality: 0.6 });
    const sides = attempts.map(({ width, height }) => Math.max(width, height));
    expect(sides).toEqual([...sides].sort((a, b) => b - a));
    expect(Math.min(...sides)).toBeGreaterThanOrEqual(480);
  });

  it('keeps the size of a small photo in the first try', () => {
    expect(compressionAttempts(800, 600)[0]).toEqual({ width: 800, height: 600, quality: 0.8 });
  });
});

describe('compressImage', () => {
  it('returns the first JPEG that fits 500 KB (usually the very first try)', async () => {
    const encode = vi.fn((attempt: CompressionAttempt) =>
      Promise.resolve(blobOf(attempt.width * 100)),
    );
    const result = await compressImage({ width: 4032, height: 3024 }, encode);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith({ width: 1600, height: 1200, quality: 0.8 });
    expect(result.size).toBeLessThanOrEqual(COOK_PHOTO_LIMITS.maxBytes);
  });

  it('lowers the quality and then the size until the photo fits', async () => {
    // A «noisy» photo: about 0.4 byte per pixel per quality step.
    const encode = vi.fn(({ width, height, quality }: CompressionAttempt) =>
      Promise.resolve(blobOf(Math.round(width * height * quality * 0.45))),
    );
    const result = await compressImage({ width: 4032, height: 3024 }, encode);
    expect(result.size).toBeLessThanOrEqual(500 * 1024);
    const tries = encode.mock.calls.map(([attempt]) => attempt);
    expect(tries.map(({ quality }) => quality).slice(0, 3)).toEqual([0.8, 0.7, 0.6]);
    expect(tries.at(-1)?.width).toBeLessThan(1600);
  });

  it('fails when nothing fits the limit', async () => {
    const encode = () => Promise.resolve(blobOf(600 * 1024));
    await expect(compressImage({ width: 2000, height: 2000 }, encode)).rejects.toBeInstanceOf(
      PhotoTooLargeError,
    );
  });
});
