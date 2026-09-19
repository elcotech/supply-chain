// ===== src/hooks/useIsMobile.ts =====
// Subscribes to the viewport width so mobile-only UI chrome (bottom tab bar,
// compact header, card lists) renders only on small screens — desktop layout
// stays completely unchanged.
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    onChange as unknown; // keep linters quiet on Safari's addListener path
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};

export default useIsMobile;