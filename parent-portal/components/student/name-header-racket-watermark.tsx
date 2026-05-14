/** 名前エリア：ミニマルな透かしラケット（細線・円＋弦2本＋シャフト1本） */
export function NameHeaderRacketWatermark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g
        transform="translate(6 2) rotate(-34 50 54)"
        stroke="rgba(230, 253, 245, 0.55)"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="50" r="30" strokeWidth="1.75" />
        <path
          d="M23 47c9 3 18 4 27 3s18-2 27-5"
          strokeWidth="1.35"
        />
        <path
          d="M25 56c8 2.5 16 3.5 25 3s17-1.5 25-4"
          strokeWidth="1.35"
        />
        <line x1="69" y1="71" x2="93" y2="102" strokeWidth="1.65" />
      </g>
    </svg>
  );
}
