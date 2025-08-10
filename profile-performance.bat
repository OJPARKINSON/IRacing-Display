@echo off
REM Batch script for comprehensive performance profiling

setlocal enabledelayedexpansion

set TEST_DIR=.\ingest\go\ibt_files\
if "%1" neq "" set TEST_DIR=%1

echo Starting comprehensive performance profiling...
echo Test directory: %TEST_DIR%

REM Create timestamp directory
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /format:list') do set datetime=%%I
set timestamp=%datetime:~0,8%-%datetime:~8,6%
set PROFILE_DIR=.\performance-profiles\%timestamp%
mkdir "%PROFILE_DIR%" 2>nul

echo Created profile directory: %PROFILE_DIR%

cd ingest\go

echo.
echo === Running CPU Profile ===
set CPU_PROFILE=..\..\%PROFILE_DIR%\cpu.prof
set MEM_PROFILE=
go run cmd/ingest-app/main.go %TEST_DIR%

echo.
echo === Running Memory Profile ===
set MEM_PROFILE=..\..\%PROFILE_DIR%\mem.prof
set CPU_PROFILE=
go run cmd/ingest-app/main.go %TEST_DIR%

echo.
echo === Running Live pprof Server Profile ===
set ENABLE_PPROF=true
set MEM_PROFILE=
set CPU_PROFILE=

echo Starting pprof server on http://localhost:6060
start /b go run cmd/ingest-app/main.go %TEST_DIR%

REM Wait for server to start
timeout /t 3 /nobreak >nul

echo Collecting profiles from running server...
curl -s "http://localhost:6060/debug/pprof/profile?seconds=30" > "..\..\%PROFILE_DIR%\live-cpu.prof"
curl -s "http://localhost:6060/debug/pprof/heap" > "..\..\%PROFILE_DIR%\heap.prof"
curl -s "http://localhost:6060/debug/pprof/goroutine" > "..\..\%PROFILE_DIR%\goroutine.prof"
curl -s "http://localhost:6060/debug/pprof/block" > "..\..\%PROFILE_DIR%\block.prof"
curl -s "http://localhost:6060/debug/pprof/mutex" > "..\..\%PROFILE_DIR%\mutex.prof"
curl -s "http://localhost:6060/debug/pprof/allocs" > "..\..\%PROFILE_DIR%\allocs.prof"

REM Kill any remaining processes
taskkill /f /im ingest-app.exe 2>nul
taskkill /f /im go.exe 2>nul

cd ..\..

echo.
echo === Generating Performance Report ===
echo Performance Analysis Report - Generated %date% %time% > "%PROFILE_DIR%\report.txt"
echo Profile Directory: %PROFILE_DIR% >> "%PROFILE_DIR%\report.txt"
echo. >> "%PROFILE_DIR%\report.txt"

echo === Analysis Commands === >> "%PROFILE_DIR%\report.txt"
echo To analyze CPU profile: >> "%PROFILE_DIR%\report.txt"
echo   go tool pprof %PROFILE_DIR%\cpu.prof >> "%PROFILE_DIR%\report.txt"
echo   go tool pprof %PROFILE_DIR%\live-cpu.prof >> "%PROFILE_DIR%\report.txt"
echo. >> "%PROFILE_DIR%\report.txt"
echo To analyze memory profile: >> "%PROFILE_DIR%\report.txt"
echo   go tool pprof %PROFILE_DIR%\mem.prof >> "%PROFILE_DIR%\report.txt"
echo   go tool pprof %PROFILE_DIR%\heap.prof >> "%PROFILE_DIR%\report.txt"
echo. >> "%PROFILE_DIR%\report.txt"

echo.
echo === Profiling Complete ===
echo All profiles saved to: %PROFILE_DIR%
echo View report: %PROFILE_DIR%\report.txt
pause