package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/teamjorge/ibt"
)

func main() {
	// Ensure an IBT file path is provided
	if len(os.Args) < 2 {
		log.Fatal("Usage: ./telemetry-app <ibt-file-path>")
	}

	ibtFilePath := os.Args[1]
	fmt.Println("Processing IBT file:", ibtFilePath)

	files, err := filepath.Glob(ibtFilePath)
	if err != nil {
		fmt.Errorf("could not glob the given input files: %v", err)
	}

	// Parse the files into stubs
	stubs, err := ibt.ParseStubs(files...)
	if err != nil {
		fmt.Errorf("failed to parse stubs for %v. error - %v", files, err)
	}

	// Ensure stubs are not empty
	if len(stubs) == 0 {
		log.Println("No telemetry data found in IBT file.")
		time.Sleep(60 * time.Second) // Keep the container alive for debugging
		return
	}

	// Initialize InfluxDB storage
	storage := newStorage()
	if err := storage.Connect(); err != nil {
		log.Fatal(err)
	}
	defer storage.Close()

	// Process telemetry data
	groups := stubs.Group()
	defer ibt.CloseAllStubs(groups)

	count := 0
	for groupNumber, group := range groups {
		if count > 0 {
			continue
		}
		processor := newLoaderProcessor(storage, groupNumber, 1000)

		if err := ibt.Process(context.Background(), group, processor); err != nil {
			log.Fatalf("Failed to process telemetry: %v", err)
		}

		log.Printf("%d batches loaded after group %d\n", storage.Loaded(), groupNumber)
		count++
	}

	log.Println("Processing complete. Sleeping to keep container running.")
	for {
		time.Sleep(60 * time.Second) // Prevent container from exiting
	}
}
