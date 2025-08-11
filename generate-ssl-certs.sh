#!/bin/bash

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert is not installed."
    echo ""
    echo "Please install mkcert first:"
    echo ""
    echo "Raspberry Pi (64-bit):"
    echo "  curl -JLO https://dl.filippo.io/mkcert/latest?for=linux/arm64"
    echo "  chmod +x mkcert-v*-linux-arm64"
    echo "  sudo mv mkcert-v*-linux-arm64 /usr/local/bin/mkcert"
    echo ""
    echo "Raspberry Pi (32-bit):"
    echo "  curl -JLO https://dl.filippo.io/mkcert/latest?for=linux/arm"
    echo "  chmod +x mkcert-v*-linux-arm"
    echo "  sudo mv mkcert-v*-linux-arm /usr/local/bin/mkcert"
    echo ""
    echo "Other Linux (x64):"
    echo "  curl -JLO https://dl.filippo.io/mkcert/latest?for=linux/amd64"
    echo "  chmod +x mkcert-v*-linux-amd64"
    echo "  sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert"
    echo ""
    echo "macOS:   brew install mkcert"
    echo "Windows: scoop install mkcert"
    echo ""
    echo "After installation, run: mkcert -install"
    exit 1
fi

# Check if mkcert CA is installed
if ! mkcert -CAROOT &> /dev/null || [ ! -f "$(mkcert -CAROOT)/rootCA.pem" ]; then
    echo "🔧 Installing mkcert root CA..."
    mkcert -install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install mkcert root CA"
        exit 1
    fi
    echo "✅ mkcert root CA installed successfully"
fi

# Create SSL certificates directory
mkdir -p ssl/certs ssl/private

# Generate DH parameters (still needed for nginx security)
echo "🔐 Generating DH parameters (this may take a minute)..."
if [ ! -f ssl/certs/dhparam.pem ]; then
    openssl dhparam -out ssl/certs/dhparam.pem 2048
    echo "✅ DH parameters generated"
else
    echo "✅ DH parameters already exist"
fi

# Detect device IP address
echo "🔍 Detecting device IP address..."
if command -v ip >/dev/null 2>&1; then
    DEVICE_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
elif command -v ifconfig >/dev/null 2>&1; then
    DEVICE_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
else
    DEVICE_IP="192.168.1.100"
    echo "⚠️  Could not detect IP, using default: $DEVICE_IP"
fi

if [ -n "$DEVICE_IP" ] && [ "$DEVICE_IP" != "" ]; then
    echo "📍 Detected IP address: $DEVICE_IP"
else
    DEVICE_IP="192.168.1.100"
    echo "⚠️  Using fallback IP: $DEVICE_IP"
fi

# Generate mkcert certificate
echo "🔒 Generating trusted SSL certificate with mkcert..."
mkcert -key-file ssl/private/nginx-selfsigned.key -cert-file ssl/certs/nginx-selfsigned.crt localhost 127.0.0.1 ::1 "$DEVICE_IP"

if [ $? -eq 0 ]; then
    echo "✅ mkcert certificate generated successfully"
else
    echo "❌ Failed to generate mkcert certificate"
    exit 1
fi

# Set proper permissions
chmod 600 ssl/private/nginx-selfsigned.key
chmod 644 ssl/certs/nginx-selfsigned.crt
chmod 644 ssl/certs/dhparam.pem

echo "SSL certificates generated successfully!"
echo ""
echo "You can now access your services using your device's IP address:"
echo "https://YOUR_IP_ADDRESS/ (Main dashboard)"
echo "https://YOUR_IP_ADDRESS/grafana/ (Grafana)"
echo "https://YOUR_IP_ADDRESS/questdb/ (QuestDB)"
echo "https://YOUR_IP_ADDRESS/prometheus/ (Prometheus)"
echo ""
echo "Local access:"
echo "https://localhost/ (Main dashboard)"
echo "https://127.0.0.1/ (Same as localhost)"
echo ""
echo "Find your IP address with: ip addr show or ifconfig"