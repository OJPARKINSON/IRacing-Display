package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/processing"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/worker"
)

var progress *worker.ProgressDisplay

func main() {
	startTime := time.Now()

	cfg := config.LoadConfig()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signalCh
		if progress != nil {
			progress.AddLog("Received shutdown signal...")
		}
		cancel()
	}()

	if len(os.Args) < 2 {
		log.Fatal("Usage: ./telemetry-app <telemetry-folder-path> [--test-mode]")
	}

	telemetryFolder := os.Args[1]
	testMode := len(os.Args) > 2 && os.Args[2] == "--test-mode"

	if testMode {
		cfg.DisableRabbitMQ = true
	}

	if !strings.HasSuffix(telemetryFolder, string(filepath.Separator)) {
		telemetryFolder += string(filepath.Separator)
	}

	pool := worker.NewWorkerPool(cfg)

	expectedFiles, err := discoverAndQueueFiles(ctx, pool, telemetryFolder, cfg)
	if err != nil {
		log.Printf("Error during file discovery: %v", err)
		return
	}

	progress = worker.NewProgressDisplay(cfg.WorkerCount, expectedFiles)
	pool.SetProgressDisplay(progress)

	log.SetOutput(io.Discard)

	progress.Start()
	defer progress.Stop()

	progress.AddLog(fmt.Sprintf("Starting %d workers for %d files", cfg.WorkerCount, expectedFiles))

	pool.Start()
	defer pool.Stop()

	waitForCompletion(ctx, pool, startTime, expectedFiles)

	progress.AddLog(fmt.Sprintf("Completed in %v", time.Since(startTime)))
	time.Sleep(2 * time.Second)
}

func discoverAndQueueFiles(ctx context.Context, pool *worker.WorkerPool, telemetryFolder string, cfg *config.Config) (int, error) {
	directory := processing.NewDir(telemetryFolder, cfg)
	files := directory.WatchDir()

	filesQueued := 0
	for _, file := range files {
		select {
		case <-ctx.Done():
			return filesQueued, ctx.Err()
		default:
		}

		fileName := file.Name()

		if !strings.Contains(fileName, ".ibt") {
			continue
		}

		workItem := worker.WorkItem{
			FilePath:   telemetryFolder,
			FileInfo:   file,
			RetryCount: 0,
		}

		if err := pool.SubmitFile(workItem); err != nil {
			return filesQueued, err
		}

		filesQueued++
	}

	return filesQueued, nil
}

func waitForCompletion(ctx context.Context, pool *worker.WorkerPool, startTime time.Time, expectedFiles int) {
	for {
		select {
		case <-ctx.Done():
			progress.AddLog("Shutdown requested...")
			return
		default:
			time.Sleep(200 * time.Millisecond)
			metrics := pool.GetMetrics()

			if metrics.QueueDepth == 0 && metrics.TotalFilesProcessed >= expectedFiles {
				progress.AddLog("All files processed!")
				return
			}
		}
	}
}
