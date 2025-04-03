
#!/bin/bash

# Create directories for Kafka data
mkdir -p kafka-data kafka-metadata
chmod -R 777 kafka-data kafka-metadata

# Make sure the network exists
docker network inspect telemetry-network >/dev/null 2>&1 || docker network create telemetry-network

# Create secret files if they don't exist
if [ ! -f .env.influxdb-admin-username ]; then
  echo "admin" > .env.influxdb-admin-username
  echo "strongpassword" > .env.influxdb-admin-password
  echo "your-admin-token" > .env.influxdb-admin-token
  chmod 600 .env.influxdb-admin-*
fi

echo "Setup complete! You can now run 'docker-compose up -d'"