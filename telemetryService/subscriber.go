package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/nats-io/nats.go"
)

func main() {
	// Connect to NATS server
	nc, err := nats.Connect("nats://localhost:4222")
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	defer nc.Close()

	// Create JetStream context
	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("Failed to get JetStream context: %v", err)
	}

	// Ensure the stream exists (you can also create this via CLI beforehand)
	_, err = js.AddStream(&nats.StreamConfig{
		Name:     "TELEMETRY",
		Subjects: []string{"telemetry.*"},
		Storage:  nats.FileStorage,
		MaxAge:   72 * time.Hour,
	})
	if err != nil {
		log.Fatalf("Failed to create stream: %v", err)
	}

	// Read the file as binary data
	fileData, err := os.ReadFile("ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt")
	if err != nil {
		log.Fatalf("Failed to read file: %v", err)
	}

	fmt.Println(len(fileData))

	mp := nc.MaxPayload()
	log.Printf("Maximum payload is %v bytes", mp)

	// Publish the binary data
	// pubAck, err := js.Publish("telemetry.raw", fileData)
	// if err != nil {
	// 	log.Fatalf("Failed to publish message: %v", err)
	// }

	// fmt.Printf("Published message with sequence %d\n", pubAck.Sequence)
}
