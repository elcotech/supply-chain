// ===== src/hooks/useIsMobile.ts =====
// Subscribes to the viewport width so mobile-only UI chrome (bottom tab bar,
// compact header, card lists) renders only on small screens — desktop layout
// stays completely unchanged.
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 900px), (max-height: 520px) and (pointer: coarse)';

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
    } else {
      mql.addListener(onChange);
    }
    setIsMobile(mql.matches);
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', onChange);
      } else {
        mql.removeListener(onChange);
      }
    };
  }, []);

  return isMobile;
};

export default useIsMobile;