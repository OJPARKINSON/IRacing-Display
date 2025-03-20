package main

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

var (
	kafkaTopic = "large-files"
)

type FileReassembly struct {
	Filename       string
	TotalChunks    int
	ReceivedChunks map[int][]byte
	TotalFileSize  int
	TransferID     string
	LastUpdated    time.Time
	mu             sync.Mutex
}

var fileReassemblies = make(map[string]*FileReassembly)
var reassemblyMutex sync.Mutex

func main() {
	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":         "localhost:9094,localhost:9095,localhost:9092",
		"group.id":                  "file-processor-group",
		"auto.offset.reset":         "earliest",
		"fetch.message.max.bytes":   409715200,
		"max.partition.fetch.bytes": 409715200,
		"security.protocol":         "PLAINTEXT",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer consumer.Close()

	consumer.SubscribeTopics([]string{"large-files"}, nil)

	// Start a goroutine to clean up stale transfers
	go cleanupStaleTransfers()

	for {
		msg, err := consumer.ReadMessage(time.Second * 10)

		if err == nil {
			processFileChunk(msg)
			consumer.CommitMessage(msg)
		} else {
			// Check if the error is a kafka.Error and if it's a timeout
			kafkaErr, ok := err.(kafka.Error)
			if ok && kafkaErr.Code() == kafka.ErrTimedOut {
				// Timeout is normal, just continue
				continue
			}

			// Handle other errors
			fmt.Printf("Consumer error: %v\n", err)
		}
	}
}

func processFileChunk(msg *kafka.Message) {
	// Extract metadata from headers
	var filename, transferID string
	var chunkIndex, totalChunks, fileSize int

	for _, header := range msg.Headers {
		switch header.Key {
		case "filename":
			filename = string(header.Value)
		case "chunkIndex":
			chunkIndex, _ = strconv.Atoi(string(header.Value))
		case "totalChunks":
			totalChunks, _ = strconv.Atoi(string(header.Value))
		case "fileSize":
			fileSize, _ = strconv.Atoi(string(header.Value))
		case "transferId":
			transferID = string(header.Value)
		}
	}

	if filename == "" || transferID == "" {
		log.Println("Received chunk with missing metadata, skipping")
		return
	}

	// Get or create the file reassembly tracker
	reassemblyMutex.Lock()
	reassembly, exists := fileReassemblies[transferID]
	if !exists {
		reassembly = &FileReassembly{
			Filename:       filename,
			TotalChunks:    totalChunks,
			ReceivedChunks: make(map[int][]byte),
			TotalFileSize:  fileSize,
			TransferID:     transferID,
			LastUpdated:    time.Now(),
		}
		fileReassemblies[transferID] = reassembly
	}
	reassemblyMutex.Unlock()

	// Add this chunk to the reassembly
	reassembly.mu.Lock()
	reassembly.ReceivedChunks[chunkIndex] = msg.Value
	reassembly.LastUpdated = time.Now()

	// Check if we have all chunks
	if len(reassembly.ReceivedChunks) == reassembly.TotalChunks {
		// Reassemble the file
		reassembleAndSaveFile(reassembly)
		// Remove from tracking
		reassemblyMutex.Lock()
		delete(fileReassemblies, transferID)
		reassemblyMutex.Unlock()
	}
	reassembly.mu.Unlock()

	log.Printf("Processed chunk %d/%d for file %s (Transfer ID: %s)\n",
		chunkIndex+1, totalChunks, filename, transferID)
}

// Reassemble and save the complete file
func reassembleAndSaveFile(reassembly *FileReassembly) {
	// Create a buffer to hold the complete file
	var buffer bytes.Buffer

	// Add chunks in correct order
	for i := 0; i < reassembly.TotalChunks; i++ {
		chunk, exists := reassembly.ReceivedChunks[i]
		if !exists {
			log.Printf("Missing chunk %d for file %s, cannot reassemble\n", i, reassembly.Filename)
			return
		}
		buffer.Write(chunk)
	}

	// Verify file size
	if buffer.Len() != reassembly.TotalFileSize {
		log.Printf("Reassembled file size mismatch: expected %d, got %d\n",
			reassembly.TotalFileSize, buffer.Len())
		return
	}

	// Create output directory if it doesn't exist
	outputDir := "./received_files"
	os.MkdirAll(outputDir, 0755)

	// Save the file
	outputPath := filepath.Join(outputDir, reassembly.Filename)
	err := os.WriteFile(outputPath, buffer.Bytes(), 0644)
	if err != nil {
		log.Printf("Failed to save file %s: %v\n", outputPath, err)
		return
	}

	log.Printf("Successfully reassembled file %s from %d chunks (%d bytes)\n",
		reassembly.Filename, reassembly.TotalChunks, buffer.Len())
}

// Periodically clean up stale transfers (run in a goroutine)
func cleanupStaleTransfers() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		reassemblyMutex.Lock()

		for id, reassembly := range fileReassemblies {
			// If no updates in 30 minutes, consider it stale
			if now.Sub(reassembly.LastUpdated) > 30*time.Minute {
				log.Printf("Cleaning up stale transfer %s for file %s\n",
					id, reassembly.Filename)
				delete(fileReassemblies, id)
			}
		}

		reassemblyMutex.Unlock()
	}
}
