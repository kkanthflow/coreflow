import { motion } from 'motion/react';

interface AuvrynHeroArtworkProps {
  className?: string;
}

/**
 * Main Landing-Page Hero Artwork
 * Uses the exact asset "Auvryn_ Plans to Progress Dashboard(1).png".
 * Preserves the complete original composition: thinking fox, laptop,
 * analytics cards, plant, books, warm background, and decorative details.
 */
export default function AuvrynHeroArtwork({ className = '' }: AuvrynHeroArtworkProps) {
  return (
    <div className={`relative w-full flex items-center justify-center lg:justify-end select-none ${className}`}>
      {/* Soft radiant ambient glow */}
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#FF5A36]/12 via-[#FFA07A]/10 to-transparent blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="hero-main-artwork-wrapper relative w-full aspect-[1.82/1] overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(255,90,54,0.18)] border border-orange-200/60 dark:border-white/10 bg-[#FAF7F2] dark:bg-[#12121a]"
      >
        <img
          src="/Auvryn_ Plans to Progress Dashboard(1).png"
          alt="Auvryn Plans to Progress Dashboard Hero Artwork — Thinking fox with laptop, analytics cards, plant, and books"
          className="absolute right-0 h-[116%] w-auto max-w-none select-none pointer-events-none block"
          style={{ top: '-12%' }}
          loading="eager"
          fetchPriority="high"
        />
      </motion.div>
    </div>
  );
}
