import React from 'react';
import { Link } from 'react-router-dom';
import { Monitor, ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';

export const DesktopRequired: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#f3f4fb] flex flex-col justify-between p-6 sm:p-10 select-none relative overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between w-full pb-6 border-b-4 border-[#27272a]">
        <Link to="/" className="flex items-center focus:outline-none" aria-label="0Touch Home">
          <Logo className="h-8 sm:h-9 w-auto text-[#27272a]" />
        </Link>
        <Link
          to="/"
          className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#27272a] hover:text-[#6f7bd4] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Center Hero Notice Card */}
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-lg bg-white border-4 border-[#27272a] shadow-[8px_8px_0px_#27272a] p-6 sm:p-10 flex flex-col items-center text-center relative">
          {/* Decorative Corner Accent */}
          <div className="absolute top-3 right-3 w-3 h-3 bg-[#ff8066] border-2 border-[#27272a] rounded-full" />

          {/* Desktop Monitor Icon with Neo-brutalist circle badge */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#6f7bd4] border-4 border-[#27272a] shadow-[4px_4px_0px_#27272a] flex items-center justify-center text-white mb-6">
            <Monitor className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.2]" />
          </div>

          {/* 0TOUCH Badge */}
          <span className="inline-block px-3.5 py-1 bg-[#27272a] text-white text-[11px] font-black uppercase tracking-widest rounded-full mb-4">
            0TOUCH WORKSPACE
          </span>

          {/* Heading */}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-[#27272a] leading-tight mb-4"
            style={{ fontFamily: '"Pratico Variable", sans-serif' }}
          >
            Desktop Experience Required
          </h1>

          {/* Main Message */}
          <p className="text-sm sm:text-base text-zinc-700 leading-relaxed font-medium mb-3 max-w-md">
            The 0Touch Gesture Viewer is designed for desktop and laptop screens with webcam access. Please open this experience on a desktop to use touchless medical imaging.
          </p>

          {/* Small Supporting Text */}
          <p className="text-xs sm:text-sm text-zinc-500 font-semibold mb-8">
            For the best touchless imaging experience.
          </p>

          {/* Navigation action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link
              to="/"
              className="loz-button loz-button-primary flex-1 text-center text-xs sm:text-sm py-3 justify-center"
            >
              EXPLORE OVERVIEW
            </Link>
            <Link
              to="/docs"
              className="loz-button loz-button-secondary flex-1 text-center text-xs sm:text-sm py-3 justify-center"
            >
              VIEW DOCUMENTATION
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Footer Note */}
      <footer className="text-center pt-6 border-t-2 border-[#27272a]/20">
        <p className="text-xs text-zinc-500 font-medium">
          ZeroTouch Medical DICOM &bull; Sterile Touchless Navigation
        </p>
      </footer>
    </div>
  );
};
