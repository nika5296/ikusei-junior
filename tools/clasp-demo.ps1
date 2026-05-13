#Requires -Version 5.1
<#
  Demo Apps Script target for clasp only:
  - Reads .clasp.demo.json (scriptId). Validates before touching .clasp.json.
  - Temporarily swaps .clasp.json, clasp push --force, restores parent.
  - With -Deploy: clasp version + clasp deploy. Loads deploymentId from:
      - parameter -DeploymentId, else .clasp.demo.deployment.json
      First deploy without saved ID creates deployment and saves AKfy... to .clasp.demo.deployment.json

  YOU MUST SET ONCE: scriptId in .clasp.demo.json (Apps Script > Project Settings).

  Usage:
    .\tools\clasp-demo.ps1
    .\tools\clasp-demo.ps1 -Deploy
    .\tools\clasp-demo.ps1 -Deploy -DeploymentId AKfy...
#>
param(
  [switch]$Deploy,
  [string]$DeploymentId = "",
  [string]$Description = "demo clasp"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DemoConfig = Join-Path $ProjectRoot ".clasp.demo.json"
$MainConfig = Join-Path $ProjectRoot ".clasp.json"
$BackupConfig = Join-Path $ProjectRoot ".clasp.json.__parent_backup__"
$DeployStatePath = Join-Path $ProjectRoot ".clasp.demo.deployment.json"

function Get-DemoScriptId {
  if (-not (Test-Path $DemoConfig)) {
    throw "Missing .clasp.demo.json. Copy .clasp.demo.json.example to .clasp.demo.json"
  }
  $raw = Get-Content -LiteralPath $DemoConfig -Raw -Encoding UTF8
  $j = $raw | ConvertFrom-Json
  if (-not $j.scriptId) { throw ".clasp.demo.json: missing scriptId" }
  $sid = [string]$j.scriptId.Trim()
  $badTokens = @("PASTE_", "_HERE", "REPLACE", "your-", "YOUR_", "example")
  foreach ($t in $badTokens) {
    if ($sid.ToUpperInvariant().Contains($t.ToUpperInvariant())) {
      throw @"
.clasp.demo.json scriptId is still a placeholder.

Do this once (cannot be automated without your Google account):
  1. Open the DEMO spreadsheet > Extensions > Apps Script
  2. Gear icon > Project Settings > copy "Script ID"
  3. Paste into .clasp.demo.json as scriptId

Then run this script again.
"@
    }
  }
  if ($sid.Length -lt 25) {
    throw ".clasp.demo.json: scriptId looks too short. Paste full Script ID from Project Settings."
  }
  return $sid
}

function Save-DeploymentId([string]$Id) {
  $obj = [ordered]@{ deploymentId = $Id; savedAt = (Get-Date).ToString("s") }
  $obj | ConvertTo-Json | Set-Content -LiteralPath $DeployStatePath -Encoding UTF8
  Write-Host ">>> Saved deploymentId to .clasp.demo.deployment.json (gitignored)" -ForegroundColor Green
}

# Validate demo config BEFORE swapping parent clasp.json
$null = Get-DemoScriptId

if (-not (Test-Path $MainConfig)) {
  throw "Missing .clasp.json"
}

Copy-Item -LiteralPath $MainConfig -Destination $BackupConfig -Force
try {
  Copy-Item -LiteralPath $DemoConfig -Destination $MainConfig -Force
  Write-Host ">>> Using demo scriptId; parent .clasp.json restored on exit." -ForegroundColor Cyan

  Push-Location $ProjectRoot
  try {
    clasp push --force
    if ($LASTEXITCODE -ne 0) { throw "clasp push failed (exit $LASTEXITCODE). Try: clasp login" }

    if ($Deploy) {
      $verLines = clasp version $Description 2>&1 | ForEach-Object { "$_" }
      if ($LASTEXITCODE -ne 0) {
        throw "clasp version failed:`n$( $verLines -join "`n" )"
      }
      $verText = $verLines -join "`n"
      if ($verText -notmatch 'Created version\s+(\d+)') {
        throw "Could not parse version from:`n$verText"
      }
      $verNum = $Matches[1]
      Write-Host ">>> version $verNum" -ForegroundColor Cyan

      $depId = $DeploymentId.Trim()
      if (-not $depId -and (Test-Path $DeployStatePath)) {
        $dj = (Get-Content -LiteralPath $DeployStatePath -Raw -Encoding UTF8 | ConvertFrom-Json)
        if ($dj.deploymentId) { $depId = [string]$dj.deploymentId.Trim() }
      }

      if ($depId) {
        Write-Host ">>> clasp deploy (existing deployment $depId)" -ForegroundColor Cyan
        $deployLines = clasp deploy --deploymentId $depId --versionNumber $verNum --description $Description 2>&1 | ForEach-Object { "$_" }
      } else {
        Write-Host ">>> clasp deploy (first time: new deployment)" -ForegroundColor Cyan
        $deployLines = clasp deploy --versionNumber $verNum --description $Description 2>&1 | ForEach-Object { "$_" }
      }
      if ($LASTEXITCODE -ne 0) {
        throw "clasp deploy failed (exit $LASTEXITCODE):`n$( $deployLines -join "`n" )"
      }
      $deployText = $deployLines -join "`n"
      if ($deployText -match 'Deployed\s+(AKfy[^\s]+)') {
        $foundId = $Matches[1]
        if (-not $depId -or $depId -ne $foundId) {
          Save-DeploymentId $foundId
        }
      } elseif (-not $depId) {
        Write-Host "WARN: Could not parse deployment ID from clasp output. Save web app URL from Apps Script Deploy UI." -ForegroundColor Yellow
      }

      $execId = ""
      if ($deployText -match 'Deployed\s+(AKfy[^\s]+)') { $execId = $Matches[1] }
      elseif ($depId) { $execId = $depId }
      elseif (Test-Path $DeployStatePath) {
        $djx = Get-Content -LiteralPath $DeployStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($djx.deploymentId) { $execId = [string]$djx.deploymentId.Trim() }
      }
      if ($execId) {
        Write-Host ""
        Write-Host ">>> CANONICAL exec URL (paste once in Sheet menu: Ikusei > exec URL registration):" -ForegroundColor Yellow
        Write-Host ("https://script.google.com/macros/s/{0}/exec" -f $execId)
      }
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  if (Test-Path $BackupConfig) {
    Copy-Item -LiteralPath $BackupConfig -Destination $MainConfig -Force
    Remove-Item -LiteralPath $BackupConfig -Force
    Write-Host ">>> Restored parent .clasp.json" -ForegroundColor Green
  }
}

Write-Host "Done." -ForegroundColor Green
