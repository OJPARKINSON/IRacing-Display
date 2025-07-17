package messaging

import (
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

type PubSub struct {
	conn          *amqp.Connection
	ch            *amqp.Channel
	sessionID     string
	sessionTime   time.Time
	config        *config.Config
	mu            sync.Mutex
	batchesLoaded int
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	errorCh       chan error
	pointsBuffer  []byte
	bufferSize    int
	maxBufferSize int
	workerID      int
}

func failOnError(err error, msg string) {
	if err != nil {
		log.Panicf("%s: %s", msg, err)
	}
}

func NewPubSub(sessionId string, sessionTime time.Time, cfg *config.Config) *PubSub {
	log.Printf("Connecting to RabbitMQ at %s", cfg.RabbitMQURL)

	conn, err := amqp.Dial(cfg.RabbitMQURL)
	failOnError(err, "Failed to connect to RabbitMQ")

	ch, err := conn.Channel()
	failOnError(err, "failed to open channel")

	err = ch.ExchangeDeclare("telemetry_topic", "topic", true, false, false, false, nil)
	failOnError(err, "Failed to declare exchange")

	q, err := ch.QueueDeclare(
		"telemetry_queue",
		true,
		false,
		false,
		false,
		nil,
	)
	failOnError(err, "Failed to declare queue")

	err = ch.QueueBind(
		q.Name,
		"telemetry.#",
		"telemetry_topic",
		false,
		nil,
	)
	failOnError(err, "Failed to bind queue")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)

	return &PubSub{
		conn:          conn,
		ch:            ch,
		sessionID:     sessionId,
		sessionTime:   sessionTime,
		config:        cfg,
		ctx:           ctx,
		cancel:        cancel,
		errorCh:       make(chan error, 100),
		pointsBuffer:  make([]byte, 0, cfg.BatchSizeBytes),
		maxBufferSize: cfg.BatchSizeBytes,
	}
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
			log.Printf("Float parse error for key %s: %v", key, err)
		case int:
			return float64(v)
		case int64:
			return float64(v)
		case float32:
			return float64(v)
		default:
			log.Printf("Unexpected type for key %s: %T", key, v)
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
			log.Printf("Integer parse error for key %s: %v", key, err)
		default:
			log.Printf("Unexpected type for key %s: %T", key, v)
		}
	}
	return 0
}

func (p *PubSub) Exec(data []map[string]interface{}) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if len(data) == 0 {
		return nil
	}

	workerID := 0
	if len(data) > 0 {
		if wid, ok := data[0]["workerID"]; ok {
			if widInt, ok := wid.(int); ok {
				workerID = widInt
			}
		}
	}

	for _, record := range data {
		lapID := getIntValue(record, "Lap")
		sessionTime := getFloatValue(record, "SessionTime")

		sessionNum := ""
		if val, ok := record["SessionNum"]; ok {
			sessionNum = fmt.Sprintf("%v", val)
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

		tickTime := p.sessionTime.Add(time.Duration(sessionTime * float64(time.Second)))

		tick := map[string]interface{}{
			"lap_id":       fmt.Sprintf("%d", lapID),
			"speed":        getFloatValue(record, "Speed"),
			"lap_dist_pct": getFloatValue(record, "LapDistPct"),
			"session_id":   p.sessionID,
			"session_num":  sessionNum,
			"session_time": sessionTime,
			"car_id":       carID,
			"track_name":   trackName,
			"track_id":     trackID,
			"worker_id":    workerID,

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

		jsonData, err := json.Marshal(tick)
		if err != nil {
			log.Printf("Error marshaling point to JSON: %v", err)
			continue
		}

		if p.bufferSize == 0 {
			p.pointsBuffer = append(p.pointsBuffer, '[')
		} else {
			p.pointsBuffer = append(p.pointsBuffer, ',')
		}
		p.pointsBuffer = append(p.pointsBuffer, jsonData...)
		p.bufferSize++

		if len(p.pointsBuffer) >= p.maxBufferSize-1000 { // Leave 1KB buffer
			p.flushBuffer()
		}
	}

	p.batchesLoaded++
	// log.Printf("Worker %d: Processed %d telemetry points in session %s (batch %d, buffer size: %d)",
	// 	workerID, len(data), p.sessionID, p.batchesLoaded, p.bufferSize)

	p.flushBuffer()

	return nil
}

func (p *PubSub) flushBuffer() {
	if p.bufferSize == 0 {
		return
	}

	p.pointsBuffer = append(p.pointsBuffer, ']')

	err := p.ch.PublishWithContext(p.ctx, "telemetry_topic", "telemetry.ticks", true, false, amqp.Publishing{
		ContentType: "text/plain",
		Body:        p.pointsBuffer,
	})

	if err != nil {
		log.Printf("Failed to publish message: %v", err)
	}

	p.pointsBuffer = p.pointsBuffer[:0]
	p.bufferSize = 0
}

func (p *PubSub) Close() error {
	p.mu.Lock()
	p.flushBuffer()
	p.mu.Unlock()

	p.cancel()
	p.wg.Wait()

	if p.ch != nil {
		p.ch.Close()
	}

	if p.conn != nil {
		p.conn.Close()
	}

	log.Println("Closed RabbitMQ connection.")
	return nil
}

func (p *PubSub) Loaded() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.batchesLoaded
}
