# 保護者ポータル（Next.js / Vercel）

Google Apps Script の `format=json` API から振替残数を表示します（`script.google.com` の注意バナーなし）。

## 前提

- GAS ウェブアプリがデプロイ済みで、`…/exec?token=…&format=json` が動くこと
- スプレッドシートの「設定」に **保護者ポータルURL**（このサイトの `https://…vercel.app`）を入れ、URLリストを再出力すること

## 環境変数（Vercel / ローカル）

| 名前 | 説明 |
|------|------|
| `GAS_STUDENT_API_BASE_URL` | GAS の exec URL（`https://script.google.com/macros/s/…/exec` まで） |
| `NEXT_PUBLIC_BRAND_ASSET_BASE_URL` | （任意）GAS が返す `assets` が空のときの補完用。未設定なら画像なしで表示（**Vercel だけの運用で問題ありません**） |

## 公式ブランド画像（ロゴ・左右マスコット）

**プレースホルダー画像はリポジトリに含めていません。** スクール公式のデータだけを `public/brand/` に配置してください。

1. ファイル名は **`lib/student-assets.ts` の `BRAND_ASSET_FILES`** と完全一致（リネーム不可）。
2. 解像度・用途の一覧は **`docs/brand-assets-spec.json`**。
3. ローカルまたは Vercel で静的ファイルとして配信する場合: `public/brand/` に PNG を置き、環境変数に `NEXT_PUBLIC_BRAND_ASSET_BASE_URL=/brand` を設定。
4. フォルダ内の **`public/brand/PLACE_OFFICIAL_FILES_HERE.txt`** にも同じ注意が書いてあります。

UI は元の **WebApp.html** と同じ **森緑 `#14532d`** ヘッダー・カード・黄色の予約ボタンに揃え、**Shadcn/ui（Accordion / Button）+ Tailwind** で実装しています。

---

## 自動デプロイ（推奨・このリポジトリの既定）

**Vercel の Git 連携だけ**使います。**GitHub に `git push` するたび**、Vercel が自動でビルド・本番反映します（追加の Actions や CLI は不要）。

1. [vercel.com](https://vercel.com) → **Add New → Project** → この GitHub リポジトリを Import  
2. **Root Directory** を **`parent-portal`** に設定  
3. **Settings → Environment Variables** に `GAS_STUDENT_API_BASE_URL` などを設定（Production にチェック）  
4. 一度 **Deploy** したあとは、**`main` / `master` など Production ブランチへ push** するだけで更新される  

詳細: [Vercel に Git リポジトリを接続する](https://vercel.com/docs/deployments/git)

> **注意:** 同じプロジェクトで **Git 連携と GitHub Actions の push トリガーを両方**有効にすると、**二重デプロイ**になります。本リポジトリの `.github/workflows/vercel-parent-portal.yml` は **手動（workflow_dispatch）のみ**にしてあるので、通常は **Secrets を入れなくてよい**です。

---

## GitHub Actions から手動デプロイ（オプション）

CI から出したい場合のみ、**Settings → Secrets and variables → Actions** に次を登録し、**Actions タブから「Run workflow」**で実行します。

| Secret | 取得方法 |
|--------|----------|
| `VERCEL_TOKEN` | [Account Tokens](https://vercel.com/account/tokens) で作成 |
| `VERCEL_ORG_ID` | `parent-portal` で `npx vercel link` 後の `.vercel/project.json` の `orgId` |
| `VERCEL_PROJECT_ID` | 同上の `projectId` |

---

## PC から CLI で 1 発（トークン必須）

```powershell
$env:VERCEL_TOKEN = '（Vercel の Token）'
.\tools\Deploy-VercelParentPortal.ps1
```

初回は同じフォルダで `npx vercel link` が必要な場合があります。

## ローカル開発

```bash
cd parent-portal
cp .env.example .env.local
# .env.local に GAS_STUDENT_API_BASE_URL=
npm install
npm run dev
# http://localhost:3040/student/（トークン）
```
