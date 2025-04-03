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
		"bootstrap.servers":         "localhost:9094,localhost:9092",
		"group.id":                  "file-processor-group",
		"auto.offset.reset":         "earliest",
		"fetch.message.max.bytes":   409715200,
		"max.partition.fetch.bytes": 409715200,
		"security.protocol":         "PLAINTEXT",
	})
	if err != nil {
		fmt.Printf("Failed to create consumer: %s", err)
		os.Exit(1)
	}
	defer consumer.Close()

	consumer.SubscribeTopics([]string{"test-topic", "large-files"}, nil)

	go cleanupStaleTransfers()

	for {
		msg, err := consumer.ReadMessage(time.Second * 10)

		if err == nil {
			if *msg.TopicPartition.Topic == "large-files" {
				processFileChunk(msg)
			} else {
				processTestEvent(msg)
			}
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
	var parseError bool

	for _, header := range msg.Headers {
		switch header.Key {
		case "filename":
			filename = string(header.Value)
		case "chunkIndex":
			var err error
			chunkIndex, err = strconv.Atoi(string(header.Value))
			if err != nil {
				log.Printf("Invalid chunkIndex: %v", err)
			}
		case "totalChunks":
			var err error
			totalChunks, err = strconv.Atoi(string(header.Value))
			if err != nil {
				log.Printf("Invalid totalChunks: %v", err)
				parseError = true
			}
		case "fileSize":
			var err error
			fileSize, err = strconv.Atoi(string(header.Value))
			if err != nil {
				log.Printf("Invalid fileSize: %v", err)
				parseError = true
			}
		case "transferId":
			transferID = string(header.Value)
		}
	}

	if filename == "" || transferID == "" || parseError {
		log.Println("Received chunk with missing or invalid metadata, skipping")
		if !parseError {
			log.Println(parseError)
		}
		return
	}

	// Validate the chunk metadata
	if chunkIndex < 0 || chunkIndex >= totalChunks {
		log.Printf("Invalid chunk index %d (total chunks: %d), skipping",
			chunkIndex, totalChunks)
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
	} else {
		// Verify that metadata is consistent across chunks
		if reassembly.TotalChunks != totalChunks {
			log.Printf("Warning: Chunk has inconsistent totalChunks value: got %d, expected %d",
				totalChunks, reassembly.TotalChunks)
		}
	}
	reassemblyMutex.Unlock()

	// Add this chunk to the reassembly
	reassembly.mu.Lock()
	defer reassembly.mu.Unlock()

	// Check if we've already received this chunk
	if _, exists := reassembly.ReceivedChunks[chunkIndex]; exists {
		log.Printf("Duplicate chunk received for index %d, overwriting", chunkIndex)
	}

	// Store the chunk
	reassembly.ReceivedChunks[chunkIndex] = msg.Value
	reassembly.LastUpdated = time.Now()

	log.Printf("Processed chunk %d/%d for file %s (Transfer ID: %s, Received: %d/%d)\n",
		chunkIndex+1, totalChunks, filename, transferID,
		len(reassembly.ReceivedChunks), totalChunks)

	// Check if we have all chunks
	if len(reassembly.ReceivedChunks) == reassembly.TotalChunks {
		log.Printf("All chunks received for file %s, reassembling...", filename)
		// Reassemble the file
		reassembleAndSaveFile(reassembly)
		// Remove from tracking
		reassemblyMutex.Lock()
		delete(fileReassemblies, transferID)
		reassemblyMutex.Unlock()
	} else {
		log.Println(len(reassembly.ReceivedChunks), reassembly.TotalChunks, reassembly.TotalFileSize)
	}
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

func processTestEvent(msg *kafka.Message) {
	fmt.Println(msg.Key)
	fmt.Println(msg.TopicPartition)
	fmt.Println("value", msg.Value)
	fmt.Println(msg.Headers)
}
