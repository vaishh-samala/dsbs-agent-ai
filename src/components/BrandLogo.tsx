import React from 'react';

interface BrandLogoProps {
  collapsed?: boolean;
  className?: string;
  badgeText?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  collapsed = false,
  className = '',
  badgeText = 'v1.0 · sandbox engine',
}) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Distinctive Isometric Hexagon/Cube Sandbox Emblem */}
      <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-9 h-9 drop-shadow-[0_0_12px_rgba(139,92,246,0.35)]"
        >
          {/* Outer Hexagonal Container Shell */}
          <path
            d="M18 3L32 10.5V25.5L18 33L4 25.5V10.5L18 3Z"
            fill="url(#logo_shell_grad)"
            stroke="#8b5cf6"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Inner 3D Cube Facets */}
          <path
            d="M18 3L32 10.5L18 18L4 10.5L18 3Z"
            fill="#a78bfa"
            fillOpacity="0.25"
          />
          <path
            d="M4 10.5L18 18V33L4 25.5V10.5Z"
            fill="#6d28d9"
            fillOpacity="0.4"
          />
          <path
            d="M32 10.5L18 18V33L32 25.5V10.5Z"
            fill="#7c3aed"
            fillOpacity="0.2"
          />
          {/* Electric Boot Arrow / Lightning glyph */}
          <path
            d="M19.5 9L13 18H18L16.5 27L23 17H18L19.5 9Z"
            fill="#38bdf8"
            stroke="#0284c7"
            strokeWidth="0.8"
            strokeLinejoin="round"
            className="filter drop-shadow-[0_0_4px_rgba(56,189,248,0.7)]"
          />
          <defs>
            <linearGradient
              id="logo_shell_grad"
              x1="4"
              y1="3"
              x2="32"
              y2="33"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#1e1b4b" />
              <stop offset="0.5" stopColor="#0f172a" />
              <stop offset="1" stopColor="#1e123a" />
            </linearGradient>
          </defs>
        </svg>

        {/* Small active status glow dot */}
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#0c0e14] shadow-[0_0_6px_#22d3ee]" />
      </div>

      {/* Brand Typography */}
      {!collapsed && (
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-bold text-sm text-neutral-100 tracking-tight">
              Sandbox
            </span>
            <span className="font-extrabold text-sm text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 tracking-tight">
              Bootstrapper
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 font-mono tracking-tight mt-1 truncate">
            {badgeText}
          </span>
        </div>
      )}
    </div>
  );
};

