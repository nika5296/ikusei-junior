#Requires -Version 5.1
<#
  parent-portal を Vercel 本番にデプロイ（非対話）。
  通常は Vercel の「Git 連携」で GitHub に push すれば自動デプロイされるため、このスクリプトは任意。

  事前: https://vercel.com/account/tokens で Token を発行し、環境変数 VERCEL_TOKEN に設定。
  初回のみ: parent-portal で `npx vercel link` を実行し、.vercel/project.json の orgId / projectId を控える
    → GitHub Actions の手動デプロイ用に Secrets に VERCEL_ORG_ID / VERCEL_PROJECT_ID として登録する場合あり。

  使用例:
    $env:VERCEL_TOKEN = "xxxxxxxx"
    .\tools\Deploy-VercelParentPortal.ps1

  任意: GAS の exec URL（ビルド時は不要だが CLI が聞く場合用）
    $env:GAS_STUDENT_API_BASE_URL = "https://script.google.com/macros/s/.../exec"
#>
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pp = Join-Path $root "parent-portal"

if (-not $env:VERCEL_TOKEN -or -not $env:VERCEL_TOKEN.Trim()) {
  throw @"
VERCEL_TOKEN が未設定です。

1. ブラウザで https://vercel.com/account/tokens を開き、Create を押してトークンをコピー
2. PowerShell で:
   `$env:VERCEL_TOKEN = '（貼り付け）'`
3. 再度このスクリプトを実行
"@
}

Push-Location $pp
try {
  npx --yes vercel@latest deploy --prod --yes --token $env:VERCEL_TOKEN.Trim()
  if ($LASTEXITCODE -ne 0) { throw "vercel deploy failed (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done. Vercel ダッシュボードで Production に GAS_STUDENT_API_BASE_URL を設定し、必要なら Redeploy してください。" -ForegroundColor Cyan
