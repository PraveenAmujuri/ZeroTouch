import React, { useEffect, useRef, useState } from 'react';
import pathsData from './zerotouch_paths_clean.json';

interface FooterLogoProps {
  className?: string;
  color?: string;
}

export const FooterLogo: React.FC<FooterLogoProps> = ({ className = '', color = '#74d2c2' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const [isDrawn, setIsDrawn] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Setup strokeDasharray and initial strokeDashoffset on mount
  useEffect(() => {
    pathRefs.current.forEach((path) => {
      if (path && typeof path.getTotalLength === 'function') {
        const len = Math.ceil(path.getTotalLength());
        path.style.strokeDasharray = `${len}px`;
        path.style.strokeDashoffset = `${len}px`;
      }
    });
  }, []);

  // IntersectionObserver: Triggers the self-running drawing animation when entering viewport
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsDrawn(true);
      pathRefs.current.forEach((path) => {
        if (path) path.style.strokeDashoffset = '0px';
      });
      return;
    }

    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When 20% of the footer logo enters the viewport, trigger the automated drawing
          if (entry.isIntersecting) {
            setIsDrawn(true);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
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
          // Stagger each letter slightly (like The Loz 0s, 0.3s, 0.6s, ...)
          const delaySeconds = (idx * 0.22).toFixed(2);

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
              fill={isHovered ? color : 'transparent'}
              style={{
                strokeDashoffset: isDrawn ? '0px' : undefined,
                transition: `stroke-dashoffset 1.1s cubic-bezier(0.47, 0, 0.745, 0.715) ${delaySeconds}s, fill 0.8s ease-in-out`,
                paintOrder: 'fill stroke',
              }}
            />
          );
        })}
      </svg>
    </div>
  );
};
