import { DefinitionAccordion } from '@/components/student/definition-accordion';
import { Button } from '@/components/ui/button';
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
      <main className="kg-page-bg mx-auto flex min-h-dvh max-w-lg flex-col">
        <header
          className="shrink-0 bg-kg-forest px-4 pb-4 pt-[max(0.65rem,env(safe-area-inset-top))] text-center text-white shadow-sm"
          style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top))' }}
        >
          <p className="text-sm font-extrabold">鎌倉グリーンテニススクール</p>
          <p className="mt-1 text-[10px] font-semibold text-emerald-100/90">育成クラス・振替の残り</p>
        </header>
        <div className="flex flex-1 flex-col items-center px-4 py-8 text-center">
          <p className="w-full max-w-sm rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{msg}</p>
          <p className="mt-4 max-w-sm text-xs text-slate-600">
            管理者向け: Vercel に <code className="rounded bg-white/80 px-1">GAS_STUDENT_API_BASE_URL</code> を設定してください。
          </p>
        </div>
      </main>
    );
  }

  const a = resolveStudentAssets(data.assets);

  if (data.error) {
    return (
      <main className="kg-page-bg mx-auto flex min-h-dvh max-w-lg flex-col">
        <header
          className="shrink-0 bg-kg-forest px-4 pb-4 pt-[max(0.65rem,env(safe-area-inset-top))] text-center text-white shadow-sm"
          style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top))' }}
        >
          <p className="text-sm font-extrabold">鎌倉グリーンテニススクール</p>
          <p className="mt-1 text-[10px] font-semibold text-emerald-100/90">育成クラス・振替の残り</p>
        </header>
        <div className="flex flex-1 flex-col items-center px-4 py-8 text-center">
          <p className="w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base font-medium text-amber-950">
            {data.error}
          </p>
          <p className="mt-6 max-w-sm text-sm text-slate-600">お手数ですが、配布のURLから再度お試しください。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="kg-page-bg mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      {/* ブランド帯：文言・ロゴ・マスコットをすべて中央基準で整列 */}
      <header
        className="shrink-0 bg-kg-forest px-4 pb-4 pt-[max(0.65rem,env(safe-area-inset-top))] text-center text-white shadow-md"
        style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top))' }}
      >
        <div className="mx-auto w-full max-w-md">
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-end gap-1 px-0.5">
            <div className="flex min-h-[3.25rem] items-end justify-end pb-0.5">
              {a.bearLeftUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.bearLeftUrl}
                    alt=""
                    width={44}
                    height={52}
                    className="kg-mascot h-11 w-auto max-w-[2.75rem] object-contain object-bottom opacity-90"
                    decoding="async"
                  />
                </>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col items-center px-1 text-center">
              {a.logoUrl ? (
                <div className="mb-1.5 flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 p-1 ring-1 ring-white/25">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.logoUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-8 w-8 object-contain"
                    loading="eager"
                    decoding="async"
                  />
                </div>
              ) : null}
              <p className="max-w-[16rem] text-[13px] font-extrabold leading-tight tracking-tight">
                鎌倉グリーンテニススクール
              </p>
              <p className="mt-1 text-[10px] font-semibold tracking-wide text-emerald-100/95">育成クラス・振替の残り</p>
            </div>

            <div className="flex min-h-[3.25rem] items-end justify-start pb-0.5">
              {a.bearRightUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.bearRightUrl}
                    alt=""
                    width={48}
                    height={56}
                    className="kg-mascot h-12 w-auto max-w-[3rem] object-contain object-bottom opacity-90 drop-shadow-md"
                    decoding="async"
                  />
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-3 border-t border-white/20 pt-3 text-center">
            <p className="text-[10px] font-semibold tracking-wider text-emerald-100/85">お名前</p>
            <p className="mx-auto mt-1 max-w-[18rem] break-words text-lg font-bold leading-snug tracking-tight md:text-xl">
              {data.name}
            </p>
          </div>
        </div>
      </header>

      {/* 白カード：2枚目に近い「更新／残数」の二列＋以降も中央揃え */}
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col rounded-3xl bg-white p-3 shadow-[0_8px_30px_-8px_rgba(20,83,45,0.18)] ring-1 ring-emerald-900/10">
          <section className="grid shrink-0 grid-cols-2 divide-x divide-emerald-200/90 rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-slate-50/90 to-emerald-50/50">
            <div className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 px-2 py-4 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">最終更新</span>
              <span className="max-w-full break-words px-0.5 text-sm font-bold tabular-nums leading-snug text-slate-800 sm:text-base">
                {data.updated}
              </span>
            </div>
            <div className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 px-2 py-4 text-center">
              <span className="text-xs font-bold text-emerald-800">振替の残り</span>
              <div className="flex items-baseline justify-center gap-0.5">
                {data.remainingHasUnit ? (
                  <>
                    <span className="text-5xl font-black tabular-nums leading-none text-emerald-600 drop-shadow-sm sm:text-6xl">
                      {data.remainingMain}
                    </span>
                    <span className="pb-0.5 text-xl font-bold leading-none text-emerald-700 sm:text-2xl">
                      {data.remainingSuffix}
                    </span>
                  </>
                ) : (
                  <span className="text-5xl font-black leading-none text-emerald-600 sm:text-6xl">{data.remainingMain}</span>
                )}
              </div>
            </div>
          </section>

          {data.definitionHtml ? <DefinitionAccordion html={data.definitionHtml} /> : null}

          <div className="mt-auto flex shrink-0 flex-col items-center gap-2.5 pt-4 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-slate-600">空き枠は予約ページでご確認ください</p>
            {data.reservationUrl ? (
              <Button variant="reservation" asChild className="w-full max-w-sm">
                <a href={data.reservationUrl} target="_blank" rel="noopener noreferrer">
                  <span aria-hidden>🎾</span>
                  振替を予約する
                </a>
              </Button>
            ) : (
              <p className="w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base font-medium text-amber-950">
                予約ページ未設定です。スクールまでお問い合わせください。
              </p>
            )}
            <p className="max-w-[20rem] text-xs leading-relaxed text-slate-500">
              ※このURLはご家庭内でのご利用を想定しています
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
