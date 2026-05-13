import { Calendar, ChevronRight } from 'lucide-react';
import { DefinitionAccordion } from '@/components/student/definition-accordion';
import { RemainingMotionLines } from '@/components/student/remaining-motion-lines';
import { TennisRacketIcon } from '@/components/student/tennis-racket-icon';
import { Button } from '@/components/ui/button';
import { formatGasUpdatedDisplay } from '@/lib/format-gas-datetime';
import { fetchStudentPayload } from '@/lib/gas';
import { resolveStudentAssets } from '@/lib/student-assets';

export const revalidate = 60;

type PageProps = { params: { token: string } };

export default async function StudentPage({ params }: PageProps) {
  const { token } = params;
  const decoded = decodeURIComponent(token);

  let data;
  try {
    data = await fetchStudentPayload(decoded);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'データ取得に失敗しました';
    return (
      <main className="kg-page-bg mx-auto flex min-h-dvh max-w-lg flex-col px-3 py-6">
        <p className="mx-auto w-full max-w-sm rounded-2xl border border-rose-200 bg-white/90 px-4 py-3 text-center text-sm text-rose-900 shadow-sm">
          {msg}
        </p>
        <p className="mx-auto mt-4 max-w-sm text-center text-xs text-slate-600">
          Vercel に <code className="rounded bg-white/90 px-1">GAS_STUDENT_API_BASE_URL</code> を設定してください。
        </p>
      </main>
    );
  }

  const a = resolveStudentAssets(data.assets);

  if (data.error) {
    return (
      <main className="kg-page-bg mx-auto flex min-h-dvh max-w-lg flex-col px-3 py-6">
        <p className="mx-auto w-full max-w-sm rounded-2xl border border-amber-200 bg-white/90 px-4 py-3 text-center text-base font-medium text-amber-950 shadow-sm">
          {data.error}
        </p>
        <p className="mx-auto mt-6 max-w-sm text-center text-sm text-slate-600">配布のURLから再度お試しください。</p>
      </main>
    );
  }

  const updatedLine = formatGasUpdatedDisplay(data.updated);
  const unitIsKai =
    data.remainingHasUnit && String(data.remainingSuffix || '').trim() === '回';

  return (
    <main className="kg-page-bg min-h-dvh w-full">
      <div className="mx-auto max-w-lg px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* 題名ブロック：ロゴ左上＋校名横並び、下に「育成クラス振替残数」 */}
        <section className="mb-3 rounded-2xl bg-white px-4 py-4 shadow-md ring-1 ring-emerald-900/10">
          <div className="flex flex-row items-center gap-3">
            {a.logoUrl ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.logoUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-9 w-9 object-contain"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="h-12 w-12 shrink-0 rounded-full bg-emerald-50 ring-1 ring-emerald-100" aria-hidden />
            )}
            <p className="min-w-0 flex-1 text-left text-[15px] font-extrabold leading-snug tracking-tight text-emerald-900 sm:text-base">
              鎌倉グリーンテニススクール
            </p>
          </div>
          <h1 className="mt-4 border-t border-emerald-100 pt-3 text-center text-lg font-black tracking-wide text-emerald-950 sm:text-xl">
            育成クラス振替残数
          </h1>
        </section>

        {/* 氏名：中央・大きく、左右に大きなマスコット */}
        <section className="mb-3 flex items-end justify-center gap-0.5 px-0 sm:gap-1">
          <div className="flex min-h-[7.5rem] w-[min(30%,5.75rem)] flex-1 items-end justify-end sm:min-h-[8.5rem] sm:w-28">
            {a.bearLeftUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.bearLeftUrl}
                  alt=""
                  width={112}
                  height={132}
                  className="kg-mascot h-[6.5rem] w-auto max-w-full object-contain object-bottom drop-shadow-md sm:h-[7.5rem]"
                  decoding="async"
                />
              </>
            ) : (
              <span className="inline-block w-4 shrink-0 sm:w-6" aria-hidden />
            )}
          </div>
          <div className="z-10 flex max-w-[58%] min-w-0 flex-col items-center justify-end px-1 pb-1 text-center">
            <p className="text-[11px] font-semibold tracking-wide text-emerald-800/90">おなまえ</p>
            <p className="mt-1.5 break-words text-[1.65rem] font-bold leading-tight tracking-tight text-emerald-950 sm:text-4xl sm:leading-tight">
              {data.name}
            </p>
          </div>
          <div className="flex min-h-[7.5rem] w-[min(30%,5.75rem)] flex-1 items-end justify-start sm:min-h-[8.5rem] sm:w-28">
            {a.bearRightUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.bearRightUrl}
                  alt=""
                  width={120}
                  height={140}
                  className="kg-mascot h-[7rem] w-auto max-w-full object-contain object-bottom drop-shadow-md sm:h-[8rem]"
                  decoding="async"
                />
              </>
            ) : (
              <span className="inline-block w-4 shrink-0 sm:w-6" aria-hidden />
            )}
          </div>
        </section>

        {/* メインカード（メトリクス〜） */}
        <div className="mx-auto w-full max-w-[22.5rem] overflow-hidden rounded-[1.75rem] bg-white shadow-[0_12px_40px_-12px_rgba(15,118,110,0.35)] ring-1 ring-emerald-900/12">
          <div className="grid grid-cols-2 divide-x divide-slate-200/90 bg-white">
            <div className="flex items-center justify-center gap-2.5 px-2 py-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 ring-1 ring-teal-200/80">
                <Calendar className="size-5 text-teal-700" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[11px] font-semibold text-slate-500">更新日時</p>
                <p className="mt-0.5 text-[13px] font-bold leading-snug text-slate-800">{updatedLine}</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 px-2 py-4 text-center">
              <p className="text-xs font-bold text-emerald-700">振替残数</p>
              {data.remainingHasUnit ? (
                <div className="flex items-start justify-center gap-1">
                  <span className="text-5xl font-black leading-none tabular-nums tracking-tight text-teal-600 drop-shadow-sm sm:text-[3.25rem]">
                    {data.remainingMain}
                  </span>
                  <RemainingMotionLines className="pt-1.5" />
                  {unitIsKai ? (
                    <span className="mt-1.5 inline-flex h-8 min-w-[1.75rem] items-center justify-center rounded border-2 border-emerald-600 bg-white text-lg font-bold text-emerald-700">
                      回
                    </span>
                  ) : (
                    <span className="mt-2 text-xl font-bold text-emerald-700">{data.remainingSuffix}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-start justify-center gap-1">
                  <span className="text-5xl font-black leading-none text-teal-600 sm:text-[3.25rem]">
                    {data.remainingMain}
                  </span>
                  <RemainingMotionLines className="pt-1.5" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white px-2 pb-2 pt-1">
            {data.definitionHtml ? <DefinitionAccordion html={data.definitionHtml} /> : null}

            <div className="mt-5 flex flex-col items-center gap-3 px-1 pb-4">
              {data.reservationUrl ? (
                <Button variant="reservation" asChild className="w-full max-w-[19rem]">
                  <a href={data.reservationUrl} target="_blank" rel="noopener noreferrer">
                    <span className="flex w-full items-center justify-between gap-2">
                      <TennisRacketIcon className="size-6 shrink-0 text-white drop-shadow" />
                      <span className="flex-1 text-center text-[15px] font-bold text-neutral-900">
                        振替予約はこちら
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-neutral-900" strokeWidth={2.5} aria-hidden />
                    </span>
                  </a>
                </Button>
              ) : (
                <p className="w-full max-w-[19rem] rounded-full border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950">
                  予約ページ未設定です
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-[19rem] px-2 text-center text-[11px] leading-relaxed text-slate-500">
          ※このURLはご家庭内のみでご利用ください
        </p>
      </div>
    </main>
  );
}
