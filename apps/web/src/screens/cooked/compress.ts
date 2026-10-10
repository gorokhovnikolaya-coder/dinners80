import {
  COOK_PHOTO_MAX_BYTES,
  COOK_PHOTO_MAX_SIDE,
  COOK_PHOTO_QUALITY,
  COOK_PHOTO_TYPE,
} from '@tma80/shared';

/** One encoding try: the target size and JPEG quality. */
export interface CompressionAttempt {
  width: number;
  height: number;
  quality: number;
}

export interface CompressionLimits {
  maxSide: number;
  maxBytes: number;
  quality: number;
}

/** ТЗ: up to 1600 px on the long side, JPEG 80%, at most 500 KB. */
export const COOK_PHOTO_LIMITS: CompressionLimits = {
  maxSide: COOK_PHOTO_MAX_SIDE,
  maxBytes: COOK_PHOTO_MAX_BYTES,
  quality: COOK_PHOTO_QUALITY,
};

/** Lower qualities tried at the full size before the photo is scaled down. */
const FALLBACK_QUALITIES = [0.7, 0.6] as const;
/** Each further try scales the long side by this factor (quality stays at the last fallback). */
const SCALE_STEP = 0.8;
/** Do not go below this long side: such a photo is useless, the upload fails instead. */
const MIN_SIDE = 480;

/** Size that fits `maxSide` on the long side, keeping the aspect ratio; never upscales. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const long = Math.max(width, height);
  if (long <= maxSide) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxSide / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The encoding tries in order: the photo fitted to `maxSide` at the ТЗ quality (80%); if the JPEG
 * is still over `maxBytes` — lower qualities at the same size, then smaller sizes, down to a long
 * side of 480 px.
 */
export function compressionAttempts(
  width: number,
  height: number,
  limits: CompressionLimits = COOK_PHOTO_LIMITS,
): CompressionAttempt[] {
  const fitted = fitWithin(width, height, limits.maxSide);
  const attempts: CompressionAttempt[] = [{ ...fitted, quality: limits.quality }];
  const lower = FALLBACK_QUALITIES.filter((quality) => quality < limits.quality);
  for (const quality of lower) attempts.push({ ...fitted, quality });
  const lastQuality = lower.at(-1) ?? limits.quality;
  let side = Math.max(fitted.width, fitted.height) * SCALE_STEP;
  while (side >= MIN_SIDE) {
    attempts.push({
      ...fitWithin(fitted.width, fitted.height, Math.round(side)),
      quality: lastQuality,
    });
    side *= SCALE_STEP;
  }
  return attempts;
}

/** Encodes the decoded image at a size and quality (canvas in the browser, a fake in tests). */
export type JpegEncoder = (attempt: CompressionAttempt) => Promise<Blob>;

export class PhotoTooLargeError extends Error {
  constructor() {
    super('The photo does not compress under the upload limit');
    this.name = 'PhotoTooLargeError';
  }
}

/**
 * Runs the tries until a JPEG fits `maxBytes`.
 * @throws PhotoTooLargeError if no try fits.
 */
export async function compressImage(
  size: { width: number; height: number },
  encode: JpegEncoder,
  limits: CompressionLimits = COOK_PHOTO_LIMITS,
): Promise<Blob> {
  for (const attempt of compressionAttempts(size.width, size.height, limits)) {
    const blob = await encode(attempt);
    if (blob.size <= limits.maxBytes) return blob;
  }
  throw new PhotoTooLargeError();
}

/** Decodes a picked file; EXIF orientation is applied, so a portrait photo stays upright. */
async function decode(
  file: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => {
        bitmap.close();
      },
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Compresses the photo of the cooked dish on the client before the upload (ТЗ, НФТ: ≤ 1600 px on
 * the long side, JPEG 80%, ≤ 500 KB).
 * @throws if the file cannot be decoded as an image or does not fit the limit.
 */
export async function compressCookPhoto(file: Blob): Promise<Blob> {
  const image = await decode(file);
  try {
    const canvas = document.createElement('canvas');
    const encode: JpegEncoder = ({ width, height, quality }) => {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return Promise.reject(new Error('Canvas 2D is not available'));
      // JPEG has no alpha: a transparent PNG gets a white background, not black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image.source, 0, 0, width, height);
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('JPEG encoding failed'));
          },
          COOK_PHOTO_TYPE,
          quality,
        );
      });
    };
    return await compressImage(image, encode);
  } finally {
    image.close();
  }
}
