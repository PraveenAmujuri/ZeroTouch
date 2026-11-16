import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FooterLogo } from '../components/FooterLogo';
import { Logo } from '../components/Logo';

// Canvas-based video renderer to prevent Opera / Chrome from injecting floating media overlays (pop-out, video-skip)
const HeroVideoCanvas: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isMounted = true;

    const render = () => {
      if (!isMounted) return;
      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      animId = requestAnimationFrame(render);
    };

    video.play().catch(() => {});
    animId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          clipPath: 'inset(50%)',
        }}
      >
        <source src="/hero_video.webm" type="video/webm" />
        <source src="/hero_video.mp4" type="video/mp4" />
      </video>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none select-none"
        aria-hidden="true"
      />
    </>
  );
};

export const Home: React.FC = () => {
  const [selectedModality, setSelectedModality] = useState<'echo' | 'angio' | 'mri'>('echo');
  const [streamMode, setStreamMode] = useState<'realtime' | 'buffered'>('realtime');

  return (
    <main id="MainContent" className="content-for-layout focus-none w-full bg-[#f3f4fb]" role="main" tabIndex={-1}>
      
      {/* 1. HERO BANNER SECTION (Exact template--17036177244384__image_banner layout from theloz.co)
          Desktop (md+): flex-row, h-[34.4vw] min-h-[460px] max-h-[660px], 40%/60% split.
          Mobile (<md): flex-col, auto height, perfectly aligned text cycler with 64px line-height, elegant buttons. */}
      <section id="shopify-section-template--17036177244384__image_banner" className="shopify-section section w-full">
        <div
          id="Banner-template--17036177244384__image_banner"
          className="banner flex flex-col md:flex-row w-full md:h-[34.4vw] md:min-h-[460px] md:max-h-[660px]"
        >
          {/* Content Column: Exactly matching original banner structure */}
          <div className="banner__content bg-[#6f7bd4] w-full md:w-[40%] flex items-center justify-center p-0 md:h-full shrink-0">
            <div className="banner__box px-5 sm:px-8 pt-4 pb-6 sm:py-8 md:py-10 content-container tw-bg-transparent flex flex-col justify-around w-full md:h-full">
              <div className="flex flex-col justify-center relative w-full max-w-[480px] mx-auto text-center -mt-2 sm:mt-0">
                
                {/* Line 1: Animated / morphing cycling text (Heavy Bold) */}
                <div className="banner__heading text-center overflow-hidden">
                  <div className="inline-block text-center overflow-hidden h-[75px] sm:h-[90px] md:h-[105px] w-full">
                    <ul className="cycle-slider list-none m-0 p-0 text-center w-full overflow-hidden">
                      {['NAVIGATE', 'EXPLORE', 'CONTROL', 'INTERACT'].map((word) => (
                        <li key={word} className="h-[75px] sm:h-[90px] md:h-[105px] flex items-center justify-center overflow-hidden">
                          <h1
                            className="text-[#262929] leading-tight m-0 uppercase select-none whitespace-nowrap"
                            style={{
                              fontFamily: '"Pratico Variable", sans-serif',
                              fontSize: 'clamp(54px, 5.5vw, 88px)',
                              fontWeight: 900,
                            }}
                          >
                            {word}
                          </h1>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Line 2: Permanent static text (Light / Normal Weight) */}
                <div className="banner__text text-center rte mt-2 sm:mt-1 subtitle">
                  <h2
                    className="text-[#262929] leading-none whitespace-nowrap"
                    style={{
                      fontFamily: '"Pratico Variable", sans-serif',
                      fontSize: 'clamp(52px, 5.2vw, 84px)',
                      fontWeight: 400,
                    }}
                  >
                    DICOM With
                  </h2>
                </div>

                {/* Line 3: Permanent static text / Solid Logo */}
                <div className="banner__text text-center flex items-center justify-center mt-1 sm:mt-2">
                  <Logo className="h-[44px] sm:h-[54px] md:h-[64px] lg:h-[72px] w-auto text-[#262929]" />
                </div>

                {/* Description below headline */}
                <p className="text-xs sm:text-sm md:text-base text-[#262929]/90 font-medium leading-relaxed max-w-[380px] mx-auto mt-4 mb-3">
                  Interact with DICOM images through intuitive hand gestures.
                </p>

                {/* Banner Buttons: Stacked on mobile (<md), Side-by-Side on desktop (md+) */}
                <div className="banner__buttons mt-2 mb-2 flex flex-col md:flex-row items-center justify-center gap-3 w-full max-w-sm md:max-w-none mx-auto px-2">
                  <Link
                    to="/viewer"
                    className="loz-button loz-button-primary w-full md:flex-1 text-center whitespace-nowrap text-xs md:text-sm"
                  >
                    LAUNCH VIEWER
                  </Link>
                  <Link
                    to="/features"
                    className="loz-button loz-button-secondary w-full md:flex-1 text-center whitespace-nowrap text-xs md:text-sm"
                  >
                    EXPLORE PRODUCT
                    <span className="relative -top-[0.15rem]">
                      <svg xmlns="http://www.w3.org/2000/svg" height="15" width="10" viewBox="0 0 320 512">
                        <path d="M317.3 256l-22.6 22.6-192 192L80 493.3 34.7 448l22.6-22.6L226.7 256 57.4 86.6 34.7 64 80 18.7l22.6 22.6 192 192L317.3 256z" />
                      </svg>
                    </span>
                  </Link>
                </div>

              </div>
            </div>
          </div>

          {/* Media Column: 100% on mobile with border-t-4, 60% with border-l-4 on md+ */}
          <div className="relative overflow-hidden banner__media border-t-4 md:border-t-0 md:border-l-4 border-[#27272a] media w-full md:w-[60%] flex-1 h-[280px] sm:h-[380px] md:h-full min-h-[260px] md:min-h-[380px] flex items-center justify-center bg-[#6f7bd4]">
            <HeroVideoCanvas />
          </div>

        </div>
      </section>

      {/* 2. CENTERED TEXT BADGE SECTION */}
      <div id="shopify-section-template--17036177244384__e7154d28-df5a-4761-ae6b-32113327176f" className="shopify-section bg-white border-b-4 border-[#27272a]">
        <div className="centered-text-badge-section relative mx-auto px-5 sm:px-8 md:px-12 3xl:px-20 py-14 sm:py-20 md:py-24 flex flex-col gap-y-6 sm:gap-y-8 items-center text-center">
          <div className="flex flex-col 3xl:flex-row justify-center items-center gap-4 sm:gap-6">
            <h2
              className="mb-4 sm:mb-6 3xl:mb-0 text-center 3xl:text-left max-w-2xl lg:max-w-3xl 3xl:max-w-full"
              style={{
                color: '#27272a',
                fontFamily: '"Pratico Variable", sans-serif',
                fontSize: 'clamp(32px, 8vw, 72px)',
                fontWeight: 900,
                letterSpacing: '0.02em',
                lineHeight: '1.05',
              }}
            >
              Touchless medical imaging with
            </h2>
            
            <Link
              to="/viewer"
              className="bg-[#ff8066] border-4 border-[#27272a] px-8 sm:px-14 py-4 sm:py-6 -rotate-[3deg] hover:rotate-0 transition-transform duration-200 inline-flex items-center justify-center shadow-[4px_4px_0px_#27272a]"
              aria-label="Launch 0Touch"
            >
              <div className="rotate-[3deg] hover:rotate-0 transition-transform duration-200 flex items-center justify-center">
                <Logo className="h-8 sm:h-11 w-auto text-[#262929]" />
              </div>
            </Link>
          </div>

          <div>
            <h4
              style={{
                fontFamily: '"Pratico Variable", sans-serif',
                fontSize: 'clamp(24px, 5vw, 48px)',
                fontWeight: 400,
                color: '#27272a',
                lineHeight: '1.1',
              }}
              className="text-center"
            >
              Touchless Medical Imaging
            </h4>
          </div>
        </div>
      </div>

      {/* 3. FEATURED PRODUCT / WORKSPACE SPECIFICATION SECTION */}
      <section id="shopify-section-template--17036177244384__featured_product_w8dbKp" className="shopify-section section section-featured-product w-full border-b-4 border-[#27272a] bg-white py-12 sm:py-16 md:py-24 px-5 sm:px-8 md:px-12 lg:px-24">
        <div className="page-width !pt-0 max-w-7xl mx-auto">
          <div className="featured-product product product--small grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
            
            {/* Left: Product media container */}
            <div className="grid__item product__media-wrapper flex justify-center items-center w-full">
              <div className="product-media-container global-media-settings bg-transparent w-full max-w-lg aspect-square border-4 border-[#27272a] p-4 sm:p-8 flex flex-col justify-center items-center relative bg-[#f3f4fb] shadow-[6px_6px_0px_#27272a]">
                <img
                  src={
                    selectedModality === 'echo'
                      ? '/sample_echo.png'
                      : selectedModality === 'angio'
                      ? '/sample_angio.png'
                      : '/sample_mrbrain.png'
                  }
                  alt="0Touch Medical Scan"
                  className="max-h-[220px] sm:max-h-[300px] md:max-h-[340px] w-auto object-contain drop-shadow-xl"
                />
                <div className="absolute top-3 left-3 bg-white border-2 border-[#27272a] px-2.5 py-1 font-bold text-[10px] sm:text-xs uppercase text-[#27272a]">
                  DIAGNOSTIC SAMPLE: 0003.DCM
                </div>
              </div>
            </div>

            {/* Right: Product Info & Radios */}
            <div className="product__info-wrapper mb-6 md:mb-0 grid__item w-full">
              <div className="product__info-container flex flex-col text-left">
                <p className="product__text inline-richtext caption-with-letter-spacing text-xs font-bold uppercase tracking-widest text-[#27272a] mb-2 flex items-center gap-1.5">
                  <Logo className="h-3.5 w-auto text-[#27272a]" />
                  <span>Medical Scan</span>
                </p>

                <div className="pb-3 flex flex-row justify-between items-center">
                  <h2
                    className="product__title !mb-0 text-[#27272a] leading-none flex items-center gap-3 flex-wrap"
                    style={{
                      fontFamily: '"Pratico Variable", sans-serif',
                      fontSize: 'clamp(28px, 6vw, 44px)',
                      fontWeight: 600,
                    }}
                  >
                    <Logo className="h-7 sm:h-9 md:h-10 w-auto text-[#27272a]" />
                    <span>Gesture Engine</span>
                  </h2>
                </div>

                {/* Step 1: Modality Selection */}
                <fieldset className="product-form__input variant-input my-5 sm:my-6">
                  <legend
                    className="form__label delivery-label text-[#27272a] mb-3 sm:mb-4"
                    style={{
                      fontFamily: '"Pratico Variable", sans-serif',
                      fontSize: 'clamp(20px, 4vw, 32px)',
                      fontWeight: 600,
                    }}
                  >
                    1. Select Modality
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'echo', name: 'Ultrasound', save: '11ct Slices (0020.DCM)' },
                      { id: 'angio', name: 'Angiography', save: '17ct Cine (0003.DCM)' },
                      { id: 'mri', name: 'Brain MRI', save: '3D Axial Series' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedModality(item.id as any)}
                        className={`p-3.5 sm:p-4 border-2 border-[#27272a] text-left transition-all ${
                          selectedModality === item.id
                            ? 'bg-[#6f7bd4] text-white shadow-[4px_4px_0px_#27272a]'
                            : 'bg-transparent text-[#27272a] hover:bg-zinc-100 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <span className="qty_btn_value block text-base sm:text-lg font-bold uppercase leading-none">
                          {item.name}
                        </span>
                        <span className={`qty_btn_saveText mt-1.5 block text-xs font-semibold ${selectedModality === item.id ? 'text-white' : 'text-[#27272a]'}`}>
                          {item.save}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Step 2: Tracking Configuration */}
                <fieldset className="product-form__input variant-input mb-6 sm:mb-8">
                  <legend
                    className="form__label delivery-label text-[#27272a] mb-3 sm:mb-4"
                    style={{
                      fontFamily: '"Pratico Variable", sans-serif',
                      fontSize: 'clamp(20px, 4vw, 32px)',
                      fontWeight: 600,
                    }}
                  >
                    2. Tracking Pipeline
                  </legend>

                  <div className="flex flex-col gap-3">
                    <label
                      onClick={() => setStreamMode('realtime')}
                      className={`p-3.5 sm:p-4 border-2 border-[#27272a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 cursor-pointer transition-all ${
                        streamMode === 'realtime' ? 'bg-[#ff8066]/20 shadow-[3px_3px_0px_#27272a]' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="streamMode"
                          checked={streamMode === 'realtime'}
                          onChange={() => setStreamMode('realtime')}
                          className="w-4 h-4 text-[#ff8066] shrink-0"
                        />
                        <div>
                          <span className="font-bold text-xs sm:text-sm uppercase block text-[#27272a]">
                            Real-Time Hand Tracking
                          </span>
                          <span className="text-[11px] sm:text-xs text-[#27272a]/70 font-medium">
                            Detects and tracks both hands through the webcam.
                          </span>
                        </div>
                      </div>
                      <span className="font-extrabold text-[10px] uppercase bg-[#ff8066] text-[#27272a] px-2 py-0.5 border border-[#27272a] shrink-0 self-start sm:self-center">
                        RECOMMENDED
                      </span>
                    </label>

                    <label
                      onClick={() => setStreamMode('buffered')}
                      className={`p-3.5 sm:p-4 border-2 border-[#27272a] flex items-center justify-between cursor-pointer transition-all ${
                        streamMode === 'buffered' ? 'bg-[#ff8066]/20 shadow-[3px_3px_0px_#27272a]' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="streamMode"
                          checked={streamMode === 'buffered'}
                          onChange={() => setStreamMode('buffered')}
                          className="w-4 h-4 text-[#ff8066] shrink-0"
                        />
                        <div>
                          <span className="font-bold text-xs sm:text-sm uppercase block text-[#27272a]">
                            Step-Based Directional Panning
                          </span>
                          <span className="text-[11px] sm:text-xs text-[#27272a]/70 font-medium">
                            Navigate images using matching finger-count gestures.
                          </span>
                        </div>
                      </div>
                    </label>

                    <div className="p-3.5 sm:p-4 border-2 border-[#27272a] flex items-center justify-between bg-transparent">
                      <div>
                        <span className="font-bold text-xs sm:text-sm uppercase block text-[#27272a]">
                          Gesture Recognition &amp; Smoothing
                        </span>
                        <span className="text-[11px] sm:text-xs text-[#27272a]/70 font-medium">
                          Stable two-hand gesture detection with 1€ adaptive low-pass filtering and temporal anti-repeat confirmation.
                        </span>
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* Launch CTA Button */}
                <Link
                  to="/viewer"
                  className="loz-button loz-button-primary w-full text-center text-xs sm:text-sm py-3.5"
                >
                  LAUNCH INTERACTIVE WORKSPACE
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. MARQUEE TEXT SECTION */}
      <div id="shopify-section-template--17036177244384__c483e1a6-7b93-4203-a2e9-ec33e1aa70e8" className="shopify-section">
        <div className="marquee-text-section marquee-container bg-[#27272a] pt-10 sm:pt-16 pb-10 sm:pb-16 border-b-4 border-[#27272a]">
          <div className="marquee">
            <div className="marquee-content select-none flex items-center whitespace-nowrap">
              <span className="inline-flex items-center gap-3 sm:gap-4">
                <Logo className="h-[0.8em] w-auto inline-block text-[#6f7bd4]" />
                <span>Touchless Medical Imaging. Intuitive Hand Gestures. DICOM Studies Navigation. Real-Time Hand Tracking.&nbsp;</span>
              </span>
              <span className="inline-flex items-center gap-3 sm:gap-4">
                <Logo className="h-[0.8em] w-auto inline-block text-[#6f7bd4]" />
                <span>Touchless Medical Imaging. Intuitive Hand Gestures. DICOM Studies Navigation. Real-Time Hand Tracking.&nbsp;</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. IMAGE WITH TEXT SECTION 1 (Product Introduction Section) */}
      <div id="shopify-section-template--17036177244384__fd2a9372-daa9-43ac-96ff-1dff8a1f596e" className="shopify-section section">
        <div className="relative px-5 sm:px-8 md:px-12 py-16 sm:py-24 lg:px-44 border-t-4 border-b-4 border-[#27272a] bg-[#99a1e1]">
          <div className="page-width !px-0 !max-w-7xl mx-auto">
            <div className="image-with-text image-with-text--no-overlap isolate collapse-corners">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
                
                {/* Media Item */}
                <div className="image-with-text__media-item flex justify-center">
                  <div className="image-with-text__media w-[65%] sm:w-[55%] md:w-[65%] max-w-[280px] sm:max-w-[340px] mx-auto">
                    <img
                      src="/benefit_one.webp"
                      alt="0Touch Medical Imaging"
                      className="w-full h-auto object-contain drop-shadow-md"
                    />
                  </div>
                </div>

                {/* Text Item */}
                <div className="image-with-text__text-item flex justify-end">
                  <div className="image-with-text__content max-w-[660px] text-left">
                    <h2
                      className="image-with-text__heading inline-richtext !my-0 text-[#f3f4fb]"
                      style={{
                        fontFamily: '"Pratico Variable", sans-serif',
                        fontSize: 'clamp(28px, 6vw, 48px)',
                        fontWeight: 600,
                        lineHeight: '1.2',
                      }}
                    >
                      Touchless interaction. A different way to navigate medical imaging.
                    </h2>
                    <div
                      className="image-with-text__text rte text-body !my-5 text-[#f3f4fb]/85"
                      style={{
                        fontSize: 'clamp(16px, 3vw, 24px)',
                        lineHeight: '125%',
                      }}
                    >
                      <p>
                        Navigate DICOM studies through intuitive hand movements, bringing a new way to interact with medical images beyond traditional keyboard and mouse controls.
                      </p>
                    </div>
                    <Link
                      to="/features"
                      className="loz-button loz-button-primary inline-flex text-xs sm:text-base"
                    >
                      EXPLORE PRODUCT
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. IMAGE WITH TEXT SECTION 2 */}
      <div id="shopify-section-template--17036177244384__f97598a8-41cb-46c7-a951-778d3753b27c" className="shopify-section section">
        <div className="relative px-5 sm:px-8 md:px-12 py-16 sm:py-24 lg:px-44 border-b-4 border-[#27272a] bg-[#ffeeeb]">
          <div className="page-width !px-0 !max-w-7xl mx-auto">
            <div className="image-with-text image-with-text--no-overlap isolate collapse-corners">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
                
                {/* Text Item (order-2 md:order-1) */}
                <div className="image-with-text__text-item flex justify-start order-2 md:order-1">
                  <div className="image-with-text__content max-w-[660px] text-left">
                    <h2
                      className="image-with-text__heading inline-richtext !my-0 text-[#6f7bd4]"
                      style={{
                        fontFamily: '"Pratico Variable", sans-serif',
                        fontSize: 'clamp(28px, 6vw, 48px)',
                        fontWeight: 600,
                        lineHeight: '1.2',
                      }}
                    >
                      <Logo className="h-7 sm:h-9 md:h-10 w-auto text-[#6f7bd4] inline-block align-middle mr-2" />
                      Gesture Engine
                    </h2>
                    <div
                      className="image-with-text__text rte text-body !my-5 text-[#6f7bd4]/85"
                      style={{
                        fontSize: 'clamp(16px, 3vw, 24px)',
                        lineHeight: '125%',
                      }}
                    >
                      <p>
                        Engineered for precise two-handed spatial gestures, providing touchless interaction with medical imaging workspaces.
                      </p>
                    </div>
                    <Link
                      to="/features"
                      className="loz-button loz-button-secondary inline-flex text-xs sm:text-base !text-[#6f7bd4] !border-[#6f7bd4] hover:!bg-[#6f7bd4] hover:!text-white group/gestures"
                    >
                      EXPLORE GESTURES
                      <span className="relative -top-[0.15rem]">
                        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="10" viewBox="0 0 320 512" className="!fill-[#6f7bd4] group-hover/gestures:!fill-white transition-colors">
                          <path d="M317.3 256l-22.6 22.6-192 192L80 493.3 34.7 448l22.6-22.6L226.7 256 57.4 86.6 34.7 64 80 18.7l22.6 22.6 192 192L317.3 256z" />
                        </svg>
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Media Item (order-1 md:order-2) */}
                <div className="image-with-text__media-item flex justify-center order-1 md:order-2">
                  <div className="image-with-text__media w-[65%] sm:w-[55%] md:w-[65%] max-w-[280px] sm:max-w-[340px] mx-auto">
                    <img
                      src="/benefit_two.webp"
                      alt="0Touch Gesture Engine"
                      className="w-full h-auto object-contain drop-shadow-md"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. FOOTER / NEWSLETTER SECTION */}
      <footer className="footer bg-[#18181b] px-5 sm:px-8 pt-12 md:pt-16 pb-8 md:pb-10 text-white w-full">
        <div className="footer__content-top page-width !p-0 max-w-6xl mx-auto flex flex-col items-center text-center">
          <div className="newsletter--wrapper flex flex-col justify-center items-center w-full">
            <div className="footer-block__newsletter flex flex-col justify-center items-center mx-auto max-w-xl w-full">
              <h2
                className="footer-block__heading inline-richtext text-white mb-6 md:mb-8 text-center"
                style={{
                  fontFamily: '"Pratico Variable", sans-serif',
                  fontSize: 'clamp(24px, 5vw, 36px)',
                  fontWeight: 400,
                  lineHeight: '120%',
                }}
              >
                Explore my work, <strong className="text-[#74d2c2] font-normal">projects</strong><br className="hidden sm:inline" /> and experiments!
              </h2>

              <a
                href="https://praveen-amujuri-portfolio.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full max-w-[560px] relative flex items-stretch border-2 border-black bg-white shadow-none transition-all duration-200 hover:shadow-[4px_4px_0px_#74d2c2] select-none cursor-pointer"
                aria-label="View My Portfolio"
              >
                <div
                  className="w-full bg-white text-black px-4 sm:px-6 py-3.5 md:py-4 text-xs sm:text-base md:text-lg font-bold uppercase tracking-wider flex items-center justify-start group-hover:text-[#6f7bd4] transition-colors"
                  style={{ fontFamily: '"Pratico Variable", sans-serif' }}
                >
                  VIEW MY PORTFOLIO
                </div>
                <div
                  className="bg-[#ff8066] group-hover:bg-[#6f7bd4] text-black group-hover:text-white px-5 sm:px-7 flex items-center justify-center border-l-2 border-black transition-colors duration-200 shrink-0"
                >
                  <svg width="24" height="20" viewBox="0 0 29 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-4 sm:w-6 sm:h-5 transition-transform duration-200 group-hover:translate-x-1">
                    <path d="M28 13.625L17 24.125C16.375 24.6875 15.4375 24.6875 14.875 24.0625C14.3125 23.4375 14.3125 22.5 14.9375 21.9375L23.25 14H2C1.125 14 0.5 13.375 0.5 12.5C0.5 11.6875 1.125 11 2 11H23.25L14.9375 3.125C14.3125 2.5625 14.3125 1.5625 14.875 1C15.4375 0.375 16.4375 0.375 17 0.9375L28 11.4375C28.3125 11.75 28.5 12.125 28.5 12.5C28.5 12.9375 28.3125 13.3125 28 13.625Z" fill="currentColor"></path>
                  </svg>
                </div>
              </a>
            </div>

            {/* Interactive Animated SVG 0Touch Footer Logo (matching The Loz) */}
            <div className="w-full flex justify-center my-10 sm:my-14 md:my-20 lg:my-24 select-none px-4">
              <FooterLogo className="max-w-[240px] sm:max-w-[440px] md:max-w-[720px] lg:max-w-[850px]" />
            </div>

            {/* Footer Navigation Links */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-400 mt-2">
              <Link to="/" className="hover:text-white">Home</Link>
              <Link to="/features" className="hover:text-white">Product</Link>
              <Link to="/docs" className="hover:text-white">Docs</Link>
              <Link to="/contact" className="hover:text-white">Contact</Link>
              <Link to="/viewer" className="hover:text-[#74d2c2]">Launch</Link>
            </div>

            <p className="text-xs text-zinc-500 mt-4 sm:mt-2">
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
        </div>
      </footer>

    </main>
  );
};
