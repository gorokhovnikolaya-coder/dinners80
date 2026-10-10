/** Date on the stamp: the user's «today» as `ДД.ММ.ГГГГ` in their time zone. */
export function stampDate(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(now);
  } catch {
    // An unknown zone (should not happen: the server validates it) — the device's zone.
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(now);
  }
}

/**
 * Text size of the country on the round stamp (132 px, wide display font): long names get
 * smaller so «АРГЕНТИНА» fits as well as «ПЕРУ».
 */
export function stampCountryClass(name: string): string {
  const { length } = name;
  if (length <= 4) return 'text-5xl';
  if (length <= 6) return 'text-2xl';
  if (length <= 8) return 'text-lg';
  if (length <= 10) return 'text-md';
  return 'text-xs';
}
