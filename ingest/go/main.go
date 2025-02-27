package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/teamjorge/ibt"
)

func main() {
	// Setup clean shutdown handling
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle interrupt signals for graceful shutdown
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signalCh
		log.Println("Received shutdown signal. Gracefully shutting down...")
		cancel()
	}()

	// Ensure an IBT file path is provided
	if len(os.Args) < 2 {
		log.Fatal("Usage: ./telemetry-app <ibt-file-path>")
	}

	ibtFilePath := os.Args[1]
	log.Println("Processing IBT file:", ibtFilePath)

	startTime := time.Now()

	// Find matching files
	files, err := filepath.Glob(ibtFilePath)
	if err != nil {
		log.Fatalf("Could not glob the given input files: %v", err)
	}

	if len(files) == 0 {
		log.Fatalf("No files found matching pattern: %s", ibtFilePath)
	}

	log.Printf("Found %d files to process", len(files))

	// Parse the files into stubs
	stubs, err := ibt.ParseStubs(files...)
	if err != nil {
		log.Fatalf("Failed to parse stubs for %v: %v", files, err)
	}

	// Ensure stubs are not empty
	if len(stubs) == 0 {
		log.Println("No telemetry data found in IBT file.")
		return
	}

	log.Printf("Parsed %d stubs", len(stubs))

	// Initialize InfluxDB storage
	storage := newStorage()
	if err := storage.Connect(); err != nil {
		log.Fatal(err)
	}
	defer func() {
		log.Println("Closing storage connection...")
		if err := storage.Close(); err != nil {
			log.Printf("Error closing storage: %v", err)
		}
	}()

	// Process telemetry data
	groups := stubs.Group()
	log.Printf("Grouped telemetry data into %d groups", len(groups))

	// Create wait group for parallel processing
	var wg sync.WaitGroup
	processedGroups := 0

	// Determine optimal parallel processing count
	parallelism := runtime.NumCPU()
	if pEnv := os.Getenv("PARALLEL_GROUPS"); pEnv != "" {
		if p, err := fmt.Sscanf(pEnv, "%d", &parallelism); err != nil || p < 1 {
			parallelism = 1
		}
	}
	log.Printf("Using parallelism of %d", parallelism)

	// Create processor for each group
	processors := make([]*loaderProcessor, 0, len(groups))

	// Create semaphore to limit concurrency
	sem := make(chan struct{}, parallelism)

	for groupNumber, group := range groups {
		// Create processor with optimal batch size
		// Batch size is adjustable via environment variable
		batchSize := 1000
		if bsEnv := os.Getenv("BATCH_SIZE"); bsEnv != "" {
			if bs, err := fmt.Sscanf(bsEnv, "%d", &batchSize); err != nil || bs < 1 {
				batchSize = 1000
			}
		}

		processor := newLoaderProcessor(storage, groupNumber, batchSize)
		processors = append(processors, processor)

		wg.Add(1)
		go func(g ibt.StubGroup, p *loaderProcessor, groupNum int) {
			defer wg.Done()

			// Acquire semaphore slot
			sem <- struct{}{}
			defer func() { <-sem }()

			log.Printf("Starting processing for group %d", groupNum)
			startGroup := time.Now()

			if err := ibt.Process(ctx, g, p); err != nil {
				if ctx.Err() == context.Canceled {
					log.Printf("Processing of group %d was canceled", groupNum)
				} else {
					log.Printf("Failed to process telemetry for group %d: %v", groupNum, err)
				}
				return
			}

			// Close processor to flush remaining data
			if err := p.Close(); err != nil {
				log.Printf("Error closing processor for group %d: %v", groupNum, err)
			}

			processTime := time.Since(startGroup)
			log.Printf("Completed processing group %d in %v", groupNum, processTime)
		}(group, processor, groupNumber)

		processedGroups++
	}

	// Wait for all processing to complete
	wg.Wait()

	// Close all stubs
	ibt.CloseAllStubs(groups)

	totalTime := time.Since(startTime)
	log.Printf("Processing complete. Processed %d groups in %v", processedGroups, totalTime)
	log.Printf("Total batches loaded: %d", storage.Loaded())

	// The application has completed its work and will now exit
	log.Println("All data has been processed and uploaded to InfluxDB. Exiting application.")
}
