import { useEffect, useRef, useState } from 'react';

export interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
}

// Reversible: an element's revealed state tracks the observed element's
// current viewport intersection -- fades/rises in when scrolled into the
// reveal zone, fades/rises back out when scrolled away from it (in either
// direction). The observer is never disconnected except on unmount, unlike
// a "reveal once" pattern. Shared by every animated element in the vertical
// timeline (quarter headings, month labels, line segments, task markers) so
// the "the timeline is revealed as you move through time" effect comes from
// one mechanism rather than bespoke logic per component.
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {},
) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = options;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setRevealed(entry.isIntersecting),
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}
