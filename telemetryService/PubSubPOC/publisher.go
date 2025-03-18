package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func main() {
	fileName, fileData := getFile()
	topic := "large-files"

	// Configure the producer
	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers":            "localhost:9092",
		"message.max.bytes":            209715200, // ~400MB
		"delivery.timeout.ms":          600000,    // 5 minutes
		"socket.send.buffer.bytes":     100000000,
		"receive.message.max.bytes":    209715200,
		"queue.buffering.max.messages": 10,
		"queue.buffering.max.kbytes":   419430400, // ~400MB
	})
	if err != nil {
		log.Fatalf("Failed to create producer: %s", err)
	}
	defer producer.Close()

	// Create a delivery channel for async delivery reports
	deliveryChan := make(chan kafka.Event)

	// Produce message
	err = producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Key:            []byte(fileName),
		Value:          fileData,
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

	// Flush any remaining messages
	log.Println("Flushing remaining messages...")
	producer.Flush(15000) // Wait up to 15 seconds
}

func getFile() (string, []byte) {
	filePath := "../ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt"
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
