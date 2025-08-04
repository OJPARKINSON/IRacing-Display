package processing

import (
	"log"
	"os"
	"time"

	"github.com/OJPARKINSON/IRacing-Display/ingest/go/internal/config"
)

type Directory struct {
	path             string
	lastScan         time.Time
	fileAgeThreshold time.Duration
}

func NewDir(path string, cfg *config.Config) *Directory {
	return &Directory{
		path:             path,
		fileAgeThreshold: cfg.FileAgeThreshold,
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

		if info.ModTime().Before(time.Now().Add(-d.fileAgeThreshold)) {
			filesToProcess = append(filesToProcess, file)
		} else {
			log.Printf("Skipping recent file (still being written? Age threshold: %v): %s", d.fileAgeThreshold, file.Name())
		}
	}

	d.lastScan = time.Now()
	log.Printf("Found %d files ready for processing out of %d total files", len(filesToProcess), len(files))
	return filesToProcess
}
