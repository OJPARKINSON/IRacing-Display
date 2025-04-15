FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /src

ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GOTOOLCHAIN=auto \
    GO111MODULE=on

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .


RUN go build -trimpath -ldflags="-s -w" -o /src/telemetry-app

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata curl && \
    update-ca-certificates

RUN adduser -D -g '' appuser

WORKDIR /app

RUN mkdir -p /app/ibt_files && \
    chown -R appuser:appuser /app

COPY --from=builder /src/telemetry-app /app/telemetry-app
RUN chmod +x /app/telemetry-app

USER appuser

ENV INFLUXDB_URL="http://influxdb:8086" \
    INFLUXDB_ORG="myorg" \
    INFLUXDB_BUCKET="telemetry" \
    MAX_BATCH_SIZE="5000" \
    BATCH_TIMEOUT="1s" \
    MAX_RETRIES="3" \
    RETRY_DELAY="500ms" \
    GOMAXPROCS="0"

LABEL org.opencontainers.image.description="Telemetry data processing application"

ENTRYPOINT ["/app/telemetry-app"]

CMD ["--help"]