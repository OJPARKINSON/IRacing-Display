package processing

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/messaging"
	"github.com/OJPARKINSON/ibt"
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
	batchBuffer    []map[string]interface{}
	bufferPool     *sync.Pool
	config         *config.Config

	// Session info mapping for all available sessions
	sessionMap     map[int]sessionInfo // Maps SessionNum to session details
	trackName      string
	trackID        int
	sessionInfoSet bool
}

type sessionInfo struct {
	sessionNum  int
	sessionType string
	sessionName string
}

type processorMetrics struct {
	totalProcessed    int
	totalBatches      int
	processingTime    time.Duration
	maxBatchSize      int
	processingStarted time.Time
}

func NewLoaderProcessor(pubSub *messaging.PubSub, groupNumber int, config *config.Config, workerID int) *loaderProcessor {
	lp := &loaderProcessor{
		pubSub:         pubSub,
		cache:          make([]map[string]interface{}, 0, 1000), // Initial capacity
		groupNumber:    groupNumber,
		config:         config,
		thresholdBytes: config.BatchSizeBytes,
		workerID:       workerID,
		lastFlush:      time.Now(),
		currentBytes:   0,
		sessionMap:     make(map[int]sessionInfo),
		metrics: processorMetrics{
			processingStarted: time.Now(),
		},
		batchBuffer: make([]map[string]interface{}, 0, 1000),
		bufferPool: &sync.Pool{
			New: func() interface{} {
				return make(map[string]interface{}, 64)
			},
		},
	}

	return lp
}

func (l *loaderProcessor) flushTimerCallback() {
	l.mu.Lock()
	hasData := len(l.cache) > 0
	if hasData {
		if err := l.loadBatch(); err != nil {
			log.Printf("Worker %d: Error during auto-flush: %v", l.workerID, err)
		}
	}
	l.mu.Unlock()

	l.flushTimer.Reset(l.config.BatchTimeout)
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
	// Build session map once on first call instead of every tick
	if !l.sessionInfoSet && session != nil && len(session.SessionInfo.Sessions) > 0 {
		// Map all available sessions by their SessionNum
		for _, sess := range session.SessionInfo.Sessions {
			l.sessionMap[sess.SessionNum] = sessionInfo{
				sessionNum:  sess.SessionNum,
				sessionType: sess.SessionType,
				sessionName: sess.SessionName,
			}
		}
		l.trackName = session.WeekendInfo.TrackDisplayShortName
		l.trackID = session.WeekendInfo.TrackID
		l.sessionInfoSet = true
		
		log.Printf("Worker %d: Mapped %d sessions for track %s", 
			l.workerID, len(l.sessionMap), l.trackName)
	}

	if l.metrics.totalProcessed%50000 == 0 {
		log.Printf("Worker %d: Processed %d records, current batch size: %d",
			l.workerID, l.metrics.totalProcessed, len(l.cache))
	}

	enrichedInput := l.bufferPool.Get().(map[string]interface{})
	
	for k, v := range input {
		enrichedInput[k] = v
	}

	enrichedInput["groupNum"] = l.groupNumber
	enrichedInput["workerID"] = l.workerID

	if l.sessionInfoSet {
		enrichedInput["trackDisplayShortName"] = l.trackName
		enrichedInput["trackID"] = l.trackID
		
		// Use the actual SessionNum from telemetry data to get session info  
		if sessionNumVal, ok := input["SessionNum"]; ok {
			if sessionNum, ok := sessionNumVal.(int); ok {
				if sessionInfo, exists := l.sessionMap[sessionNum]; exists {
					enrichedInput["sessionID"] = sessionInfo.sessionNum
					enrichedInput["sessionType"] = sessionInfo.sessionType
					enrichedInput["sessionName"] = sessionInfo.sessionName
				} else {
					// Fallback if session not found in map
					enrichedInput["sessionID"] = sessionNum
					enrichedInput["sessionType"] = "Unknown"
					enrichedInput["sessionName"] = "Unknown"
				}
			} else {
				// Fallback if conversion fails
				enrichedInput["sessionID"] = 0
				enrichedInput["sessionType"] = "Unknown"
				enrichedInput["sessionName"] = "Unknown"
			}
		} else {
			// Fallback if SessionNum not present
			enrichedInput["sessionID"] = 0
			enrichedInput["sessionType"] = "Unknown"
			enrichedInput["sessionName"] = "Unknown"
		}
	} else {
		enrichedInput["sessionID"] = 0
		enrichedInput["sessionType"] = "Unknown"
		enrichedInput["sessionName"] = "Unknown"
	}

	estimatedSize := len(input)*20 + 100 // Rough estimate

	l.mu.Lock()

	// PERFORMANCE OPTIMIZATION: Dynamic batch size based on memory pressure
	maxBatchSize := 2000
	if l.currentBytes > l.thresholdBytes/2 {
		maxBatchSize = 1000 // Reduce batch size when memory pressure is high
	}
	
	shouldFlush := len(l.cache) >= maxBatchSize || l.currentBytes+estimatedSize > l.thresholdBytes
	if shouldFlush && len(l.cache) > 0 {
		if l.metrics.totalBatches%100 == 0 {
			log.Printf("Worker %d: Flushing batch at %d records",
				l.workerID, len(l.cache))
		}
		if err := l.loadBatch(); err != nil {
			l.mu.Unlock()
			// No need to put back since we're using new maps
			return fmt.Errorf("failed to load batch: %w", err)
		}
	}

	// PERFORMANCE OPTIMIZATION: Pre-allocate cache capacity to reduce slice growth
	if cap(l.cache) == 0 {
		l.cache = make([]map[string]interface{}, 0, 2000)
	}
	l.cache = append(l.cache, enrichedInput)
	l.currentBytes += estimatedSize

	l.metrics.totalProcessed++
	if len(l.cache) > l.metrics.maxBatchSize {
		l.metrics.maxBatchSize = len(l.cache)
	}

	l.mu.Unlock()

	return nil
}

func (l *loaderProcessor) estimateJSONSize(record map[string]interface{}) int {

	size := 2

	for k, v := range record {

		size += len(k) + 3

		switch val := v.(type) {
		case string:
			size += len(val) + 2
		case int:
			if val == 0 {
				size += 1
			} else if val < 0 {
				size += 1 + intDigits(-val)
			} else {
				size += intDigits(val)
			}
		case int32, int64:
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

func intDigits(n int) int {
	if n < 10 {
		return 1
	}
	if n < 100 {
		return 2
	}
	if n < 1000 {
		return 3
	}
	if n < 10000 {
		return 4
	}
	if n < 100000 {
		return 5
	}
	if n < 1000000 {
		return 6
	}
	return 7
}

func (l *loaderProcessor) loadBatch() error {
	if len(l.cache) == 0 {
		return nil
	}

	if cap(l.batchBuffer) < len(l.cache) {
		l.batchBuffer = make([]map[string]interface{}, len(l.cache))
	} else {
		l.batchBuffer = l.batchBuffer[:len(l.cache)]
	}

	copy(l.batchBuffer, l.cache)

	var err error
	if !l.config.DisableRabbitMQ {
		err = l.pubSub.Exec(l.batchBuffer)
	}

	for _, m := range l.cache {
		// Clear the map before returning to pool to prevent memory leaks
		for k := range m {
			delete(m, k)
		}
		l.bufferPool.Put(m)
	}

	l.cache = l.cache[:0]
	l.currentBytes = 0
	l.lastFlush = time.Now()

	l.metrics.totalBatches++

	return err
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
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.metrics
}
