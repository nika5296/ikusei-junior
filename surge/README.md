# Surge（静的 HTML / CSS）の公開手順

このフォルダには **画像アセット**（**`kamakura-green-logo.png`**、**`bear-left.png`**（ご提供イラスト**2枚目**）／**`bear-right.png`**（**3枚目**）鎌倉グリーンベア）と、任意の **`styles.css`**、プレビュー用 **`index.html`** があります。

**保護者向けページ本体は Tailwind CSS（CDN）** で描画します。設定シートの **`Surge_スタイルシートURL`**（例: `https://xxx.surge.sh/styles.css`）は **Surge のベースURLを決める用途**（ロゴ・ベアのパス算出）に使います。`styles.css` は空でも構いませんが、デプロイ時にベースURLが確定するよう **`…/styles.css` 形式**を推奨します。

## 前提

- [Node.js](https://nodejs.org/) が入っている（`node -v` で確認）
- [Surge](https://surge.sh/) に無料でサインアップ可能（メールアドレス）

## 手順（コマンド）

プロジェクトのルート（`育成クラス出欠名簿`）で:

```bash
cd surge
npx surge . your-subdomain.surge.sh
```

- `your-subdomain` は **英数字とハイフン**（世界で一意な名前）。例: `ikusei-attendance-v1.surge.sh`
- 初回は `surge` がメール・パスワードを聞くので、Surge アカウントでログイン

公開後、次のURLが使えます。

- スタイルシート: `https://your-subdomain.surge.sh/styles.css`
- ロゴ画像: `https://your-subdomain.surge.sh/kamakura-green-logo.png`（GAS は CSS のURLから自動で参照します）
- プレビューページ: `https://your-subdomain.surge.sh/index.html`（任意）

## Apps Script 側の設定

1. スプレッドシートの **「設定」** シートで **「Surge_スタイルシートURL」** の値を  
   `https://your-subdomain.surge.sh/styles.css`  
   に書き換える（**末尾は `/styles.css`**）。

2. または `Config.gs` の `SURGE_STYLESHEET_URL` を同じURLに書き換える（設定シートが空のときの既定値）。

3. **Web アプリ**を再デプロイ（または新バージョン）して反映。

## CSS を更新したとき

`styles.css` を編集したら、もう一度 `npx surge . your-subdomain.surge.sh` で上書きデプロイ。ブラウザキャッシュで古い見た目になることがあるので、**Ctrl+F5** で再読み込みしてください。
