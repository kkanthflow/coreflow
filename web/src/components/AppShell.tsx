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

  const isInvoiceStudio = location.pathname.startsWith('/invoices/new') || (location.pathname.startsWith('/invoices/') && location.pathname.endsWith('/edit'));

  return (
    <div 
      onPointerMove={handlePointerMove}
      className="flex h-screen w-full bg-bg overflow-hidden text-text selection:bg-accent/25 selection:text-text font-sans antialiased relative"
    >
      {/* Living Atmospheric Background Canvas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Cursor-responsive restrained atmospheric gradient aura (< 4% opacity) */}
        <div 
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: `radial-gradient(750px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 90, 54, 0.03), transparent 75%)`,
          }}
        />

        {currentModule === 'dashboard' && (
          <div className="absolute -top-[10%] left-[25%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#ff5a36]/[0.035] to-transparent blur-[120px]" />
        )}
        {currentModule === 'meetings' && (
          <div className="absolute inset-0 bg-radial from-transparent via-bg/50 to-bg" />
        )}
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-blue-600/[0.02] to-transparent blur-[100px]" />
        
        {/* Subtle grid pattern kept under 5% opacity */}
        <div 
          className="absolute inset-0 opacity-25 dark:opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--line) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <Topbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
        <main className={`flex-1 bg-transparent ${isInvoiceStudio ? 'p-0 overflow-hidden' : 'p-4 sm:p-6 lg:p-7 overflow-auto'}`}>
          <div className={`w-full ${isInvoiceStudio ? 'max-w-none' : 'max-w-[1700px] mx-auto'} h-full flex flex-col`}>
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
