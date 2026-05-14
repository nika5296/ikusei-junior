import { Calendar, ChevronRight } from 'lucide-react';
import { DefinitionAccordion } from '@/components/student/definition-accordion';
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
      <main className="kg-page-bg mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden px-4 py-8 text-[#1F2937]">
        <p className="rounded-3xl border border-rose-200/80 bg-white/95 px-5 py-4 text-center text-[15px] text-rose-900 shadow-md">
          {msg}
        </p>
        <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-relaxed text-[#6B7280]">
          Vercel に <code className="rounded-lg bg-white/90 px-1.5 py-0.5 text-[13px]">GAS_STUDENT_API_BASE_URL</code>{' '}
          を設定してください。
        </p>
      </main>
    );
  }

  const a = resolveStudentAssets(data.assets);

  if (data.error) {
    return (
      <main className="kg-page-bg mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden px-4 py-8 text-[#1F2937]">
        <p className="rounded-3xl border border-amber-200/90 bg-white/95 px-5 py-4 text-center text-base font-medium text-amber-950 shadow-md">
          {data.error}
        </p>
        <p className="mx-auto mt-6 max-w-sm text-center text-[15px] leading-relaxed text-[#6B7280]">
          配布のURLから再度お試しください。
        </p>
      </main>
    );
  }

  const updatedLine = formatGasUpdatedDisplay(data.updated);
  const unitIsKai =
    data.remainingHasUnit && String(data.remainingSuffix || '').trim() === '回';

  return (
    <main className="kg-page-bg min-h-dvh w-full overflow-x-hidden text-[#1F2937]">
      <div className="mx-auto w-full max-w-[430px] px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* 上部ヘッダー：白カード */}
        <header className="mb-2 rounded-3xl bg-white px-5 py-5 shadow-md ring-1 ring-black/5">
          <div className="flex items-center gap-4">
            {a.logoUrl ? (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EAFBF3] ring-1 ring-[#009b6b]/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.logoUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain"
                  decoding="async"
                />
              </div>
            ) : (
              <div
                className="h-14 w-14 shrink-0 rounded-full bg-[#EAFBF3] ring-1 ring-[#009b6b]/15"
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-extrabold leading-snug tracking-tight text-[#0d4d3a]">
                鎌倉グリーンテニススクール
              </p>
              <p className="mt-2.5 text-[15px] font-semibold tracking-wide text-[#009b6b]">育成クラス｜振替残数</p>
            </div>
          </div>
        </header>

        {/* マスコット：メインカードに少し重なる */}
        <div className="relative z-10 -mb-7 flex justify-between px-0.5 sm:-mb-9">
          <div className="flex w-[34%] max-w-[7.25rem] shrink-0 items-end justify-start sm:max-w-[8rem]">
            {a.bearLeftUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.bearLeftUrl}
                  alt=""
                  width={112}
                  height={132}
                  className="kg-mascot h-[5.75rem] w-auto max-w-full object-contain object-bottom drop-shadow-lg sm:h-[6.5rem]"
                  decoding="async"
                />
              </>
            ) : (
              <span className="inline-block h-1 w-6 shrink-0" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1" aria-hidden />
          <div className="flex w-[34%] max-w-[7.25rem] shrink-0 items-end justify-end sm:max-w-[8rem]">
            {a.bearRightUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.bearRightUrl}
                  alt=""
                  width={120}
                  height={140}
                  className="kg-mascot h-[6rem] w-auto max-w-full object-contain object-bottom drop-shadow-lg sm:h-[6.75rem]"
                  decoding="async"
                />
              </>
            ) : (
              <span className="inline-block h-1 w-6 shrink-0" aria-hidden />
            )}
          </div>
        </div>

        {/* メインカード */}
        <div className="relative z-20 mx-auto w-full overflow-hidden rounded-[1.85rem] bg-white kg-main-card ring-1 ring-[#009b6b]/10">
          {/* 名前エリア（グリーングラデーション） */}
          <div className="kg-name-header px-5 pb-9 pt-8">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-white/90">おなまえ</p>
            <p className="mt-3 break-words text-[1.9rem] font-bold leading-[1.2] tracking-tight text-white sm:text-[2.15rem]">
              {data.name}
            </p>
          </div>

          {/* 残数エリア：2カラム */}
          <div className="grid grid-cols-2 divide-x divide-slate-200/90 bg-white px-1 py-7 sm:px-2 sm:py-8">
            <div className="flex flex-col items-center justify-center gap-3 px-2 text-center sm:px-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAFBF3] ring-1 ring-[#009b6b]/12">
                <Calendar className="size-[22px] text-[#009b6b]" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="w-full min-w-0">
                <p className="text-[13px] font-semibold text-[#6B7280]">更新日時</p>
                <p className="mt-2 text-[15px] font-bold leading-snug text-[#1F2937]">{updatedLine}</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 px-2 text-center sm:px-3">
              <p className="text-[13px] font-bold text-[#009b6b]">振替残数</p>
              {data.remainingHasUnit ? (
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="tabular-nums text-[3.35rem] font-black leading-none tracking-tight text-[#00b884] sm:text-[3.75rem]">
                    {data.remainingMain}
                  </span>
                  {unitIsKai ? (
                    <span className="shrink-0 pb-1 text-[1.65rem] font-black tabular-nums text-[#009b6b] sm:text-[1.85rem]">
                      回
                    </span>
                  ) : (
                    <span className="shrink-0 pb-1 text-xl font-bold text-[#009b6b]">{data.remainingSuffix}</span>
                  )}
                </div>
              ) : (
                <span className="mt-1 tabular-nums text-[3.35rem] font-black leading-none text-[#00b884] sm:text-[3.75rem]">
                  {data.remainingMain}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white px-3 pb-2 pt-0">
            {data.definitionHtml ? <DefinitionAccordion html={data.definitionHtml} /> : null}

            <div className="mt-6 flex flex-col items-stretch gap-3 px-1 pb-6 pt-1">
              {data.reservationUrl ? (
                <Button variant="reservation" asChild className="w-full">
                  <a href={data.reservationUrl} target="_blank" rel="noopener noreferrer">
                    <span className="flex w-full min-h-14 items-center justify-center gap-2 px-4">
                      <span className="text-[16px] font-bold text-[#1F2937]">振替予約はこちら</span>
                      <ChevronRight className="size-6 shrink-0 text-[#1F2937]" strokeWidth={2.5} aria-hidden />
                    </span>
                  </a>
                </Button>
              ) : (
                <p className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-[15px] font-medium text-amber-950">
                  予約ページ未設定です
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-7 max-w-md px-2 text-center text-[13px] leading-relaxed text-[#6B7280]">
          ※このURLはご家庭内のみでご利用ください
        </p>
      </div>
    </main>
  );
}
