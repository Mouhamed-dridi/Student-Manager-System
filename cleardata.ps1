<#
  clear-local-data.ps1
  Launches Chrome (or reuses a debug-mode Chrome already running),
  finds the tab for your app, and runs localStorage.clear() in it
  remotely via Chrome DevTools Protocol.

  Usage:
    .\clear-local-data.ps1
    .\clear-local-data.ps1 -Url "http://localhost:5173"
    .\clear-local-data.ps1 -BrowserPath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
#>

param(
    [string]$Url = "http://localhost:5173",
    [string]$BrowserPath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    [int]$DebugPort = 9222
)

$debugUrl = "http://localhost:$DebugPort/json"

# --- Step 1: connect to an existing debug-mode browser, or launch one ---
try {
    $targets = Invoke-RestMethod -Uri $debugUrl -TimeoutSec 2
    Write-Host "Found an already-running debug-mode browser." -ForegroundColor Gray
} catch {
    if (-not (Test-Path $BrowserPath)) {
        Write-Host "[FAIL] Browser not found at: $BrowserPath" -ForegroundColor Red
        Write-Host "       Pass -BrowserPath pointing to your Chrome or Edge .exe" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Launching browser in debug mode..." -ForegroundColor Cyan
    Start-Process -FilePath $BrowserPath -ArgumentList "--remote-debugging-port=$DebugPort", $Url
    Start-Sleep -Seconds 3
    try {
        $targets = Invoke-RestMethod -Uri $debugUrl -TimeoutSec 5
    } catch {
        Write-Host "[FAIL] Could not connect to the browser's debug port." -ForegroundColor Red
        exit 1
    }
}

# --- Step 2: find the tab for our app ---
$target = $targets | Where-Object { $_.url -like "$Url*" } | Select-Object -First 1
if (-not $target) {
    Write-Host "[FAIL] No open tab found for $Url" -ForegroundColor Red
    Write-Host "       Open $Url in the browser window that was just launched, then re-run this script." -ForegroundColor Yellow
    exit 1
}

# --- Step 3: connect via WebSocket and run localStorage.clear() ---
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, $cts.Token).GetAwaiter().GetResult()

$payload = @{
    id     = 1
    method = "Runtime.evaluate"
    params = @{ expression = "localStorage.clear(); 'cleared'" }
} | ConvertTo-Json -Compress

$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$sendSegment = New-Object System.ArraySegment[byte] (, $bytes)
$ws.SendAsync($sendSegment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).GetAwaiter().GetResult() | Out-Null

$buffer = New-Object byte[] 4096
$recvSegment = New-Object System.ArraySegment[byte] (, $buffer)
$result = $ws.ReceiveAsync($recvSegment, $cts.Token).GetAwaiter().GetResult()
$response = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $cts.Token).GetAwaiter().GetResult() | Out-Null

if ($response -match "cleared") {
    Write-Host "[OK] localStorage cleared for $Url" -ForegroundColor Green
} else {
    Write-Host "[WARN] Ran, but response looked unexpected:" -ForegroundColor Yellow
    Write-Host $response -ForegroundColor Gray
}

Write-Host "Refresh that tab to see the change take effect." -ForegroundColor Cyan