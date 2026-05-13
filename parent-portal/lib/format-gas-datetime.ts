/** GAS の表示用日時（例: 2026-05-13 8:28）を完成版 UI 用に整形 */
const JP_WD = ['日', '月', '火', '水', '木', '金', '土'];

export function formatGasUpdatedDisplay(s: string): string {
  const t = String(s || '').trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const min = parseInt(m[5], 10);
  const noonUtc = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const wd = JP_WD[noonUtc.getUTCDay()];
  const hh = String(h).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  return `${m[1]}-${m[2]}-${m[3]} (${wd}) ${hh}:${mm}`;
}
