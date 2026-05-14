/**
 * テニスラケット＋ボールの線画アイコン（太めストローク・角丸）。
 * currentColor で色が付く（ボタン左など）。
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
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* ボール（ヘッド右上） */}
        <circle cx="17.5" cy="6.4" r="2.2" />
        <path d="M15.8 5.4c1.1-.6 2.5-.4 3.6.3" strokeWidth="1.65" />
        <path d="M15.7 7.4c1.2.7 2.7.8 3.8.1" strokeWidth="1.65" />

        <g transform="rotate(-40 10.4 9.6)">
          <ellipse cx="10.4" cy="9.6" rx="5.05" ry="5.85" />
          {/* ストリング（粗めグリッド） */}
          <path d="M5.8 7.4h9.2" strokeWidth="1.55" />
          <path d="M5.6 9.6h9.6" strokeWidth="1.55" />
          <path d="M5.8 11.8h9.2" strokeWidth="1.55" />
          <path d="M7.9 4.6v10.4" strokeWidth="1.55" />
          <path d="M10.4 4.1v11.2" strokeWidth="1.55" />
          <path d="M12.9 4.6v10.4" strokeWidth="1.55" />
          {/* 喉の三角 */}
          <path d="M8.1 14.6l2.3 2.5 2.3-2.5" strokeWidth="1.85" />
          {/* シャフト〜グリップ */}
          <path d="M10.4 17.1v5.6" strokeWidth="2" />
          <path d="M8.9 21.4h3" strokeWidth="1.75" />
        </g>
      </g>
    </svg>
  );
}
