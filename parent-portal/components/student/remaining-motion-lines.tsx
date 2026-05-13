import { cn } from '@/lib/utils';

/** 振替残数の数字右上の「動き」装飾（3本線） */
export function RemainingMotionLines({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-end gap-[3px] pr-0.5', className)} aria-hidden>
      <span className="block h-[3px] w-3 rounded-full bg-emerald-500" />
      <span className="block h-[3px] w-4 rounded-full bg-emerald-500" />
      <span className="block h-[3px] w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}
