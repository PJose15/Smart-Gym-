<#
.SYNOPSIS
  Nexera demo environment seeder (DOC_04). Windows / PowerShell.

.DESCRIPTION
  DESTRUCTIVE: runs `supabase db reset` (wipes ALL local data, reapplies all
  migrations + supabase/seed.sql), then loads supabase/seed-bulk.sql, then
  prints the manual auth step and runs the verification query.

.EXAMPLE
  .\scripts\seed-demo.ps1 -Confirm:$true
  .\scripts\seed-demo.ps1 -Confirm:$true -WithAuth        # also run seed-auth.sql via psql (local only)
  .\scripts\seed-demo.ps1 -Confirm:$true -SkipReset       # keep DB, just (re)apply the bulk seed
#>
[CmdletBinding()]
param(
  [switch]$Confirm,
  [switch]$WithAuth,
  [switch]$SkipReset,
  [string]$DbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host ""
Write-Host "  ##############################################################" -ForegroundColor Red
Write-Host "  ##                                                          ##" -ForegroundColor Red
Write-Host "  ##   !!  WARNING: 'supabase db reset' DESTROYS ALL DATA  !!   ##" -ForegroundColor Red
Write-Host "  ##                                                          ##" -ForegroundColor Red
Write-Host "  ##   Every table in the LOCAL database will be wiped and    ##" -ForegroundColor Red
Write-Host "  ##   rebuilt from migrations + seed files.                  ##" -ForegroundColor Red
Write-Host "  ##   NEVER run this against a production database.          ##" -ForegroundColor Red
Write-Host "  ##                                                          ##" -ForegroundColor Red
Write-Host "  ##############################################################" -ForegroundColor Red
Write-Host ""

if (-not $Confirm) {
  Write-Host "Refusing to run without explicit confirmation." -ForegroundColor Yellow
  Write-Host "Re-run with:  .\scripts\seed-demo.ps1 -Confirm:`$true" -ForegroundColor Yellow
  exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Host "psql not found on PATH. Install PostgreSQL client tools first." -ForegroundColor Red
  exit 1
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Host "supabase CLI not found on PATH." -ForegroundColor Red
  exit 1
}

# -- Step 1: reset (migrations + basic seed: feature flags, achievements, tips)
if ($SkipReset) {
  Write-Host "[1/4] Skipping 'supabase db reset' (-SkipReset)" -ForegroundColor DarkYellow
} else {
  Write-Host "[1/4] supabase db reset (migrations + supabase/seed.sql)..." -ForegroundColor Cyan
  supabase db reset
  if ($LASTEXITCODE -ne 0) { Write-Host "supabase db reset failed." -ForegroundColor Red; exit 1 }
}

# -- Step 2: bulk demo seed
Write-Host "[2/4] Applying supabase/seed-bulk.sql (Iron Society demo data)..." -ForegroundColor Cyan
psql $DbUrl -v ON_ERROR_STOP=1 -f "supabase/seed-bulk.sql"
if ($LASTEXITCODE -ne 0) { Write-Host "seed-bulk.sql failed." -ForegroundColor Red; exit 1 }

# -- Step 3: auth users (manual, or -WithAuth on local)
if ($WithAuth) {
  Write-Host "[3/4] Applying supabase/seed-auth.sql via psql (local superuser)..." -ForegroundColor Cyan
  psql $DbUrl -v ON_ERROR_STOP=1 -f "supabase/seed-auth.sql"
  if ($LASTEXITCODE -ne 0) { Write-Host "seed-auth.sql failed - run it manually in the SQL Editor." -ForegroundColor Red; exit 1 }
} else {
  Write-Host "[3/4] MANUAL STEP - create demo auth users:" -ForegroundColor Yellow
  Write-Host "      Open the Supabase SQL Editor (local Studio: http://127.0.0.1:54323)" -ForegroundColor Yellow
  Write-Host "      and run the contents of:  supabase/seed-auth.sql" -ForegroundColor Yellow
  Write-Host "      (or re-run this script with -WithAuth to do it via psql locally)" -ForegroundColor Yellow
}

# -- Step 4: verification
Write-Host "[4/4] Verifying demo state..." -ForegroundColor Cyan
psql $DbUrl -c @"
SELECT
  (SELECT COUNT(*) FROM public.members          WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND id::text LIKE '00000000-0000-0000-0001-%') AS members,
  (SELECT COUNT(*) FROM public.machines         WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS machines,
  (SELECT COUNT(*) FROM public.workout_sessions WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS sessions,
  (SELECT COUNT(*) FROM public.gym_feed_events  WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS feed_events,
  (SELECT COUNT(*) FROM public.gym_challenges   WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS challenges,
  (SELECT COUNT(*) FROM public.weekly_checkins  WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS checkins;
"@

Write-Host ""
Write-Host "Expected: members=50, machines=20, sessions=600+, feed_events=200+, challenges=6, checkins=40+" -ForegroundColor Green
Write-Host "Demo logins: owner@ironsociety.com / alex@ironsociety.com / admin@nexera.io (see supabase/seed-auth.sql)" -ForegroundColor Green
Write-Host "Member demo: phone +17875550003 (Carlos). Machine scan page: /m/chest-press" -ForegroundColor Green
Write-Host "Full guide: DEMO_SETUP.md" -ForegroundColor Green
