import { useEffect, useState } from 'react';

/** true enquanto a media query casar (ex.: '(min-width: 1024px)'). */
export function useMedia(query) {
  const [casa, setCasa] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const aoMudar = () => setCasa(mql.matches);
    aoMudar();
    mql.addEventListener('change', aoMudar);
    return () => mql.removeEventListener('change', aoMudar);
  }, [query]);
  return casa;
}
