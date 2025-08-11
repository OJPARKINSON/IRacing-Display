#!/bin/bash

echo "Setting up nginx with HTTP/2, SSL, and compression using mkcert..."

# Check if mkcert is installed
echo "1. Checking mkcert installation..."
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert is not installed. Please install it first:"
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
    echo "After installation, run this script again."
    exit 1
fi

echo "✅ mkcert found: $(which mkcert)"

# Generate SSL certificates with mkcert
echo "2. Generating trusted SSL certificates..."
./generate-ssl-certs.sh
if [ $? -ne 0 ]; then
    echo "❌ Certificate generation failed. Please check the errors above."
    exit 1
fi

# Create nginx logs directory with proper permissions
echo "3. Creating nginx logs directory..."
mkdir -p nginx-logs
chmod 755 nginx-logs

# Get the device IP address
echo "4. Detecting IP address..."
if command -v ip >/dev/null 2>&1; then
    DEVICE_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
elif command -v ifconfig >/dev/null 2>&1; then
    DEVICE_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
else
    DEVICE_IP="YOUR_DEVICE_IP"
fi

echo "Detected IP address: $DEVICE_IP"

echo "5. Starting nginx and services..."
# Remove port conflicts by stopping services that might use the same ports
docker-compose down

# Start the services
docker-compose up -d nginx

echo ""
echo "✅ nginx setup complete!"
echo ""
echo "🌐 Access your services at:"
echo "  https://$DEVICE_IP/              - Main Dashboard"
echo "  https://$DEVICE_IP/grafana/      - Grafana"
echo "  https://$DEVICE_IP/questdb/      - QuestDB"  
echo "  https://$DEVICE_IP/prometheus/   - Prometheus"
echo ""
echo "🏠 Local access:"
echo "  https://localhost/               - Main Dashboard"
echo "  https://127.0.0.1/              - Same as localhost"
echo ""
echo "📱 Mobile/Network access:"
echo "  https://$DEVICE_IP/ (from any device on your network)"
echo ""
echo "📊 Features enabled:"
echo "  ✅ HTTP/2 support"
echo "  ✅ SSL/TLS encryption"
echo "  ✅ Gzip compression"
echo "  ✅ Security headers"
echo "  ✅ Rate limiting"
echo "  ✅ WebSocket support"
echo ""
echo "✅ Note: No browser security warnings! mkcert certificates are trusted."
echo "   Your certificates are automatically trusted by your system and browsers."
echo ""
echo "🔍 Monitor nginx status at: https://$DEVICE_IP/nginx_status"
echo "🔍 Health check: https://$DEVICE_IP/health"