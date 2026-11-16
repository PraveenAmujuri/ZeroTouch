import React, { useEffect, useRef, useState } from 'react';
import pathsData from './zerotouch_paths_clean.json';

interface FooterLogoProps {
  className?: string;
  color?: string;
}

export const FooterLogo: React.FC<FooterLogoProps> = ({ className = '', color = '#74d2c2' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const pathLengths = useRef<number[]>([]);
  const [isDrawn, setIsDrawn] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Setup strokeDasharray and initial strokeDashoffset on mount
  useEffect(() => {
    pathRefs.current.forEach((path, idx) => {
      if (path && typeof path.getTotalLength === 'function') {
        const len = Math.ceil(path.getTotalLength());
        pathLengths.current[idx] = len;
        path.style.strokeDasharray = `${len}px`;
        path.style.strokeDashoffset = `${len}px`;
      }
    });
  }, []);

  // Viewport & Scroll detection: Draws on scroll down, reverses as soon as it reaches ~50% visibility when scrolling up
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsDrawn(true);
      return;
    }

    if (!containerRef.current) return;

    const checkVisibility = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const ratio = rect.height > 0 ? visibleHeight / rect.height : 0;

      // When at least 50% of the logo is visible in viewport: draw forward
      if (ratio >= 0.50) {
        setIsDrawn(true);
      }
      // When scrolling back up and logo visibility drops below ~48% (at the point in screenshot): reverse draw
      else if (ratio < 0.48) {
        setIsDrawn(false);
        setIsHovered(false);
      }
    };

    // IntersectionObserver for hardware-accelerated visibility triggers
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.50) {
            setIsDrawn(true);
          } else if (!entry.isIntersecting || entry.intersectionRatio < 0.48) {
            setIsDrawn(false);
            setIsHovered(false);
          }
        });
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.48, 0.50, 0.55, 0.6, 0.7, 0.8, 0.9, 1.0],
      }
    );

    observer.observe(containerRef.current);
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });

    // Initial check on load
    checkVisibility();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
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
          const forwardDelay = (idx * 0.18).toFixed(2);
          const reverseDelay = ((pathsData.letters.length - 1 - idx) * 0.1).toFixed(2);
          const delaySeconds = isDrawn ? forwardDelay : reverseDelay;
          const len = pathLengths.current[idx];

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
                strokeDashoffset: isDrawn ? '0px' : len ? `${len}px` : undefined,
                transition: `stroke-dashoffset 0.95s cubic-bezier(0.47, 0, 0.745, 0.715) ${delaySeconds}s, fill 0.6s ease-in-out`,
                paintOrder: 'fill stroke',
              }}
            />
          );
        })}
      </svg>
    </div>
  );
};
