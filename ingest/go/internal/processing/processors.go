package processing

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/messaging"
	"github.com/teamjorge/ibt"
	"github.com/teamjorge/ibt/headers"
)

type loaderProcessor struct {
	pubSub         *messaging.PubSub
	cache          []map[string]interface{}
	groupNumber    int
	thresholdBytes int
	workerID       int
	mu             sync.Mutex
	lastFlush      time.Time
	flushTimer     *time.Timer
	metrics        processorMetrics
	currentBytes   int
}

type processorMetrics struct {
	totalProcessed    int
	totalBatches      int
	processingTime    time.Duration
	maxBatchSize      int
	processingStarted time.Time
	mu                sync.Mutex
}

func NewLoaderProcessor(pubSub *messaging.PubSub, groupNumber int, config *config.Config, workerID int) *loaderProcessor {
	lp := &loaderProcessor{
		pubSub:         pubSub,
		cache:          make([]map[string]interface{}, 0, 1000), // Initial capacity
		groupNumber:    groupNumber,
		thresholdBytes: config.BatchSizeBytes,
		workerID:       workerID,
		lastFlush:      time.Now(),
		currentBytes:   0,
		metrics: processorMetrics{
			processingStarted: time.Now(),
		},
	}

	lp.flushTimer = time.AfterFunc(config.BatchTimeout, lp.flushTimerCallback)

	return lp
}

func (l *loaderProcessor) flushTimerCallback() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.cache) > 0 {
		log.Printf("Worker %d: Auto-flushing %d records (%d bytes) after timeout",
			l.workerID, len(l.cache), l.currentBytes)
		if err := l.loadBatch(); err != nil {
			log.Printf("Worker %d: Error during auto-flush: %v", l.workerID, err)
		}
	}

	l.flushTimer.Reset(10 * time.Second)
}

func (l *loaderProcessor) Whitelist() []string {
	return []string{
		"Lap", "LapDistPct", "Speed", "Throttle", "Brake", "Gear", "RPM",
		"SteeringWheelAngle", "VelocityX", "VelocityY", "VelocityZ", "Lat", "Lon", "SessionTime",
		"PlayerCarPosition", "FuelLevel", "PlayerCarIdx", "SessionNum", "alt", "LatAccel", "LongAccel",
		"VertAccel", "pitch", "roll", "yaw", "YawNorth", "Voltage", "LapLastLapTime", "WaterTemp",
		"LapDeltaToBestLap", "LapCurrentLapTime", "LFpressure", "RFpressure", "LRpressure", "RRpressure", "LFtempM",
		"RFtempM", "LRtempM", "RRtempM",
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
	enrichedInput["workerID"] = l.workerID

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

	estimatedSize := l.estimateJSONSize(enrichedInput)

	if l.currentBytes+estimatedSize > l.thresholdBytes && len(l.cache) > 0 {
		if err := l.loadBatch(); err != nil {
			return fmt.Errorf("failed to load batch: %w", err)
		}
	}

	l.cache = append(l.cache, enrichedInput)
	l.currentBytes += estimatedSize

	l.metrics.mu.Lock()
	l.metrics.totalProcessed++
	processingTime := time.Since(startTime)
	l.metrics.processingTime += processingTime
	if len(l.cache) > l.metrics.maxBatchSize {
		l.metrics.maxBatchSize = len(l.cache)
	}
	l.metrics.mu.Unlock()

	return nil
}

func (l *loaderProcessor) estimateJSONSize(record map[string]interface{}) int {

	size := 2

	for k, v := range record {

		size += len(k) + 3

		switch val := v.(type) {
		case string:
			size += len(val) + 2
		case int, int32, int64:
			size += 10
		case float32, float64:
			size += 15
		case bool:
			if val {
				size += 4
			} else {
				size += 5
			}
		default:
			size += 20
		}

		size += 1
	}

	return size
}

func (l *loaderProcessor) loadBatch() error {
	if len(l.cache) == 0 {
		return nil
	}

	batch := make([]map[string]interface{}, len(l.cache))
	copy(batch, l.cache)
	// batchSize := l.currentBytes

	l.cache = l.cache[:0]
	l.currentBytes = 0
	l.lastFlush = time.Now()

	l.metrics.mu.Lock()
	l.metrics.totalBatches++
	l.metrics.mu.Unlock()

	// log.Printf("Worker %d: Loading batch of %d records (%d bytes)",
	// 	l.workerID, len(batch), batchSize)

	return l.pubSub.Exec(batch)
}

func (l *loaderProcessor) Close() error {
	if l.flushTimer != nil {
		l.flushTimer.Stop()
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.cache) > 0 {
		log.Printf("Worker %d: Flushing remaining %d records (%d bytes) on close",
			l.workerID, len(l.cache), l.currentBytes)
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
	var pointsPerSecond int64
	if totalTime > 0 {
		pointsPerSecond = int64(l.metrics.totalProcessed) * 1000 / totalTime
	}

	log.Printf("Worker %d processing metrics for group %d:", l.workerID, l.groupNumber)
	log.Printf("  Total points processed: %d", l.metrics.totalProcessed)
	log.Printf("  Total batches sent: %d", l.metrics.totalBatches)
	log.Printf("  Maximum batch size: %d", l.metrics.maxBatchSize)
	log.Printf("  Processing time: %d milliseconds", totalTime)
	log.Printf("  Points per second: %d", pointsPerSecond)
}

func (l *loaderProcessor) GetMetrics() processorMetrics {
	l.metrics.mu.Lock()
	defer l.metrics.mu.Unlock()
	return l.metrics
}
