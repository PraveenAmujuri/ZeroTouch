import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Features } from './pages/Features';
import { Docs } from './pages/Docs';
import { Contact } from './pages/Contact';
import { Viewer } from './pages/Viewer';

export const App: React.FC = () => {
  const location = useLocation();
  const isViewer = location.pathname === '/viewer';

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f9] text-zinc-900">
      {/* Show marketing navbar on marketing pages */}
      {!isViewer && <Navbar />}

      {/* Main Content View */}
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/viewer" element={<Viewer />} />
        </Routes>
      </main>

      {/* Global footer removed per request */}
    </div>
  );
};

export default App;
