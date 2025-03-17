package main

import (
	"context"
	"log"

	"github.com/segmentio/kafka-go"
)

var (
	kafkaTopic = "large-files"
)

func main() {
	w := &kafka.Writer{
		Addr:     kafka.TCP("localhost:9092", "localhost:9094", "localhost:9095"),
		Topic:    kafkaTopic,
		Balancer: &kafka.LeastBytes{},
	}

	err := w.WriteMessages(context.Background(),
		kafka.Message{
			Key:   []byte("Key-A"),
			Value: []byte("Hello World!"),
		},
		kafka.Message{
			Key:   []byte("Key-B"),
			Value: []byte("One!"),
		},
		kafka.Message{
			Key:   []byte("Key-C"),
			Value: []byte("Two!"),
		},
	)
	if err != nil {
		log.Fatal("failed to write messages:", err)
	}

	if err := w.Close(); err != nil {
		log.Fatal("failed to close writer:", err)
	}

}
