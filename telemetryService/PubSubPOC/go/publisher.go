package main

import (
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func main() {
	file := os.Args[1]
	fileName, fileData := getFile(file)
	topic := "large-files"

	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers":            "localhost:9094,localhost:9095,localhost:9092",
		"message.max.bytes":            209715200, // ~400MB
		"delivery.timeout.ms":          600000,    // 5 minutes
		"socket.send.buffer.bytes":     100000000,
		"receive.message.max.bytes":    209715200,
		"queue.buffering.max.messages": 10,
		"queue.buffering.max.kbytes":   209715200, // ~400MB
		"broker.address.family":        "v4",
		"security.protocol":            "PLAINTEXT",
	})
	if err != nil {
		log.Fatalf("Failed to create producer: %s", err)
	}
	defer producer.Close()

	deliveryChan := make(chan kafka.Event)

	if err := sendFileInChunks(producer, deliveryChan, fileName, fileData, topic); err != nil {
		log.Fatalf("Failed to send file: %s", err)
	}

	log.Println("Flushing remaining messages...")
	producer.Flush(1500)
}

func getFile(filePath string) (string, []byte) {
	file, err := os.Open(filePath)
	if err != nil {
		log.Fatalf("Error opening file: %v", err)
	}
	defer file.Close()

	fileStat, err := file.Stat()
	if err != nil {
		log.Fatalf("Error getting file stats: %v", err)
	}

	fileSize := fileStat.Size()
	fileName := filepath.Base(filePath)

	fmt.Printf("File size: %d bytes\n", fileSize)
	fmt.Printf("File name: %s\n", fileName)

	fileData := make([]byte, fileSize)
	bytesRead, err := file.Read(fileData)
	if err != nil {
		log.Fatalf("Error reading file: %v", err)
	}

	fmt.Printf("Bytes read: %d\n", bytesRead)

	return fileName, fileData
}

func sendFileInChunks(producer *kafka.Producer, deliveryChan chan kafka.Event,
	fileName string, fileData []byte, topic string) error {

	// Define chunk size (10 MB)
	chunkSize := 1 * 1024 * 1024

	// Calculate total number of chunks
	fileLen := len(fileData)
	totalChunks := int(math.Ceil(float64(fileLen) / float64(chunkSize)))

	log.Printf("Sending file %s (%d bytes) in %d chunks", fileName, fileLen, totalChunks)

	transferID := fmt.Sprintf("%s-%d", fileName, time.Now().Unix())
	log.Printf("Transfer ID: %s", transferID)

	for i := 0; i < totalChunks; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if end > fileLen {
			end = fileLen
		}

		// Extract the chunk
		chunk := fileData[start:end]

		// Create metadata headers
		headers := []kafka.Header{
			{Key: "filename", Value: []byte(fileName)},
			{Key: "chunkIndex", Value: []byte(fmt.Sprintf("%d", i))},
			{Key: "totalChunks", Value: []byte(fmt.Sprintf("%d", totalChunks))},
			{Key: "fileSize", Value: []byte(fmt.Sprintf("%d", fileLen))},
			{Key: "transferId", Value: []byte(transferID)},
		}

		log.Printf("Sending chunk %d/%d (%d bytes)", i+1, totalChunks, len(chunk))

		err := producer.Produce(&kafka.Message{
			TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
			Key:            []byte(fileName),
			Value:          chunk,
			Headers:        headers,
		}, deliveryChan)

		if err != nil {
			return fmt.Errorf("failed to produce chunk %d: %w", i+1, err)
		}

		e := <-deliveryChan
		switch ev := e.(type) {
		case *kafka.Message:
			if ev.TopicPartition.Error != nil {
				return fmt.Errorf("failed to deliver chunk %d: %w",
					i+1, ev.TopicPartition.Error)
			}
			log.Printf("Successfully delivered chunk %d/%d", i+1, totalChunks)
		case kafka.Error:
			return fmt.Errorf("kafka error on chunk %d: %w", i+1, ev)
		default:
			return fmt.Errorf("unexpected event type on chunk %d: %T", i+1, ev)
		}
	}

	log.Printf("All %d chunks sent successfully for transfer %s", totalChunks, transferID)
	return nil
}
