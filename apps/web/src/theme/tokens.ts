/**
 * Access to the design tokens from JS. The tokens themselves live only in `styles/index.css`
 * (`@theme static`, so every token is emitted as a CSS variable on `:root`).
 */

/** Screen background — also the colour of the Telegram header and background. */
export const CHROME_COLOR_TOKEN = '--color-bg';

type HexColor = `#${string}`;

/** Normalises a CSS value to `#RRGGBB` (the format Telegram accepts) or returns `undefined`. */
export function toHexColor(raw: string): HexColor | undefined {
  const value = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) {
    return value as HexColor;
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short) {
    const [, r = '', g = '', b = ''] = short;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return undefined;
}

/** Reads a colour token from `:root` as `#RRGGBB`; `undefined` if the CSS is not loaded. */
export function readColorToken(name: string, root: Element = document.documentElement) {
  return toHexColor(getComputedStyle(root).getPropertyValue(name));
}
