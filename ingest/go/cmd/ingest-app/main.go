package main

import (
	"context"
	"log"
	"net/http"
	_ "net/http/pprof" // This enables the pprof endpoints
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/processing"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/worker"
)

func main() {
	startTime := time.Now()

	cfg := config.LoadConfig()

	// Configure runtime settings for better profiling
	if cfg.GoMaxProcs > 0 {
		runtime.GOMAXPROCS(cfg.GoMaxProcs)
	}

	// Set GOGC for better memory profiling visibility
	if cfg.GOGC > 0 {
		debug.SetGCPercent(cfg.GOGC)
	}

	// Start pprof server in a goroutine
	go func() {
		log.Println("Starting pprof server on :6060")
		log.Println("Access profiles at:")
		log.Println("  CPU Profile: http://localhost:6060/debug/pprof/profile?seconds=30")
		log.Println("  Memory Profile: http://localhost:6060/debug/pprof/heap")
		log.Println("  Goroutine Profile: http://localhost:6060/debug/pprof/goroutine")
		log.Println("  All Profiles: http://localhost:6060/debug/pprof/")

		if err := http.ListenAndServe(":6060", nil); err != nil {
			log.Printf("pprof server failed: %v", err)
		}
	}()

	log.Printf("Starting telemetry application with %d workers", cfg.WorkerCount)
	log.Printf("Configuration: BatchSize=%dKB, WorkerTimeout=%v, MaxRetries=%d",
		cfg.BatchSizeBytes/1024, cfg.WorkerTimeout, cfg.MaxRetries)
	log.Printf("Runtime: GOMAXPROCS=%d, GOGC=%d", runtime.GOMAXPROCS(0), debug.SetGCPercent(-1))
	debug.SetGCPercent(cfg.GOGC) // Reset after reading

	// Initial memory stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	log.Printf("Initial memory: Alloc=%dKB Sys=%dKB NumGC=%d",
		m.Alloc/1024, m.Sys/1024, m.NumGC)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signalCh
		log.Println("Received shutdown signal. Gracefully shutting down...")
		cancel()
	}()

	if len(os.Args) < 2 {
		log.Fatal("Usage: ./telemetry-app <telemetry-folder-path>")
	}

	telemetryFolder := os.Args[1]

	if !strings.HasSuffix(telemetryFolder, string(filepath.Separator)) {
		telemetryFolder += string(filepath.Separator)
	}

	log.Println("Processing IBT folder:", telemetryFolder)

	pool := worker.NewWorkerPool(cfg)
	pool.Start()
	defer pool.Stop()

	expectedFiles, err := discoverAndQueueFiles(ctx, pool, telemetryFolder)
	if err != nil {
		log.Printf("Error during file discovery: %v", err)
		return
	}

	go monitorMemory(ctx)

	waitForCompletion(ctx, pool, startTime, expectedFiles)

	runtime.ReadMemStats(&m)
	log.Printf("Final memory: Alloc=%dKB Sys=%dKB NumGC=%d",
		m.Alloc/1024, m.Sys/1024, m.NumGC)

	log.Printf("Application completed in %v", time.Since(startTime))
	log.Println("Pprof server still running on :6060 for post-mortem analysis")
	log.Println("Press Ctrl+C again to exit completely")

	select {
	case <-signalCh:
		log.Println("Shutting down pprof server...")
	case <-time.After(30 * time.Second):
		log.Println("Auto-shutting down after 30 seconds...")
	}
}

func monitorMemory(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var m runtime.MemStats
			runtime.ReadMemStats(&m)

			log.Printf("Memory Stats: Alloc=%dKB Sys=%dKB HeapObjects=%d NumGC=%d PauseTotalNs=%dms",
				m.Alloc/1024,
				m.Sys/1024,
				m.HeapObjects,
				m.NumGC,
				m.PauseTotalNs/1000000)
		}
	}
}

func discoverAndQueueFiles(ctx context.Context, pool *worker.WorkerPool, telemetryFolder string) (int, error) {
	directory := processing.NewDir(telemetryFolder)
	files := directory.WatchDir()

	log.Printf("Found %d files to examine", len(files))

	filesQueued := 0
	for _, file := range files {
		select {
		case <-ctx.Done():
			log.Println("File discovery cancelled")
			return filesQueued, ctx.Err()
		default:
		}

		fileName := file.Name()

		if !strings.Contains(fileName, ".ibt") {
			log.Printf("Skipping non-IBT file: %s", fileName)
			continue
		}

		workItem := worker.WorkItem{
			FilePath:   telemetryFolder,
			FileInfo:   file,
			RetryCount: 0,
		}

		if err := pool.SubmitFile(workItem); err != nil {
			log.Printf("Failed to queue file %s: %v", fileName, err)
			return filesQueued, err
		}

		filesQueued++
		log.Printf("Queued file %d/%d: %s", filesQueued, len(files), fileName)
	}

	log.Printf("Successfully queued %d IBT files for processing", filesQueued)
	return filesQueued, nil
}

func waitForCompletion(ctx context.Context, pool *worker.WorkerPool, startTime time.Time, expectedFiles int) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	lastMetrics := worker.PoolMetrics{}
	lastCheck := time.Now()
	stableCount := 0

	for {
		select {
		case <-ctx.Done():
			log.Println("Shutdown requested, stopping processing...")
			return
		case <-ticker.C:
			metrics := pool.GetMetrics()

			elapsed := time.Since(startTime)
			log.Printf("=== Progress Update (elapsed: %v) ===", elapsed)
			log.Printf("Files processed: %d/%d", metrics.TotalFilesProcessed, expectedFiles)
			log.Printf("Records processed: %d", metrics.TotalRecordsProcessed)
			log.Printf("Batches sent: %d", metrics.TotalBatchesProcessed)
			log.Printf("Queue depth: %d", metrics.QueueDepth)
			log.Printf("Active workers: %d", metrics.ActiveWorkers)
			log.Printf("Errors: %d", metrics.TotalErrors)

			if lastMetrics.TotalFilesProcessed > 0 {
				filesDelta := metrics.TotalFilesProcessed - lastMetrics.TotalFilesProcessed
				recordsDelta := metrics.TotalRecordsProcessed - lastMetrics.TotalRecordsProcessed
				timeDelta := time.Since(lastCheck).Seconds()
				if timeDelta > 0 {
					log.Printf("Processing rate: %.1f files/sec, %.0f records/sec",
						float64(filesDelta)/timeDelta, float64(recordsDelta)/timeDelta)
				}
			}

			lastMetrics = metrics
			lastCheck = time.Now()

		default:
			time.Sleep(200 * time.Millisecond)
			metrics := pool.GetMetrics()

			if metrics.QueueDepth == 0 && metrics.TotalFilesProcessed >= expectedFiles {
				stableCount++
				if stableCount >= 3 {
					log.Printf("All %d files processed, shutting down...", expectedFiles)
					return
				}
			} else {
				stableCount = 0
			}
		}
	}
}
