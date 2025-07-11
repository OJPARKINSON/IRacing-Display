package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

var (
	RabbitMqURL  = getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/") // "amqp://guest:guest@192.168.1.205:5672/"
	MaxBatchSize = getEnvAsInt("MAX_BATCH_SIZE", 1500)                          // 100 kb
	BatchTimeout = getEnvAsDuration("BATCH_TIMEOUT", 10*time.Second)
	MaxRetries   = getEnvAsInt("MAX_RETRIES", 3)
	RetryDelay   = getEnvAsDuration("RETRY_DELAY", 500*time.Millisecond)
)

type PubSub struct {
	conn          *amqp.Connection
	ch            *amqp.Channel
	sessionID     string
	sessionTime   time.Time
	mu            sync.Mutex
	batchesLoaded int
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	errorCh       chan error
	pointsBuffer  []byte
	bufferSize    int
	maxBufferSize int
}

func failOnError(err error, msg string) {
	if err != nil {
		log.Panicf("%s: %s", msg, err)
	}
}

func newPubSub(sessionId string, sessionTime time.Time) *PubSub {
	log.Printf("Connecting to RabbitMQ at %s", RabbitMqURL)

	conn, err := amqp.Dial(RabbitMqURL)
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
		ctx:           ctx,
		cancel:        cancel,
		errorCh:       make(chan error, 100),
		pointsBuffer:  make([]byte, 0, MaxBatchSize),
		maxBufferSize: MaxBatchSize,
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
			"lap_id":               fmt.Sprintf("%d", lapID),
			"speed":                getFloatValue(record, "Speed"),
			"lap_dist_pct":         getFloatValue(record, "LapDistPct"),
			"lap_current_lap_time": getFloatValue(record, "LapCurresntLapTime"),
			"session_id":           p.sessionID,
			"session_num":          sessionNum,
			"session_time":         sessionTime,
			"car_id":               carID,
			"track_name":           trackName,
			"track_id":             trackID,

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
			"tick_time":            tickTime.UTC(),
		}

		jsonData, err := json.Marshal(tick)
		if err != nil {
			log.Printf("Error marshaling point to JSON: %v", err)
		}

		if p.bufferSize == 0 {
			p.pointsBuffer = append(p.pointsBuffer, '[')
		} else {
			p.pointsBuffer = append(p.pointsBuffer, ',')
		}
		p.pointsBuffer = append(p.pointsBuffer, jsonData...)
		p.bufferSize++

		// Flush if buffer is full
		if p.bufferSize >= p.maxBufferSize {
			p.flushBuffer()
		}
	}

	p.batchesLoaded++
	log.Printf("Processed %d telemetry points in session %s (batch %d, buffer size: %d)",
		len(data), p.sessionID, p.batchesLoaded, p.bufferSize)

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

	failOnError(err, "Failed to publish message")

	p.pointsBuffer = p.pointsBuffer[:0]
	p.bufferSize = 0
}

func (p *PubSub) Close() error {
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
	return p.batchesLoaded
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return fallback
}

func getEnvAsDuration(key string, fallback time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return fallback
}
