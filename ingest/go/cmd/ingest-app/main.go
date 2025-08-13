package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"runtime/pprof"
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

	// Enable profiling if ENABLE_PPROF environment variable is set
	if os.Getenv("ENABLE_PPROF") == "true" {
		go func() {
			log.Println("Starting pprof server on :6060")
			log.Println(http.ListenAndServe(":6060", nil))
		}()
	}

	// Enable CPU profiling if CPU_PROFILE environment variable is set
	if cpuProfile := os.Getenv("CPU_PROFILE"); cpuProfile != "" {
		f, err := os.Create(cpuProfile)
		if err != nil {
			log.Fatal("Could not create CPU profile: ", err)
		}
		defer f.Close()

		if err := pprof.StartCPUProfile(f); err != nil {
			log.Fatal("Could not start CPU profile: ", err)
		}
		defer pprof.StopCPUProfile()
		log.Printf("CPU profiling enabled, writing to %s", cpuProfile)
	}

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

	// Temporarily disable log discarding to see error messages
	log.SetOutput(io.Discard)

	progress.Start()
	defer progress.Stop()

	progress.AddLog(fmt.Sprintf("Starting %d workers for %d files", cfg.WorkerCount, expectedFiles))

	pool.Start()
	defer pool.Stop()

	waitForCompletion(ctx, pool, startTime, expectedFiles)

	progress.AddLog(fmt.Sprintf("Completed in %v", time.Since(startTime)))

	// Write memory profile if MEM_PROFILE environment variable is set
	if memProfile := os.Getenv("MEM_PROFILE"); memProfile != "" {
		f, err := os.Create(memProfile)
		if err != nil {
			log.Printf("Could not create memory profile: %v", err)
		} else {
			defer f.Close()
			runtime.GC() // get up-to-date statistics
			if err := pprof.WriteHeapProfile(f); err != nil {
				log.Printf("Could not write memory profile: %v", err)
			} else {
				log.Printf("Memory profile written to %s", memProfile)
			}
		}
	}

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
			FilePath:   filepath.Join(telemetryFolder, fileName),
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
			time.Sleep(20 * time.Millisecond)
			metrics := pool.GetMetrics()

			if metrics.QueueDepth == 0 && metrics.TotalFilesProcessed >= expectedFiles {
				progress.AddLog("All files processed!")
				return
			}
		}
	}
}
