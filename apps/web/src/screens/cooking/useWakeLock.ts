import { useEffect, useState } from 'react';

/**
 * Keeps the screen on while the component is mounted (Screen Wake Lock API, where supported).
 * The browser releases the lock when the page is hidden, so it is taken again when the page is
 * visible. Released on unmount.
 * @returns `true` while the lock is held (the screen shows «Экран не погаснет…»).
 */
export function useWakeLock(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;
    let disposed = false;

    const acquire = () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (disposed) {
            void lock.release();
            return;
          }
          sentinel = lock;
          setActive(true);
          lock.addEventListener('release', () => {
            if (sentinel === lock) setActive(false);
          });
        })
        .catch(() => {
          setActive(false);
        });
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
    };
  }, []);

  return active;
}
