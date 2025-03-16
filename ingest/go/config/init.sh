#!/bin/sh

# Wait for NATS to start
sleep 5

# Create the stream
nats stream add my_stream \
  --subjects "telemetry.*" \
  --storage file \
  --retention limits \
  --max-age 24h \
  --max-msgs=-1 \
  --max-bytes=-1 \
  --discard old \
  --dupe-window 2m

# Create the consumer
nats consumer add my_stream my-consumer \
  --filter "telemetry.*" \
  --deliver all \
  --replay instant \
  --ack explicit \
  --max-deliver=-1