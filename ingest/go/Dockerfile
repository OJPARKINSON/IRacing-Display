# Use the latest Go version that supports Go 1.22 toolchains
FROM golang:1.24 AS builder

# Set the working directory inside the container
WORKDIR /app

# Disable Go toolchain auto-download to avoid `toolchain not available` error
ENV GOTOOLCHAIN=auto

# Copy go.mod and go.sum files for dependency installation
COPY go.mod go.sum ./

# Download Go dependencies
RUN go mod download

# Copy the entire application source code
COPY . .

# Build the Go application (static binary for Linux)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o telemetry-app .

# Use a lightweight final image (Alpine)
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/telemetry-app /app/telemetry-app

# Ensure the binary has execution permissions
RUN chmod +x /app/telemetry-app

ENTRYPOINT ["/app/telemetry-app"]
