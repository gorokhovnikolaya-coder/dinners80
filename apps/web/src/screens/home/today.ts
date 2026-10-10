/**
 * «Четверг, 8 октября» — today in the user's time zone. An unknown zone falls back to the
 * device's one rather than breaking the screen.
 */
export function formatToday(now: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  let text: string;
  try {
    text = new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: timezone }).format(now);
  } catch {
    text = new Intl.DateTimeFormat('ru-RU', options).format(now);
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Initials for the avatar without a Telegram photo: «Борис» → «Б». */
export function initials(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}
