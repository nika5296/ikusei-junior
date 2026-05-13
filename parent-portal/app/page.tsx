export default function HomePage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-emerald-900">育成クラス・振替の残り</h1>
      <p className="mt-4 text-sm text-slate-600">
        保護者向けURLは{' '}
        <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">/student/（トークン）</code> 形式です。
      </p>
      <p className="mt-8 text-xs text-slate-400">鎌倉グリーンテニススクール</p>
    </main>
  );
}
