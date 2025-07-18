package processing

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/messaging"
	"github.com/teamjorge/ibt"
)

type FileProcessor struct {
	config   *config.Config
	workerID int
	pubSub   *messaging.PubSub
}

type ProcessResult struct {
	RecordCount int
	BatchCount  int
	SessionID   string
	TrackName   string
}

func NewFileProcessor(cfg *config.Config, workerID int) (*FileProcessor, error) {
	return &FileProcessor{
		config:   cfg,
		workerID: workerID,
	}, nil
}

func (fp *FileProcessor) ProcessFile(ctx context.Context, telemetryFolder string, fileEntry os.DirEntry) (*ProcessResult, error) {
	fileName := fileEntry.Name()

	if !strings.Contains(fileName, ".ibt") {
		return nil, fmt.Errorf("not an IBT file: %s", fileName)
	}

	sessionTime, err := fp.parseFileName(fileName)
	if err != nil {
		return nil, fmt.Errorf("failed to parse time from filename: %w", err)
	}

	fullPath := filepath.Join(telemetryFolder, fileName)

	files, err := filepath.Glob(fullPath)
	if err != nil {
		return nil, fmt.Errorf("could not glob file %s: %w", fullPath, err)
	}

	if len(files) == 0 {
		return nil, fmt.Errorf("no files found matching pattern: %s", fullPath)
	}

	log.Printf("Worker %d: Found %d files to process", fp.workerID, len(files))

	stubs, err := ibt.ParseStubs(files...)
	if err != nil {
		return nil, fmt.Errorf("failed to parse stubs for %v: %w", files, err)
	}

	if len(stubs) == 0 {
		return nil, fmt.Errorf("no telemetry data found in IBT file: %s", fileName)
	}

	headers := stubs[0].Headers()
	weekendInfo := headers.SessionInfo.WeekendInfo

	fp.pubSub = messaging.NewPubSub(strconv.Itoa(weekendInfo.SubSessionID), sessionTime, fp.config)

	groups := stubs.Group()
	log.Printf("Worker %d: Grouped telemetry data into %d groups", fp.workerID, len(groups))

	log.Printf("Worker %d: SessionID: %d, SubSessionID: %d, Track: %s, TrackID: %d",
		fp.workerID, weekendInfo.SessionID, weekendInfo.SubSessionID,
		weekendInfo.TrackDisplayName, weekendInfo.TrackID)

	totalRecords := 0
	totalBatches := 0

	for groupNumber, group := range groups {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		log.Printf("Worker %d: Starting group %d processing", fp.workerID, groupNumber)

		processor := NewLoaderProcessor(fp.pubSub, groupNumber, fp.config, fp.workerID)

		log.Printf("Worker %d: Starting processing for group %d", fp.workerID, groupNumber)
		startGroup := time.Now()

		if err := ibt.Process(ctx, group, processor); err != nil {
			if ctx.Err() == context.Canceled {
				log.Printf("Worker %d: Processing of group %d was canceled", fp.workerID, groupNumber)
			} else {
				log.Printf("Worker %d: Failed to process telemetry for group %d: %v", fp.workerID, groupNumber, err)
			}
			return nil, err
		}

		log.Printf("Worker %d: Finished group %d processing", fp.workerID, groupNumber)

		if err := processor.Close(); err != nil {
			log.Printf("Worker %d: Error closing processor for group %d: %v", fp.workerID, groupNumber, err)
		}

		metrics := processor.GetMetrics()
		totalRecords += metrics.totalProcessed
		totalBatches += metrics.totalBatches

		log.Printf("Worker %d: Completed processing group %d in %v", fp.workerID, groupNumber, time.Since(startGroup))
	}

	ibt.CloseAllStubs(groups)

	return &ProcessResult{
		RecordCount: totalRecords,
		BatchCount:  totalBatches,
		SessionID:   strconv.Itoa(weekendInfo.SubSessionID),
		TrackName:   weekendInfo.TrackDisplayName,
	}, nil
}

func (fp *FileProcessor) Close() error {
	if fp.pubSub != nil {
		return fp.pubSub.Close()
	}
	return nil
}

func (fp *FileProcessor) parseFileName(fileName string) (time.Time, error) {
	regex := regexp.MustCompile(`\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}`)

	match := regex.FindString(fileName)
	if match == "" {
		return time.Time{}, fmt.Errorf("no date pattern found in filename: %s", fileName)
	}

	parts := strings.Split(match, " ")
	if len(parts) != 2 {
		return time.Time{}, fmt.Errorf("invalid date format: %s", match)
	}

	timeStr := strings.ReplaceAll(parts[1], "-", ":")
	rfc3339Str := parts[0] + "T" + timeStr + "Z"

	parsedTime, err := time.Parse(time.RFC3339, rfc3339Str)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse time %s: %w", rfc3339Str, err)
	}

	return parsedTime, nil
}
