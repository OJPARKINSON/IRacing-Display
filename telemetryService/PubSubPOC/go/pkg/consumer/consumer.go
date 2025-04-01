package consumer

import (
	"encoding/json"
	"fmt"
	"sync"

	"nats-chunking-poc/pkg/message"
	"nats-chunking-poc/pkg/utils"

	"github.com/nats-io/nats.go"
)

type ChunkMetadata = message.ChunkMetadata

// Consumer reassembles chunks from NATS messages
type Consumer struct {
	nc                *nats.Conn
	subject           string
	consumerID        string
	messageChunks     map[string][][]byte
	mutex             sync.Mutex
	completeCallbacks map[string]func([]byte, ChunkMetadata)
}

func NewConsumer(nc *nats.Conn, subject string, consumerID string) *Consumer {
	return &Consumer{
		nc:                nc,
		subject:           subject,
		consumerID:        consumerID,
		messageChunks:     make(map[string][][]byte),
		completeCallbacks: make(map[string]func([]byte, ChunkMetadata)),
	}
}

func (c *Consumer) OnComplete(messageID string, callback func([]byte, ChunkMetadata)) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.completeCallbacks[messageID] = callback
}

// Subscribe starts consuming messages
func (c *Consumer) Subscribe() (*nats.Subscription, error) {
	return c.nc.Subscribe(c.subject, func(msg *nats.Msg) {
		var chunkMsg message.ChunkMessage
		err := json.Unmarshal(msg.Data, &chunkMsg)
		if err != nil {
			fmt.Printf("Error unmarshaling message: %v\n", err)
			return
		}

		c.processChunk(chunkMsg)
	})
}

func (c *Consumer) processChunk(msg message.ChunkMessage) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	metadata := msg.Metadata
	messageID := metadata.MessageID

	// Initialize storage for this message if it doesn't exist
	if _, exists := c.messageChunks[messageID]; !exists {
		c.messageChunks[messageID] = make([][]byte, metadata.TotalChunks)
	}

	// Store this chunk in the appropriate position
	c.messageChunks[messageID][metadata.ChunkIndex] = msg.Data

	// Send acknowledgment for this chunk
	err := c.sendAck(metadata.MessageID, metadata.ChunkIndex)
	if err != nil {
		fmt.Printf("Failed to acknowledge chunk %d: %v\n", metadata.ChunkIndex, err)
	}

	// Check if we have all chunks for this message
	chunks := c.messageChunks[messageID]
	isComplete := true
	for _, chunk := range chunks {
		if chunk == nil {
			isComplete = false
			break
		}
	}

	// If all chunks received, reassemble and callback
	if isComplete {
		// Show 100% completion before processing
		progressBar := utils.MakeProgressBar(100.0, 50)
		fmt.Printf("\rReceiving %s: %s 100.0%% (completed)                ",
			metadata.FileName, progressBar)

		// Calculate total size for the complete buffer
		totalSize := 0
		for _, chunk := range chunks {
			totalSize += len(chunk)
		}

		// Concatenate all chunks
		completeBuffer := make([]byte, 0, totalSize)
		for _, chunk := range chunks {
			completeBuffer = append(completeBuffer, chunk...)
		}

		// Call the callback if registered
		var success bool = true
		var errorMsg string

		if callback, exists := c.completeCallbacks[messageID]; exists {
			// Use a goroutine to avoid blocking the NATS message handler
			callback(completeBuffer, metadata)
			delete(c.completeCallbacks, messageID)
		}

		// Cleanup
		delete(c.messageChunks, messageID)

		fmt.Printf("\nReassembled complete file: %s (%d bytes)\n",
			metadata.FileName, metadata.FileSize)

		// Send completion acknowledgment
		c.sendCompletionAck(metadata.MessageID, success, errorMsg)
	} else {
		// Count received chunks for progress reporting
		received := 0
		for _, chunk := range chunks {
			if chunk != nil {
				received++
			}
		}
		// Show progress bar
		progress := float64(received) / float64(metadata.TotalChunks) * 100
		progressBar := utils.MakeProgressBar(progress, 50)
		fmt.Printf("\rReceiving %s: %s %.1f%% (%d/%d chunks)",
			metadata.FileName, progressBar, progress, received, metadata.TotalChunks)
	}
}

func (c *Consumer) sendAck(messageID string, chunkIndex int) error {
	ack := message.ChunkAck{
		MessageID:  messageID,
		ChunkIndex: chunkIndex,
		ConsumerID: c.consumerID,
	}

	data, err := json.Marshal(ack)
	if err != nil {
		return fmt.Errorf("failed to marshal ack: %w", err)
	}

	return c.nc.Publish(c.subject+".ack", data)
}

func (c *Consumer) sendCompletionAck(messageID string, success bool, errorMsg string) error {
	complete := message.FileCompletionAck{
		MessageID:  messageID,
		ConsumerID: c.consumerID,
		Success:    success,
		Error:      errorMsg,
	}

	data, err := json.Marshal(complete)
	if err != nil {
		return fmt.Errorf("failed to marshal completion ack: %w", err)
	}

	if err := c.nc.Publish(c.subject+".complete", data); err != nil {
		fmt.Printf("Failed to send completion acknowledgment: %v\n", err)
		return err
	}

	return nil
}
