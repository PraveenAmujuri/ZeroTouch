import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll only when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { name: 'HOME', path: '/' },
    { name: 'PRODUCT', path: '/features' },
    { name: 'DOC', path: '/docs' },
    { name: 'CONTACT', path: '/contact' },
  ];

  return (
    <div className="header-wrapper color-background-1 header-wrapper--border-bottom w-full bg-[#f3f4fb] border-t-4 border-b-4 border-[#27272a] relative z-40">
      <header className="header flex items-stretch justify-between w-full h-[76px] sm:h-[88px] min-[991px]:h-[100px] relative">
        
        {/* Mobile Hamburger / 3-Dot Kebab Menu button (Exact Loz style morphing to X) */}
        <div className="min-[991px]:hidden flex items-center pl-4 sm:pl-6 z-20">
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="cursor-pointer p-1.5 flex items-center justify-center focus:outline-none select-none"
            aria-label="Toggle navigation drawer"
            aria-expanded={mobileMenuOpen}
          >
            <div className="menu__wrapper-kebab">
              <div className={`menu__item-kebab ${mobileMenuOpen ? 'is-open' : ''}`}>
                <div className="kebab-circle"></div>
                <div className="kebab-circle"></div>
                <div className="kebab-circle"></div>
                <div className="kebab-circle"></div>
                <div className="kebab-circle"></div>
              </div>
            </div>
          </button>
        </div>

        {/* Branding: 0Touch vector logo (Centered on mobile, left-aligned on desktop >=991px) */}
        <div className="flex items-center absolute left-1/2 -translate-x-1/2 min-[991px]:translate-x-0 min-[991px]:left-0 min-[991px]:max-h-[100px] min-[991px]:h-[100px] h-full z-10 pointer-events-auto">
          <Link
            to="/"
            className="pl-0 min-[991px]:pl-8 lg:pl-10 flex items-center focus:outline-none select-none"
            aria-label="0Touch Home"
          >
            <Logo className="h-7 sm:h-8 min-[991px]:h-9 w-auto text-[#262929]" />
          </Link>
        </div>

        {/* Center / Inline Navigation Menu (Desktop >=991px) */}
        <nav className="hidden min-[991px]:flex items-stretch h-[100px] m-0 p-0 ml-auto">
          <ul className="flex items-stretch h-full m-0 p-0 list-none" role="list">
            {navLinks.map((link, index) => {
              const isActive = location.pathname === link.path;
              const isFirst = index === 0;
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

        {/* Far Right: LAUNCH Block (Responsive width, border-l-4, coral bg #ff8066) */}
        <Link
          to="/viewer"
          className="px-4 sm:px-6 md:px-10 h-full flex justify-center items-center w-auto min-[991px]:w-[230px] border-l-4 border-[#27272a] bg-[#ff8066] hover:bg-[#ff947d] transition-colors gap-x-3 md:gap-x-6 text-[#27272a] select-none z-20"
          title="Launch ZeroTouch Medical DICOM Viewer"
        >
          <span className="hidden sm:inline">
            <span
              className="uppercase tracking-wide"
              style={{
                fontFamily: '"Pratico Variable", sans-serif',
                fontSize: '18px',
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
            className="w-7 h-7 sm:w-9 sm:h-9 min-[991px]:w-[42px] min-[991px]:h-[46px]"
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

      {/* Mobile Drawer Menu (Exact Loz mobile drawer layout: Full viewport backdrop + horizontal slide-in navigation) */}
      <div
        className={`min-[991px]:hidden fixed inset-0 top-[76px] sm:top-[88px] z-50 transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Backdrop overlay */}
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Sliding Menu Drawer Container */}
        <div
          className={`relative z-10 flex flex-col w-full h-[calc(100vh-76px)] sm:h-[calc(100vh-88px)] overflow-y-auto transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          {/* Solid Menu Content Box */}
          <div
            className="w-full bg-[#f3f4fb] border-b-4 border-[#27272a] shadow-[0_16px_32px_rgba(0,0,0,0.35)] flex flex-col shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col w-full" role="navigation">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-8 py-4 sm:py-5 text-xl sm:text-2xl font-black uppercase tracking-wider border-b-2 border-[#27272a] transition-colors flex items-center justify-between ${
                      isActive ? 'bg-[#6f7bd4] text-white' : 'text-[#27272a] hover:bg-[#6f7bd4]/10'
                    }`}
                    style={{ fontFamily: '"Pratico Variable", sans-serif' }}
                  >
                    <span>{link.name}</span>
                    <span className="text-xl opacity-60">→</span>
                  </Link>
                );
              })}
            </nav>

            {/* Launch CTA inside mobile drawer */}
            <div className="p-4 sm:p-6 bg-white border-b-4 border-[#27272a] flex justify-center">
              <Link
                to="/viewer"
                onClick={() => setMobileMenuOpen(false)}
                className="loz-button loz-button-primary w-full text-center text-xs sm:text-sm py-2.5 sm:py-3.5 leading-snug"
              >
                LAUNCH VIEWER WORKSPACE
              </Link>
            </div>

            {/* 0TOUCH touchless medical imaging utility bar - directly below Launch Viewer button */}
            <div className="bg-[#27272a] text-white p-5 sm:p-6 flex flex-col gap-2.5 text-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                0TOUCH &bull; TOUCHLESS MEDICAL IMAGING
              </span>
              <p className="text-xs text-zinc-400">
                Operate DICOM scans with sterile touchless hand gestures.
              </p>
            </div>
          </div>

          {/* Transparent clickable exit space below menu */}
          <div
            className="flex-1 min-h-[60px] cursor-pointer"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
        </div>
      </div>
    </div>
  );
};
