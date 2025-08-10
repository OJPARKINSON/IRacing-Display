#!/bin/bash

# Optimized settings for AMD Ryzen 5 7600X (6 cores, 12 threads)
# This script configures the ingest application for maximum performance

export WORKER_COUNT=8                    # Slightly less than thread count for I/O overhead
export GOMAXPROCS=12                     # Match thread count
export GOGC=150                          # Higher GC threshold for less frequent collection
export BATCH_SIZE_BYTES=2097152          # 2MB batch size for better throughput
export BATCH_SIZE_RECORDS=2000           # Larger record batches
export RABBITMQ_BATCH_SIZE=500           # Larger RabbitMQ batches
export RABBITMQ_BATCH_TIMEOUT=10ms       # Shorter timeout for faster processing
export RABBITMQ_PREFETCH_COUNT=5000      # Higher prefetch for better batching
export RABBITMQ_POOL_SIZE=16             # More connections for parallel publishing
export FILE_QUEUE_SIZE=200               # Larger queue for file processing
export BATCH_TIMEOUT=1s                  # Shorter batch timeout

echo "🚀 Starting IRacing Telemetry Ingest with optimized settings for Ryzen 7600X"
echo "Workers: $WORKER_COUNT, GOMAXPROCS: $GOMAXPROCS, Batch Size: $BATCH_SIZE_BYTES bytes"
echo "Expected performance: 100K+ records/second"
echo

# Run the application
go run cmd/ingest-app/main.go "$@"