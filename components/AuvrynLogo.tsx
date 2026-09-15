import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface LogoProps {
  size?: number;
  color?: string;
  style?: any;
}

export default function AuvrynLogo({ size = 24, color = "#FF6B4A", style }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={style}
    >
      <Path d="M50 12L15 78H28L50 34L72 78H85L50 12Z" fill={color} />
      <Path d="M15 78C30 74 48 55 80 50C55 51 35 62 20 74" fill={color} />
      <Path d="M50 58Q50 64 44 64Q50 64 50 70Q50 64 56 64Q50 64 50 58Z" fill={color} />
    </Svg>
  );
}
