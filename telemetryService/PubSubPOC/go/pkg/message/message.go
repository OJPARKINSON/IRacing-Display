package message

// ChunkMetadata holds information about a chunk
type ChunkMetadata struct {
	MessageID   string `json:"message_id"`
	ChunkIndex  int    `json:"chunk_index"`
	TotalChunks int    `json:"total_chunks"`
	FileName    string `json:"file_name"`
	FileSize    int64  `json:"file_size"`
	ChunkSize   int    `json:"chunk_size"`
	LastChunk   bool   `json:"last_chunk"`
}

// ChunkMessage is the complete message with metadata and binary data
type ChunkMessage struct {
	Metadata ChunkMetadata `json:"metadata"`
	Data     []byte        `json:"data"`
}

type ChunkAck struct {
	MessageID  string `json:"message_id"`
	ChunkIndex int    `json:"chunk_index"`
	ConsumerID string `json:"consumer_id"`
}

type FileCompletionAck struct {
	MessageID  string `json:"message_id"`
	ConsumerID string `json:"consumer_id"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}
