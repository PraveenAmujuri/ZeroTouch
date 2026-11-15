import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';

// Lazy-load secondary and workspace pages to optimize bundle loading
const Features = lazy(() => import('./pages/Features').then((m) => ({ default: m.Features })));
const Docs = lazy(() => import('./pages/Docs').then((m) => ({ default: m.Docs })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const Viewer = lazy(() => import('./pages/Viewer').then((m) => ({ default: m.Viewer })));
const GestureTester = lazy(() => import('./pages/GestureTester').then((m) => ({ default: m.GestureTester })));

const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center min-h-[400px]">
    <div className="w-8 h-8 border-4 border-[#27272a] border-t-[#FF8066] rounded-full animate-spin" />
  </div>
);

export const App: React.FC = () => {
  const location = useLocation();
  const isViewer = location.pathname === '/viewer';
  const isTester = location.pathname === '/gestures-test';

  return (
    <div className={`min-h-screen flex flex-col bg-[#f7f7f9] text-zinc-900 ${isViewer ? 'h-screen overflow-hidden' : ''}`}>
      {/* Show marketing navbar on marketing pages */}
      {!isViewer && !isTester && <Navbar />}

      {/* Main Content View */}
      <main className={`flex-1 flex flex-col ${isViewer ? 'h-full overflow-hidden' : ''}`}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/viewer" element={<Viewer />} />
            <Route path="/gestures-test" element={<GestureTester />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default App;
