# Push the notes sign-in secrets to the Cloudflare Worker, then (optionally) deploy.
#
#   powershell -ExecutionPolicy Bypass -File scripts\notes-secrets.ps1 -Deploy
#
# Reads GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and NOTES_AUTH_SECRET from
# .dev.vars (git-ignored) and sends them in ONE `wrangler secret bulk` call, piped
# on stdin: nothing is printed, written to a temp file, or typed. Re-run after
# rotating any of them. docs/NOTES.md.
param([switch]$Deploy)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$keys = 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NOTES_AUTH_SECRET'
if (-not (Test-Path .dev.vars)) { throw '.dev.vars not found in the repo root.' }

$vals = @{}
foreach ($line in Get-Content .dev.vars) {
  if ($line -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$' -and $keys -contains $Matches[1]) {
    $vals[$Matches[1]] = $Matches[2].Trim('"')
  }
}
$missing = $keys | Where-Object { -not $vals[$_] }
if ($missing) { throw "Missing in .dev.vars: $($missing -join ', ')" }
if ($vals['NOTES_AUTH_SECRET'].Length -lt 32) { throw 'NOTES_AUTH_SECRET must be 32+ characters.' }

Write-Host '> wrangler whoami' -ForegroundColor Cyan
npx wrangler whoami
if ($LASTEXITCODE -ne 0) { throw 'Not logged in to Cloudflare: run `npx wrangler login` first.' }

Write-Host "> wrangler secret bulk ($($keys -join ', '))" -ForegroundColor Cyan
($vals | ConvertTo-Json -Compress) | npx wrangler secret bulk
if ($LASTEXITCODE -ne 0) { throw 'wrangler secret bulk failed.' }

if ($Deploy) {
  Write-Host '> npm run deploy' -ForegroundColor Cyan
  npm run deploy
  if ($LASTEXITCODE -ne 0) { throw 'npm run deploy failed.' }
}
Write-Host 'Done.' -ForegroundColor Green
