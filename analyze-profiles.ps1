# PowerShell script for analyzing performance profiles
param(
    [string]$ProfileDir = ""
)

if ($ProfileDir -eq "") {
    # Find the most recent profile directory
    $ProfileDir = Get-ChildItem ".\performance-profiles\" -Directory | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
    if (-not $ProfileDir) {
        Write-Host "No profile directories found. Run profile-performance.ps1 first." -ForegroundColor Red
        exit 1
    }
    Write-Host "Using most recent profile directory: $ProfileDir" -ForegroundColor Yellow
}

Write-Host "Analyzing profiles in: $ProfileDir" -ForegroundColor Green

# Function to analyze a profile file
function Analyze-Profile {
    param($ProfileFile, $ProfileType)
    
    if (Test-Path $ProfileFile) {
        Write-Host "`n=== $ProfileType Analysis ===" -ForegroundColor Cyan
        Write-Host "File: $ProfileFile" -ForegroundColor Gray
        
        # Get file size
        $size = [math]::Round((Get-Item $ProfileFile).Length / 1KB, 2)
        Write-Host "Size: ${size}KB" -ForegroundColor Gray
        
        Write-Host "`nTop functions by cumulative time/allocations:" -ForegroundColor Yellow
        try {
            $output = & go tool pprof -text -cum $ProfileFile 2>&1 | Select-Object -First 20
            $output | ForEach-Object { Write-Host $_ -ForegroundColor White }
        } catch {
            Write-Host "Could not analyze profile: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        Write-Host "`nTo open web interface:" -ForegroundColor Yellow
        Write-Host "  go tool pprof -http=:8080 `"$ProfileFile`"" -ForegroundColor Cyan
    } else {
        Write-Host "`n=== $ProfileType Analysis ===" -ForegroundColor Cyan
        Write-Host "Profile not found: $ProfileFile" -ForegroundColor Red
    }
}

# Analyze each profile type
Analyze-Profile "$ProfileDir\cpu.prof" "CPU Profile (File-based)"
Analyze-Profile "$ProfileDir\live-cpu.prof" "CPU Profile (Live)"
Analyze-Profile "$ProfileDir\mem.prof" "Memory Profile (File-based)"
Analyze-Profile "$ProfileDir\heap.prof" "Heap Profile (Live)"
Analyze-Profile "$ProfileDir\goroutine.prof" "Goroutine Profile"
Analyze-Profile "$ProfileDir\block.prof" "Blocking Profile"
Analyze-Profile "$ProfileDir\mutex.prof" "Mutex Profile"
Analyze-Profile "$ProfileDir\allocs.prof" "Allocations Profile"

# Generate summary report
Write-Host "`n=== Performance Summary ===" -ForegroundColor Green

$profiles = @(
    @{Name="CPU (File)"; File="$ProfileDir\cpu.prof"},
    @{Name="CPU (Live)"; File="$ProfileDir\live-cpu.prof"},
    @{Name="Memory"; File="$ProfileDir\mem.prof"},
    @{Name="Heap"; File="$ProfileDir\heap.prof"},
    @{Name="Goroutines"; File="$ProfileDir\goroutine.prof"},
    @{Name="Blocking"; File="$ProfileDir\block.prof"},
    @{Name="Mutex"; File="$ProfileDir\mutex.prof"},
    @{Name="Allocations"; File="$ProfileDir\allocs.prof"}
)

Write-Host "`nProfile Files Status:" -ForegroundColor Yellow
foreach ($profile in $profiles) {
    if (Test-Path $profile.File) {
        $size = [math]::Round((Get-Item $profile.File).Length / 1KB, 2)
        Write-Host "✓ $($profile.Name): ${size}KB" -ForegroundColor Green
    } else {
        Write-Host "✗ $($profile.Name): Not found" -ForegroundColor Red
    }
}

Write-Host "`n=== Optimization Recommendations ===" -ForegroundColor Green

Write-Host "`n1. CPU Optimization:" -ForegroundColor Yellow
Write-Host "   - Look for functions with high cumulative CPU time" -ForegroundColor Gray
Write-Host "   - Focus on hot paths in file processing" -ForegroundColor Gray
Write-Host "   - Check for inefficient loops or algorithms" -ForegroundColor Gray

Write-Host "`n2. Memory Optimization:" -ForegroundColor Yellow
Write-Host "   - Identify functions allocating large amounts of memory" -ForegroundColor Gray
Write-Host "   - Look for memory leaks in long-running goroutines" -ForegroundColor Gray
Write-Host "   - Consider object pooling for frequently allocated objects" -ForegroundColor Gray

Write-Host "`n3. Concurrency Optimization:" -ForegroundColor Yellow
Write-Host "   - Check goroutine count for appropriate parallelism" -ForegroundColor Gray
Write-Host "   - Analyze blocking operations that might limit throughput" -ForegroundColor Gray
Write-Host "   - Look for mutex contention in shared resources" -ForegroundColor Gray

Write-Host "`n=== Next Steps ===" -ForegroundColor Green
Write-Host "1. Open profiles in web UI: go tool pprof -http=:8080 <profile-file>" -ForegroundColor Cyan
Write-Host "2. Compare before/after profiles when making optimizations" -ForegroundColor Cyan
Write-Host "3. Focus on the top 5-10 functions consuming most resources" -ForegroundColor Cyan
Write-Host "4. Use benchmarks to validate improvements" -ForegroundColor Cyan