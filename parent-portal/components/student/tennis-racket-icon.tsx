/** 予約ボタン左の白ラケット（簡易 SVG） */
export function TennisRacketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M14.5 3.5c2.5 2.5 2.2 6.8-.8 9.8-3 3-7.3 3.3-9.8.8l-.7-.7c-1.2-1.2-1-3.3.5-4.8C5 6.4 8.2 5.8 10.5 4.5c1.5-.8 2.6-2 3.5-3.5 1-1.7 2.5-1.9 3.5-.9l.7.7Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M5 19l3-3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
