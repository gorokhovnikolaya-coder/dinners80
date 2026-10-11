import type { Dish } from '@tma80/shared';

/** Warm photo-like tints of the mock placeholders, picked by the dish id. */
const TINTS = [
  ['#d9c3a5', '#b98e5f'],
  ['#e8d7a8', '#c9a659'],
  ['#e7b3a0', '#c46f50'],
  ['#c9d8b6', '#7f9f5a'],
  ['#f0c9a0', '#d08a48'],
  ['#d6b8a8', '#9c6b55'],
] as const;

const hash = (text: string) => {
  let sum = 7;
  for (let i = 0; i < text.length; i += 1) sum = (sum * 31 + text.charCodeAt(i)) >>> 0;
  return sum;
};

/**
 * The mock has no content photos: each dish gets an SVG gradient as a `data:` URL instead of the
 * WebP served by nginx in production. Only for the mock API (never in a production bundle).
 */
export function mockDishImageUrl(dish: Pick<Dish, 'id'>): string {
  const [from, to] = TINTS[hash(dish.id) % TINTS.length] ?? TINTS[0];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="400" height="300" fill="url(#g)"/>` +
    `<circle cx="200" cy="160" r="90" fill="#ffffff" fill-opacity="0.35"/>` +
    `<circle cx="200" cy="160" r="62" fill="#ffffff" fill-opacity="0.25"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Stand-in for a signed link to a user's cook photo (`/media/cooks/...` in production): an SVG
 * «snapshot» — a plate on a table — tinted by the photo path. Only for the mock API.
 */
export function mockCookPhotoUrl(photoPath: string): string {
  const [from, to] = TINTS[hash(photoPath) % TINTS.length] ?? TINTS[0];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">` +
    `<rect width="300" height="300" fill="#8a6a4f"/>` +
    `<circle cx="150" cy="150" r="118" fill="#f4efe6"/>` +
    `<circle cx="150" cy="150" r="84" fill="${from}"/>` +
    `<circle cx="128" cy="134" r="34" fill="${to}"/>` +
    `<circle cx="178" cy="170" r="24" fill="${to}" fill-opacity="0.7"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
