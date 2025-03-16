package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"nats-chunking-poc/pkg/consumer"
	"nats-chunking-poc/pkg/publisher"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

func main() {
	opts := []nats.Option{
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
		nats.Timeout(10 * time.Second),
	}
	nc, err := nats.Connect(nats.DefaultURL, opts...)
	if err != nil {
		fmt.Printf("Failed to connect to NATS: %v\n", err)
		return
	}
	defer nc.Close()

	subject := "file.chunks"

	// Based on command line arguments, act as publisher or consumer
	if len(os.Args) > 1 && os.Args[1] == "publish" {
		if len(os.Args) < 3 {
			fmt.Println("Usage: program publish <filepath>")
			return
		}

		filePath := os.Args[2]
		pubOptions := publisher.PublisherOptions{
			RequiredConsumers: 1, // Set to the number of consumers that must receive the file
			AckTimeout:        90 * time.Second,
			MaxRetries:        2,
			RetryInterval:     5 * time.Second,
		}

		pub := publisher.NewPublisher(nc, subject, pubOptions)

		startTime := time.Now()
		err = pub.PublishFile(filePath)
		if err != nil {
			fmt.Printf("Failed to publish file: %v\n", err)
			return
		}

		elapsed := time.Since(startTime)
		fmt.Printf("Published file in %v\n", elapsed)

	} else {
		cons := consumer.NewConsumer(nc, subject, uuid.New().String())

		// Register callback for reassembled files
		cons.OnComplete("", func(data []byte, metadata consumer.ChunkMetadata) {
			// Create output directory if it doesn't exist
			err := os.MkdirAll("received", 0755)
			if err != nil {
				fmt.Printf("Failed to create output directory: %v\n", err)
				return
			}

			// Write reassembled file
			outputPath := filepath.Join("received", metadata.FileName)
			err = os.WriteFile(outputPath, data, 0644)
			if err != nil {
				fmt.Printf("Failed to write file: %v\n", err)
				return
			}

			fmt.Printf("Successfully wrote reassembled file to %s\n", outputPath)
		})

		// Subscribe to chunks
		_, err = cons.Subscribe()
		if err != nil {
			fmt.Printf("Failed to subscribe: %v\n", err)
			return
		}

		fmt.Println("Listening for file chunks. Press Ctrl+C to exit.")
		select {} // Block forever
	}
}
