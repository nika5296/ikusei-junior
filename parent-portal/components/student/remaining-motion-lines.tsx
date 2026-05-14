import { cn } from '@/lib/utils';

/**
 * 振替残数の数字右上の短い放射線（モックの「キラ」に近い位置）。
 * 数字と「回」の間には入れない（レイアウト崩れ防止）。
 */
export function RemainingMotionLines({ className }: { className?: string }) {
  return (
    <span
      className={cn('pointer-events-none inline-flex flex-col items-end gap-[2px]', className)}
      aria-hidden
    >
      <span className="block h-[2px] w-2.5 rounded-full bg-emerald-500" />
      <span className="block h-[2px] w-3.5 rounded-full bg-emerald-500" />
      <span className="block h-[2px] w-2 rounded-full bg-emerald-500" />
    </span>
  );
}
