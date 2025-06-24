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

	lp.flushTimer = time.AfterFunc(10*time.Second, lp.flushTimerCallback)

	return lp
}

func (l *loaderProcessor) flushTimerCallback() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.cache) > 0 {
		log.Printf("Auto-flushing %d records after timeout", len(l.cache))
		if err := l.loadBatch(); err != nil {
			log.Printf("Error during auto-flush: %v", err)
		}
	}

	l.flushTimer.Reset(10 * time.Second)
}

func (l *loaderProcessor) Whitelist() []string {
	return []string{
		"Lap", "LapDistPct", "Speed", "Throttle", "Brake", "Gear", "RPM",
		"SteeringWheelAngle", "VelocityX", "VelocityY", "VelocityZ", "Lat", "Lon", "SessionTime",
		"LapCurrentLapTime", "PlayerCarPosition", "FuelLevel", "PlayerCarIdx", "SessionNum", "alt", "LatAccel",
		"LongAccel", "VertAccel", "pitch", "roll", "yaw", "YawNorth",
	}
}

func (l *loaderProcessor) Process(input ibt.Tick, hasNext bool, session *headers.Session) error {
	startTime := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	enrichedInput := make(map[string]interface{}, len(input)+2)
	for k, v := range input {
		enrichedInput[k] = v
	}
	enrichedInput["groupNum"] = l.groupNumber

	if session != nil && len(session.SessionInfo.Sessions) > 0 {
		sessionIndex := 0
		if len(session.SessionInfo.Sessions) > 2 {
			sessionIndex = 2
		}
		enrichedInput["sessionID"] = session.SessionInfo.Sessions[sessionIndex].SessionNum

		enrichedInput["trackDisplayShortName"] = session.WeekendInfo.TrackDisplayShortName
		enrichedInput["trackID"] = session.WeekendInfo.TrackID
	} else {
		enrichedInput["sessionID"] = 0
	}

	l.cache = append(l.cache, enrichedInput)

	l.metrics.mu.Lock()
	l.metrics.totalProcessed++
	processingTime := time.Since(startTime)
	l.metrics.processingTime += processingTime
	if len(l.cache) > l.metrics.maxBatchSize {
		l.metrics.maxBatchSize = len(l.cache)
	}
	l.metrics.mu.Unlock()

	if len(l.cache) >= l.threshold {
		if err := l.loadBatch(); err != nil {
			return fmt.Errorf("failed to load batch: %w", err)
		}
	}

	return nil
}

func (l *loaderProcessor) loadBatch() error {
	if len(l.cache) == 0 {
		return nil
	}

	batch := make([]map[string]interface{}, len(l.cache))
	copy(batch, l.cache)
	l.cache = l.cache[:0]

	l.lastFlush = time.Now()

	l.metrics.mu.Lock()
	l.metrics.totalBatches++
	l.metrics.mu.Unlock()

	return l.pubSub.Exec(batch)
}

func (l *loaderProcessor) Close() error {
	if l.flushTimer != nil {
		l.flushTimer.Stop()
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.cache) > 0 {
		log.Printf("Flushing remaining %d records on close", len(l.cache))
		if err := l.loadBatch(); err != nil {
			return fmt.Errorf("failed to flush data on close: %w", err)
		}
	}

	l.logMetrics()

	return nil
}

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
