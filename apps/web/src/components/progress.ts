/** Most segments the `steps` variant draws; longer scales fall back to a plain bar. */
export const MAX_STEP_SEGMENTS = 20;

export interface ProgressRange {
  /** `value` clamped to `[0, max]`; non-finite values become 0. */
  value: number;
  /** `max`, or 0 when it is not a positive finite number. */
  max: number;
  /** Filled share in `[0, 1]`. */
  ratio: number;
}

/** Normalises a progress value for display and ARIA: clamps it and guards against bad input. */
export function normalizeProgress(value: number, max: number): ProgressRange {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  return { value: safeValue, max: safeMax, ratio: safeMax === 0 ? 0 : safeValue / safeMax };
}
