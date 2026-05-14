import type { StudentApiPayload } from '@/lib/gas';

/**
 * 公式ブランド画像のファイル名（`public/brand/` 配置時と GAS フォールバックで共通）。
 * 仕様・解像度の説明は `docs/brand-assets-spec.json`。
 */
export const BRAND_ASSET_FILES = {
  logo: 'kamakura-green-logo.png',
  bearLeft: 'bear-left.png',
  bearRight: 'bear-right.png'
} as const;

export type BrandAssetRole = keyof typeof BRAND_ASSET_FILES;

/**
 * ロゴ・マスコットのフォールバック用ベース URL（末尾スラッシュなし）。
 * 例: 同サイトの `public/brand` を使う → `NEXT_PUBLIC_BRAND_ASSET_BASE_URL=/brand`
 * 未設定なら GAS が返した URL のみ使用（画像なし表示になる）。
 */
function optionalAssetBase(): string {
  return (process.env.NEXT_PUBLIC_BRAND_ASSET_BASE_URL?.trim() || '').replace(/\/+$/, '');
}

/** GAS の URL を優先。環境変数があれば空欄時のみそこから補完。 */
export function resolveStudentAssets(assets: StudentApiPayload['assets']) {
  const base = optionalAssetBase();
  const pick = (fromGas: string, role: BrandAssetRole) => {
    const g = String(fromGas || '').trim();
    if (g) return g;
    const file = BRAND_ASSET_FILES[role];
    return base ? `${base}/${file}` : '';
  };
  return {
    logoUrl: pick(assets.logoUrl, 'logo'),
    bearLeftUrl: pick(assets.bearLeftUrl, 'bearLeft'),
    bearRightUrl: pick(assets.bearRightUrl, 'bearRight')
  };
}
