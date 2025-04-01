package utils

// Min returns the smaller of two int64s
func Min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// MakeProgressBar creates a visual progress bar
func MakeProgressBar(percent float64, width int) string {
	completed := int(percent / 100 * float64(width))
	remaining := width - completed

	bar := "["
	for i := 0; i < completed; i++ {
		bar += "="
	}

	if completed < width {
		bar += ">"
		remaining--
	}

	for i := 0; i < remaining; i++ {
		bar += " "
	}

	bar += "]"
	return bar
}
