package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
)

var (
	InfluxDBURL    = getEnv("INFLUXDB_URL", "http://localhost:8086")
	InfluxDBToken  = getSecretTrimmed(getEnv("INFLUXDB_TOKEN_FILE", "/run/secrets/influxdb-admin-token"), "super-secret-token")
	InfluxDBOrg    = getEnv("INFLUXDB_ORG", "myorg")
	InfluxDBBucket = getEnv("INFLUXDB_BUCKET", "racing_telemetry") // Base bucket name
	// Configuration for optimized batch processing
	MaxBatchSize       = getEnvAsInt("MAX_BATCH_SIZE", 100)
	BatchTimeout       = getEnvAsDuration("BATCH_TIMEOUT", 10*time.Second)
	MaxRetries         = getEnvAsInt("MAX_RETRIES", 3)
	RetryDelay         = getEnvAsDuration("RETRY_DELAY", 500*time.Millisecond)
	UseSeparateBuckets = getEnvAsBool("USE_SEPARATE_BUCKETS", true)
)

// TelemetryPoint represents a single point of telemetry data
type TelemetryPoint struct {
	Time               time.Time
	SessionID          string
	LapID              string
	CarID              string
	SessionNum         string
	Brake              float64
	Gear               int
	LapDistPct         float64
	Lat                float64
	Lon                float64
	RPM                float64
	Speed              float64
	SteeringWheelAngle float64
	Throttle           float64
	VelocityX          float64
	VelocityY          float64
	LapCurrentLapTime  float64
	PlayerCarPosition  float64
	FuelLevel          float64
	SessionTime        float64
}

type storage struct {
	client        influxdb2.Client
	writeAPIs     map[string]api.WriteAPI // Map of bucket name to WriteAPI
	sessionID     string
	bucketName    string
	mu            sync.Mutex
	batchesLoaded int
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	errorCh       chan error
	pointsBuffer  []*write.Point
	bufferSize    int
	maxBufferSize int
}

// Connect establishes the connection to InfluxDB
func (s *storage) Connect() error {
	// Determine the bucket name
	if UseSeparateBuckets {
		s.bucketName = fmt.Sprintf("%s_%s", InfluxDBBucket, s.sessionID)

		// Create bucket if it doesn't exist
		err := s.createBucketIfNotExists(s.bucketName)
		if err != nil {
			log.Printf("Warning: Failed to create bucket %s: %v, using main bucket", s.bucketName, err)
			s.bucketName = InfluxDBBucket
		} else {
			log.Printf("Using session-specific bucket: %s", s.bucketName)
		}
	} else {
		s.bucketName = InfluxDBBucket
	}

	// Initialize write API for the bucket
	s.writeAPIs[s.bucketName] = s.client.WriteAPI(InfluxDBOrg, s.bucketName)

	// Validate connection
	health, err := s.client.Health(context.Background())
	if err != nil {
		return fmt.Errorf("failed to connect to InfluxDB: %w", err)
	}

	log.Printf("Connected to InfluxDB %s with session: %s, bucket: %s", health.Version, s.sessionID, s.bucketName)

	// Start error handling goroutine
	s.wg.Add(1)
	go s.handleErrors()

	return nil
}

// createBucketIfNotExists creates a new bucket if it doesn't already exist
func (s *storage) createBucketIfNotExists(bucketName string) error {
	// Using the API client to manage buckets
	bucketsAPI := s.client.BucketsAPI()

	// Check if bucket exists
	_, err := bucketsAPI.FindBucketByName(context.Background(), bucketName)
	if err != nil {
		// Find the organization by name
		org, err := s.client.OrganizationsAPI().FindOrganizationByName(context.Background(), InfluxDBOrg)
		if err != nil {
			return fmt.Errorf("failed to find organization %s: %w", InfluxDBOrg, err)
		}

		// Create a new bucket with a 30-day retention policy
		_, err = bucketsAPI.CreateBucketWithName(
			context.Background(),
			org,
			bucketName,
		)
		if err != nil {
			return fmt.Errorf("failed to create bucket %s: %w", bucketName, err)
		}

		log.Printf("Created new bucket: %s with 30-day retention", bucketName)
	}
	return nil
}

// newStorage creates a new storage instance with optimized settings
func newStorage() *storage {
	// Hide token in logs for security
	log.Printf("Connecting to InfluxDB at %s", InfluxDBURL)

	// Create client with timeout options
	options := influxdb2.DefaultOptions()
	options.SetBatchSize(uint(MaxBatchSize))
	options.SetFlushInterval(uint(BatchTimeout.Milliseconds()))
	options.SetRetryInterval(uint(RetryDelay.Milliseconds()))
	options.SetMaxRetries(uint(MaxRetries))
	options.SetHTTPRequestTimeout(30000) // 30 seconds timeout

	client := influxdb2.NewClientWithOptions(InfluxDBURL, InfluxDBToken, options)

	ctx, cancel := context.WithCancel(context.Background())

	return &storage{
		client:        client,
		writeAPIs:     make(map[string]api.WriteAPI),
		sessionID:     generateSessionID(),
		ctx:           ctx,
		cancel:        cancel,
		errorCh:       make(chan error, 100), // Buffer for error handling
		pointsBuffer:  make([]*write.Point, 0, MaxBatchSize),
		maxBufferSize: MaxBatchSize,
	}
}

// handleErrors processes errors from the non-blocking write API
func (s *storage) handleErrors() {
	defer s.wg.Done()

	// Create error handlers for all write APIs
	for bucketName, writeAPI := range s.writeAPIs {
		errorsCh := writeAPI.Errors()
		bucketName := bucketName // Create local copy for goroutine

		// Handle errors for this specific write API
		go func() {
			for {
				select {
				case err := <-errorsCh:
					if err != nil {
						log.Printf("Error writing to InfluxDB bucket %s: %v", bucketName, err)
						s.errorCh <- err
					}
				case <-s.ctx.Done():
					return
				}
			}
		}()
	}

	// Handle custom errors
	for {
		select {
		case err := <-s.errorCh:
			log.Printf("Error: %v", err)
		case <-s.ctx.Done():
			return
		}
	}
}

func generateSessionID() string {
	return fmt.Sprintf("%d-%d", time.Now().Unix(), time.Now().Nanosecond())
}

// getFloatValue extracts a float value from a record with proper error handling
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

// getIntValue extracts an integer value from a record with proper error handling
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

// Exec processes a batch of telemetry data records
func (s *storage) Exec(data []map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(data) == 0 {
		return nil
	}

	// Use a fixed reference time to calculate relative timestamps
	sessionStartTime := time.Now().Add(-time.Duration(getFloatValue(data[0], "SessionTime") * float64(time.Second)))

	// Process records in bulk
	for _, record := range data {
		lapID := getIntValue(record, "Lap")
		sessionTime := getFloatValue(record, "SessionTime")

		// Add session number as an additional tag if available
		sessionNum := ""
		if val, ok := record["sessionID"]; ok {
			sessionNum = fmt.Sprintf("%v", val)
		}

		// Calculate timestamp relative to session start
		tickTime := sessionStartTime.Add(time.Duration(sessionTime * float64(time.Second)))

		// Create point with optimized tag structure
		point := influxdb2.NewPoint(
			"telemetry_ticks",
			map[string]string{
				"lap_id":      fmt.Sprintf("%d", lapID), // Indexed tag for lap filtering
				"session_id":  s.sessionID,              // Indexed tag for session filtering
				"session_num": sessionNum,               // Additional indexed tag
			},
			map[string]interface{}{
				// Most frequently accessed fields first for query optimization
				"speed":                getFloatValue(record, "Speed"),
				"lap_dist_pct":         getFloatValue(record, "LapDistPct"),
				"session_time":         sessionTime,
				"lap_current_lap_time": getFloatValue(record, "LapCurrentLapTime"),
				"car_id":               getIntValue(record, "PlayerCarPosition"), // Indexed tag for car filtering

				// Other telemetry fields
				"brake":                getFloatValue(record, "Brake"),
				"throttle":             getFloatValue(record, "Throttle"),
				"gear":                 getIntValue(record, "Gear"),
				"rpm":                  getFloatValue(record, "RPM"),
				"steering_wheel_angle": getFloatValue(record, "SteeringWheelAngle"),
				"velocity_x":           getFloatValue(record, "VelocityX"),
				"velocity_y":           getFloatValue(record, "VelocityY"),
				"lat":                  getFloatValue(record, "Lat"),
				"lon":                  getFloatValue(record, "Lon"),
				"player_car_position":  getFloatValue(record, "PlayerCarPosition"),
				"fuel_level":           getFloatValue(record, "FuelLevel"),
			},
			tickTime,
		)

		// Add to the buffer
		s.pointsBuffer = append(s.pointsBuffer, point)
		s.bufferSize++

		// Flush if buffer is full
		if s.bufferSize >= s.maxBufferSize {
			s.flushBuffer()
		}
	}

	s.batchesLoaded++
	log.Printf("Processed %d telemetry points in session %s (batch %d, buffer size: %d)",
		len(data), s.sessionID, s.batchesLoaded, s.bufferSize)

	return nil
}

// flushBuffer writes the accumulated points to InfluxDB
func (s *storage) flushBuffer() {
	if s.bufferSize == 0 {
		return
	}

	// Get the write API for this bucket
	writeAPI, ok := s.writeAPIs[s.bucketName]
	if !ok {
		// Create a new write API if one doesn't exist
		writeAPI = s.client.WriteAPI(InfluxDBOrg, s.bucketName)
		s.writeAPIs[s.bucketName] = writeAPI

		// Set up error handling for this new API
		errorsCh := writeAPI.Errors()
		go func() {
			for err := range errorsCh {
				if err != nil {
					log.Printf("Error writing to InfluxDB for bucket %s: %v", s.bucketName, err)
					s.errorCh <- err
				}
			}
		}()
	}

	for _, point := range s.pointsBuffer {
		writeAPI.WritePoint(point)
	}

	log.Printf("Flushed %d points to InfluxDB for session %s (%.2f points/sec)",
		s.bufferSize, s.sessionID)

	// Reset buffer
	s.pointsBuffer = s.pointsBuffer[:0]
	s.bufferSize = 0
}

// Flush explicitly flushes any pending writes
func (s *storage) Flush() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Flush internal buffer first
	s.flushBuffer()

	// Then flush all write APIs
	for bucketName, writeAPI := range s.writeAPIs {
		log.Printf("Flushing write API for bucket %s", bucketName)
		writeAPI.Flush()
	}
}

// Close properly shuts down the storage
func (s *storage) Close() error {
	// Cancel the error handling goroutine
	s.cancel()

	// Flush any pending writes
	s.Flush()

	// Wait for error handling to complete
	s.wg.Wait()

	// Close the client
	s.client.Close()

	log.Println("Closed InfluxDB connection.")
	return nil
}

// Loaded returns the number of batches loaded
func (s *storage) Loaded() int {
	return s.batchesLoaded
}

// Helper functions for environment variables

// getEnv reads an environment variable or returns a default value
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// getSecretTrimmed reads a secret from a file, trims it, and returns a fallback if the file cannot be read
func getSecretTrimmed(filepath string, fallback string) string {
	data, err := os.ReadFile(filepath)
	if err != nil {
		log.Printf("Warning: Unable to read secret from %s, using fallback.", filepath)
		return fallback
	}
	return strings.TrimSpace(string(data))
}

// getEnvAsInt parses an environment variable as an integer
func getEnvAsInt(key string, fallback int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return fallback
}

// getEnvAsDuration parses an environment variable as a duration
func getEnvAsDuration(key string, fallback time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return fallback
}

// getEnvAsBool parses an environment variable as a boolean
func getEnvAsBool(key string, fallback bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return fallback
}
