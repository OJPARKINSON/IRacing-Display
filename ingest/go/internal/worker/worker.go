package worker

import (
	"context"
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

	log.Printf("Worker %d processing file: %s (retry %d)", workerID, item.FilePath, item.RetryCount)

	// Pass the connection pool to the file processor
	processor, err := processing.NewFileProcessor(wp.config, workerID, wp.rabbitPool)
	if err != nil {
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

	result, err := processor.ProcessFile(ctx, item.FilePath, item.FileInfo)
	if err != nil {
		wp.errorsChan <- WorkError{
			FilePath:  item.FilePath,
			Error:     err,
			Retry:     shouldRetry(err, item.RetryCount),
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
