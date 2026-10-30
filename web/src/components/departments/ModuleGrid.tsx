import React from 'react';

export interface ModuleGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Responsive CSS Grid container for operational module cards.
 * Uses repeat(auto-fill, minmax(280px, 1fr)) with 16px gap to guarantee
 * equal height cards and avoid empty awkward slots.
 */
export function ModuleGrid({ children, className = '' }: ModuleGridProps) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 items-stretch ${className}`}
    >
      {children}
    </div>
  );
}

