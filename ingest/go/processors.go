package main

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/teamjorge/ibt"
	"github.com/teamjorge/ibt/headers"
)

type loaderProcessor struct {
	pubSub      *PubSub
	cache       []map[string]interface{}
	groupNumber int
	threshold   int
	mu          sync.Mutex
	lastFlush   time.Time
	flushTimer  *time.Timer
	metrics     processorMetrics
}

type processorMetrics struct {
	totalProcessed    int
	totalBatches      int
	processingTime    time.Duration
	maxBatchSize      int
	processingStarted time.Time
	mu                sync.Mutex
}

// newLoaderProcessor creates a new processor with the specified parameters
func newLoaderProcessor(pubSub *PubSub, groupNumber int, threshold int) *loaderProcessor {
	lp := &loaderProcessor{
		pubSub:      pubSub,
		cache:       make([]map[string]interface{}, 0, threshold),
		groupNumber: groupNumber,
		threshold:   threshold,
		lastFlush:   time.Now(),
		metrics: processorMetrics{
			processingStarted: time.Now(),
		},
	}

	// Start automatic flush timer (ensure data is sent even if threshold isn't reached)
	lp.flushTimer = time.AfterFunc(10*time.Second, lp.flushTimerCallback)

	return lp
}

// flushTimerCallback handles automatic flushing of data on timer
func (l *loaderProcessor) flushTimerCallback() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.cache) > 0 {
		log.Printf("Auto-flushing %d records after timeout", len(l.cache))
		if err := l.loadBatch(); err != nil {
			log.Printf("Error during auto-flush: %v", err)
		}
	}

	// Reset timer
	l.flushTimer.Reset(10 * time.Second)
}

// Whitelist returns the list of telemetry fields to process
func (l *loaderProcessor) Whitelist() []string {
	return []string{
		"Lap", "LapDistPct", "Speed", "Throttle", "Brake", "Gear", "RPM",
		"SteeringWheelAngle", "VelocityX", "VelocityY", "Lat", "Lon", "SessionTime",
		"LapCurrentLapTime", "PlayerCarPosition", "FuelLevel", "PlayerCarIdx",
	}
}

// Process handles a single telemetry tick
func (l *loaderProcessor) Process(input ibt.Tick, hasNext bool, session *headers.Session) error {
	startTime := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	// Add group and session information
	enrichedInput := make(map[string]interface{}, len(input)+2)
	for k, v := range input {
		enrichedInput[k] = v
	}
	enrichedInput["groupNum"] = l.groupNumber

	// Select the correct session if available
	if session != nil && len(session.SessionInfo.Sessions) > 0 {
		// Default to the first session if index 2 doesn't exist
		sessionIndex := 0
		if len(session.SessionInfo.Sessions) > 2 {
			sessionIndex = 2
		}
		enrichedInput["sessionID"] = session.SessionInfo.Sessions[sessionIndex].SessionNum
	} else {
		enrichedInput["sessionID"] = 0
	}

	// Add to cache
	l.cache = append(l.cache, enrichedInput)

	// Update metrics
	l.metrics.mu.Lock()
	l.metrics.totalProcessed++
	processingTime := time.Since(startTime)
	l.metrics.processingTime += processingTime
	if len(l.cache) > l.metrics.maxBatchSize {
		l.metrics.maxBatchSize = len(l.cache)
	}
	l.metrics.mu.Unlock()

	// Load batch if threshold is reached
	if len(l.cache) >= l.threshold {
		if err := l.loadBatch(); err != nil {
			return fmt.Errorf("failed to load batch: %w", err)
		}
	}

	return nil
}

// loadBatch sends a batch of data to storage
func (l *loaderProcessor) loadBatch() error {
	if len(l.cache) == 0 {
		return nil
	}

	// Create a copy of the cache to avoid holding the lock during database operations
	batch := make([]map[string]interface{}, len(l.cache))
	copy(batch, l.cache)
	l.cache = l.cache[:0]

	// Reset the last flush time
	l.lastFlush = time.Now()

	// Update metrics
	l.metrics.mu.Lock()
	l.metrics.totalBatches++
	l.metrics.mu.Unlock()

	// Send the batch to storage
	return l.pubSub.Exec(batch)
}

// Close performs any necessary cleanup for the processor
func (l *loaderProcessor) Close() error {
	// Stop the timer
	if l.flushTimer != nil {
		l.flushTimer.Stop()
	}

	// Flush any remaining data
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.cache) > 0 {
		log.Printf("Flushing remaining %d records on close", len(l.cache))
		if err := l.loadBatch(); err != nil {
			return fmt.Errorf("failed to flush data on close: %w", err)
		}
	}

	// Log processing metrics
	l.logMetrics()

	return nil
}

// logMetrics outputs processing statistics
func (l *loaderProcessor) logMetrics() {
	l.metrics.mu.Lock()
	defer l.metrics.mu.Unlock()

	totalTime := time.Since(l.metrics.processingStarted).Milliseconds()
	pointsPerSecond := int64(l.metrics.totalProcessed) / totalTime

	log.Printf("Processing metrics for group %d:", l.groupNumber)
	log.Printf("  Total points processed: %d", l.metrics.totalProcessed)
	log.Printf("  Total batches sent: %d", l.metrics.totalBatches)
	log.Printf("  Maximum batch size: %d", l.metrics.maxBatchSize)
	log.Printf("  Processing time: %d milliseconds", totalTime)
	log.Printf("  Points per second: %d", pointsPerSecond)
}
