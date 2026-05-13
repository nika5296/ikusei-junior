# 保護者ポータル（Next.js / Vercel）

Google Apps Script の `format=json` API から振替残数を表示します（`script.google.com` の注意バナーなし）。

## 前提

- GAS ウェブアプリがデプロイ済みで、`…/exec?token=…&format=json` が動くこと
- スプレッドシートの「設定」に **保護者ポータルURL**（このサイトの `https://…vercel.app`）を入れ、URLリストを再出力すること

## 環境変数（Vercel / ローカル）

| 名前 | 説明 |
|------|------|
| `GAS_STUDENT_API_BASE_URL` | GAS の exec URL（`https://script.google.com/macros/s/…/exec` まで） |

## いちばん簡単な立ち上げ（ブラウザ 1 回）

1. このリポジトリを **GitHub に push**
2. [vercel.com](https://vercel.com) にログイン → **Add New → Project** → リポジトリを Import
3. **Root Directory** を `parent-portal` に設定
4. **Environment Variables** に `GAS_STUDENT_API_BASE_URL` を追加（Production にチェック）
5. **Deploy**  
   → 以降、同じブランチへの push で **自動デプロイ**（Vercel 標準の Git 連携）

詳細: [Vercel に Git リポジトリを接続する](https://vercel.com/docs/deployments/git)

## GitHub Actions だけでデプロイしたい場合

リポジトリの **Settings → Secrets and variables → Actions** に次を登録:

| Secret | 取得方法 |
|--------|----------|
| `VERCEL_TOKEN` | [Account Tokens](https://vercel.com/account/tokens) で作成 |
| `VERCEL_ORG_ID` | ローカルで `parent-portal` に移動し `npx vercel link` 後、`.vercel/project.json` の `orgId` |
| `VERCEL_PROJECT_ID` | 同上の `projectId` |
| `GAS_STUDENT_API_BASE_URL` | （任意）ビルド時に渡す用。未設定なら Vercel ダッシュボードの Env のみでも可 |

`main` / `master` へ `parent-portal/` が含まれる push で `.github/workflows/vercel-parent-portal.yml` が動きます。

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
