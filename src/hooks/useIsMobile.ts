import { useState, useEffect } from 'react';

/**
 * Custom hook to detect mobile phones based on responsive viewport width.
 * Re-evaluates continuously on window resize and orientation change events.
 * 
 * Breakpoint: 768px (standard mobile phone width threshold, < md).
 * This ensures tablets, iPads (768px+), laptops, and desktop screens have full access,
 * and only mobile phones are blocked.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [breakpoint]);

  return isMobile;
}

