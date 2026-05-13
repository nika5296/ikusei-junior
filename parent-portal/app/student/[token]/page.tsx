import Image from 'next/image';
import { fetchStudentPayload } from '@/lib/gas';

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
      <main className="mx-auto max-w-lg px-4 pb-8 pt-10">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{msg}</p>
        <p className="mt-4 text-center text-xs text-slate-500">
          管理者向け: Vercel に <code className="rounded bg-slate-200 px-1">GAS_STUDENT_API_BASE_URL</code> を設定してください。
        </p>
      </main>
    );
  }

  const a = data.assets;

  if (data.error) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-8 pt-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-base font-medium text-amber-950">
          {data.error}
        </p>
        <p className="mt-6 text-center text-sm text-slate-600">お手数ですが、配布のURLから再度お試しください。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col overflow-hidden">
      {/* ヘッダー帯 */}
      <header
        className="shrink-0 bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-700 px-4 pb-4 pt-[max(0.75rem,var(--safe-top))] text-white shadow-sm"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-start gap-3">
          {a.logoUrl ? (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/15 ring-1 ring-white/30">
              <Image src={a.logoUrl} alt="" fill className="object-contain p-1" sizes="44px" unoptimized />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-base font-extrabold leading-tight tracking-tight">鎌倉グリーンテニススクール</p>
            <p className="mt-1 text-sm font-semibold text-emerald-100/95">育成クラス・振替の残り</p>
          </div>
          {a.bearRightUrl ? (
            <div className="relative h-14 w-12 shrink-0 opacity-90">
              <Image src={a.bearRightUrl} alt="" fill className="object-contain object-bottom" sizes="48px" unoptimized />
            </div>
          ) : null}
        </div>
        <div className="mt-3 border-t border-white/20 pt-3">
          <p className="text-sm font-semibold tracking-wide text-emerald-100/90">お名前</p>
          <p className="mt-1 break-words text-xl font-bold leading-snug tracking-tight text-white drop-shadow-sm md:text-2xl">
            {data.name}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col rounded-t-2xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-6px_24px_-6px_rgba(6,78,59,0.12)] ring-1 ring-slate-200/70">
        {/* メトリックカード：最終更新を大きく */}
        <section className="shrink-0 rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-slate-50 to-emerald-50/50 px-4 py-4 shadow-sm">
          <p className="text-center text-sm font-semibold text-slate-600">
            最終更新
            <span className="mt-1 block text-lg font-bold tabular-nums text-slate-800 md:text-xl">{data.updated}</span>
          </p>
          <div className="my-4 h-px w-full bg-emerald-200/90" />
          <p className="text-center text-base font-bold text-emerald-900">振替の残り</p>
          <div className="mt-3 flex items-baseline justify-center gap-1">
            {data.remainingHasUnit ? (
              <>
                <span className="text-7xl font-black tabular-nums leading-none tracking-tight text-emerald-600 drop-shadow-sm md:text-8xl">
                  {data.remainingMain}
                </span>
                <span className="pb-1 text-3xl font-bold leading-none text-emerald-700">{data.remainingSuffix}</span>
              </>
            ) : (
              <span className="text-5xl font-black leading-none text-emerald-600 md:text-6xl">{data.remainingMain}</span>
            )}
          </div>
        </section>

        {data.definitionHtml ? (
          <details className="mt-3 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 open:shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-base font-bold text-emerald-950 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                詳しい説明（タップで開く）
                <span className="text-emerald-600">▼</span>
              </span>
            </summary>
            <div
              className="definition-html max-h-[38vh] overflow-y-auto overscroll-contain border-t border-slate-200 px-4 py-3 text-base leading-relaxed text-slate-700"
              dangerouslySetInnerHTML={{ __html: data.definitionHtml }}
            />
          </details>
        ) : null}

        <div className="mt-auto shrink-0 space-y-3 pt-4">
          <p className="text-center text-sm text-slate-600">空き枠は予約ページでご確認ください</p>
          {data.reservationUrl ? (
            <a
              href={data.reservationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[3.25rem] items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300 text-center text-lg font-black text-amber-950 shadow-md ring-2 ring-amber-200/80 active:scale-[0.99]"
            >
              🎾 振替を予約する
            </a>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-base font-medium text-amber-950">
              予約ページ未設定です。スクールまでお問い合わせください。
            </p>
          )}
          <p className="text-sm leading-snug text-slate-500">※このURLはご家庭内でのご利用を想定しています</p>
        </div>
      </div>
    </main>
  );
}
