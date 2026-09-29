# ============================================================================
# check.ps1 — Verify Supabase connectivity and table health
# Run from the project root: .\check.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

# --- Load .env.local --------------------------------------------------------
$envFile = Join-Path $PSScriptRoot ".env.local"
if (!(Test-Path $envFile)) {
    Write-Host "[FAIL] .env.local not found. Copy .env.example to .env.local first." -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile | Where-Object { $_ -match "^[^#]" -and $_ -match "=" }
$env = @{}
foreach ($line in $envContent) {
    $key, $value = $line -split "=", 2
    $env[$key.Trim()] = $value.Trim()
}

$baseUrl = $env["VITE_SUPABASE_URL"]
$publishableKey = $env["VITE_SUPABASE_PUBLISHABLE_KEY"]
if (-not $baseUrl) { $baseUrl = $env["VITE_SUPABASE_URL"] }

if (-not $baseUrl -or -not $publishableKey) {
    Write-Host "[FAIL] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local" -ForegroundColor Red
    exit 1
}

$headers = @{
    "apikey"       = $publishableKey
    "Authorization" = "Bearer $publishableKey"
}

$restBase = "$baseUrl/rest/v1/"
$allOk = $true

# --- 1. Basic connectivity ---------------------------------------------------
Write-Host "`n=== Connectivity ===" -ForegroundColor Cyan
try {
    $resp = Invoke-RestMethod -Uri "${restBase}students?select=*&limit=1" -Headers $headers -TimeoutSec 10
    Write-Host "[OK] REST API reachable at $baseUrl" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Cannot reach REST API: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# --- 2. Table existence check ------------------------------------------------
Write-Host "`n=== Table Check ===" -ForegroundColor Cyan
$tables = @("students", "teachers", "payments", "attendance", "courses", "exams", "grades", "publications", "planning", "quizzes", "quiz_responses")
$missing = @()

foreach ($t in $tables) {
    try {
        $r = Invoke-RestMethod -Uri "${restBase}${t}?select=*&limit=1" -Headers $headers -TimeoutSec 8
        Write-Host "[OK]   $t" -ForegroundColor Green
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        Write-Host "[MISS] $t (HTTP $code)" -ForegroundColor Red
        $missing += $t
        $allOk = $false
    }
}

# --- 3. Row counts -----------------------------------------------------------
if ($missing.Count -lt $tables.Count) {
    Write-Host "`n=== Row Counts ===" -ForegroundColor Cyan
    foreach ($t in $tables) {
        if ($t -in $missing) { continue }
        try {
            $r = Invoke-RestMethod -Uri "${restBase}${t}?select=*" -Headers $headers -TimeoutSec 8
            $count = if ($r -is [array]) { $r.Count } else { 1 }
            Write-Host "  $t : $count rows" -ForegroundColor Gray
        } catch {
            Write-Host "  $t : count failed" -ForegroundColor DarkYellow
        }
    }
}

# --- 4. RLS check: can anon read data? --------------------------------------
Write-Host "`n=== RLS (anon read) ===" -ForegroundColor Cyan
foreach ($t in $tables) {
    if ($t -in $missing) { continue }
    try {
        $r = Invoke-RestMethod -Uri "${restBase}${t}?select=*&limit=1" -Headers $headers -TimeoutSec 8
        Write-Host "[OK]   $t readable by anon" -ForegroundColor Green
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 403) {
            Write-Host "[FAIL] $t blocked by RLS (HTTP 403)" -ForegroundColor Red
        } else {
            Write-Host "[WARN] $t returned HTTP $code" -ForegroundColor DarkYellow
        }
        $allOk = $false
    }
}

# --- 4b. QCM columns ---------------------------------------------------------
# A table can exist and still be behind schema.sql: the live quizzes table was
# created without course_id/is_deleted/deleted_at/updated_at, which every query
# would then reject with 42703. Probing `select=*` on an empty table proves
# nothing, so ask for the named columns and report each 400.
Write-Host "`n=== QCM columns ===" -ForegroundColor Cyan
$qcmCols = @{
    "quizzes"        = @("id","teacher_id","title","description","course_id","questions","is_published","is_deleted","deleted_at","created_at","updated_at")
    "quiz_responses" = @("id","quiz_id","student_id","answers","score","created_at")
}
$qcmMissing = @()
foreach ($t in $qcmCols.Keys) {
    if ($t -in $missing) { continue }
    $missedHere = @()
    foreach ($c in $qcmCols[$t]) {
        try {
            $null = Invoke-RestMethod -Uri "${restBase}${t}?select=$c&limit=1" -Headers $headers -TimeoutSec 8
        } catch {
            Write-Host "[MISS] $t.$c" -ForegroundColor Red
            $missedHere += "$t.$c"
            $qcmMissing += "$t.$c"
            $allOk = $false
        }
    }
    if ($missedHere.Count -eq 0) {
        Write-Host "[OK]   $t has every expected column" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $t is missing $($missedHere.Count) column(s)" -ForegroundColor Red
    }
}

# --- 4c. QCM write access ----------------------------------------------------
# RLS policies for these two tables were never created on the live project, so
# reads worked while every write died with 42501. A throwaway row proves it.
Write-Host "`n=== QCM write (anon insert) ===" -ForegroundColor Cyan
if (-not ($qcmMissing.Count -gt 0)) {
    try {
        $probeBody = @{
            teacher_id = "00000000-0000-0000-0000-000000000001"
            title      = "__check_probe__"
            questions  = @()
        } | ConvertTo-Json -Depth 5
        $writeHeaders = $headers.Clone()
        $writeHeaders["Prefer"] = "return=representation"
        $writeHeaders["Content-Type"] = "application/json"
        $ins = Invoke-RestMethod -Uri "${restBase}quizzes" -Method Post -Headers $writeHeaders -Body $probeBody -TimeoutSec 10
        Write-Host "[OK]   anon insert into quizzes allowed" -ForegroundColor Green
        $null = Invoke-RestMethod -Uri "${restBase}quizzes?id=eq.$($ins[0].id)" -Method Delete -Headers $headers -TimeoutSec 10
        Write-Host "[OK]   probe row cleaned up" -ForegroundColor DarkGray
    } catch {
        $detail = ""
        try {
            $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $detail = $sr.ReadToEnd()
        } catch {}
        Write-Host "[FAIL] anon insert into quizzes rejected: $detail" -ForegroundColor Red
        Write-Host "       The _anon_all RLS policy is missing. Run supabase/qcm-migration.sql." -ForegroundColor Yellow
        $allOk = $false
    }
}

# --- 5. Secret key check (optional) ------------------------------------------
Write-Host "`n=== Secret Key ===" -ForegroundColor Cyan
$secretKey = $env["SUPABASE_SECRET_KEY"]
if ($secretKey) {
    $secretHeaders = @{
        "apikey"       = $secretKey
        "Authorization" = "Bearer $secretKey"
    }
    try {
        $r = Invoke-RestMethod -Uri "${restBase}students?select=*&limit=1" -Headers $secretHeaders -TimeoutSec 10
        Write-Host "[OK] Secret key accepted" -ForegroundColor Green
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        Write-Host "[FAIL] Secret key rejected (HTTP $code)" -ForegroundColor Red
        Write-Host "       The sb_secret_ key may be invalid or not matched to this project." -ForegroundColor DarkGray
        $allOk = $false
    }
} else {
    Write-Host "[SKIP] No SUPABASE_SECRET_KEY in .env.local (optional)" -ForegroundColor DarkGray
}

# --- Summary -----------------------------------------------------------------
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($missing.Count -gt 0) {
    Write-Host "[ISSUE] $($missing.Count) table(s) missing from database:" -ForegroundColor Red
    foreach ($m in $missing) { Write-Host "        - $m" -ForegroundColor Red }
    Write-Host "`n  Fix: Paste the full supabase/schema.sql into Supabase SQL Editor and run it." -ForegroundColor Yellow
}
if ($qcmMissing.Count -gt 0) {
    Write-Host "[ISSUE] $($qcmMissing.Count) QCM column(s) missing:" -ForegroundColor Red
    foreach ($c in $qcmMissing) { Write-Host "        - $c" -ForegroundColor Red }
    Write-Host "        Fix: run supabase/qcm-migration.sql in the Supabase SQL Editor." -ForegroundColor Yellow
}
if ($allOk -and $missing.Count -eq 0) {
    Write-Host "[OK] All tables present and readable." -ForegroundColor Green
} elseif ($missing.Count -gt 0) {
    Write-Host ""
}
