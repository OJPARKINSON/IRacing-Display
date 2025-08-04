package messaging

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	amqp "github.com/rabbitmq/amqp091-go"
)

var jsonBufferPool = sync.Pool{
	New: func() interface{} {
		return &bytes.Buffer{}
	},
}

type ConnectionPool struct {
	connections []*amqp.Connection
	channels    []*amqp.Channel
	mu          sync.RWMutex
	url         string
	poolSize    int
	current     int
}

func NewConnectionPool(url string, poolSize int) (*ConnectionPool, error) {
	pool := &ConnectionPool{
		connections: make([]*amqp.Connection, poolSize),
		channels:    make([]*amqp.Channel, poolSize),
		url:         url,
		poolSize:    poolSize,
	}

	for i := 0; i < poolSize; i++ {
		conn, err := amqp.Dial(url)
		if err != nil {
			pool.Close()
			return nil, fmt.Errorf("failed to create connection %d: %w", i, err)
		}

		ch, err := conn.Channel()
		if err != nil {
			conn.Close()
			pool.Close()

			return nil, fmt.Errorf("failed to create channel %d: %w", i, err)
		}

		err = ch.Qos(1000, 0, false)
		if err != nil {
			ch.Close()
			conn.Close()
			pool.Close()
			return nil, fmt.Errorf("failed to set Qos for channel %d: %w", i, err)
		}

		pool.connections[i] = conn
		pool.channels[i] = ch
	}

	return pool, nil
}

func (p *ConnectionPool) GetChannel() *amqp.Channel {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if p.channels == nil || len(p.channels) == 0 {
		return nil
	}

	ch := p.channels[p.current]
	p.current = (p.current + 1) % p.poolSize

	// Check if channel is still open
	if ch == nil || ch.IsClosed() {
		log.Printf("Channel %d is closed, attempting to recreate", p.current-1)
		return nil
	}

	return ch
}

func (p *ConnectionPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for i := 0; i < len(p.channels); i++ {
		if p.channels[i] != nil {
			p.channels[i].Close()
		}
	}
}

type PubSub struct {
	pool          *ConnectionPool
	sessionID     string
	sessionTime   time.Time
	config        *config.Config
	mu            sync.Mutex
	batchesLoaded int
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup

	messageBatch []amqp.Publishing
	batchSize    int
	maxBatchSize int
	workerID     int

	totalMessages int64
	totalBatches  int64
	lastFlush     time.Time
}

func NewPubSub(sessionId string, sessionTime time.Time, cfg *config.Config, pool *ConnectionPool) *PubSub {
	log.Printf("Connecting to RabbitMQ at %s", cfg.RabbitMQURL)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)

	ps := &PubSub{
		pool:         pool,
		sessionID:    sessionId,
		sessionTime:  sessionTime,
		config:       cfg,
		ctx:          ctx,
		cancel:       cancel,
		messageBatch: make([]amqp.Publishing, 0, 100),
		maxBatchSize: 100,
		lastFlush:    time.Now(),
	}

	return ps
}

func getFloatValue(record map[string]interface{}, key string) float64 {
	if val, ok := record[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case string:
			f, err := strconv.ParseFloat(v, 64)
			if err == nil {
				return f
			}
		case int:
			return float64(v)
		case int64:
			return float64(v)
		case float32:
			return float64(v)
		}
	}
	return 0.0
}

func getIntValue(record map[string]interface{}, key string) int {
	if val, ok := record[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case int64:
			return int(v)
		case float64:
			return int(v)
		case string:
			i, err := strconv.Atoi(v)
			if err == nil {
				return i
			}
		}
	}
	return 0
}

func (ps *PubSub) Exec(data []map[string]interface{}) error {
	if len(data) == 0 {
		return nil
	}

	ps.mu.Lock()
	defer ps.mu.Unlock()

	// Get worker ID from first record
	workerID := 0
	if len(data) > 0 {
		if wid, ok := data[0]["workerID"]; ok {
			if widInt, ok := wid.(int); ok {
				workerID = widInt
				ps.workerID = workerID
			}
		}
	}

	batchMessages := make([]map[string]interface{}, 0, len(data))

	for _, record := range data {
		lapID := getIntValue(record, "Lap")
		sessionTime := getFloatValue(record, "SessionTime")

		sessionNum := ""
		if val, ok := record["SessionNum"]; ok {
			sessionNum = fmt.Sprintf("%v", val)
		}

		sessionType := ""
		if val, ok := record["sessionType"]; ok {
			sessionType = fmt.Sprintf("%v", val)
		}

		sessionName := ""
		if val, ok := record["sessionName"]; ok {
			sessionName = fmt.Sprintf("%v", val)
		}

		trackName := ""
		if val, ok := record["trackDisplayShortName"]; ok {
			trackName = fmt.Sprintf("%v", val)
			trackName = strings.ReplaceAll(trackName, " ", "-")
		}

		trackID := ""
		if val, ok := record["trackID"]; ok {
			trackID = fmt.Sprintf("%v", val)
		}

		carID := ""
		if val, ok := record["PlayerCarIdx"]; ok {
			carID = fmt.Sprintf("%v", val)
		}

		tickTime := ps.sessionTime.Add(time.Duration(sessionTime * float64(time.Second)))

		tick := map[string]interface{}{
			"lap_id":               fmt.Sprintf("%d", lapID),
			"speed":                getFloatValue(record, "Speed"),
			"lap_dist_pct":         getFloatValue(record, "LapDistPct"),
			"session_id":           ps.sessionID,
			"session_num":          sessionNum,
			"session_type":         sessionType,
			"session_name":         sessionName,
			"session_time":         sessionTime,
			"car_id":               carID,
			"track_name":           trackName,
			"track_id":             trackID,
			"worker_id":            workerID,
			"steering_wheel_angle": getFloatValue(record, "SteeringWheelAngle"),
			"player_car_position":  getFloatValue(record, "PlayerCarPosition"),
			"velocity_x":           getFloatValue(record, "VelocityX"),
			"velocity_y":           getFloatValue(record, "VelocityY"),
			"velocity_z":           getFloatValue(record, "VelocityZ"),
			"fuel_level":           getFloatValue(record, "FuelLevel"),
			"throttle":             getFloatValue(record, "Throttle"),
			"brake":                getFloatValue(record, "Brake"),
			"rpm":                  getFloatValue(record, "RPM"),
			"lat":                  getFloatValue(record, "Lat"),
			"lon":                  getFloatValue(record, "Lon"),
			"gear":                 getIntValue(record, "Gear"),
			"alt":                  getFloatValue(record, "Alt"),
			"lat_accel":            getFloatValue(record, "LatAccel"),
			"long_accel":           getFloatValue(record, "LongAccel"),
			"vert_accel":           getFloatValue(record, "VertAccel"),
			"pitch":                getFloatValue(record, "Pitch"),
			"roll":                 getFloatValue(record, "Roll"),
			"yaw":                  getFloatValue(record, "Yaw"),
			"yaw_north":            getFloatValue(record, "YawNorth"),
			"voltage":              getFloatValue(record, "Voltage"),
			"lapLastLapTime":       getFloatValue(record, "LapLastLapTime"),
			"waterTemp":            getFloatValue(record, "WaterTemp"),
			"lapDeltaToBestLap":    getFloatValue(record, "LapDeltaToBestLap"),
			"lapCurrentLapTime":    getFloatValue(record, "LapCurrentLapTime"),
			"lFpressure":           getFloatValue(record, "LFpressure"),
			"rFpressure":           getFloatValue(record, "RFpressure"),
			"lRpressure":           getFloatValue(record, "LRpressure"),
			"rRpressure":           getFloatValue(record, "RRpressure"),
			"lFtempM":              getFloatValue(record, "LFtempM"),
			"rFtempM":              getFloatValue(record, "RFtempM"),
			"lRtempM":              getFloatValue(record, "LRtempM"),
			"rRtempM":              getFloatValue(record, "RRtempM"),
			"tick_time":            tickTime.UTC(),
		}

		batchMessages = append(batchMessages, tick)
	}

	buf := jsonBufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer jsonBufferPool.Put(buf)

	err := json.NewEncoder(buf).Encode(batchMessages)
	if err != nil {
		return fmt.Errorf("error marshaling batch to JSON: %w", err)
	}
	jsonData := buf.Bytes()

	publishing := amqp.Publishing{
		ContentType:  "application/json",
		Body:         jsonData,
		DeliveryMode: amqp.Transient,
		Headers: amqp.Table{
			"worker_id":  workerID,
			"batch_size": len(data),
			"session_id": ps.sessionID,
		},
	}

	// Add to batch
	ps.messageBatch = append(ps.messageBatch, publishing)
	ps.batchSize += len(jsonData)
	ps.totalMessages += int64(len(data))

	ps.flushBatch()

	ps.batchesLoaded++
	return nil
}

func (ps *PubSub) flushBatch() {
	if len(ps.messageBatch) == 0 {
		return
	}

	maxRetries := 3
	batchSize := len(ps.messageBatch)
	
	for retry := 0; retry < maxRetries; retry++ {
		ch := ps.pool.GetChannel()
		if ch == nil {
			log.Printf("Worker %d: Failed to get channel from pool (attempt %d/%d)", ps.workerID, retry+1, maxRetries)
			if retry < maxRetries-1 {
				time.Sleep(time.Duration(retry+1) * 100 * time.Millisecond)
				continue
			}
			return
		}

		publishedCount := 0
		// Create a context with timeout for publishing
		ctx, cancel := context.WithTimeout(ps.ctx, 10*time.Second)

		publishSuccess := true
		for _, msg := range ps.messageBatch {
			err := ch.PublishWithContext(
				ctx,
				"telemetry_topic",
				"telemetry.ticks",
				false,
				false,
				msg,
			)
			if err != nil {
				log.Printf("Worker %d: Failed to publish message (attempt %d/%d): %v", ps.workerID, retry+1, maxRetries, err)
				publishSuccess = false
				break
			}
			publishedCount++
		}
		cancel()

		if publishSuccess {
			ps.messageBatch = ps.messageBatch[:0]
			ps.batchSize = 0
			ps.totalBatches++
			ps.lastFlush = time.Now()

			if ps.totalBatches%50 == 0 {
				log.Printf("Worker %d: Published batch %d (%d messages, %d/batch)",
					ps.workerID, ps.totalBatches, publishedCount, batchSize)
			}
			return
		}

		// If we failed, wait before retrying
		if retry < maxRetries-1 {
			time.Sleep(time.Duration(retry+1) * 250 * time.Millisecond)
		}
	}

	// If we get here, all retries failed
	log.Printf("Worker %d: Failed to publish batch after %d retries, dropping %d messages", 
		ps.workerID, maxRetries, batchSize)
	ps.messageBatch = ps.messageBatch[:0]
	ps.batchSize = 0
}

func (ps *PubSub) Close() error {
	ps.mu.Lock()
	ps.flushBatch()
	ps.mu.Unlock()

	ps.cancel()
	ps.wg.Wait()

	log.Printf("Worker %d: Closed PubSub. Total: %d messages, %d batches",
		ps.workerID, ps.totalMessages, ps.totalBatches)

	return nil
}

func (ps *PubSub) Loaded() int {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	return ps.batchesLoaded
}
