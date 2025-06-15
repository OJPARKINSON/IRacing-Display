package main

import (
	"log"
	"os"
	"time"
)

type directory struct {
	path     string
	lastScan time.Time
}

type file struct {
	fullPath string
	size     int64
	fileAge  time.Time
	status   string
}

func newDir(path string) directory {
	return directory{
		path: path,
	}
}

func (d *directory) WatchDir() []os.DirEntry {
	d.lastScan = time.Now()
	files, err := os.ReadDir(d.path)
	if err != nil {
		log.Fatalf("Could not glob the given input files: %v", err)
	}

	filesToProcess := make([]os.DirEntry, 0)

	for _, file := range files {
		info, _ := file.Info()
		if info.ModTime().Before(time.Now().Add(-(time.Minute * 10))) {
			filesToProcess = append(filesToProcess, file)
		}
	}

	d.lastScan = time.Now()
	return filesToProcess
}
