import { useState, type ReactNode } from 'react';

import { cx } from './cx.ts';

/**
 * A content photo of a dish, loaded lazily; a failed image leaves the neutral background instead
 * of a broken icon. Size and radius come from `className`; overlays (badge, lock) are children.
 */
export function DishPhoto({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cx('relative block shrink-0 bg-track', className)}>
      {!failed && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      )}
      {children}
    </span>
  );
}
