package main

import (
	"context"
	"fmt"
	"log"

	"github.com/segmentio/kafka-go"
)

var (
	kafkaTopic = "large-files"
)

func main() {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:   []string{"localhost:9092", "localhost:9094", "localhost:9095"},
		Topic:     kafkaTopic,
		Partition: 0,
		MaxBytes:  209715200, // 600MB
	})
	r.SetOffset(0)

	for {
		m, err := r.ReadMessage(context.Background())
		if err != nil {
			log.Fatal("failed to read:", err)
			break
		}
		fmt.Printf("message at offset %d: %s = %s\n", m.Offset, string(m.Key), string(m.Value))
	}

	if err := r.Close(); err != nil {
		log.Fatal("failed to close reader:", err)
	}
}
