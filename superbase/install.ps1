<#
  supabase-setup.ps1
  Run this from the root of your React (Vite) project — same folder as package.json.
  It creates .env and utils/supabase.ts, then reminds you to restart the dev server.
  Step 1 (npm install @supabase/supabase-js) is assumed already done.
#>

param(
    [string]$SupabaseUrl,
    [string]$SupabaseKey
)

# Confirm we're in a project folder
if (-not (Test-Path ".\package.json")) {
    Write-Host "package.json not found here. Run this script from your project's root folder." -ForegroundColor Red
    exit 1
}

# Ask for credentials if not passed in as parameters
if (-not $SupabaseUrl) {
    $SupabaseUrl = Read-Host "Paste your Supabase Project URL (VITE_SUPABASE_URL)"
}
if (-not $SupabaseKey) {
    $SupabaseKey = Read-Host "Paste your Supabase Publishable Key (VITE_SUPABASE_PUBLISHABLE_KEY)"
}

# --- Step 2: write/append .env ---
$envPath = ".\.env"
$envLines = @(
    "VITE_SUPABASE_URL=$SupabaseUrl"
    "VITE_SUPABASE_PUBLISHABLE_KEY=$SupabaseKey"
)

if (Test-Path $envPath) {
    $existing = Get-Content $envPath -Raw
    if ($existing -notmatch "VITE_SUPABASE_URL") {
        Add-Content -Path $envPath -Value ($envLines -join "`n")
        Write-Host "Appended Supabase variables to existing .env" -ForegroundColor Green
    } else {
        Write-Host ".env already has VITE_SUPABASE_URL — leaving it untouched. Edit it by hand if the values changed." -ForegroundColor Yellow
    }
} else {
    Set-Content -Path $envPath -Value ($envLines -join "`n")
    Write-Host "Created .env with your Supabase credentials" -ForegroundColor Green
}

# --- Step 3: create utils/supabase.ts ---
$utilsDir = ".\utils"
if (-not (Test-Path $utilsDir)) {
    New-Item -ItemType Directory -Path $utilsDir | Out-Null
}

$clientFile = Join-Path $utilsDir "supabase.ts"
$clientContent = @"
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
"@

if (Test-Path $clientFile) {
    Write-Host "utils/supabase.ts already exists — leaving it untouched." -ForegroundColor Yellow
} else {
    Set-Content -Path $clientFile -Value $clientContent
    Write-Host "Created utils/supabase.ts" -ForegroundColor Green
}

# --- Reminder ---
Write-Host ""
Write-Host "Done. Now restart your dev server so Vite picks up the new .env:" -ForegroundColor Cyan
Write-Host "    npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Import the client anywhere with: import { supabase } from '../utils/supabase'" -ForegroundColor Cyan