package processing

import (
	"log"
	"os"
	"time"
)

type Directory struct {
	path     string
	lastScan time.Time
}

type FileInfo struct {
	fullPath string
	size     int64
	fileAge  time.Time
	status   string
}

func NewDir(path string) *Directory {
	return &Directory{
		path: path,
	}
}

func (d *Directory) WatchDir() []os.DirEntry {
	d.lastScan = time.Now()
	files, err := os.ReadDir(d.path)
	if err != nil {
		log.Fatalf("Could not read the given input directory: %v", err)
	}

	filesToProcess := make([]os.DirEntry, 0)

	for _, file := range files {
		info, err := file.Info()
		if err != nil {
			log.Printf("Could not get file info for %s: %v", file.Name(), err)
			continue
		}

		// Only process files that are at least 10 minutes old
		// This prevents processing files that are still being written
		if info.ModTime().Before(time.Now().Add(-(time.Minute * 10))) {
			filesToProcess = append(filesToProcess, file)
		} else {
			log.Printf("Skipping recent file (still being written?): %s", file.Name())
		}
	}

	d.lastScan = time.Now()
	log.Printf("Found %d files ready for processing out of %d total files", len(filesToProcess), len(files))
	return filesToProcess
}
