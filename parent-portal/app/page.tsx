export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-slate-100">
      <header className="shrink-0 bg-kg-forest px-4 py-8 text-center text-white shadow-sm">
        <h1 className="text-lg font-extrabold tracking-tight">育成クラス・振替の残り</h1>
        <p className="mt-2 text-[10px] font-semibold text-emerald-100/90">鎌倉グリーンテニススクール</p>
      </header>
      <div className="flex flex-1 flex-col justify-center px-4 py-10 text-center">
        <p className="text-sm text-slate-600">
          保護者向けURLは{' '}
          <code className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs text-slate-800">/student/（トークン）</code>{' '}
          形式です。
        </p>
      </div>
    </main>
  );
}
