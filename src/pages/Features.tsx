import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FooterLogo } from '../components/FooterLogo';

export const Features: React.FC = () => {
  // Active mode: 0 = Slice Nav, 1 = Continuous Zoom, 2 = Windowing, 3 = Panning
  const [activeMode, setActiveMode] = useState<number>(0);
  // Carousel active step index (0, 1, or 2)
  const [activeSlide, setActiveSlide] = useState<number>(0);
  // Hover state to pause auto-slide
  const [isHovered, setIsHovered] = useState<boolean>(false);
  // Progress bar percentage (0 to 100)
  const [storyProgress, setStoryProgress] = useState<number>(0);

  const SLIDE_DURATION_MS = 4000;
  const TICK_INTERVAL_MS = 40;

  // Exact gesture mode configurations utilizing the authentic user SVGs from public/guestures/
  const modes = [
    {
      id: 0,
      title: 'SLICE NAVIGATION',
      counts: '1 + 1',
      desc: '1+1 Matching Index Fingers',
      slides: [
        {
          title: 'ENTER MODE: 1 + 1 POSES',
          sub: 'Show matching 1 index finger on both hands simultaneously to engage Slice Navigation.',
          badge: 'MODE ENGAGEMENT',
          svgUrl: '/guestures/slice-navigation.svg',
        },
        {
          title: 'HAND + FIST: STEP BACKWARD',
          sub: 'Hold left hand open while forming right hand into a fist to step backward 1 slice.',
          badge: 'DIRECTION A (PREV)',
          svgUrl: '/guestures/hand-fist.svg',
        },
        {
          title: 'FIST + HAND: STEP FORWARD',
          sub: 'Form left hand into a fist while holding right hand open to step forward 1 slice.',
          badge: 'DIRECTION B (NEXT)',
          svgUrl: '/guestures/fist-hand.svg',
        },
      ],
    },
    {
      id: 1,
      title: 'CONTINUOUS ZOOM',
      counts: '2 + 2',
      desc: '2+2 Index & Middle Fingers',
      slides: [
        {
          title: 'ENTER MODE: 2 + 2 POSES',
          sub: 'Show matching 2 fingers on both hands to lock Continuous Zoom mode.',
          badge: 'MODE ENGAGEMENT',
          svgUrl: '/guestures/zoom.svg',
        },
        {
          title: 'HAND + FIST: ZOOM IN',
          sub: 'Hold left hand open with right hand closed in a fist to smoothly magnify the image.',
          badge: 'MAGNIFY (IN)',
          svgUrl: '/guestures/hand-fist.svg',
        },
        {
          title: 'FIST + HAND: ZOOM OUT',
          sub: 'Hold left hand in a fist with right hand open to smoothly zoom out.',
          badge: 'DEMAGNIFY (OUT)',
          svgUrl: '/guestures/fist-hand.svg',
        },
      ],
    },
    {
      id: 2,
      title: 'CLINICAL WINDOWING',
      counts: '3 + 3',
      desc: '3+3 Three Fingers',
      slides: [
        {
          title: 'ENTER MODE: 3 + 3 POSES',
          sub: 'Show matching 3 fingers on both hands to select Windowing Preset mode.',
          badge: 'MODE ENGAGEMENT',
          svgUrl: '/guestures/windowing.svg',
        },
        {
          title: 'HAND + FIST: PREVIOUS PRESET',
          sub: 'Hold left hand open and right fist to step back to previous calibrated window preset.',
          badge: 'PREV PRESET',
          svgUrl: '/guestures/hand-fist.svg',
        },
        {
          title: 'FIST + HAND: NEXT PRESET',
          sub: 'Hold left fist and right hand open to step forward to next calibrated window preset.',
          badge: 'NEXT PRESET',
          svgUrl: '/guestures/fist-hand.svg',
        },
      ],
    },
    {
      id: 3,
      title: 'STEP-BASED PANNING',
      counts: '4 + 4',
      desc: '4+4 Four Fingers (Cardinal)',
      slides: [
        {
          title: 'ENTER PANNING: 4 + 4 FINGERS',
          sub: 'Extend 4 fingers on both hands to engage step-based directional Panning mode.',
          badge: 'PANNING ENGAGED',
          svgUrl: '/guestures/panning.svg',
        },
        {
          title: '1+1 LEFT & 2+2 RIGHT',
          sub: 'Show matching 1+1 fingers to step Left (-18px). Show matching 2+2 fingers to step Right (+18px).',
          badge: 'HORIZONTAL AXIS',
          svgUrl: '/guestures/slice-navigation.svg',
        },
        {
          title: '3+3 UP & 4+4 DOWN',
          sub: 'Show matching 3+3 fingers to step Up (-18px). Show matching 4+4 fingers to step Down (+18px).',
          badge: 'VERTICAL AXIS',
          svgUrl: '/guestures/panning.svg',
        },
      ],
    },
  ];

  const currentModeData = modes[activeMode];
  const totalSlides = currentModeData.slides.length;

  // WhatsApp-style Auto-slide story timer
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setStoryProgress((prev) => {
        const next = prev + (TICK_INTERVAL_MS / SLIDE_DURATION_MS) * 100;
        if (next >= 100) {
          setActiveSlide((s) => (s + 1) % totalSlides);
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isHovered, totalSlides, activeMode]);

  const handleSelectSlide = (idx: number) => {
    setActiveSlide(idx);
    setStoryProgress(0);
  };

  const handleSelectMode = (id: number) => {
    setActiveMode(id);
    setActiveSlide(0);
    setStoryProgress(0);
  };

  return (
    <div className="w-full bg-[#f3f4fb] flex flex-col min-h-screen">
      
      {/* =========================================================================
          MAIN PRODUCT PAGE TWO-COLUMN LAYOUT
          Matching https://theloz.co/products/moisturizing-mint-lozenges:
          - Desktop (min-[991px]): 
            * Left column is fixed at left: 0 with 50% width and exact 100vh - 100px height.
            * Right column is in standard document flow with 50% width and left border of 4px solid #27272a.
            * Right column scrolls down naturally into its dedicated footer.
         ========================================================================= */}
      <div className="w-full relative flex-1">
        
        {/* Top-left gap filler: fills the 100px gap with blue when navbar scrolls up out of view */}
        <div
          className="hidden min-[991px]:block fixed top-0 left-0 w-1/2 h-[104px] bg-[#6f7bd4] border-r-4 border-[#27272a] z-10 pointer-events-none"
          aria-hidden="true"
        />

        {/* ================= LEFT COLUMN: CLEAN FIXED GESTURE GALLERY ================= */}
        <div
          className="w-full min-[991px]:w-1/2 min-[991px]:fixed min-[991px]:top-[100px] min-[991px]:left-0 min-[991px]:h-[calc(100vh-100px)] bg-[#6f7bd4] border-b-4 min-[991px]:border-b-0 min-[991px]:border-r-4 border-[#27272a] z-10 flex flex-col justify-between p-6 sm:p-8 lg:p-10 select-none overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          
          {/* Top Clean WhatsApp-style Story Progress Bar */}
          <div className="w-full max-w-xl mx-auto pt-2 pb-6 shrink-0">
            <div className="w-full flex items-center justify-between gap-3">
              {currentModeData.slides.map((_, idx) => {
                let barWidth = '0%';
                if (idx < activeSlide) {
                  barWidth = '100%';
                } else if (idx === activeSlide) {
                  barWidth = `${storyProgress}%`;
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSlide(idx)}
                    className="h-1.5 flex-1 bg-black/25 rounded-full overflow-hidden focus:outline-none cursor-pointer relative"
                    title={`Gesture Step ${idx + 1}`}
                  >
                    <div
                      className="h-full bg-white rounded-full transition-all duration-75"
                      style={{ width: barWidth }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Graphic: Authentic User SVGs on TRANSPARENT Background */}
          <div className="flex flex-col items-center justify-center text-center w-full min-h-0 flex-1 py-2">
            
            {/* Gesture Badge */}
            <span className="bg-[#ff8066] border-2 border-[#27272a] text-[#27272a] px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-4 inline-block shrink-0 shadow-[2px_2px_0px_#27272a]">
              {currentModeData.slides[activeSlide].badge}
            </span>

            {/* SVG Visual: Transparent Background Directly Over Periwinkle Field */}
            <div className="w-full max-w-[320px] sm:max-w-[350px] lg:max-w-[380px] aspect-square flex items-center justify-center p-2 shrink">
              <img
                src={currentModeData.slides[activeSlide].svgUrl}
                alt={currentModeData.slides[activeSlide].title}
                className="w-full h-full object-contain filter drop-shadow-xl select-none"
              />
            </div>

            {/* Clean Caption Card Below Transparent SVG */}
            <div className="bg-white border-2 border-[#27272a] p-3.5 sm:p-4 rounded-[16px] max-w-md w-full mt-3 shadow-[4px_4px_0px_#27272a] text-center shrink-0">
              <h3
                className="text-base sm:text-lg font-black text-[#27272a] mb-1 leading-tight uppercase"
                style={{ fontFamily: '"Pratico Variable", sans-serif' }}
              >
                {currentModeData.slides[activeSlide].title}
              </h3>
              <p className="text-xs sm:text-sm text-[#27272a]/80 font-semibold leading-snug">
                {currentModeData.slides[activeSlide].sub}
              </p>
            </div>
          </div>

          {/* Bottom Slider Nav Arrows */}
          <div className="w-full flex items-center justify-between pt-2 shrink-0 max-w-xl mx-auto">
            <button
              type="button"
              onClick={() => handleSelectSlide(activeSlide > 0 ? activeSlide - 1 : totalSlides - 1)}
              className="w-10 h-10 rounded-full bg-white border-2 border-[#27272a] flex items-center justify-center font-black text-[#27272a] hover:bg-[#ffa694] transition-colors focus:outline-none shadow-[2px_2px_0px_#27272a]"
              title="Previous gesture step"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => handleSelectSlide((activeSlide + 1) % totalSlides)}
              className="w-10 h-10 rounded-full bg-white border-2 border-[#27272a] flex items-center justify-center font-black text-[#27272a] hover:bg-[#ffa694] transition-colors focus:outline-none shadow-[2px_2px_0px_#27272a]"
              title="Next gesture step"
            >
              →
            </button>
          </div>

        </div>


        {/* ================= RIGHT COLUMN: SIMPLE & CLEAN PRODUCT OPTIONS ================= */}
        <div className="w-full min-[991px]:w-1/2 min-[991px]:ml-auto bg-white border-l-0 min-[991px]:border-l-4 border-[#27272a] flex flex-col justify-between">
          
          <div className="p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
            
            {/* Header: Title + Droplet / Count Badge (Exact LOZ style) */}
            <div className="border-b-2 border-[#27272a] pb-6 mb-8 flex items-start justify-between">
              <div>
                <h1
                  className="text-[#27272a] uppercase leading-none m-0"
                  style={{
                    fontFamily: '"Pratico Variable", sans-serif',
                    fontSize: 'clamp(2.4rem, 5vw, 4rem)',
                    fontWeight: 900,
                  }}
                >
                  GESTURE CONTROL MODES
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-[#27272a]/60 mt-3">
                  STERILE TWO-HANDED INTERACTION PIPELINE
                </p>
              </div>

              {/* Loz Flame Badge */}
              <div className="flex flex-col items-center shrink-0 ml-4">
                <span className="text-[11px] font-bold text-[#ff8066] uppercase">MODES</span>
                <div className="w-12 h-14 bg-[#ff8066] border-2 border-[#27272a] flex items-center justify-center font-black text-white text-base shadow-[2px_2px_0px_#27272a]">
                  4
                </div>
              </div>
            </div>


            {/* STEP 1: SELECT OPERATING MODE */}
            <div className="mb-10">
              <span
                className="block text-[#27272a] mb-4 text-left"
                style={{
                  fontFamily: '"Pratico Variable", sans-serif',
                  fontSize: '28px',
                  fontWeight: 600,
                }}
              >
                1. Select Operating Mode
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {modes.map((mode) => {
                  const isSelected = activeMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleSelectMode(mode.id)}
                      className={`p-4 border-2 border-[#27272a] text-left transition-all relative ${
                        isSelected
                          ? 'bg-[#6f7bd4] text-white shadow-[4px_4px_0px_#27272a]'
                          : 'bg-white text-[#27272a] hover:bg-zinc-50'
                      }`}
                    >
                      {/* Checkmark Tag */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-[#ff8066] border border-[#27272a] flex items-center justify-center text-white text-xs font-black">
                          ✓
                        </div>
                      )}
                      <span className="block text-xl font-bold uppercase leading-tight">
                        {mode.title}
                      </span>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-black uppercase px-2 py-0.5 border ${
                          isSelected ? 'bg-white text-[#27272a] border-white' : 'bg-[#ff8066] text-[#27272a] border-[#27272a]'
                        }`}>
                          {mode.counts}
                        </span>
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white/90' : 'text-[#27272a]/70'}`}>
                          {mode.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* STEP 2: DIRECTIONAL HAND ACTIONS */}
            <div className="mb-10">
              <span
                className="block text-[#27272a] mb-4 text-left"
                style={{
                  fontFamily: '"Pratico Variable", sans-serif',
                  fontSize: '28px',
                  fontWeight: 600,
                }}
              >
                2. Directional Hand Actions
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border-2 border-[#27272a] p-4 bg-white flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#6f7bd4] text-white font-black flex items-center justify-center text-sm shrink-0">
                    A
                  </span>
                  <div className="text-left">
                    <span className="block text-sm font-black uppercase text-[#27272a]">
                      HAND + FIST
                    </span>
                    <span className="block text-xs text-[#27272a]/70 font-semibold mt-0.5">
                      {activeMode === 0 ? 'Step Backward 1 Slice' : activeMode === 1 ? 'Continuous Zoom In' : activeMode === 2 ? 'Previous Preset' : 'Left / Up Pan'}
                    </span>
                  </div>
                </div>

                <div className="border-2 border-[#27272a] p-4 bg-white flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#ff8066] text-[#27272a] font-black flex items-center justify-center text-sm shrink-0">
                    B
                  </span>
                  <div className="text-left">
                    <span className="block text-sm font-black uppercase text-[#27272a]">
                      FIST + HAND
                    </span>
                    <span className="block text-xs text-[#27272a]/70 font-semibold mt-0.5">
                      {activeMode === 0 ? 'Step Forward 1 Slice' : activeMode === 1 ? 'Continuous Zoom Out' : activeMode === 2 ? 'Next Preset' : 'Right / Down Pan'}
                    </span>
                  </div>
                </div>
              </div>
            </div>


            {/* STEP 3: STABILIZATION PIPELINE */}
            <div className="mb-8">
              <span
                className="block text-[#27272a] mb-4 text-left"
                style={{
                  fontFamily: '"Pratico Variable", sans-serif',
                  fontSize: '28px',
                  fontWeight: 600,
                }}
              >
                3. Stabilization Pipeline
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border-2 border-[#27272a] bg-[#ff8066]/20 relative">
                  <div className="absolute top-2 right-2 w-5 h-5 bg-[#ff8066] border border-[#27272a] flex items-center justify-center text-white text-xs font-black">
                    ✓
                  </div>
                  <span className="block font-black text-sm uppercase text-[#27272a]">
                    1€ Adaptive Jitter Filtering
                  </span>
                  <span className="block text-xs text-[#27272a]/70 mt-1">
                    Suppresses webcam landmark jitter with adaptive low-pass filtering, maintaining stable hand tracking during gesture recognition.
                  </span>
                </div>

                <div className="p-4 border-2 border-[#27272a] bg-white">
                  <span className="block font-black text-sm uppercase text-[#27272a]">
                    Temporal Anti-Repeat Control
                  </span>
                  <span className="block text-xs text-[#27272a]/70 mt-1">
                    Controlled gesture timing and repeat intervals prevent accidental duplicate triggers and runaway interactions.
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Launch CTA Box Button: Exact full-width right section, default dark zinc-800, hover coral #ff8066, no black border-t bar */}
          <div className="w-full pb-8 sm:pb-12 bg-white">
            <Link
              to="/viewer"
              className="w-full bg-[#27272a] hover:bg-[#ff8066] text-white hover:text-[#27272a] border-y-4 border-[#27272a] px-8 sm:px-12 py-7 sm:py-8 flex items-center justify-between transition-colors duration-300 select-none group cursor-pointer"
            >
              <span
                className="font-extrabold uppercase tracking-tight text-xl sm:text-2xl md:text-3xl lg:text-4xl text-left"
                style={{ fontFamily: '"Pratico Variable", sans-serif', lineHeight: '110%' }}
              >
                TEST GESTURES IN LIVE DICOM VIEWER
              </span>
              <span className="flex items-center gap-3 shrink-0 ml-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 448 512"
                  className="w-6 h-6 fill-white group-hover:fill-[#27272a] transition-all duration-300 group-hover:translate-x-2 shrink-0"
                >
                  <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
                </svg>
              </span>
            </Link>
          </div>

          {/* =========================================================================
              CLEAN & SIMPLE PRODUCT PAGE FOOTER
              (Exact layout matching page_content_product/index.html with full width inside right flow)
             ========================================================================= */}
          <footer className="footer bg-[#18181b] px-8 sm:px-12 py-16 text-white border-t-4 border-[#27272a] w-full">
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              
              <div className="w-full flex flex-col items-center mb-8">
                <h2
                  className="text-white text-2xl sm:text-3xl font-normal mb-6 text-center"
                  style={{ fontFamily: '"Pratico Variable", sans-serif', lineHeight: '115%' }}
                >
                  Explore my work, <strong className="text-[#74d2c2] font-normal">projects</strong><br className="hidden sm:inline" /> and experiments!
                </h2>

                <a
                  href="https://praveen-amujuri-portfolio.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-full max-w-md relative flex items-stretch border-2 border-black bg-white shadow-none transition-all duration-200 hover:shadow-[4px_4px_0px_#74d2c2] select-none cursor-pointer"
                  aria-label="View My Portfolio"
                >
                  <div
                    className="w-full bg-white text-black px-5 py-3 text-sm font-bold uppercase tracking-wider flex items-center justify-start group-hover:text-[#6f7bd4] transition-colors"
                    style={{ fontFamily: '"Pratico Variable", sans-serif' }}
                  >
                    VIEW MY PORTFOLIO
                  </div>
                  <div
                    className="bg-[#ff8066] group-hover:bg-[#6f7bd4] text-black group-hover:text-white px-5 flex items-center justify-center border-l-2 border-black transition-colors duration-200 shrink-0"
                  >
                    <svg width="24" height="20" viewBox="0 0 29 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-4 transition-transform duration-200 group-hover:translate-x-1">
                      <path d="M28 13.625L17 24.125C16.375 24.6875 15.4375 24.6875 14.875 24.0625C14.3125 23.4375 14.3125 22.5 14.9375 21.9375L23.25 14H2C1.125 14 0.5 13.375 0.5 12.5C0.5 11.6875 1.125 11 2 11H23.25L14.9375 3.125C14.3125 2.5625 14.3125 1.5625 14.875 1C15.4375 0.375 16.4375 0.375 17 0.9375L28 11.4375C28.3125 11.75 28.5 12.125 28.5 12.5C28.5 12.9375 28.3125 13.3125 28 13.625Z" fill="currentColor"></path>
                    </svg>
                  </div>
                </a>
              </div>

              {/* Interactive Animated SVG 0Touch Footer Logo with generous vertical padding */}
              <div className="w-full flex justify-center my-12 md:my-16 lg:my-20 select-none">
                <FooterLogo className="max-w-[280px] sm:max-w-[420px] md:max-w-[560px]" />
              </div>

              {/* Navigation links */}
              <div className="flex flex-wrap justify-center gap-6 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <Link to="/" className="hover:text-white">Home</Link>
                <Link to="/features" className="hover:text-white">Product</Link>
                <Link to="/docs" className="hover:text-white">FAQ</Link>
                <Link to="/contact" className="hover:text-white">Blog</Link>
                <Link to="/viewer" className="hover:text-[#74d2c2]">Cart</Link>
              </div>

              <p className="text-[11px] text-zinc-500 mt-6">
                © 2026 0Touch. All rights reserved.{' '}
                <a
                  href="https://praveen-amujuri-portfolio.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#74d2c2] hover:underline"
                >
                  praveenai.tech
                </a>
              </p>
            </div>
          </footer>

        </div>

      </div>

    </div>
  );
};
