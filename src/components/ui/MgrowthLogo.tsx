interface MgrowthLogoProps {
  className?: string;
}

export function MgrowthLogo({ className }: MgrowthLogoProps) {
  return (
    <svg
      viewBox="0 0 520 130"
      width="520"
      height="130"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label="MGrowth Marketing B2B"
    >
      {/* Cursive M - Yellow calligraphic stroke */}
      <path
        d="M 28 20 C 22 18, 12 28, 10 48 C 8 68, 5 85, 8 96 C 11 107, 19 108, 24 96 C 29 84, 40 52, 50 32 C 55 23, 59 22, 58 30 C 57 40, 54 54, 60 50 C 66 46, 72 30, 80 18 C 88 6, 98 12, 104 30 C 108 42, 112 55, 108 56"
        stroke="#FFD400"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* GROWTH */}
      <text
        x="108"
        y="92"
        style={{
          fill: 'currentColor',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 800,
          fontSize: 88,
          letterSpacing: 2,
        }}
      >
        GROWTH
      </text>
      {/* MARKETING B2B */}
      <text
        x="148"
        y="122"
        style={{
          fill: 'currentColor',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 500,
          fontSize: 20,
          letterSpacing: 7,
        }}
      >
        MARKETING B2B
      </text>
    </svg>
  );
}
