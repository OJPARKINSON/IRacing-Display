package worker

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/fatih/color"
)

type ProgressDisplay struct {
	startTime   time.Time
	totalFiles  int
	workers     []*WorkerProgress
	mu          sync.RWMutex
	isRunning   bool
	stopChan    chan bool
	refreshRate time.Duration
	logBuffer   []string
	maxLogs     int
}

type WorkerProgress struct {
	ID               int
	FilesProcessed   int
	RecordsProcessed int64
	BatchesProcessed int64
	CurrentFile      string
	Status           WorkerStatus
	LastActivity     time.Time
	ProcessingRate   float64
	AvgTimePerFile   time.Duration
	TotalFileTime    time.Duration
}

type WorkerStatus int

const (
	StatusIdle WorkerStatus = iota
	StatusProcessing
	StatusError
	StatusCompleted
)

func (s WorkerStatus) String() string {
	switch s {
	case StatusIdle:
		return "IDLE"
	case StatusProcessing:
		return "PROC"
	case StatusError:
		return "ERR"
	case StatusCompleted:
		return "DONE"
	default:
		return "UNK"
	}
}

func NewProgressDisplay(workerCount, totalFiles int) *ProgressDisplay {
	workers := make([]*WorkerProgress, workerCount)
	for i := range workers {
		workers[i] = &WorkerProgress{
			ID:           i,
			Status:       StatusIdle,
			LastActivity: time.Now(),
		}
	}

	return &ProgressDisplay{
		startTime:   time.Now(),
		totalFiles:  totalFiles,
		workers:     workers,
		refreshRate: 200 * time.Millisecond,
		stopChan:    make(chan bool),
		logBuffer:   make([]string, 0),
		maxLogs:     3,
	}
}

func (pd *ProgressDisplay) Start() {
	pd.mu.Lock()
	pd.isRunning = true
	pd.mu.Unlock()

	fmt.Print("\033[?25l\033[2J\033[H")

	go pd.displayLoop()
}

func (pd *ProgressDisplay) Stop() {
	pd.mu.Lock()
	pd.isRunning = false
	pd.mu.Unlock()

	pd.stopChan <- true

	fmt.Print("\033[?25h")
}

func (pd *ProgressDisplay) UpdateWorker(workerID int, filesProcessed int, recordsProcessed int64, batchesProcessed int64, currentFile string, status WorkerStatus) {
	pd.mu.Lock()
	defer pd.mu.Unlock()

	if workerID >= 0 && workerID < len(pd.workers) {
		worker := pd.workers[workerID]

		elapsed := time.Since(worker.LastActivity).Seconds()
		if elapsed > 0 {
			recordsDelta := recordsProcessed - worker.RecordsProcessed
			worker.ProcessingRate = float64(recordsDelta) / elapsed
		}

		worker.FilesProcessed = filesProcessed
		worker.RecordsProcessed = recordsProcessed
		worker.BatchesProcessed = batchesProcessed
		worker.CurrentFile = currentFile
		worker.Status = status
		worker.LastActivity = time.Now()
	}
}

func (pd *ProgressDisplay) UpdateWorkerWithTiming(workerID int, filesProcessed int, recordsProcessed int64, batchesProcessed int64, currentFile string, status WorkerStatus, avgTimePerFile time.Duration, totalFileTime time.Duration) {
	pd.mu.Lock()
	defer pd.mu.Unlock()

	if workerID >= 0 && workerID < len(pd.workers) {
		worker := pd.workers[workerID]

		elapsed := time.Since(worker.LastActivity).Seconds()
		if elapsed > 0 {
			recordsDelta := recordsProcessed - worker.RecordsProcessed
			worker.ProcessingRate = float64(recordsDelta) / elapsed
		}

		worker.FilesProcessed = filesProcessed
		worker.RecordsProcessed = recordsProcessed
		worker.BatchesProcessed = batchesProcessed
		worker.CurrentFile = currentFile
		worker.Status = status
		worker.LastActivity = time.Now()
		worker.AvgTimePerFile = avgTimePerFile
		worker.TotalFileTime = totalFileTime
	}
}

func (pd *ProgressDisplay) AddLog(message string) {
	pd.mu.Lock()
	defer pd.mu.Unlock()

	timestamp := time.Now().Format("15:04:05")
	logMsg := fmt.Sprintf("[%s] %s", timestamp, message)

	pd.logBuffer = append(pd.logBuffer, logMsg)
	if len(pd.logBuffer) > pd.maxLogs {
		pd.logBuffer = pd.logBuffer[1:]
	}
}

func (pd *ProgressDisplay) displayLoop() {
	ticker := time.NewTicker(pd.refreshRate)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			pd.render()
		case <-pd.stopChan:
			return
		}
	}
}

func (pd *ProgressDisplay) render() {
	pd.mu.RLock()
	defer pd.mu.RUnlock()

	fmt.Print("\033[H")

	accent := color.New(color.FgCyan, color.Bold)

	muted := color.New(color.FgHiBlack)

	elapsed := time.Since(pd.startTime)

	totalFiles := pd.getTotalFilesProcessed()
	totalRecords := pd.getTotalRecordsProcessed()
	totalBatches := pd.getTotalBatchesProcessed()

	overallProgress := float64(totalFiles) / float64(pd.totalFiles) * 100
	if pd.totalFiles == 0 {
		overallProgress = 0
	}

	width := 95

	fmt.Print("┌")
	fmt.Print(strings.Repeat("─", width-2))
	fmt.Println("┐")

	fmt.Print("│ ")
	accent.Print("⚡ IRacing Telemetry Ingest")
	fmt.Print(" - Performance Monitor")
	remaining := width - 52
	fmt.Print(strings.Repeat(" ", remaining))
	fmt.Println("│")

	fmt.Print("├")
	fmt.Print(strings.Repeat("─", width-2))
	fmt.Println("┤")

	fmt.Print("│ Overall: ")
	pd.renderProgressBar(overallProgress, 35)
	progressSuffix := fmt.Sprintf(" %.1f%% (%d/%d files)", overallProgress, totalFiles, pd.totalFiles)
	fmt.Print(progressSuffix)
	remaining = width - 10 - 37 - len(progressSuffix) - 1
	if remaining > 0 {
		fmt.Print(strings.Repeat(" ", remaining))
	}
	fmt.Println("│")

	avgTimePerFile := pd.getAverageTimePerFile()

	var perfIcon string
	if avgTimePerFile > 0 {
		ms := avgTimePerFile.Milliseconds()
		if ms < 50 {
			perfIcon = "🟢" // Green - excellent
		} else if ms < 100 {
			perfIcon = "🟡" // Yellow - good
		} else {
			perfIcon = "🔴" // Red - needs optimization
		}
	} else {
		perfIcon = "⚪" // White - no data
	}

	statsText := fmt.Sprintf("⏱️  Time: %v  📊 Records: %s  📦 Batches: %s  %s Avg/File: %s",
		elapsed.Round(time.Second),
		formatNumber(totalRecords),
		formatNumber(totalBatches),
		perfIcon,
		formatDuration(avgTimePerFile))

	if elapsed.Seconds() > 0 {
		rate := float64(totalRecords) / elapsed.Seconds()
		statsText += fmt.Sprintf("  🚀 Rate: %s/s", formatNumber(int64(rate)))
	}

	fmt.Print("│ ")
	fmt.Print(statsText)

	displayWidth := getDisplayWidth(statsText)
	remaining = width - displayWidth - 3
	if remaining > 0 {
		fmt.Print(strings.Repeat(" ", remaining))
	}
	fmt.Println("│")

	fmt.Print("├")
	fmt.Print(strings.Repeat("─", width-2))
	fmt.Println("┤")

	fmt.Print("│ ")
	accent.Print("Worker  Status  Files  Records     Batches  Rate/s    Ms/File  Current File")
	remaining = width - 73
	fmt.Print(strings.Repeat(" ", remaining))
	fmt.Println("│")

	fmt.Print("├")
	fmt.Print(strings.Repeat("─", width-2))
	fmt.Println("┤")

	for _, worker := range pd.workers {
		msPerFile := formatDuration(worker.AvgTimePerFile)
		if worker.FilesProcessed == 0 || worker.AvgTimePerFile == 0 {
			msPerFile = "-"
		}

		currentFile := worker.CurrentFile
		if len(currentFile) > 25 {
			currentFile = "..." + currentFile[len(currentFile)-22:]
		}

		lineContent := fmt.Sprintf("W%-2d     %-4s  %-5d  %-10s  %-7s  %-8s  %-7s  %-25s",
			worker.ID,
			worker.Status.String(),
			worker.FilesProcessed,
			formatNumber(worker.RecordsProcessed),
			formatNumber(worker.BatchesProcessed),
			formatRate(worker.ProcessingRate),
			msPerFile,
			currentFile)

		contentWidth := len([]rune(lineContent))
		padding := width - contentWidth - 4
		if padding < 0 {
			padding = 0
		}

		fmt.Printf("│ %s%s │\n", lineContent, strings.Repeat(" ", padding))
	}

	if len(pd.logBuffer) > 0 {
		fmt.Print("├")
		fmt.Print(strings.Repeat("─", width-2))
		fmt.Println("┤")

		for _, logMsg := range pd.logBuffer {
			if len(logMsg) > width-4 {
				logMsg = logMsg[:width-7] + "..."
			}
			fmt.Printf("│ %s", logMsg)
			remaining := width - len(logMsg) - 3
			fmt.Print(strings.Repeat(" ", remaining))
			fmt.Println("│")
		}
	}

	fmt.Print("└")
	fmt.Print(strings.Repeat("─", width-2))
	fmt.Println("┘")

	muted.Println("Press Ctrl+C to stop gracefully")

	fmt.Print("\033[J")
}

func (pd *ProgressDisplay) renderProgressBar(percentage float64, width int) {
	filled := int(percentage / 100 * float64(width))
	if filled > width {
		filled = width
	}

	accent := color.New(color.FgCyan, color.Bold)
	muted := color.New(color.FgHiBlack)

	fmt.Print("█")

	if filled > 0 {
		accent.Print(strings.Repeat("█", filled))
	}

	remaining := width - filled
	if remaining > 0 {
		muted.Print(strings.Repeat("░", remaining))
	}

	fmt.Print("█")
}

func (pd *ProgressDisplay) getTotalFilesProcessed() int {
	total := 0
	for _, worker := range pd.workers {
		total += worker.FilesProcessed
	}
	return total
}

func (pd *ProgressDisplay) getTotalRecordsProcessed() int64 {
	var total int64
	for _, worker := range pd.workers {
		total += worker.RecordsProcessed
	}
	return total
}

func (pd *ProgressDisplay) getTotalBatchesProcessed() int64 {
	var total int64
	for _, worker := range pd.workers {
		total += worker.BatchesProcessed
	}
	return total
}

func formatNumber(n int64) string {
	if n < 1000 {
		return fmt.Sprintf("%d", n)
	} else if n < 1000000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	} else if n < 1000000000 {
		return fmt.Sprintf("%.1fM", float64(n)/1000000)
	}
	return fmt.Sprintf("%.1fB", float64(n)/1000000000)
}

func formatRate(rate float64) string {
	if rate < 1000 {
		return fmt.Sprintf("%.0f", rate)
	} else if rate < 1000000 {
		return fmt.Sprintf("%.1fK", rate/1000)
	}
	return fmt.Sprintf("%.1fM", rate/1000000)
}

func formatDuration(d time.Duration) string {
	if d == 0 {
		return "-"
	}
	ms := d.Milliseconds()
	if ms < 1000 {
		return fmt.Sprintf("%dms", ms)
	} else if ms < 10000 {
		return fmt.Sprintf("%dms", ms)
	} else if ms < 60000 {
		return fmt.Sprintf("%.1fs", float64(ms)/1000)
	}
	return fmt.Sprintf("%.1fm", float64(ms)/60000)
}

func (pd *ProgressDisplay) getAverageTimePerFile() time.Duration {
	var totalTime time.Duration
	var totalFiles int

	for _, worker := range pd.workers {
		if worker.FilesProcessed > 0 {
			totalTime += worker.TotalFileTime
			totalFiles += worker.FilesProcessed
		}
	}

	if totalFiles == 0 {
		return 0
	}
	return totalTime / time.Duration(totalFiles)
}

func getDisplayWidth(s string) int {
	width := 0
	runes := []rune(s)
	for _, r := range runes {
		if r > 0x1F600 && r < 0x1F6FF {
			width += 2
		} else {
			width += 1
		}
	}
	return width
}

func (pd *ProgressDisplay) UpdateFromPoolMetrics(metrics PoolMetrics, workerMetrics []WorkerMetrics) {
	pd.mu.Lock()
	defer pd.mu.Unlock()

	for i, wm := range workerMetrics {
		if i < len(pd.workers) {
			status := StatusProcessing
			if wm.ErrorCount > 0 {
				status = StatusError
			} else if wm.FilesProcessed == 0 {
				status = StatusIdle
			}

			pd.workers[i].FilesProcessed = wm.FilesProcessed
			pd.workers[i].RecordsProcessed = int64(wm.TotalRecords)
			pd.workers[i].BatchesProcessed = int64(wm.TotalBatches)
			pd.workers[i].Status = status
			pd.workers[i].LastActivity = wm.LastActivity
			pd.workers[i].AvgTimePerFile = wm.AvgTimePerFile
			pd.workers[i].TotalFileTime = wm.TotalFileTime
		}
	}
}
