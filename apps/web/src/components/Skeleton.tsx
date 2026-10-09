import type { CSSProperties, ReactNode } from 'react';

import { cx } from './cx.ts';

export type SkeletonShape = 'rect' | 'text' | 'circle';

export interface SkeletonProps {
  /** CSS width (number = px). Defaults to the full width. */
  width?: number | string;
  /** CSS height (number = px). `text` defaults to one line, `circle` to its width. */
  height?: number | string;
  /** `rect` — a card/photo block; `text` — a line of text; `circle` — an avatar. */
  shape?: SkeletonShape;
  className?: string;
}

const shapes: Record<SkeletonShape, string> = {
  rect: 'rounded-card',
  text: 'h-[1em] rounded-chip',
  circle: 'rounded-full',
};

/** A decorative placeholder (`aria-hidden`); wrap a group of them in `SkeletonGroup`. */
export function Skeleton({ width, height, shape = 'rect', className }: SkeletonProps) {
  const style: CSSProperties = {
    width,
    height: height ?? (shape === 'circle' ? width : undefined),
  };
  return (
    <span
      aria-hidden="true"
      className={cx('block bg-track motion-safe:animate-pulse', shapes[shape], className)}
      style={style}
    />
  );
}

export interface SkeletonGroupProps {
  /** Text for screen readers, e.g. «Загрузка…». */
  label: string;
  children: ReactNode;
  className?: string;
}

/** The loading state of a region: `role="status"` + `aria-busy` with a visually hidden label. */
export function SkeletonGroup({ label, children, className }: SkeletonGroupProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
