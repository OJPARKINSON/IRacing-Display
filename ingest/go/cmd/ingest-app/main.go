package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/processing"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/worker"
)

func main() {
	startTime := time.Now()

	// Load configuration
	cfg := config.LoadConfig()

	// Set runtime parameters
	if cfg.GoMaxProcs > 0 {
		runtime.GOMAXPROCS(cfg.GoMaxProcs)
	}

	log.Printf("Starting telemetry application with %d workers", cfg.WorkerCount)
	log.Printf("Configuration: BatchSize=%dKB, WorkerTimeout=%v, MaxRetries=%d",
		cfg.BatchSizeBytes/1024, cfg.WorkerTimeout, cfg.MaxRetries)

	// Create cancellable context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup signal handling for graceful shutdown
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signalCh
		log.Println("Received shutdown signal. Gracefully shutting down...")
		cancel()
	}()

	// Validate command line arguments
	if len(os.Args) < 2 {
		log.Fatal("Usage: ./telemetry-app <telemetry-folder-path>")
	}

	telemetryFolder := os.Args[1]

	// Ensure folder path ends with separator for consistent path joining
	if !strings.HasSuffix(telemetryFolder, string(filepath.Separator)) {
		telemetryFolder += string(filepath.Separator)
	}

	log.Println("Processing IBT folder:", telemetryFolder)

	// Create and start worker pool
	pool := worker.NewWorkerPool(cfg)
	pool.Start()
	defer pool.Stop()

	// Discover and queue files for processing
	if err := discoverAndQueueFiles(ctx, pool, telemetryFolder); err != nil {
		log.Printf("Error during file discovery: %v", err)
		return
	}

	// Wait for processing to complete or context cancellation
	waitForCompletion(ctx, pool, startTime)

	log.Printf("Application completed in %v", time.Since(startTime))
}

// discoverAndQueueFiles finds IBT files and submits them to the worker pool
func discoverAndQueueFiles(ctx context.Context, pool *worker.WorkerPool, telemetryFolder string) error {
	directory := processing.NewDir(telemetryFolder)
	files := directory.WatchDir()

	log.Printf("Found %d files to examine", len(files))

	filesQueued := 0
	for _, file := range files {
		select {
		case <-ctx.Done():
			log.Println("File discovery cancelled")
			return ctx.Err()
		default:
		}

		fileName := file.Name()

		// Filter for IBT files only
		if !strings.Contains(fileName, ".ibt") {
			log.Printf("Skipping non-IBT file: %s", fileName)
			continue
		}

		// Create work item
		workItem := worker.WorkItem{
			FilePath:   telemetryFolder,
			FileInfo:   file,
			RetryCount: 0,
		}

		// Submit to worker pool
		if err := pool.SubmitFile(workItem); err != nil {
			log.Printf("Failed to queue file %s: %v", fileName, err)
			return err
		}

		filesQueued++
		log.Printf("Queued file %d/%d: %s", filesQueued, len(files), fileName)
	}

	log.Printf("Successfully queued %d IBT files for processing", filesQueued)
	return nil
}

// waitForCompletion monitors the worker pool and waits for completion
func waitForCompletion(ctx context.Context, pool *worker.WorkerPool, startTime time.Time) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	lastMetrics := worker.PoolMetrics{}

	for {
		select {
		case <-ctx.Done():
			log.Println("Shutdown requested, stopping processing...")
			return
		case <-ticker.C:
			metrics := pool.GetMetrics()

			// Log progress
			elapsed := time.Since(startTime)
			log.Printf("=== Progress Update (elapsed: %v) ===", elapsed)
			log.Printf("Files processed: %d", metrics.TotalFilesProcessed)
			log.Printf("Records processed: %d", metrics.TotalRecordsProcessed)
			log.Printf("Batches sent: %d", metrics.TotalBatchesProcessed)
			log.Printf("Queue depth: %d", metrics.QueueDepth)
			log.Printf("Active workers: %d", metrics.ActiveWorkers)
			log.Printf("Errors: %d", metrics.TotalErrors)

			// Calculate rates since last update
			if lastMetrics.TotalFilesProcessed > 0 {
				filesDelta := metrics.TotalFilesProcessed - lastMetrics.TotalFilesProcessed
				recordsDelta := metrics.TotalRecordsProcessed - lastMetrics.TotalRecordsProcessed
				log.Printf("Processing rate: %d files/30s, %d records/30s", filesDelta, recordsDelta)
			}

			// Check if processing is complete (no queue depth and no active processing)
			if metrics.QueueDepth == 0 && metrics.TotalFilesProcessed > 0 {
				log.Println("All files processed, shutting down...")
				return
			}

			lastMetrics = metrics
		}
	}
}
