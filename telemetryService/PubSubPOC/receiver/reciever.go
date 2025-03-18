package main

import (
	"fmt"
	"log"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

var (
	kafkaTopic = "large-files"
)

func main() {
	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":         "localhost:9092,localhost:9094,localhost:9095",
		"group.id":                  "file-processor-group",
		"auto.offset.reset":         "earliest",
		"fetch.message.max.bytes":   409715200, // 200MB
		"max.partition.fetch.bytes": 409715200,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer consumer.Close()

	consumer.SubscribeTopics([]string{kafkaTopic}, nil)

	for {
		msg, err := consumer.ReadMessage(time.Second * 10)

		if err == nil {
			// Process your 200MB file
			fmt.Printf("Message on %s: %s bytes\n", msg.TopicPartition, len(msg.Value))

			// Commit the message
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
