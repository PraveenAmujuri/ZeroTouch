import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-zinc-900 text-white border-t-4 border-black px-6 md:px-16 lg:px-28 py-16 md:py-24">
      <div className="max-w-7xl mx-auto flex flex-col gap-16">
        
        {/* Newsletter / Updates Section matching Loz */}
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-6">
          <h2 className="font-display font-extrabold text-3xl md:text-5xl tracking-tight text-white">
            Stay ahead in <span className="text-secondary-400">touchless OR</span> imaging.
          </h2>
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
            Get the latest releases, clinical study updates, and deployment guidelines for sterile operating rooms.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("Thank you for subscribing to ZeroTouch updates!");
            }}
            className="w-full flex flex-col sm:flex-row gap-3 mt-2"
          >
            <div className="relative flex-1">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                required
                placeholder="Enter your clinical or institutional email"
                className="w-full pl-12 pr-4 py-3.5 bg-zinc-800 border-2 border-zinc-700 text-white placeholder-zinc-500 font-medium focus:outline-none focus:border-tertiary-400"
              />
            </div>
            <button
              type="submit"
              className="bg-secondary-500 hover:bg-secondary-400 text-zinc-950 font-bold uppercase tracking-wider px-6 py-3.5 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>Subscribe</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="h-1 bg-zinc-800 w-full" />

        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          
          {/* Brand info */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center">
              <Logo className="h-7 w-auto text-[#74d2c2]" />
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sterile touchless DICOM viewer interface engineered for operating rooms and surgical suites.
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-tertiary-400" />
              <span>Zero-Contamination Surgical Protocol</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-3">
            <h4 className="font-bold uppercase tracking-wider text-sm text-tertiary-400">
              Quick Links
            </h4>
            <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">Home</Link>
            <Link to="/features" className="text-sm text-zinc-400 hover:text-white transition-colors">Interaction Features</Link>
            <Link to="/docs" className="text-sm text-zinc-400 hover:text-white transition-colors">Documentation & Studies</Link>
            <Link to="/viewer" className="text-sm text-zinc-400 hover:text-white transition-colors">DICOM Workspace</Link>
          </div>

          {/* Clinical Info */}
          <div className="flex flex-col gap-3">
            <h4 className="font-bold uppercase tracking-wider text-sm text-secondary-400">
              System Specs
            </h4>
            <span className="text-sm text-zinc-400">Operating Modes: 4 (Slice, Zoom, Window, Pan)</span>
            <span className="text-sm text-zinc-400">Spatial Range: Chest-level tracking</span>
            <span className="text-sm text-zinc-400">Filtering: 1€ Adaptive Jitter Filter</span>
            <span className="text-sm text-zinc-400">Supported Scans: CT, MR, XA, US Cine</span>
          </div>

          {/* Institutional Contact */}
          <div className="flex flex-col gap-3">
            <h4 className="font-bold uppercase tracking-wider text-sm text-primary-400">
              Contact & Support
            </h4>
            <Link to="/contact" className="text-sm text-zinc-400 hover:text-white transition-colors">Clinical Demonstration</Link>
            <span className="text-sm text-zinc-400">Email: or-support@zerotouch.io</span>
            <span className="text-sm text-zinc-400">Location: Surgical Engineering Labs</span>
            <span className="text-xs text-zinc-500 mt-2">
              © 2026 0Touch. All rights reserved.{' '}
              <a
                href="https://praveenai.tech/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ff8066] hover:underline"
              >
                praveenai.tech
              </a>
            </span>
          </div>

        </div>

      </div>
    </footer>
  );
};
