import type { StudentApiPayload } from '@/lib/gas';

/**
 * ロゴ・マスコットのフォールバック用ベース URL（末尾スラッシュなし）。
 * 未設定なら GAS が返した URL のみ使用（Vercel 単体運用で十分な場合は空のまま）。
 * 必要なときだけ Surge / 別 CDN / 同サイトの公開 URL などを指定。
 */
function optionalAssetBase(): string {
  return (process.env.NEXT_PUBLIC_BRAND_ASSET_BASE_URL?.trim() || '').replace(/\/+$/, '');
}

/** GAS の URL を優先。環境変数があれば空欄時のみそこから補完。 */
export function resolveStudentAssets(assets: StudentApiPayload['assets']) {
  const base = optionalAssetBase();
  const pick = (fromGas: string, file: string) => {
    const g = String(fromGas || '').trim();
    if (g) return g;
    return base ? `${base}/${file}` : '';
  };
  return {
    logoUrl: pick(assets.logoUrl, 'kamakura-green-logo.png'),
    bearLeftUrl: pick(assets.bearLeftUrl, 'bear-left.png'),
    bearRightUrl: pick(assets.bearRightUrl, 'bear-right.png')
  };
}
