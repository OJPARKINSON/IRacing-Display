#!/bin/bash

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Use HOST_IP from environment or default
HOST_IP=${HOST_IP:-192.168.1.202}

# Create certs directory
mkdir -p certs

# Set secure permissions on certs directory
chmod 700 certs

echo "🔐 Generating self-signed SSL certificates for host: $HOST_IP"

# Generate self-signed certificate for local testing
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/localhost.key \
    -out certs/localhost.crt \
    -subj "/C=US/ST=State/L=City/O=LocalDev/CN=$HOST_IP" \
    -addext "subjectAltName=DNS:localhost,DNS:$HOST_IP,IP:$HOST_IP,IP:127.0.0.1"

# Set secure permissions on certificate files
chmod 600 certs/localhost.key
chmod 644 certs/localhost.crt

# Copy TLS configuration template
cp dynamic/tls.yaml.example dynamic/tls.yaml

echo "✅ Self-signed certificates generated in certs/ directory"
echo "   - Certificate: certs/localhost.crt"
echo "   - Private Key: certs/localhost.key"
echo "   - TLS Config: dynamic/tls.yaml"
echo ""
echo "🔒 Secure file permissions set:"
echo "   - Private key (600): owner read/write only"
echo "   - Certificate (644): world readable"
echo "   - Certs directory (700): owner access only"
echo ""
echo "⚠️  Note: Browsers will show security warnings for self-signed certificates"
echo "   You can safely proceed through the warning for local development."
echo ""
echo "🚀 You can now start Traefik with: docker-compose up traefik -d"