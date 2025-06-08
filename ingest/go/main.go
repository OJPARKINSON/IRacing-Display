package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/teamjorge/ibt"
)

func main() {
	startTime := time.Now()

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
	log.Println("Processing IBT folder:", telemetryFolder)

	files, err := os.ReadDir(telemetryFolder)
	if err != nil {
		log.Fatalf("Could not glob the given input files: %v", err)
	}

	for _, file := range files {
		fileName := file.Name()

		if !strings.Contains(fileName, ".ibt") {
			continue
		}

		fmt.Println(fileName)

		fmt.Println(telemetryFolder + fileName)

		file, err := filepath.Glob(telemetryFolder + file.Name())
		if err != nil {
			log.Fatalf("Could not glob the given input files: %v", err)
		}

		if len(file) == 0 {
			log.Fatalf("No files found matching pattern: %s", telemetryFolder)
		}

		log.Printf("Found %d files to process", len(files))

		stubs, err := ibt.ParseStubs(file...)
		if err != nil {
			log.Fatalf("Failed to parse stubs for %v: %v", files, err)
		}

		if len(stubs) == 0 {
			log.Println("No telemetry data found in IBT file.")
			return
		}

		headers := stubs[0].Headers()
		WeekendInfo := headers.SessionInfo.WeekendInfo

		pubSub := newPubSub(strconv.Itoa(WeekendInfo.SubSessionID))
		defer func() {
			log.Println("Closing RabbitMQ connection...")
			if err := pubSub.Close(); err != nil {
				log.Printf("Error closing storage: %v", err)
			}
		}()

		groups := stubs.Group()
		log.Printf("Grouped telemetry data into %d groups", len(groups))

		fmt.Println("SessionID:", WeekendInfo.SessionID)
		fmt.Println("SubSessionID:", WeekendInfo.SubSessionID)
		fmt.Println("TrackDisplayName:", WeekendInfo.TrackDisplayName)
		fmt.Println("TrackID:", WeekendInfo.TrackID)

		var wg sync.WaitGroup
		processedGroups := 0

		parallelism := runtime.NumCPU()

		processors := make([]*loaderProcessor, 0, len(groups))

		sem := make(chan struct{}, parallelism)

		for groupNumber, group := range groups {
			batchSize := 100000
			if bsEnv := os.Getenv("BATCH_SIZE"); bsEnv != "" {
				if bs, err := fmt.Sscanf(bsEnv, "%d", &batchSize); err != nil || bs < 1 {
					batchSize = 10000
				}
			}

			processor := newLoaderProcessor(pubSub, groupNumber, batchSize)
			processors = append(processors, processor)

			wg.Add(1)
			go func(g ibt.StubGroup, p *loaderProcessor, groupNum int) {
				defer wg.Done()

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

				if err := p.Close(); err != nil {
					log.Printf("Error closing processor for group %d: %v", groupNum, err)
				}

				log.Printf("Completed processing group %d in %v", groupNum, time.Since(startGroup))
			}(group, processor, groupNumber)

			processedGroups++
		}

		wg.Wait()
		log.Printf("All %d groups have completed processing", processedGroups)

		ibt.CloseAllStubs(groups)

		log.Printf("Processing complete. Processed %d groups in %v", processedGroups, time.Since(startTime))
		log.Printf("Total batches loaded: %d", pubSub.Loaded())
	}

	log.Println("All data has been processed and uploaded to RabbitMQ. Exiting application.")
}
