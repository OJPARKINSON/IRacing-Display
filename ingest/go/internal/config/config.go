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

	RabbitMQURL     string
	DisableRabbitMQ bool

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
		WorkerCount:   getEnvAsInt("WORKER_COUNT", 20),
		FileQueueSize: getEnvAsInt("FILE_QUEUE_SIZE", 100),
		WorkerTimeout: getEnvAsDuration("WORKER_TIMEOUT", 30*time.Minute),

		BatchSizeBytes: getEnvAsInt("BATCH_SIZE_BYTES", 1048576),
		BatchTimeout:   getEnvAsDuration("BATCH_TIMEOUT", 2*time.Second),
		MaxRetries:     getEnvAsInt("MAX_RETRIES", 3),
		RetryDelay:     getEnvAsDuration("RETRY_DELAY", 250*time.Millisecond),

		RabbitMQURL: getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),

		GoMaxProcs: getEnvAsInt("GOMAXPROCS", 0),
		GOGC:       getEnvAsInt("GOGC", 50),

		EnablePprof:  getEnvAsBool("ENABLE_PPROF", true),
		PprofPort:    getEnv("PPROF_PORT", "6060"),
		MemoryTuning: getEnvAsBool("MEMORY_TUNING", true),

		RabbitMQPoolSize:      getEnvAsInt("RABBITMQ_POOL_SIZE", 8),
		RabbitMQPrefetchCount: getEnvAsInt("RABBITMQ_PREFETCH_COUNT", 2000),
		RabbitMQBatchSize:     getEnvAsInt("RABBITMQ_BATCH_SIZE", 200),
		RabbitMQBatchTimeout:  getEnvAsDuration("RABBITMQ_BATCH_TIMEOUT", 25*time.Millisecond),
		RabbitMQConfirms:      getEnvAsBool("RABBITMQ_CONFIRMS", false),
		RabbitMQPersistent:    getEnvAsBool("RABBITMQ_PERSISTENT", false),
		RabbitMQHeartbeat:     getEnvAsDuration("RABBITMQ_HEARTBEAT", 30*time.Second),
		RabbitMQChannelMax:    getEnvAsInt("RABBITMQ_CHANNEL_MAX", 4096),
		RabbitMQFrameSize:     getEnvAsInt("RABBITMQ_FRAME_SIZE", 1048576),
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
