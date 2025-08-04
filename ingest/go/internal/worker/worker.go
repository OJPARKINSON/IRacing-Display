package worker

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/processing"
)

func (wp *WorkerPool) startWorker(workerID int) {
	log.Printf("Worker %d starting", workerID)

	workerCtx, cancel := context.WithTimeout(wp.ctx, wp.config.WorkerTimeout)
	defer cancel()

	for {
		select {
		case workItem, ok := <-wp.fileQueue:
			if !ok {
				log.Printf("Worker %d shutting down - queue closed", workerID)
				return
			}

			wp.processWorkItem(workerCtx, workerID, workItem)

		case <-workerCtx.Done():
			log.Printf("Worker %d shutting down - context done: %v", workerID, workerCtx.Err())
			return
		}
	}
}

func (wp *WorkerPool) processWorkItem(ctx context.Context, workerID int, item WorkItem) {
	startTime := time.Now()

	filename := item.FileInfo.Name()
	wp.UpdateWorkerStatus(workerID, filename, "PROCESSING")

	log.Printf("Worker %d processing file: %s (retry %d)", workerID, item.FilePath, item.RetryCount)

	processor, err := processing.NewFileProcessor(wp.config, workerID, wp.rabbitPool)
	if err != nil {
		wp.UpdateWorkerStatus(workerID, filename, "ERROR")
		wp.errorsChan <- WorkError{
			FilePath:  item.FilePath,
			Error:     err,
			Retry:     true,
			WorkerID:  workerID,
			Timestamp: time.Now(),
		}
		return
	}
	defer processor.Close()

	// Create timeout context for file processing
	processCtx, processCancel := context.WithTimeout(ctx, wp.config.FileProcessTimeout)
	defer processCancel()

	// Channel to receive the result or timeout
	resultChan := make(chan struct {
		result *processing.ProcessResult
		err    error
	}, 1)

	// Process file in goroutine to enable timeout
	go func() {
		result, err := processor.ProcessFile(processCtx, item.FilePath, item.FileInfo)
		resultChan <- struct {
			result *processing.ProcessResult
			err    error
		}{result, err}
	}()

	// Wait for result or timeout
	var result *processing.ProcessResult
	var processErr error
	select {
	case res := <-resultChan:
		result = res.result
		processErr = res.err
	case <-processCtx.Done():
		processErr = fmt.Errorf("file processing timeout after %v", wp.config.FileProcessTimeout)
		log.Printf("Worker %d: File processing timeout for %s", workerID, filename)
	}

	if processErr != nil {
		wp.UpdateWorkerStatus(workerID, filename, "ERROR")
		wp.errorsChan <- WorkError{
			FilePath:  item.FilePath,
			Error:     processErr,
			Retry:     shouldRetry(processErr, item.RetryCount),
			WorkerID:  workerID,
			Timestamp: time.Now(),
		}
		return
	}

	wp.resultsChan <- WorkResult{
		FilePath:       item.FilePath,
		ProcessedCount: result.RecordCount,
		BatchCount:     result.BatchCount,
		Duration:       time.Since(startTime),
		SessionID:      result.SessionID,
		TrackName:      result.TrackName,
		WorkerID:       workerID,
	}
}

func shouldRetry(err error, retryCount int) bool {
	if retryCount >= 3 {
		return false
	}

	if err == context.Canceled || err == context.DeadlineExceeded {
		return false
	}

	return true
}
