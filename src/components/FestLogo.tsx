import React from 'react';
import { Sparkles, Plus } from 'lucide-react';

interface FestLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark'; // 'light' for dark backgrounds (white text), 'dark' for light backgrounds (dark text)
  showSubtitle?: boolean;
  subtitleText?: string;
  badgeText?: string;
  showBadge?: boolean;
  animated?: boolean;
  className?: string;
}

export const FestLogo: React.FC<FestLogoProps> = ({
  size = 'md',
  variant = 'dark',
  showSubtitle = true,
  subtitleText,
  badgeText = "Fest '26",
  showBadge = true,
  animated = true,
  className = '',
}) => {
  // Dimension definitions
  const dimensions = {
    sm: {
      box: 'w-8 h-8 rounded-xl',
      svgSize: 18,
      textSize: 'text-base',
      plusSize: 'text-base',
      badgeSize: 'text-[9px] px-1.5 py-0.2',
      sparkleSize: 'w-2.5 h-2.5',
      subText: 'text-[10px]',
    },
    md: {
      box: 'w-10 h-10 rounded-2xl',
      svgSize: 22,
      textSize: 'text-xl',
      plusSize: 'text-xl',
      badgeSize: 'text-[10px] px-2 py-0.5',
      sparkleSize: 'w-3 h-3',
      subText: 'text-[11px]',
    },
    lg: {
      box: 'w-12 h-12 rounded-2xl',
      svgSize: 26,
      textSize: 'text-2xl',
      plusSize: 'text-2xl',
      badgeSize: 'text-xs px-2.5 py-0.5',
      sparkleSize: 'w-3.5 h-3.5',
      subText: 'text-xs',
    },
    xl: {
      box: 'w-16 h-16 rounded-3xl',
      svgSize: 34,
      textSize: 'text-3xl sm:text-4xl',
      plusSize: 'text-3xl sm:text-4xl',
      badgeSize: 'text-xs px-3 py-1',
      sparkleSize: 'w-4 h-4',
      subText: 'text-sm',
    },
  }[size];

  const isLightMode = variant === 'light'; // Light text on dark bg

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Crisp, Modern Emblem / Icon */}
      <div className="relative group shrink-0">
        {/* Logo Container Box - Crisp, premium gradient with subtle, tight shadow */}
        <div
          className={`relative ${dimensions.box} bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 overflow-hidden border border-indigo-400/30 transition-transform duration-200 group-hover:scale-105`}
        >
          {/* Custom SVG Stylized 'F+' Emblem */}
          <svg
            width={dimensions.svgSize}
            height={dimensions.svgSize}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-transform duration-200"
          >
            {/* Stylized 'F' */}
            <path
              d="M7 6C7 4.89543 7.89543 4 9 4H20C21.1046 4 22 4.89543 22 6C22 7.10457 21.1046 8 20 8H12V13H18.5C19.6046 13 20.5 13.8954 20.5 15C20.5 16.1046 19.6046 17 18.5 17H12V26C12 27.1046 11.1046 28 10 28C8.89543 28 8 27.1046 8 26V8C7.44772 8 7 7.55228 7 7V6Z"
              fill="white"
            />
            {/* Crisp Accent Plus Sign (+) */}
            <path
              d="M25 18C25 17.1716 25.6716 16.5 26.5 16.5C27.3284 16.5 28 17.1716 28 18V21H31C31.8284 21 32.5 21.6716 32.5 22.5C32.5 23.3284 31.8284 24 31 24H28V27C28 27.8284 27.3284 28.5 26.5 28.5C25.6716 28.5 25 27.8284 25 27V24H22C21.1716 24 20.5 23.3284 20.5 22.5C20.5 21.6716 21.1716 21 22 21H25V18Z"
              fill="#FCD34D"
            />
          </svg>
        </div>
      </div>

      {/* Typography: "Fest" + "+" & Badges */}
      <div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-baseline">
            <span
              className={`font-black tracking-tight ${dimensions.textSize} ${
                isLightMode ? 'text-white' : 'text-slate-900'
              } transition-colors`}
            >
              Fest
            </span>
            {/* Elegant Accent '+' without color bleed */}
            <span
              className={`font-black tracking-tight ${dimensions.plusSize} text-indigo-600 inline-flex items-center ml-0.5`}
            >
              +
            </span>
          </div>

          {/* Badge */}
          {showBadge && (
            <span
              className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-full border ${dimensions.badgeSize} ${
                isLightMode
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
              }`}
            >
              <Sparkles className={`${dimensions.sparkleSize} text-amber-500`} />
              <span>{badgeText}</span>
            </span>
          )}
        </div>

        {/* Subtitle / Tagline */}
        {showSubtitle && (
          <p
            className={`${dimensions.subText} font-medium ${
              isLightMode ? 'text-slate-400' : 'text-slate-500'
            } leading-tight hidden sm:block`}
          >
            {subtitleText || 'College Events & Tickets'}
          </p>
        )}
      </div>
    </div>
  );
};
