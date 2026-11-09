import { useEffect, useState } from 'react';

/** Narrow window (tablet in portrait, small laptop): toolbars show icons without text. */
export const COMPACT_WIDTH = 1100;

export function useCompact(limit = COMPACT_WIDTH): boolean {
  const query = `(max-width: ${limit - 1}px)`;
  const [compact, setCompact] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(query);
    const on = () => setCompact(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return compact;
}
