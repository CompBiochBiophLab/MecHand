import { type RefObject, useEffect, useRef, useState } from 'react';

/**
 * Toolbars show icons without text when they have less than `limit` px of width (a tablet in
 * portrait, or the canvas narrowed by the study panel or the help centre). The element's own width
 * is measured, not the window's.
 */
export const COMPACT_WIDTH = 1100;

export function useCompact<T extends HTMLElement = HTMLDivElement>(limit = COMPACT_WIDTH): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < limit);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width + 20 < limit));
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, compact];
}
