import { useState, useRef, useEffect } from 'react';
import { Check, ChevronRight } from 'lucide-react';

interface CaptchaSliderProps {
  onVerify: () => void;
}

export function CaptchaSlider({ onVerify }: CaptchaSliderProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonWidth = 48;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || isVerified || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const maxDrag = containerRect.width - buttonWidth - 4; // padding
      
      let newX = e.clientX - containerRect.left - (buttonWidth / 2);
      newX = Math.max(0, Math.min(newX, maxDrag));
      
      setDragOffset(newX);
      
      if (newX >= maxDrag * 0.9) {
        setIsVerified(true);
        setDragOffset(maxDrag);
        setIsDragging(false);
        onVerify();
      }
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      
      if (!isVerified) {
        // Snap back
        setDragOffset(0);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Touch support
      document.addEventListener('touchmove', (e) => {
        handleMouseMove(e.touches[0] as any);
      });
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove as any);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isVerified, onVerify]);

  return (
    <div className="p-4 rounded-3xl bg-[#131C33] border border-white/10 mb-5">
      <h3 className="text-base font-bold mb-1 text-center text-white">Security Verification</h3>
      <p className="text-xs mb-4 text-center text-white/60">
        Drag the slider to the right to complete verification
      </p>
      
      <div 
        ref={containerRef}
        className={`h-[54px] rounded-full border p-0.5 flex flex-row items-center relative overflow-hidden transition-colors ${
          isVerified 
            ? 'bg-emerald-500/15 border-emerald-500' 
            : 'bg-white/5 border-white/10'
        }`}
      >
        {/* Background fill */}
        {isVerified && (
          <div 
            className="absolute left-0 top-0 bottom-0 bg-emerald-500/15 rounded-full"
            style={{ width: `${dragOffset + buttonWidth}px` }}
          />
        )}

        {/* Text centered behind slider */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span 
            className={`text-sm font-semibold transition-colors ${
              isVerified ? 'text-emerald-500' : 'text-white/60'
            }`}
          >
            {isVerified ? "Verification Successful" : "Slide to Verify"}
          </span>
        </div>

        {/* Slider Button */}
        <div
          onMouseDown={() => !isVerified && setIsDragging(true)}
          onTouchStart={() => !isVerified && setIsDragging(true)}
          className={`w-[48px] h-[48px] rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-10 transition-colors ${
            isVerified ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
          style={{ transform: `translateX(${dragOffset}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease' }}
        >
          {isVerified ? (
            <Check className="text-white" size={22} strokeWidth={3} />
          ) : (
            <ChevronRight className="text-white" size={22} strokeWidth={3} />
          )}
        </div>
      </div>
    </div>
  );
}
