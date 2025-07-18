package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	WorkerCount   int
	FileQueueSize int
	WorkerTimeout time.Duration

	BatchSizeBytes int
	BatchTimeout   time.Duration
	MaxRetries     int
	RetryDelay     time.Duration

	RabbitMQURL string

	GoMaxProcs int
	GOGC       int

	EnablePprof  bool
	PprofPort    string
	MemoryTuning bool

	RabbitMQPoolSize      int
	RabbitMQPrefetchCount int
	RabbitMQBatchSize     int
	RabbitMQBatchTimeout  time.Duration
	RabbitMQConfirms      bool
	RabbitMQPersistent    bool
	RabbitMQHeartbeat     time.Duration
	RabbitMQChannelMax    int
	RabbitMQFrameSize     int
}

func LoadConfig() *Config {
	return &Config{
		WorkerCount:   getEnvAsInt("WORKER_COUNT", 6),
		FileQueueSize: getEnvAsInt("FILE_QUEUE_SIZE", 50),
		WorkerTimeout: getEnvAsDuration("WORKER_TIMEOUT", 30*time.Minute),

		BatchSizeBytes: getEnvAsInt("BATCH_SIZE_BYTES", 250000), // 250KB
		BatchTimeout:   getEnvAsDuration("BATCH_TIMEOUT", 5*time.Second),
		MaxRetries:     getEnvAsInt("MAX_RETRIES", 3),
		RetryDelay:     getEnvAsDuration("RETRY_DELAY", 500*time.Millisecond),

		RabbitMQURL: getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),

		GoMaxProcs: getEnvAsInt("GOMAXPROCS", 0),
		GOGC:       getEnvAsInt("GOGC", 100),

		EnablePprof:  getEnvAsBool("ENABLE_PPROF", true),
		PprofPort:    getEnv("PPROF_PORT", "6060"),
		MemoryTuning: getEnvAsBool("MEMORY_TUNING", true),

		RabbitMQPoolSize:      getEnvAsInt("RABBITMQ_POOL_SIZE", 4),
		RabbitMQPrefetchCount: getEnvAsInt("RABBITMQ_PREFETCH_COUNT", 1000),
		RabbitMQBatchSize:     getEnvAsInt("RABBITMQ_BATCH_SIZE", 100),
		RabbitMQBatchTimeout:  getEnvAsDuration("RABBITMQ_BATCH_TIMEOUT", 50*time.Millisecond),
		RabbitMQConfirms:      getEnvAsBool("RABBITMQ_CONFIRMS", true),
		RabbitMQPersistent:    getEnvAsBool("RABBITMQ_PERSISTENT", false), // Transient for performance
		RabbitMQHeartbeat:     getEnvAsDuration("RABBITMQ_HEARTBEAT", 60*time.Second),
		RabbitMQChannelMax:    getEnvAsInt("RABBITMQ_CHANNEL_MAX", 2048),
		RabbitMQFrameSize:     getEnvAsInt("RABBITMQ_FRAME_SIZE", 131072), // 128KB frames
	}
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

func getEnvAsBool(key string, fallback bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
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
