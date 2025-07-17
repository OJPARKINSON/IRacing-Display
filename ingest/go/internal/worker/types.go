package worker

import (
	"os"
	"time"
)

type WorkItem struct {
	FilePath   string
	FileInfo   os.DirEntry
	RetryCount int
}

type WorkResult struct {
	FilePath       string
	ProcessedCount int
	BatchCount     int
	Duration       time.Duration
	SessionID      string
	TrackName      string
	WorkerID       int
}

type WorkError struct {
	FilePath  string
	Error     error
	Retry     bool
	WorkerID  int
	Timestamp time.Time
}

type WorkerMetrics struct {
	WorkerID       int
	FilesPRocessed int
	TotalRecords   int
	TotalBatches   int
	ProcessingTime time.Duration
	LastActivity   time.Time
	ErrorCount     int
}
