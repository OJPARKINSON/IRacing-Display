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
	WorkerID         int
	FilesProcessed   int
	TotalRecords     int64
	TotalBatches     int64
	ProcessingTime   time.Duration
	LastActivity     time.Time
	ErrorCount       int
	CurrentFile      string
	Status           string
	ProcessingRate   float64
	AvgTimePerFile   time.Duration
	TotalFileTime    time.Duration
}
