import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  color?: string;
}

export default function AuvrynLogo({ size = 24, className = "", color = "#FF6B4A" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M50 12L15 78H28L50 34L72 78H85L50 12Z" fill={color} />
      <path d="M15 78C30 74 48 55 80 50C55 51 35 62 20 74" fill={color} />
      <path d="M50 58Q50 64 44 64Q50 64 50 70Q50 64 56 64Q50 64 50 58Z" fill={color} />
    </svg>
  );
}
