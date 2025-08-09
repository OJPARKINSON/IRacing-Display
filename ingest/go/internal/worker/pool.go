package worker

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/messaging"
)

type WorkerPool struct {
	config      *config.Config
	fileQueue   chan WorkItem
	resultsChan chan WorkResult
	errorsChan  chan WorkError
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	metrics     PoolMetrics
	mu          sync.Mutex

	rabbitPool *messaging.ConnectionPool

	workerMetrics   []WorkerMetrics
	progressDisplay *ProgressDisplay
}

type PoolMetrics struct {
	TotalFilesProcessed   int
	TotalRecordsProcessed int
	TotalBatchesProcessed int
	TotalErrors           int
	StartTime             time.Time
	ActiveWorkers         int
	QueueDepth            int
	WorkerMetrics         []WorkerMetrics
}

func NewWorkerPool(cfg *config.Config) *WorkerPool {
	ctx, cancel := context.WithCancel(context.Background())

	rabbitPool, err := messaging.NewConnectionPool(cfg.RabbitMQURL, cfg.RabbitMQPoolSize)
	if err != nil {
		log.Fatalf("Failed to create RabbitMQ connection pool: %v", err)
	}

	log.Printf("Created RabbitMQ connection pool with %d connections", cfg.RabbitMQPoolSize)

	workerMetrics := make([]WorkerMetrics, cfg.WorkerCount)
	for i := range workerMetrics {
		workerMetrics[i] = WorkerMetrics{
			WorkerID:     i,
			LastActivity: time.Now(),
			Status:       "IDLE",
		}
	}

	return &WorkerPool{
		config:        cfg,
		fileQueue:     make(chan WorkItem, cfg.FileQueueSize),
		resultsChan:   make(chan WorkResult, cfg.WorkerCount*2),
		errorsChan:    make(chan WorkError, cfg.WorkerCount*2),
		ctx:           ctx,
		cancel:        cancel,
		rabbitPool:    rabbitPool,
		workerMetrics: workerMetrics,
		metrics: PoolMetrics{
			StartTime:     time.Now(),
			WorkerMetrics: workerMetrics,
		},
	}
}

func (wp *WorkerPool) SetProgressDisplay(pd *ProgressDisplay) {
	wp.progressDisplay = pd
}

func (wp *WorkerPool) Start() {
	log.Printf("Starting worker pool with %d workers", wp.config.WorkerCount)

	wp.wg.Add(1)
	go func() {
		defer wp.wg.Done()
		wp.resultCollector()
	}()

	wp.wg.Add(1)
	go func() {
		defer wp.wg.Done()
		wp.errorCollector()
	}()

	for i := 0; i < wp.config.WorkerCount; i++ {
		wp.wg.Add(1)
		workerID := i
		go func() {
			defer wp.wg.Done()
			wp.startWorker(workerID)
		}()
	}

	wp.mu.Lock()
	wp.metrics.ActiveWorkers = wp.config.WorkerCount
	wp.mu.Unlock()

	log.Printf("Worker pool started successfully")
}

func (wp *WorkerPool) SubmitFile(item WorkItem) error {
	select {
	case wp.fileQueue <- item:
		wp.mu.Lock()
		wp.metrics.QueueDepth++
		wp.mu.Unlock()
		return nil
	case <-wp.ctx.Done():
		return wp.ctx.Err()
	}
}

func (wp *WorkerPool) Stop() {
	log.Println("Stopping worker pool...")

	close(wp.fileQueue)

	wp.cancel()

	wp.wg.Wait()

	if wp.rabbitPool != nil {
		wp.rabbitPool.Close()
		log.Println("Closed RabbitMQ connection pool")
	}

	close(wp.resultsChan)
	close(wp.errorsChan)

	wp.logFinalMetrics()
	log.Println("Worker pool stopped")
}

func (wp *WorkerPool) GetMetrics() PoolMetrics {
	wp.mu.Lock()
	defer wp.mu.Unlock()

	metrics := wp.metrics
	metrics.QueueDepth = len(wp.fileQueue)

	metrics.WorkerMetrics = make([]WorkerMetrics, len(wp.workerMetrics))
	copy(metrics.WorkerMetrics, wp.workerMetrics)

	return metrics
}

func (wp *WorkerPool) UpdateWorkerStatus(workerID int, currentFile, status string) {
	wp.mu.Lock()
	defer wp.mu.Unlock()

	if workerID >= 0 && workerID < len(wp.workerMetrics) {
		wp.workerMetrics[workerID].CurrentFile = currentFile
		wp.workerMetrics[workerID].Status = status
		wp.workerMetrics[workerID].LastActivity = time.Now()

		if wp.progressDisplay != nil {
			var displayStatus WorkerStatus
			switch status {
			case "PROCESSING":
				displayStatus = StatusProcessing
			case "ERROR":
				displayStatus = StatusError
			case "COMPLETED":
				displayStatus = StatusCompleted
			default:
				displayStatus = StatusIdle
			}

			wm := wp.workerMetrics[workerID]
			wp.progressDisplay.UpdateWorker(
				workerID,
				wm.FilesProcessed,
				wm.TotalRecords,
				wm.TotalBatches,
				wm.CurrentFile,
				displayStatus,
			)
		}
	}
}

func (wp *WorkerPool) resultCollector() {
	for {
		select {
		case result, ok := <-wp.resultsChan:
			if !ok {
				return
			}
			wp.handleResult(result)
		case <-wp.ctx.Done():
			return
		}
	}
}

func (wp *WorkerPool) errorCollector() {
	for {
		select {
		case workError, ok := <-wp.errorsChan:
			if !ok {
				return
			}
			wp.handleError(workError)
		case <-wp.ctx.Done():
			return
		}
	}
}

func (wp *WorkerPool) handleResult(result WorkResult) {
	wp.mu.Lock()
	defer wp.mu.Unlock()

	wp.metrics.TotalFilesProcessed++
	wp.metrics.TotalRecordsProcessed += result.ProcessedCount
	wp.metrics.TotalBatchesProcessed += result.BatchCount
	wp.metrics.QueueDepth--

	if result.WorkerID >= 0 && result.WorkerID < len(wp.workerMetrics) {
		wm := &wp.workerMetrics[result.WorkerID]
		wm.FilesProcessed++
		wm.TotalRecords += int64(result.ProcessedCount)
		wm.TotalBatches += int64(result.BatchCount)
		wm.TotalFileTime += result.Duration
		wm.LastActivity = time.Now()
		wm.CurrentFile = ""
		wm.Status = "IDLE"

		if wm.FilesProcessed > 0 {
			wm.AvgTimePerFile = wm.TotalFileTime / time.Duration(wm.FilesProcessed)
		}

		if result.Duration.Seconds() > 0 {
			wm.ProcessingRate = float64(result.ProcessedCount) / result.Duration.Seconds()
		}
	}

	if wp.progressDisplay != nil {
		status := StatusCompleted
		if result.WorkerID >= 0 && result.WorkerID < len(wp.workerMetrics) {
			wm := wp.workerMetrics[result.WorkerID]
			wp.progressDisplay.UpdateWorkerWithTiming(
				result.WorkerID,
				wm.FilesProcessed,
				wm.TotalRecords,
				wm.TotalBatches,
				wm.CurrentFile,
				status,
				wm.AvgTimePerFile,
				wm.TotalFileTime,
			)
		}
	}

	log.Printf("Worker %d completed file %s: %d records in %d batches (took %v)",
		result.WorkerID, result.FilePath, result.ProcessedCount,
		result.BatchCount, result.Duration)
}

func (wp *WorkerPool) handleError(workError WorkError) {
	wp.mu.Lock()
	wp.metrics.TotalErrors++
	wp.metrics.QueueDepth--
	wp.mu.Unlock()

	log.Printf("Worker %d error processing %s: %v",
		workError.WorkerID, workError.FilePath, workError.Error)

	if workError.Retry && workError.WorkerID < wp.config.MaxRetries {
		retryItem := WorkItem{
			FilePath:   workError.FilePath,
			RetryCount: workError.WorkerID + 1,
		}

		time.AfterFunc(wp.config.RetryDelay, func() {
			select {
			case wp.fileQueue <- retryItem:
				log.Printf("Retrying file %s (attempt %d)", workError.FilePath, retryItem.RetryCount)
			case <-wp.ctx.Done():
			}
		})
	} else {
		log.Printf("File %s failed permanently after retries", workError.FilePath)
	}
}

func (wp *WorkerPool) logFinalMetrics() {
	wp.mu.Lock()
	defer wp.mu.Unlock()

	duration := time.Since(wp.metrics.StartTime)

	log.Printf("=== Final Worker Pool Metrics ===")
	log.Printf("Total processing time: %v", duration)
	log.Printf("Files processed: %d", wp.metrics.TotalFilesProcessed)
	log.Printf("Records processed: %d", wp.metrics.TotalRecordsProcessed)
	log.Printf("Batches sent: %d", wp.metrics.TotalBatchesProcessed)
	log.Printf("Errors encountered: %d", wp.metrics.TotalErrors)

	if wp.metrics.TotalFilesProcessed > 0 {
		avgPerFile := duration / time.Duration(wp.metrics.TotalFilesProcessed)
		log.Printf("Average time per file: %v", avgPerFile)
	}

	if duration.Seconds() > 0 {
		filesPerSec := float64(wp.metrics.TotalFilesProcessed) / duration.Seconds()
		recordsPerSec := float64(wp.metrics.TotalRecordsProcessed) / duration.Seconds()
		log.Println("filesPerSec: ", duration.Milliseconds())
		log.Println("recordsPerSec: ", duration.Milliseconds())
		log.Printf("Throughput: %d files/ms, %d records/ms", filesPerSec, recordsPerSec)
	}
}
