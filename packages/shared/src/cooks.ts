import { z } from 'zod/mini';

/** At most this many cooks (`cooks` rows) a user may record per 24 hours (ТЗ, «Лимит»). */
export const COOKS_PER_DAY_LIMIT = 20;

/** Upload limit of a cook photo (ТЗ: compressed on the client to ≤ 500 KB). */
export const COOK_PHOTO_MAX_BYTES = 500 * 1024;

/** Longest side of a compressed cook photo, px (ТЗ, НФТ «Производительность»). */
export const COOK_PHOTO_MAX_SIDE = 1600;

/** JPEG quality of a compressed cook photo (ТЗ: JPEG 80%). */
export const COOK_PHOTO_QUALITY = 0.8;

/** Media type of a compressed cook photo. */
export const COOK_PHOTO_TYPE = 'image/jpeg';

/** Multipart field name of the photo in `POST /uploads/cook-photo`. */
export const COOK_PHOTO_FIELD = 'photo';

/**
 * A stored cook photo: `cooks/{user_id}/{uuid}.jpg` in the private folder (ТЗ, «Фото»). The
 * client only passes back what `POST /uploads/cook-photo` returned; the server checks the owner.
 */
export const cookPhotoPathSchema = z
  .string()
  .check(z.regex(/^cooks\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/));

/**
 * At most this many cook photos a user may upload per 24 hours (decision 0019): uploads that never
 * become a cook must not fill the disk. Above it `POST /uploads/cook-photo` answers `429 rate_limited`.
 */
export const COOK_PHOTO_UPLOADS_PER_DAY_LIMIT = 40;

/** Response of `POST /api/uploads/cook-photo`. */
export const uploadCookPhotoResponseSchema = z.object({
  photoPath: cookPhotoPathSchema,
});
export type UploadCookPhotoResponse = z.infer<typeof uploadCookPhotoResponseSchema>;

/** Body of `POST /api/cooks`: the dish is cooked; the photo is optional. */
export const createCookRequestSchema = z.object({
  dishId: z.string().check(z.minLength(1)),
  photoPath: z.optional(z.nullable(cookPhotoPathSchema)),
});
export type CreateCookRequest = z.infer<typeof createCookRequestSchema>;

/** Body of `PATCH /api/cooks/:id`: a photo for a cook recorded without one (uploaded later). */
export const addCookPhotoRequestSchema = z.object({
  photoPath: cookPhotoPathSchema,
});
export type AddCookPhotoRequest = z.infer<typeof addCookPhotoRequestSchema>;

/** Response of `PATCH /api/cooks/:id`. */
export const addCookPhotoResponseSchema = z.object({
  cookId: z.string().check(z.minLength(1)),
  photoPath: cookPhotoPathSchema,
});
export type AddCookPhotoResponse = z.infer<typeof addCookPhotoResponseSchema>;

/** Upload limit of a share card (ТЗ, «Фото»: 2 MB). */
export const SHARE_CARD_MAX_BYTES = 2 * 1024 * 1024;

/** Media type of a share card. */
export const SHARE_CARD_TYPE = 'image/jpeg';

/** Multipart field name of the picture in `POST /uploads/share-card`. */
export const SHARE_CARD_FIELD = 'card';

/** Response of `POST /api/uploads/share-card`: the public URL of the card (`share/{uuid}.jpg`). */
export const uploadShareCardResponseSchema = z.object({
  url: z.string().check(z.regex(/\/share\/[0-9a-f-]{36}\.jpg$/)),
});
export type UploadShareCardResponse = z.infer<typeof uploadShareCardResponseSchema>;

/**
 * Response of `POST /api/cooks`: whether the cook brought a new country (a stamp), the counters
 * after it and the friend the user overtook in the ranking, if any.
 */
export const createCookResponseSchema = z.object({
  cookId: z.string().check(z.minLength(1)),
  newCountry: z.boolean(),
  /** Passed countries after this cook. */
  countriesCount: z.int().check(z.nonnegative()),
  /** Published countries — the «из 30» of the counter. */
  countriesTotal: z.int().check(z.positive()),
  /** All cooks of the user after this one, repeats included — the «N-е блюдо». */
  dishesCount: z.int().check(z.positive()),
  /** First name of the friend overtaken by this cook, or `null`. */
  overtook: z.nullable(z.string()),
});
export type CreateCookResponse = z.infer<typeof createCookResponseSchema>;

/** A friend in the ranking: name and counters (countries, then dishes). */
export interface RankedFriend {
  name: string;
  countries: number;
  dishes: number;
}

const byRank = (a: RankedFriend, b: RankedFriend) =>
  b.countries - a.countries || b.dishes - a.dishes || a.name.localeCompare(b.name, 'ru');

/**
 * «Обогнал друга»: the friend whose country count the user reached or passed with this cook —
 * the user had no more countries than the friend before (`countriesBefore ≤ friend`) and has more
 * after (`friend < countriesAfter`). With several such friends, the one highest in the ranking
 * (more countries, then more dishes, then by name). A cook without a new country overtakes nobody.
 * @returns the friend's name or `null`.
 */
export function findOvertakenFriend(
  countriesBefore: number,
  countriesAfter: number,
  friends: readonly RankedFriend[],
): string | null {
  if (countriesAfter <= countriesBefore) return null;
  const passed = friends.filter(
    (friend) => friend.countries >= countriesBefore && friend.countries < countriesAfter,
  );
  return [...passed].sort(byRank)[0]?.name ?? null;
}
