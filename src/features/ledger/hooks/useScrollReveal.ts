import { useEffect, useRef, useState } from 'react';

export interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
}

// Reveal-once: an element fades/grows into view the first time it crosses
// into the viewport and then stays revealed, even after scrolling back up
// past it. Shared by every animated element in the vertical timeline
// (quarter headings, month labels, line segments, task markers) so the
// "progressively reveals itself while scrolling" effect comes from one
// mechanism rather than bespoke logic per component.
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
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}
