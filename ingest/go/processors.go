package main

import (
	"fmt"
	"sync"

	"github.com/teamjorge/ibt"
	"github.com/teamjorge/ibt/headers"
)

type loaderProcessor struct {
	*storage
	cache       []map[string]interface{}
	groupNumber int
	threshold   int
	mu          sync.Mutex
}

// Constructor for creating our processor
func newLoaderProcessor(storage *storage, groupNumber int, threshold int) *loaderProcessor {
	return &loaderProcessor{
		storage:     storage,
		cache:       make([]map[string]interface{}, 0, threshold),
		groupNumber: groupNumber,
		threshold:   threshold,
	}
}

// Columns we want to parse from telemetry
func (l *loaderProcessor) Whitelist() []string {
	return []string{
		"Lap", "LapDistPct", "Speed", "Throttle", "Brake", "Gear", "RPM",
		"SteeringWheelAngle", "VelocityX", "VelocityY", "Lat", "Lon",
	}
}

// Process a single tick of telemetry.
func (l *loaderProcessor) Process(input ibt.Tick, hasNext bool, session *headers.Session) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	input["groupNum"] = l.groupNumber
	l.cache = append(l.cache, input)

	// Bulk load if threshold is reached
	if len(l.cache) >= l.threshold {
		if err := l.loadBatch(); err != nil {
			return fmt.Errorf("failed to load batch - %v", err)
		}
		l.cache = l.cache[:0] // Reset cache
	}

	return nil
}

// Loads batch data efficiently
func (l *loaderProcessor) loadBatch() error {
	return l.Exec(l.cache)
}
