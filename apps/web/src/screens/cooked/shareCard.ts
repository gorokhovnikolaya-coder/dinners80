import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_MAX_BYTES,
  SHARE_CARD_TYPE,
  SHARE_CARD_WIDTH,
} from '@tma80/shared';

import { ru } from '../../i18n/ru.ts';
import { readColorToken } from '../../theme/tokens.ts';
import { coverSquare, layoutText, type ShareSubject } from './share.ts';

const t = ru.cooked;

/** What the card shows besides the counters: the photo and, for a new country, the stamp. */
export interface ShareCardContent extends ShareSubject {
  /** The user's photo (object URL) or the content photo of the dish. */
  photoUrl: string;
  /** The stamp date `ДД.ММ.ГГГГ`; only a new country gets the stamp. */
  stampDate: string;
}

/** JPEG qualities tried until the card fits the upload limit. */
const QUALITIES = [0.9, 0.8, 0.7, 0.6];

/** Layout of the 1080 × 1920 card, px (the result screen scaled ≈ 2.8×). */
const W = SHARE_CARD_WIDTH;
const SIDE = 120;
const PHOTO = { x: SIDE, y: 290, size: W - 2 * SIDE, radius: 64 };
const STAMP = { r: 185, dx: 40, dy: 50, border: 11, tilt: (-12 * Math.PI) / 180 };

/** Colour tokens of the card (the navy result screen). */
const COLOR_TOKENS = {
  bg: '--color-ink',
  raised: '--color-navy-2',
  track: '--color-navy-3',
  amber: '--color-amber',
  white: '--color-white',
  subtle: '--color-border',
  muted: '--color-on-dark-muted',
  accent: '--color-accent',
} as const;
type Colors = Record<keyof typeof COLOR_TOKENS, string>;

function readColors(): Colors {
  const colors: Partial<Colors> = {};
  for (const [key, token] of Object.entries(COLOR_TOKENS) as [keyof Colors, string][]) {
    const value = readColorToken(token);
    if (!value) throw new Error(`Colour token ${token} is not loaded`);
    colors[key] = value;
  }
  return colors as Colors;
}

const fontFamily = (token: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(token).trim() || 'sans-serif';

/** Loads an image for the canvas; `undefined` if it cannot be loaded (e.g. no content photo). */
async function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  const image = new Image();
  if (/^https?:/i.test(url) && new URL(url).origin !== window.location.origin)
    image.crossOrigin = 'anonymous';
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch {
    return undefined;
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The card could not be encoded'));
      },
      SHARE_CARD_TYPE,
      quality,
    );
  });

/**
 * Draws the share card (ТЗ, экран 4: the dish photo, the stamp and the country counter) on a
 * 1080 × 1920 canvas for a Telegram story and returns it as a JPEG within the upload limit.
 * The colours and fonts are the design tokens of the navy result screen.
 */
export async function drawShareCard(content: ShareCardContent): Promise<Blob> {
  const colors = readColors();
  const sans = fontFamily('--font-sans');
  const display = fontFamily('--font-display');
  try {
    await Promise.all([
      document.fonts.load(`700 96px ${display}`),
      document.fonts.load(`800 40px ${sans}`),
    ]);
  } catch {
    // A missing web font falls back to the system one: the card is still drawn.
  }
  const photo = await loadImage(content.photoUrl);

  const canvas = document.createElement('canvas');
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  const { result, dish } = content;

  const font = (weight: number, size: number, family = sans) => {
    ctx.font = `${String(weight)} ${String(size)}px ${family}`;
  };
  const spacing = (value: string) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = value;
  };
  const measure = (weight: number, family: string) => (text: string, size: number) => {
    font(weight, size, family);
    return ctx.measureText(text).width;
  };
  /** A centred text block (lines go down from `y`); returns the bottom of the last line. */
  const centred = (
    text: string,
    y: number,
    opts: { weight: number; max: number; min: number; family?: string; color: string },
    maxWidth = W - 2 * SIDE,
  ) => {
    const family = opts.family ?? sans;
    const layout = layoutText(text, maxWidth, opts, measure(opts.weight, family));
    font(opts.weight, layout.size, family);
    ctx.fillStyle = opts.color;
    let line = y;
    for (const part of layout.lines) {
      ctx.fillText(part, W / 2, line);
      line += Math.round(layout.size * 1.15);
    }
    return line - Math.round(layout.size * 1.15);
  };

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  spacing('4px');
  centred(t.share.card.brand.toUpperCase(), 150, {
    weight: 800,
    max: 34,
    min: 26,
    color: colors.muted,
  });
  centred((result.newCountry ? t.newCountry : t.repeat).toUpperCase(), 222, {
    weight: 800,
    max: 42,
    min: 32,
    color: colors.amber,
  });
  spacing('0px');

  // The photo, a square with rounded corners (cover).
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size, PHOTO.radius);
  ctx.fillStyle = colors.raised;
  ctx.fill();
  if (photo) {
    ctx.clip();
    const { sx, sy, side } = coverSquare(photo.naturalWidth, photo.naturalHeight);
    ctx.drawImage(photo, sx, sy, side, side, PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size);
  }
  ctx.restore();

  if (result.newCountry) {
    const cx = PHOTO.x + PHOTO.size + STAMP.dx - STAMP.r;
    const cy = PHOTO.y + PHOTO.size + STAMP.dy - STAMP.r;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(STAMP.tilt);
    // The shadow of `--shadow-raised` (a box-shadow token, not a colour one).
    ctx.shadowColor = 'rgb(0 0 0 / 0.3)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 16;
    ctx.beginPath();
    ctx.arc(0, 0, STAMP.r, 0, 2 * Math.PI);
    ctx.fillStyle = colors.white;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = STAMP.border;
    ctx.strokeStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(0, 0, STAMP.r - STAMP.border / 2, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    spacing('3px');
    font(800, 28);
    ctx.fillText(t.stamp.caption.toUpperCase(), 0, -62);
    spacing('0px');
    const country = layoutText(
      dish.countryName.toUpperCase(),
      2 * STAMP.r - 70,
      { max: 84, min: 30 },
      measure(700, display),
    );
    font(700, country.size, display);
    ctx.textBaseline = 'middle';
    ctx.fillText(country.lines.join(' '), 0, 6);
    ctx.textBaseline = 'alphabetic';
    font(800, 31);
    ctx.fillText(content.stampDate, 0, 92);
    ctx.restore();
  }

  const heading = result.newCountry ? t.inPassport(dish.countryName) : dish.title;
  const headingBottom = centred(heading, 1300, {
    weight: 700,
    max: 96,
    min: 64,
    family: display,
    color: colors.white,
  });
  centred(result.newCountry ? dish.title : dish.countryName, headingBottom + 80, {
    weight: 600,
    max: 46,
    min: 34,
    color: colors.subtle,
  });

  // The counter and the progress bar.
  const barY = 1580;
  const counter = t.countries(result.countriesCount, result.countriesTotal);
  font(800, 46);
  ctx.fillStyle = colors.white;
  ctx.textAlign = 'left';
  ctx.fillText(counter, SIDE, barY - 36);
  if (result.newCountry) {
    ctx.fillStyle = colors.amber;
    ctx.textAlign = 'right';
    ctx.fillText(t.plusToday, W - SIDE, barY - 36);
  }
  const barWidth = W - 2 * SIDE;
  ctx.beginPath();
  ctx.roundRect(SIDE, barY, barWidth, 24, 12);
  ctx.fillStyle = colors.track;
  ctx.fill();
  const share = result.countriesTotal > 0 ? result.countriesCount / result.countriesTotal : 0;
  const filled = Math.max(24, Math.round(barWidth * Math.min(1, share)));
  ctx.beginPath();
  ctx.roundRect(SIDE, barY, filled, 24, 12);
  ctx.fillStyle = colors.amber;
  ctx.fill();

  ctx.textAlign = 'center';
  centred(t.share.card.cta, 1790, { weight: 800, max: 48, min: 36, color: colors.amber });

  for (const quality of QUALITIES) {
    const blob = await toBlob(canvas, quality);
    if (blob.size <= SHARE_CARD_MAX_BYTES) return blob;
  }
  throw new Error('The card does not fit the upload limit');
}
