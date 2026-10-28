import AuvrynLogo from '../AuvrynLogo';

interface FoxLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

/**
 * Lightweight Auvryn-branded signature loading indicator
 * Uses the glowing orange ribbon ring and Auvryn geometric emblem.
 */
export default function AuvrynFoxLoader({
  size = 'md',
  text,
  className = '',
}: FoxLoaderProps) {
  const dimensions = {
    sm: { container: 'w-7 h-7', logo: 14, ring: 'border-[2px]' },
    md: { container: 'w-11 h-11', logo: 20, ring: 'border-[2.5px]' },
    lg: { container: 'w-16 h-16', logo: 30, ring: 'border-[3px]' },
  }[size];

  return (
    <div className={`inline-flex flex-col items-center justify-center gap-3 select-none ${className}`}>
      <div className={`relative ${dimensions.container} flex items-center justify-center`}>
        {/* Soft radial glow */}
        <div className="absolute -inset-2 rounded-full bg-[#FF5A36]/20 blur-md animate-pulse pointer-events-none" />

        {/* Outer glowing orange ribbon ring */}
        <div
          className={`absolute inset-0 rounded-full ${dimensions.ring} border-[#FF5A36]/30 border-t-[#FF5A36] border-r-[#FFA07A] animate-spin`}
          style={{ animationDuration: '0.9s' }}
        />

        {/* Center geometric logo emblem */}
        <div className="relative z-10 flex items-center justify-center">
          <AuvrynLogo size={dimensions.logo} color="#FF5A36" />
        </div>
      </div>

      {text && (
        <span className="text-xs font-mono text-muted tracking-wide animate-pulse">
          {text}
        </span>
      )}
    </div>
  );
}
