# PowerShell script for comprehensive performance profiling
param(
    [string]$TestDir = ".\ingest\go\ibt_files\",
    [int]$Duration = 30
)

Write-Host "Starting comprehensive performance profiling..." -ForegroundColor Green
Write-Host "Test directory: $TestDir" -ForegroundColor Yellow
Write-Host "Duration: $Duration seconds" -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$profileDir = ".\performance-profiles\$timestamp"
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

Write-Host "`nCreated profile directory: $profileDir" -ForegroundColor Yellow

# Change to the Go app directory
Set-Location ".\ingest\go"

# 1. CPU Profile
Write-Host "`n=== Running CPU Profile ===" -ForegroundColor Cyan
$env:CPU_PROFILE = "..\..\$profileDir\cpu.prof"
$cpuStart = Get-Date
& go run cmd/ingest-app/main.go $TestDir
$cpuEnd = Get-Date
$cpuDuration = ($cpuEnd - $cpuStart).TotalSeconds
Write-Host "CPU profile completed in $cpuDuration seconds" -ForegroundColor Green

# 2. Memory Profile
Write-Host "`n=== Running Memory Profile ===" -ForegroundColor Cyan
$env:MEM_PROFILE = "..\..\$profileDir\mem.prof"
$env:CPU_PROFILE = "" # Disable CPU profiling for this run
$memStart = Get-Date
& go run cmd/ingest-app/main.go $TestDir
$memEnd = Get-Date
$memDuration = ($memEnd - $memStart).TotalSeconds
Write-Host "Memory profile completed in $memDuration seconds" -ForegroundColor Green

# 3. pprof server for live profiling
Write-Host "`n=== Running Live pprof Server Profile ===" -ForegroundColor Cyan
Write-Host "Starting pprof server on http://localhost:6060" -ForegroundColor Yellow

$env:ENABLE_PPROF = "true"
$env:MEM_PROFILE = "" # Disable file profiling

# Start the app in background
$job = Start-Job -ScriptBlock {
    param($testDir)
    Set-Location ".\ingest\go"
    $env:ENABLE_PPROF = "true"
    & go run cmd/ingest-app/main.go $testDir
} -ArgumentList $TestDir

# Wait a moment for server to start
Start-Sleep -Seconds 3

# Collect various profiles from the running server
Write-Host "Collecting profiles from running server..." -ForegroundColor Yellow

try {
    # CPU profile (30 seconds)
    Write-Host "- Collecting CPU profile (${Duration}s)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "http://localhost:6060/debug/pprof/profile?seconds=$Duration" -OutFile "$profileDir\live-cpu.prof" -TimeoutSec ($Duration + 10)
    
    # Heap profile
    Write-Host "- Collecting heap profile..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "http://localhost:6060/debug/pprof/heap" -OutFile "$profileDir\heap.prof"
    
    # Goroutine profile
    Write-Host "- Collecting goroutine profile..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "http://localhost:6060/debug/pprof/goroutine" -OutFile "$profileDir\goroutine.prof"
    
    # Block profile
    Write-Host "- Collecting block profile..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "http://localhost:6060/debug/pprof/block" -OutFile "$profileDir\block.prof"
    
    # Mutex profile
    Write-Host "- Collecting mutex profile..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "http://localhost:6060/debug/pprof/mutex" -OutFile "$profileDir\mutex.prof"
    
    # Allocs profile
    Write-Host "- Collecting allocs profile..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "http://localhost:6060/debug/pprof/allocs" -OutFile "$profileDir\allocs.prof"
} catch {
    Write-Host "Warning: Some profiles may not have been collected: $($_.Exception.Message)" -ForegroundColor Orange
} finally {
    # Stop the background job
    Stop-Job -Job $job -PassThru | Remove-Job
}

# 4. Generate reports
Write-Host "`n=== Generating Performance Reports ===" -ForegroundColor Cyan

# Create analysis script
$analysisScript = @"
Write-Host "Performance Analysis Report - Generated $(Get-Date)" -ForegroundColor Green
Write-Host "Profile Directory: $profileDir" -ForegroundColor Yellow

Write-Host "`n=== Available Profiles ===" -ForegroundColor Cyan
Get-ChildItem "$profileDir\*.prof" | ForEach-Object {
    `$size = [math]::Round(`$_.Length / 1KB, 2)
    Write-Host "- `$(`$_.Name): `${size}KB" -ForegroundColor Gray
}

Write-Host "`n=== Analysis Commands ===" -ForegroundColor Cyan
Write-Host "To analyze CPU profile:" -ForegroundColor Yellow
Write-Host "  go tool pprof $profileDir\cpu.prof" -ForegroundColor White
Write-Host "  go tool pprof $profileDir\live-cpu.prof" -ForegroundColor White

Write-Host "`nTo analyze memory profile:" -ForegroundColor Yellow
Write-Host "  go tool pprof $profileDir\mem.prof" -ForegroundColor White
Write-Host "  go tool pprof $profileDir\heap.prof" -ForegroundColor White

Write-Host "`nTo analyze goroutines:" -ForegroundColor Yellow
Write-Host "  go tool pprof $profileDir\goroutine.prof" -ForegroundColor White

Write-Host "`nTo analyze blocking:" -ForegroundColor Yellow
Write-Host "  go tool pprof $profileDir\block.prof" -ForegroundColor White

Write-Host "`n=== Quick Analysis ===" -ForegroundColor Cyan
if (Test-Path "$profileDir\cpu.prof") {
    Write-Host "`nTop CPU consumers:" -ForegroundColor Yellow
    & go tool pprof -text -cum "$profileDir\cpu.prof" | Select-Object -First 15
}

if (Test-Path "$profileDir\mem.prof") {
    Write-Host "`nTop memory consumers:" -ForegroundColor Yellow
    & go tool pprof -text -cum "$profileDir\mem.prof" | Select-Object -First 15
}

Write-Host "`n=== Recommendations ===" -ForegroundColor Cyan
Write-Host "1. Use 'go tool pprof -http=:8080 profile.prof' for web UI analysis" -ForegroundColor Gray
Write-Host "2. Look for high CPU usage in hot paths" -ForegroundColor Gray
Write-Host "3. Check for memory leaks in heap profiles" -ForegroundColor Gray
Write-Host "4. Analyze goroutine counts for concurrency issues" -ForegroundColor Gray
Write-Host "5. Investigate blocking calls that may hurt performance" -ForegroundColor Gray
"@

$analysisScript | Out-File -FilePath "$profileDir\analyze.ps1" -Encoding UTF8

# Run the analysis
& powershell.exe -ExecutionPolicy Bypass -File "$profileDir\analyze.ps1"

Write-Host "`n=== Profiling Complete ===" -ForegroundColor Green
Write-Host "All profiles saved to: $profileDir" -ForegroundColor Yellow
Write-Host "Run the analysis script: $profileDir\analyze.ps1" -ForegroundColor Yellow