import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';
import { getModuleType, MODULE_PAGE_VARIANTS } from '../lib/motionSystem';

export default function AppShell() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const location = useLocation();
  const currentModule = getModuleType(location.pathname);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    // Throttled coordinate normalized to window percentage
    const x = Math.round((e.clientX / window.innerWidth) * 100);
    const y = Math.round((e.clientY / window.innerHeight) * 100);
    setMousePos({ x, y });
  };

  return (
    <div 
      onPointerMove={handlePointerMove}
      className="flex h-screen w-full bg-[#08090D] overflow-hidden text-white selection:bg-[#FF6B4A]/30 selection:text-white font-sans antialiased relative"
    >
      {/* Living CoreFlow Atmospheric Background Canvas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Cursor-responsive living CoreFlow atmospheric gradient aura */}
        <div 
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: `radial-gradient(750px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 107, 74, 0.09), transparent 75%)`,
          }}
        />

        {currentModule === 'dashboard' && (
          <div className="absolute -top-[10%] left-[25%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#FF6B4A]/[0.10] to-transparent blur-[120px] animate-pulse-glow" />
        )}
        {currentModule === 'meetings' && (
          <div className="absolute inset-0 bg-radial from-transparent via-[#08090D]/50 to-[#040507]" />
        )}
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-blue-600/[0.06] to-transparent blur-[100px]" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <Topbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
        <main className="flex-1 overflow-auto bg-transparent p-4 sm:p-6 lg:p-7">
          <div className="w-full max-w-[1700px] mx-auto h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={MODULE_PAGE_VARIANTS[currentModule]}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full flex flex-col flex-1"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
    </div>
  );
}
