/**
 * テニスラケット（ストローク）。currentColor で色が付く。
 * 更新日時欄・予約ボタン左など共通利用。
 */
export function TennisRacketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* ヘッド（楕円） */}
        <ellipse cx="10.2" cy="9.3" rx="6.1" ry="6.45" transform="rotate(-38 10.2 9.3)" />
        {/* 簡易ストリング */}
        <path d="M5.8 7.2q4.2 2.4 8.6 1.1" opacity="0.85" />
        <path d="M6.4 10.1q3.8 1.2 7.8 0.3" opacity="0.85" />
        <path d="M7.2 12.8q3.2 0.5 6.6-0.2" opacity="0.85" />
        {/* シャフト〜グリップ */}
        <path d="M14.4 13.6l5.8 8.2" strokeWidth="2.15" />
        <path d="M18.8 20.2l2.1 1.6" strokeWidth="2" />
      </g>
    </svg>
  );
}
