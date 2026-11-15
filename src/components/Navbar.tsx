import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

type HeaderState = 'normal' | 'hidden' | 'reveal';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerState, setHeaderState] = useState<HeaderState>('normal');
  const lastScrollY = useRef(0);
  const headerHeight = useRef(100);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (navContainerRef.current) {
      headerHeight.current = navContainerRef.current.offsetHeight || 100;
    }

    const handleScroll = () => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      const hHeight = headerHeight.current;

      // 1. At the top of the website (scroll position within initial header height):
      // Natural normal scroll along with document flow (no sticky jump)
      if (currentScrollY <= hHeight) {
        setHeaderState('normal');
      }
      // 2. Scrolled past header and scrolling down:
      // Hide the header (sticks offscreen above viewport)
      else if (currentScrollY > lastScrollY.current && currentScrollY > hHeight) {
        setHeaderState('hidden');
      }
      // 3. Scrolled past header and scrolling up:
      // Immediately reveal header smoothly downward
      else if (currentScrollY < lastScrollY.current && currentScrollY > hHeight) {
        setHeaderState('reveal');
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'HOME', path: '/' },
    { name: 'PRODUCT', path: '/features' },
    { name: 'DOC', path: '/docs' },
    { name: 'CONTACT', path: '/contact' },
  ];

  // Smooth slide up on scroll down, smooth slide down on scroll up
  const getHeaderClasses = () => {
    switch (headerState) {
      case 'reveal':
        return 'sticky top-0 z-50 translate-y-0 transition-transform duration-300 ease-out shadow-[0_4px_12px_rgba(0,0,0,0.1)]';
      case 'hidden':
        return 'sticky top-0 z-50 -translate-y-full transition-transform duration-300 ease-in';
      case 'normal':
      default:
        return 'relative z-50 translate-y-0 transition-transform duration-300 ease-out';
    }
  };

  return (
    <div
      ref={navContainerRef}
      className={`header-wrapper color-background-1 header-wrapper--border-bottom w-full bg-[#f3f4fb] border-t-4 border-b-4 border-[#27272a] ${getHeaderClasses()}`}
    >
      <header className="header flex items-stretch justify-between w-full h-[100px] max-h-[100px] relative">
        
        {/* Mobile Kebab Menu button (hidden on desktop >=991px) */}
        <div className="min-[991px]:hidden flex items-center pl-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="cursor-pointer p-2 flex items-center focus:outline-none"
            aria-label="Toggle menu"
          >
            <div className={`flex flex-col items-center justify-center transition-transform duration-300 ${mobileMenuOpen ? 'rotate-45' : ''}`}>
              <div className="w-3 h-3 bg-[#27272a] rounded-full my-[2px]"></div>
              <div className="w-3 h-3 bg-[#27272a] rounded-full my-[2px]"></div>
              <div className="w-3 h-3 bg-[#27272a] rounded-full my-[2px]"></div>
            </div>
          </button>
        </div>

        {/* Branding: 0TOUCH rendered with crisp geometric letterforms matching LOZ */}
        <div className="flex items-center absolute left-16 md:left-20 min-[991px]:left-0 min-[991px]:max-h-[100px] min-[991px]:h-[100px] h-full">
          <Link
            to="/"
            className="pl-6 md:pl-8 lg:pl-10 flex items-center focus:outline-none select-none"
          >
            <span
              style={{
                fontFamily: '"Pratico Variable", sans-serif',
                fontWeight: 900,
                fontSize: '44px',
                letterSpacing: '-1.5px',
                color: '#262929',
              }}
              className="leading-none uppercase"
            >
              0TOUCH
            </span>
          </Link>
        </div>

        {/* Center / Inline Navigation Menu */}
        <nav className="hidden min-[991px]:flex items-stretch h-[100px] m-0 p-0 ml-auto">
          <ul className="flex items-stretch h-full m-0 p-0 list-none" role="list">
            {navLinks.map((link, index) => {
              const isActive = location.pathname === link.path;
              const isFirst = index === 0;
              // Only show left border on HOME (first link) when HOME is active (or hovered); on other tabs, suppress it
              const showLeftBorder = !isFirst || isActive;

              return (
                <li
                  key={link.name}
                  className={`h-full flex items-stretch ${
                    showLeftBorder ? 'border-l-4 border-[#27272a]' : 'border-l-4 border-transparent'
                  }`}
                >
                  <Link
                    to={link.path}
                    className={`h-full flex items-center justify-center transition-all duration-150 uppercase tracking-wider select-none ${
                      isActive
                        ? 'bg-[#6f7bd4] !text-white'
                        : 'text-[#27272a] hover:bg-[#6f7bd4]/10 hover:text-[#6f7bd4]'
                    }`}
                    style={{
                      fontFamily: '"Pratico Variable", sans-serif',
                      fontSize: '20px',
                      fontWeight: 600,
                      lineHeight: '150%',
                    }}
                  >
                    <span className="px-8 xl:px-10">{link.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Far Right: LAUNCH Block (Width 230px on md+, border-l-4, coral bg #ff8066) */}
        <Link
          to="/viewer"
          className="px-6 md:px-10 h-[100px] flex justify-center items-center w-auto md:w-[230px] border-l-4 border-[#27272a] bg-[#ff8066] hover:bg-[#ff947d] transition-colors gap-x-6 text-[#27272a] select-none"
          title="Launch ZeroTouch Medical DICOM Viewer"
        >
          <span className="hidden md:block">
            <span
              className="uppercase tracking-wide"
              style={{
                fontFamily: '"Pratico Variable", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                lineHeight: '150%',
                color: '#27272a',
              }}
            >
              LAUNCH
            </span>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="42"
            height="46"
            viewBox="0 0 52 56"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8.80394 2.09003L3.73096 7.33473V52.09H48.0927V7.33473L43.0197 2.09003"
              stroke="#27272A"
              strokeWidth="4"
              strokeMiterlimit="10"
            />
          </svg>
        </Link>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="min-[991px]:hidden bg-[#f3f4fb] border-t-4 border-[#27272a] w-full flex flex-col">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-8 py-5 text-xl font-bold uppercase tracking-wider border-b-2 border-[#27272a]/20 ${
                  isActive ? 'bg-[#6f7bd4] text-white' : 'text-[#27272a]'
                }`}
                style={{ fontFamily: '"Pratico Variable", sans-serif' }}
              >
                {link.name}
              </Link>
            );
          })}
          <Link
            to="/viewer"
            onClick={() => setMobileMenuOpen(false)}
            className="bg-[#ff8066] text-[#27272a] px-8 py-5 text-center font-black text-xl uppercase tracking-wider border-b-4 border-[#27272a]"
            style={{ fontFamily: '"Pratico Variable", sans-serif' }}
          >
            LAUNCH VIEWER WORKSPACE
          </Link>
        </div>
      )}
    </div>
  );
};
