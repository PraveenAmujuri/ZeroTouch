import React, { useEffect, useRef, useState } from 'react';
import pathsData from './zerotouch_paths_clean.json';

interface FooterLogoProps {
  className?: string;
  color?: string;
}

// Pre-computed fallback lengths for clean cubic Béziers in zerotouch_paths_clean.json
// (all true lengths are between 870px and 1560px)
const LETTER_LENGTHS = [1650, 950, 1550, 1350, 1350, 1350];

export const FooterLogo: React.FC<FooterLogoProps> = ({ className = '', color = '#74d2c2' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const [lengths, setLengths] = useState<number[]>(LETTER_LENGTHS);
  const [isDrawn, setIsDrawn] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Measure browser sub-pixel path lengths on mount to update state
  useEffect(() => {
    const measured: number[] = [];
    pathRefs.current.forEach((path, idx) => {
      if (path && typeof path.getTotalLength === 'function') {
        const len = Math.ceil(path.getTotalLength());
        measured[idx] = len > 0 ? len : LETTER_LENGTHS[idx];
      } else {
        measured[idx] = LETTER_LENGTHS[idx];
      }
    });
    if (measured.length === pathsData.letters.length) {
      setLengths(measured);
    }
  }, []);

  // Viewport scroll position trigger calibrated directly to user's view
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsDrawn(true);
      return;
    }

    const checkScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;

      // In the screenshot, the logo is sitting near the bottom edge (top of logo at ~82% of window height).
      // When scrolling down and top of logo reaches <= 85% of window: draw forward.
      // When scrolling up and top of logo drops > 80% of window: reverse draw immediately.
      const shouldDraw = rect.top <= windowHeight * 0.85 && rect.bottom > 0;

      setIsDrawn(shouldDraw);
      if (!shouldDraw) {
        setIsHovered(false);
      }
    };

    window.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });

    // Initial check
    checkScroll();

    return () => {
      window.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`wrapper-logo-footer flex justify-center items-center w-full max-w-[850px] mx-auto select-none cursor-pointer py-4 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered((prev) => !prev)}
      title="0Touch Medical Imaging"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={pathsData.viewBox}
        className="w-full h-auto overflow-visible"
        aria-label="0Touch Logo"
      >
        {pathsData.letters.map((letter, idx) => {
          // Stagger delays: forward order (0 -> H) when drawing, reverse order (H -> 0) when unwinding
          const forwardDelay = (idx * 0.16).toFixed(2);
          const reverseDelay = ((pathsData.letters.length - 1 - idx) * 0.08).toFixed(2);
          const delaySeconds = isDrawn ? forwardDelay : reverseDelay;
          const len = lengths[idx] || LETTER_LENGTHS[idx];

          return (
            <path
              key={idx}
              ref={(el) => (pathRefs.current[idx] = el)}
              d={letter.d}
              stroke={color}
              strokeWidth="4"
              fillRule="evenodd"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={isHovered && isDrawn ? color : 'transparent'}
              style={{
                strokeDasharray: `${len}px`,
                strokeDashoffset: isDrawn ? '0px' : `${len}px`,
                transition: `stroke-dashoffset 0.85s cubic-bezier(0.47, 0, 0.745, 0.715) ${delaySeconds}s, fill 0.5s ease-in-out`,
                paintOrder: 'fill stroke',
              }}
            />
          );
        })}
      </svg>
    </div>
  );
};
