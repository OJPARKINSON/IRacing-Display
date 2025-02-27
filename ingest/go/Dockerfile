# Build stage
FROM golang:1.24-alpine AS builder

# Install necessary build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /src

# Set Go environment variables for optimal builds
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GOTOOLCHAIN=auto \
    GO111MODULE=on

# Copy go.mod and go.sum first to leverage Docker layer caching
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build the application with optimizations
# -trimpath: removes file system paths from the binary
# -ldflags: reduces binary size and embeds version info
RUN go build -trimpath -ldflags="-s -w" -o /src/telemetry-app

# Run security scan on the built binary (optional but recommended)
# Commented out as it may not be installed by default
# RUN go install github.com/securego/gosec/v2/cmd/gosec@latest && \
#    gosec -quiet ./... || echo "Security issues found, review recommended"

# Final stage - minimal runtime image
FROM alpine:3.19

# Add necessary runtime dependencies
RUN apk add --no-cache ca-certificates tzdata curl && \
    update-ca-certificates

# Create a non-root user for running the application
RUN adduser -D -g '' appuser

# Create app directory with proper permissions
WORKDIR /app

# Create directory for IBT files with proper permissions
RUN mkdir -p /app/ibt_files && \
    chown -R appuser:appuser /app

# Copy the built binary from the builder stage
COPY --from=builder /src/telemetry-app /app/telemetry-app
RUN chmod +x /app/telemetry-app

# Switch to non-root user for security
USER appuser

# Set environment defaults that can be overridden at runtime
ENV INFLUXDB_URL="http://influxdb:8086" \
    INFLUXDB_ORG="myorg" \
    INFLUXDB_BUCKET="telemetry" \
    MAX_BATCH_SIZE="5000" \
    BATCH_TIMEOUT="1s" \
    MAX_RETRIES="3" \
    RETRY_DELAY="500ms" \
    GOMAXPROCS="0"

# Command documentation
LABEL org.opencontainers.image.description="Telemetry data processing application"

# The application binary is the entry point
ENTRYPOINT ["/app/telemetry-app"]

# Default command arguments (if no arguments are provided)
CMD ["--help"]