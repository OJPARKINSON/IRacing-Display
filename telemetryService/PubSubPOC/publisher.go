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

	// Configure the producer
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

	chunkSize := 10 * 1024 * 1024

	fileLen := len(fileData)

	totalChunks := int(math.Ceil(float64(fileLen) / float64(chunkSize)))

	for i := 0; i < totalChunks; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if end > fileLen {
			end = fileLen
		}

		chunk := fileData[start:end]

		chunkKey := fmt.Sprintf("%s.part%d-%d", fileName, i+1, totalChunks)

		fmt.Printf("Sending chunk %d/%d: %d bytes\n", i+1, totalChunks, len(chunk))

		chunkMetadata := map[string]string{
			"filename":    fileName,
			"chunkIndex":  fmt.Sprintf("%d", i),
			"totalChunks": fmt.Sprintf("%d", totalChunks),
			"fileSize":    fmt.Sprintf("%d", fileLen),
			"chunkSize":   fmt.Sprintf("%d", len(chunk)),
			"transferId":  fmt.Sprintf("%s-%d", fileName, time.Now().Unix()), // Unique transfer ID
		}

		// Convert metadata to Kafka headers
		var headers []kafka.Header
		for k, v := range chunkMetadata {
			headers = append(headers, kafka.Header{
				Key:   k,
				Value: []byte(v),
			})
		}

		err = producer.Produce(&kafka.Message{
			TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
			Key:            []byte(chunkKey),
			Value:          chunk,
			Headers:        headers,
		}, deliveryChan)

		if err != nil {
			log.Fatalf("Failed to produce message: %s", err)
		}

		// Wait for message delivery
		log.Println("Waiting for message delivery...")

		// Handle the event correctly with proper type checking
		e := <-deliveryChan
		switch ev := e.(type) {
		case *kafka.Message:
			if ev.TopicPartition.Error != nil {
				log.Printf("Failed to deliver message: %v\n", ev.TopicPartition.Error)
			} else {
				log.Printf("Successfully delivered message to topic %s [%d] at offset %v\n",
					*ev.TopicPartition.Topic, ev.TopicPartition.Partition, ev.TopicPartition.Offset)
			}
		case kafka.Error:
			log.Printf("Kafka error: %v\n", ev)
		default:
			log.Printf("Unexpected event type: %T\n", ev)
		}
	}

	// Flush any remaining messages
	log.Println("Flushing remaining messages...")
	producer.Flush(1500) // Wait up to 15 seconds
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
