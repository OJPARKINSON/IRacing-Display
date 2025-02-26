package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

var (
	InfluxDBURL    = getEnv("INFLUXDB_URL", "http://localhost:8086")
	InfluxDBToken  = getSecretTrimmed("/run/secrets/influxdb-admin-token", "super-secret-token") // ✅ Read from file, trimmed
	InfluxDBOrg    = getEnv("INFLUXDB_ORG", "myorg")
	InfluxDBBucket = getEnv("INFLUXDB_BUCKET", "racing_telemetry")
)

type storage struct {
	client        influxdb2.Client
	writeAPI      api.WriteAPIBlocking
	sessionID     string
	mu            sync.Mutex
	batchesLoaded int
}

func (s *storage) Connect() error {
	log.Println("Connected to InfluxDB with session:", s.sessionID)
	return nil
}

func newStorage() *storage {
	log.Printf("Using InfluxDB Token: %q\n", InfluxDBToken)   // ✅ Debugging Token
	client := influxdb2.NewClient(InfluxDBURL, InfluxDBToken) // ✅ Uses the trimmed token
	writeAPI := client.WriteAPIBlocking(InfluxDBOrg, InfluxDBBucket)
	return &storage{
		client:    client,
		writeAPI:  writeAPI,
		sessionID: generateSessionID(),
	}
}

func generateSessionID() string {
	return fmt.Sprintf("%d-%d", time.Now().Unix(), time.Now().Nanosecond())
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
	log.Printf("Missing value for key %s", key)
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
	log.Printf("Missing value for key %s", key)
	return 0
}

func (s *storage) Exec(data []map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, record := range data {
		lapID := getIntValue(record, "Lap")

		sessionStartTime := time.Now()

		if lapID == 24 {
			fmt.Println(record)
		}

		sessionTime := getFloatValue(record, "SessionTime")

		seconds := int64(sessionTime)
		nanoseconds := int64((sessionTime - float64(seconds)) * 1e9)

		tickTime := sessionStartTime.Add(time.Duration(seconds)*time.Second + time.Duration(nanoseconds)*time.Nanosecond)

		point := influxdb2.NewPoint(
			"telemetry_ticks",
			map[string]string{
				"session_id": s.sessionID,
				"lap_id":     fmt.Sprintf("%d", lapID),
			},
			map[string]interface{}{
				"brake":                getFloatValue(record, "Brake"),
				"gear":                 getIntValue(record, "Gear"),
				"lap":                  getIntValue(record, "Lap"),
				"lap_dist_pct":         getFloatValue(record, "LapDistPct"),
				"lat":                  getFloatValue(record, "Lat"),
				"lon":                  getFloatValue(record, "Lon"),
				"rpm":                  getFloatValue(record, "RPM"),
				"speed":                getFloatValue(record, "Speed"),
				"steering_wheel_angle": getFloatValue(record, "SteeringWheelAngle"),
				"throttle":             getFloatValue(record, "Throttle"),
				"velocity_x":           getFloatValue(record, "VelocityX"),
				"velocity_y":           getFloatValue(record, "VelocityY"),
				"lap_current_lap_time": getFloatValue(record, "LapCurrentLapTime"),
				"player_car_position":  getFloatValue(record, "PlayerCarPosition"),
				"fuel_level":           getFloatValue(record, "FuelLevel"),
				"session_time":         sessionTime,
			},
			tickTime, // ✅ Ensures unique timestamps
		)

		err := s.writeAPI.WritePoint(context.Background(), point)
		if err != nil {
			log.Println("Error writing to InfluxDB:", err)
			return err
		}
	}

	s.batchesLoaded += len(data)
	log.Printf("Stored %d telemetry points in session %s\n", len(data), s.sessionID)
	return nil
}

func (s *storage) Close() error {
	s.client.Close()
	log.Println("Closed InfluxDB connection.")
	return nil
}

// Reads an environment variable or falls back to a default value
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// ✅ Reads a Docker Secret from a file, trims newlines/spaces, and falls back to a default value
func getSecretTrimmed(filepath string, fallback string) string {
	data, err := ioutil.ReadFile(filepath)
	if err != nil {
		log.Printf("Warning: Unable to read secret %s, using fallback.\n", filepath)
		return fallback
	}
	return strings.TrimSpace(string(data)) // ✅ Removes unwanted spaces and newlines
}

func (s *storage) Loaded() int {
	return s.batchesLoaded
}
