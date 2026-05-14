/** 名前エリア右側の透かしラケット装飾 */
export function NameHeaderRacketWatermark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g opacity="0.22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="52" cy="58" rx="38" ry="42" transform="rotate(-32 52 58)" />
        <path d="M78 88 L108 128" strokeWidth="5" />
        <path d="M32 48 Q52 58 72 52" strokeWidth="2" />
        <path d="M36 62 Q54 70 74 64" strokeWidth="2" />
      </g>
    </svg>
  );
}
