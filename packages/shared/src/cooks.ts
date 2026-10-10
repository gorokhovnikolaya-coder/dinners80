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
