package publisher

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"nats-chunking-poc/pkg/message"
	"nats-chunking-poc/pkg/utils"

	"github.com/nats-io/nats.go"
)

const (
	ChunkSize           = 30 * 1024 * 1024 // 30MB
	MaxConcurrentChunks = 3
)

// PublisherOptions configures how the publisher operates
type PublisherOptions struct {
	RequiredConsumers int           // Number of consumers that must receive the file
	AckTimeout        time.Duration // How long to wait for acks
	MaxRetries        int           // Maximum retries for unacknowledged chunks
	RetryInterval     time.Duration // Time between retries
}

// Publisher sends chunks of a binary file over NATS
type Publisher struct {
	nc             *nats.Conn
	subject        string
	options        PublisherOptions
	pendingAcks    map[string]map[int]map[string]bool
	completionAcks map[string]map[string]bool
	acksMutex      sync.Mutex
	chunks         map[string]map[int][]byte
	chunkMutex     sync.Mutex
}

// NewPublisher creates a new publisher
func NewPublisher(nc *nats.Conn, subject string, options PublisherOptions) *Publisher {
	p := &Publisher{
		nc:             nc,
		subject:        subject,
		options:        options,
		pendingAcks:    make(map[string]map[int]map[string]bool),
		completionAcks: make(map[string]map[string]bool),
		chunks:         make(map[string]map[int][]byte),
	}

	// Subscribe to chunk acknowledgments
	nc.Subscribe(subject+".ack", func(msg *nats.Msg) {
		var ack message.ChunkAck
		if err := json.Unmarshal(msg.Data, &ack); err != nil {
			fmt.Printf("Error unmarshaling ack: %v\n", err)
			return
		}
		p.processAck(ack)
	})

	// Subscribe to file completion acknowledgments
	nc.Subscribe(subject+".complete", func(msg *nats.Msg) {
		var complete message.FileCompletionAck
		if err := json.Unmarshal(msg.Data, &complete); err != nil {
			fmt.Printf("Error unmarshaling completion ack: %v\n", err)
			return
		}
		p.processCompletionAck(complete)
	})

	return p
}

// Process a chunk acknowledgment
func (p *Publisher) processAck(ack message.ChunkAck) {
	p.acksMutex.Lock()
	defer p.acksMutex.Unlock()

	// Initialize maps if they don't exist
	if _, exists := p.pendingAcks[ack.MessageID]; !exists {
		p.pendingAcks[ack.MessageID] = make(map[int]map[string]bool)
	}

	if _, exists := p.pendingAcks[ack.MessageID][ack.ChunkIndex]; !exists {
		p.pendingAcks[ack.MessageID][ack.ChunkIndex] = make(map[string]bool)
	}

	// Mark this chunk as acknowledged by this consumer
	p.pendingAcks[ack.MessageID][ack.ChunkIndex][ack.ConsumerID] = true

	// Debug output
	fmt.Printf("\rReceived ACK from %s for chunk %d of %s    ",
		ack.ConsumerID[:8], ack.ChunkIndex, ack.MessageID[:8])
}

// Process a file completion acknowledgment
func (p *Publisher) processCompletionAck(ack message.FileCompletionAck) {
	p.acksMutex.Lock()
	defer p.acksMutex.Unlock()

	if _, exists := p.completionAcks[ack.MessageID]; !exists {
		p.completionAcks[ack.MessageID] = make(map[string]bool)
	}

	p.completionAcks[ack.MessageID][ack.ConsumerID] = ack.Success

	// Debug output
	successStr := "SUCCESS"
	if !ack.Success {
		successStr = "FAILED"
	}
	fmt.Printf("\nReceived completion ACK from %s for file %s: %s\n",
		ack.ConsumerID[:8], ack.MessageID[:8], successStr)
}

// generateMessageID creates a unique message ID for a chunked file
func generateMessageID() (string, error) {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// Store a chunk for potential retry
func (p *Publisher) storeChunk(messageID string, chunkIndex int, data []byte) {
	p.chunkMutex.Lock()
	defer p.chunkMutex.Unlock()

	if _, exists := p.chunks[messageID]; !exists {
		p.chunks[messageID] = make(map[int][]byte)
	}

	// Make a copy of the data to avoid race conditions
	chunk := make([]byte, len(data))
	copy(chunk, data)
	p.chunks[messageID][chunkIndex] = chunk
}

// Get a stored chunk
func (p *Publisher) getChunk(messageID string, chunkIndex int) ([]byte, bool) {
	p.chunkMutex.Lock()
	defer p.chunkMutex.Unlock()

	if chunks, exists := p.chunks[messageID]; exists {
		if data, ok := chunks[chunkIndex]; ok {
			return data, true
		}
	}

	return nil, false
}

// PublishFile chunks and publishes a binary file
func (p *Publisher) PublishFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}

	fileSize := fileInfo.Size()
	fileName := filepath.Base(filePath)

	messageID, err := generateMessageID()
	if err != nil {
		return fmt.Errorf("failed to generate message ID: %w", err)
	}

	totalChunks := int((fileSize + int64(ChunkSize) - 1) / int64(ChunkSize))

	fmt.Printf("Chunking file %s (%d bytes) into %d chunks\n", fileName, fileSize, totalChunks)

	// Initialize ack tracking for this message
	p.acksMutex.Lock()
	p.pendingAcks[messageID] = make(map[int]map[string]bool)
	p.completionAcks[messageID] = make(map[string]bool)
	p.acksMutex.Unlock()

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, MaxConcurrentChunks) // Limit concurrency
	errorChan := make(chan error, totalChunks)

	// First pass - send all chunks
	for chunkIndex := 0; chunkIndex < totalChunks; chunkIndex++ {
		wg.Add(1)
		semaphore <- struct{}{} // Acquire semaphore slot

		go func(idx int) {
			defer wg.Done()
			defer func() { <-semaphore }() // Release semaphore slot

			chunkOffset := int64(idx * ChunkSize)
			chunkSize := int(utils.Min(int64(ChunkSize), fileSize-chunkOffset))

			// Read the chunk data
			chunkData := make([]byte, chunkSize)
			_, err := file.ReadAt(chunkData, chunkOffset)
			if err != nil && err != io.EOF {
				errorChan <- fmt.Errorf("failed to read chunk %d: %w", idx, err)
				return
			}

			// Store the chunk for potential retries
			p.storeChunk(messageID, idx, chunkData)

			// Create chunk metadata
			metadata := message.ChunkMetadata{
				MessageID:   messageID,
				ChunkIndex:  idx,
				TotalChunks: totalChunks,
				FileName:    fileName,
				FileSize:    fileSize,
				ChunkSize:   chunkSize,
				LastChunk:   idx == totalChunks-1,
			}

			// Create complete chunk message
			msg := message.ChunkMessage{
				Metadata: metadata,
				Data:     chunkData,
			}

			// Serialize and publish the chunk
			err = p.publishChunk(msg)
			if err != nil {
				errorChan <- fmt.Errorf("failed to publish chunk %d: %w", idx, err)
				return
			}

			// Print progress
			progress := float64(idx+1) / float64(totalChunks) * 100
			progressBar := utils.MakeProgressBar(progress, 50)
			fmt.Printf("\rPublishing: %s %.1f%% (%d/%d chunks) ",
				progressBar, progress, idx+1, totalChunks)
		}(chunkIndex)
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(errorChan)

	// Check for any errors during publishing
	for err := range errorChan {
		if err != nil {
			return err
		}
	}

	fmt.Printf("\nPublished file with message ID: %s\n", messageID)

	// Wait for all chunks to be acknowledged by all required consumers
	fmt.Println("Waiting for acknowledgments...")
	if !p.waitForAllAcks(messageID, totalChunks) {
		return fmt.Errorf("failed to receive acknowledgments from all required consumers")
	}

	// Wait for file completion acknowledgments
	fmt.Println("Waiting for completion acknowledgments...")
	if !p.waitForCompletionAcks(messageID) {
		return fmt.Errorf("failed to receive completion acknowledgments from all required consumers")
	}

	// Clean up stored chunks
	p.chunkMutex.Lock()
	delete(p.chunks, messageID)
	p.chunkMutex.Unlock()

	fmt.Println("File successfully delivered to all consumers!")

	return nil
}

// publishChunk publishes a single chunk
func (p *Publisher) publishChunk(msg message.ChunkMessage) error {
	// Create message payload
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal chunk message: %w", err)
	}

	// Publish to NATS
	err = p.nc.Publish(p.subject, data)
	if err != nil {
		return fmt.Errorf("failed to publish to NATS: %w", err)
	}

	return nil
}

// waitForAllAcks waits for all chunks to be acknowledged by the required number of consumers
func (p *Publisher) waitForAllAcks(messageID string, totalChunks int) bool {
	timeout := time.After(p.options.AckTimeout)
	ticker := time.NewTicker(500 * time.Millisecond) // Check progress every 500ms
	defer ticker.Stop()

	retries := 0

	for {
		select {
		case <-timeout:
			fmt.Println("Timeout waiting for acknowledgments")
			return false

		case <-ticker.C:
			if p.checkAllAcks(messageID, totalChunks) {
				fmt.Println("All chunks acknowledged by all required consumers")
				return true
			}

			// Check if we need to retry any chunks
			missingChunks := p.getMissingChunks(messageID, totalChunks)
			if len(missingChunks) > 0 {
				if retries >= p.options.MaxRetries {
					fmt.Printf("Max retries (%d) reached for message %s\n",
						p.options.MaxRetries, messageID)
					return false
				}

				fmt.Printf("\nRetrying %d missing chunks (attempt %d/%d)...\n",
					len(missingChunks), retries+1, p.options.MaxRetries)

				for _, chunkIndex := range missingChunks {
					p.retryChunk(messageID, chunkIndex)
				}

				retries++
				timeout = time.After(p.options.AckTimeout) // Reset timeout
			}
		}
	}
}

// checkAllAcks checks if all chunks have been acknowledged by the required number of consumers
func (p *Publisher) checkAllAcks(messageID string, totalChunks int) bool {
	p.acksMutex.Lock()
	defer p.acksMutex.Unlock()

	// Check if we have enough consumers acknowledging each chunk
	for chunkIndex := 0; chunkIndex < totalChunks; chunkIndex++ {
		consumerAcks, exists := p.pendingAcks[messageID][chunkIndex]
		if !exists || len(consumerAcks) < p.options.RequiredConsumers {
			return false
		}
	}

	return true
}

// getMissingChunks returns a list of chunks that haven't been acknowledged by enough consumers
func (p *Publisher) getMissingChunks(messageID string, totalChunks int) []int {
	p.acksMutex.Lock()
	defer p.acksMutex.Unlock()

	var missing []int

	for chunkIndex := 0; chunkIndex < totalChunks; chunkIndex++ {
		consumerAcks, exists := p.pendingAcks[messageID][chunkIndex]
		if !exists || len(consumerAcks) < p.options.RequiredConsumers {
			missing = append(missing, chunkIndex)
		}
	}

	return missing
}

// retryChunk republishes a chunk
func (p *Publisher) retryChunk(messageID string, chunkIndex int) {
	// Retrieve the stored chunk
	chunkData, ok := p.getChunk(messageID, chunkIndex)
	if !ok {
		fmt.Printf("Error: Cannot retry chunk %d, data not found\n", chunkIndex)
		return
	}

	// Get the original metadata for this chunk
	p.acksMutex.Lock()
	var totalChunks int
	// Determine total chunks from any existing chunk acks
	for idx := range p.pendingAcks[messageID] {
		if idx > totalChunks {
			totalChunks = idx
		}
	}
	totalChunks++ // Because indices are 0-based
	p.acksMutex.Unlock()

	if totalChunks == 0 {
		fmt.Printf("Error: Cannot determine total chunks for message %s\n", messageID)
		return
	}

	// Create metadata for this chunk
	metadata := message.ChunkMetadata{
		MessageID:   messageID,
		ChunkIndex:  chunkIndex,
		TotalChunks: totalChunks,
		ChunkSize:   len(chunkData),
		LastChunk:   chunkIndex == totalChunks-1,
		// We don't have the original filename and filesize here, but it's not critical
	}

	// Create and publish the message
	msg := message.ChunkMessage{
		Metadata: metadata,
		Data:     chunkData,
	}

	if err := p.publishChunk(msg); err != nil {
		fmt.Printf("Error retrying chunk %d: %v\n", chunkIndex, err)
	} else {
		fmt.Printf("Retried chunk %d of message %s\n", chunkIndex, messageID)
	}
}

// waitForCompletionAcks waits for file completion acknowledgments
func (p *Publisher) waitForCompletionAcks(messageID string) bool {
	timeout := time.After(p.options.AckTimeout)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			fmt.Println("Timeout waiting for completion acknowledgments")
			return false

		case <-ticker.C:
			p.acksMutex.Lock()
			count := len(p.completionAcks[messageID])
			allSuccess := true

			for _, success := range p.completionAcks[messageID] {
				if !success {
					allSuccess = false
					break
				}
			}

			p.acksMutex.Unlock()

			if count >= p.options.RequiredConsumers && allSuccess {
				fmt.Println("All required consumers successfully completed file reception")
				return true
			}
		}
	}
}
