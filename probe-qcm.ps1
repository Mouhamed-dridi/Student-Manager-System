$ErrorActionPreference = "Continue"

$envContent = Get-Content (Join-Path $PSScriptRoot ".env.local") | Where-Object { $_ -match "^[^#]" -and $_ -match "=" }
$env = @{}
foreach ($line in $envContent) { $k,$v = $line -split "=",2; $env[$k.Trim()] = $v.Trim() }
Write-Host "keys present in .env.local: $(($env.Keys) -join ', ')" -ForegroundColor DarkGray
$base = $env["VITE_SUPABASE_URL"]; $key = $env["VITE_SUPABASE_PUBLISHABLE_KEY"]
$restBase = "$base/rest/v1/"

function Col($table, $c) {
    try {
        $null = Invoke-RestMethod -Uri "$restBase$table`?select=$c&limit=1" -Headers @{apikey=$key; Authorization="Bearer $key"} -TimeoutSec 10
        return "OK"
    } catch {
        $detail = ""
        try { $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $detail = $sr.ReadToEnd() } catch {}
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return "HTTP $code $detail"
    }
}

$expect = @{
    quizzes = @("id","teacher_id","title","description","course_id","questions","is_published","is_deleted","deleted_at","created_at","updated_at")
    quiz_responses = @("id","quiz_id","student_id","answers","score","created_at")
}

foreach ($t in $expect.Keys) {
    Write-Host "`n=== $t ===" -ForegroundColor Cyan
    foreach ($c in $expect[$t]) {
        $r = Col $t $c
        if ($r -eq "OK") { Write-Host ("  {0,-14} OK" -f $c) -ForegroundColor Green }
        else { Write-Host ("  {0,-14} {1}" -f $c, $r) -ForegroundColor Red }
    }
}

Write-Host "`n=== write probe per table ===" -ForegroundColor Cyan
function W($table, $body) {
    $h = @{ apikey=$key; Authorization="Bearer $key"; "Content-Type"="application/json"; Prefer="return=representation" }
    try {
        $r = Invoke-RestMethod -Uri "$restBase$table" -Method Post -Headers $h -Body $body -TimeoutSec 15
        return @{ ok=$true; row=$r[0] }
    } catch {
        $detail = ""
        try { $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $detail = $sr.ReadToEnd() } catch {}
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return @{ ok=$false; code=$code; detail=$detail }
    }
}

$q = W "quizzes" (@{ teacher_id="00000000-0000-0000-0000-000000000001"; title="__probe__"; questions=@() } | ConvertTo-Json -Depth 5)
if ($q.ok) {
    Write-Host "[OK] quizzes insert" -ForegroundColor Green
    Write-Host "  returned columns: $($q.row.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
    $null = Invoke-RestMethod -Uri "$restBase`quizzes?id=eq.$($q.row.id)" -Method Delete -Headers @{apikey=$key;Authorization="Bearer $key"} -TimeoutSec 10
} else { Write-Host "[FAIL] HTTP $($q.code) $($q.detail)" -ForegroundColor Red }

# Control on a table the app is known to write to.
$c = W "course_reviews" (@{ course_id="00000000-0000-0000-0000-000000000001"; student_name="__probe__"; rating=5; comment="probe" } | ConvertTo-Json -Depth 5)
if ($c.ok) {
    Write-Host "[OK] course_reviews insert (control) -> $($c.row.PSObject.Properties.Name -join ', ')" -ForegroundColor Green
    $null = Invoke-RestMethod -Uri "$restBase`course_reviews?id=eq.$($c.row.id)" -Method Delete -Headers @{apikey=$key;Authorization="Bearer $key"} -TimeoutSec 10
} else { Write-Host "[FAIL] control HTTP $($c.code) $($c.detail)" -ForegroundColor Red }

Write-Host ""
