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
$tables = @("students", "teachers", "payments", "attendance", "courses", "exams", "grades", "publications", "planning")
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
if ($allOk -and $missing.Count -eq 0) {
    Write-Host "[OK] All tables present and readable." -ForegroundColor Green
} elseif ($missing.Count -gt 0) {
    Write-Host ""
}
