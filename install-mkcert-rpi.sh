#!/bin/bash

echo "🍓 Installing mkcert for Raspberry Pi..."

# Detect architecture
ARCH=$(uname -m)
echo "📋 Detected architecture: $ARCH"

# Determine download URL based on architecture
case $ARCH in
    aarch64|arm64)
        echo "📦 Downloading mkcert for ARM64..."
        DOWNLOAD_URL="https://dl.filippo.io/mkcert/latest?for=linux/arm64"
        BINARY_PATTERN="mkcert-v*-linux-arm64"
        ;;
    armv7l|armv6l|arm)
        echo "📦 Downloading mkcert for ARM..."
        DOWNLOAD_URL="https://dl.filippo.io/mkcert/latest?for=linux/arm"
        BINARY_PATTERN="mkcert-v*-linux-arm"
        ;;
    x86_64)
        echo "📦 Downloading mkcert for x64..."
        DOWNLOAD_URL="https://dl.filippo.io/mkcert/latest?for=linux/amd64"
        BINARY_PATTERN="mkcert-v*-linux-amd64"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Download mkcert
echo "⬇️  Downloading mkcert..."
curl -JLO "$DOWNLOAD_URL"

if [ $? -ne 0 ]; then
    echo "❌ Failed to download mkcert"
    exit 1
fi

# Find the downloaded binary
BINARY_FILE=$(ls $BINARY_PATTERN 2>/dev/null | head -1)

if [ -z "$BINARY_FILE" ]; then
    echo "❌ Downloaded binary not found. Expected pattern: $BINARY_PATTERN"
    ls -la mkcert*
    exit 1
fi

echo "✅ Downloaded: $BINARY_FILE"

# Make it executable
chmod +x "$BINARY_FILE"

# Move to system path
echo "🔧 Installing to /usr/local/bin/mkcert..."
sudo mv "$BINARY_FILE" /usr/local/bin/mkcert

if [ $? -ne 0 ]; then
    echo "❌ Failed to install mkcert to /usr/local/bin/"
    exit 1
fi

# Verify installation
echo "🔍 Verifying installation..."
mkcert_version=$(mkcert -version 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ mkcert installed successfully: $mkcert_version"
    echo "📍 Location: $(which mkcert)"
else
    echo "❌ mkcert installation verification failed"
    exit 1
fi

# Install root CA
echo "🔐 Installing mkcert root CA..."
mkcert -install

if [ $? -eq 0 ]; then
    echo "✅ mkcert root CA installed successfully"
    echo "📂 CA Root: $(mkcert -CAROOT)"
else
    echo "❌ Failed to install mkcert root CA"
    exit 1
fi

echo ""
echo "🎉 mkcert setup complete!"
echo ""
echo "You can now run:"
echo "  ./setup-nginx.sh    # Set up nginx with trusted certificates"
echo "  or"
echo "  ./generate-ssl-certs.sh    # Generate certificates only"
echo ""
echo "📝 Note: The root CA is installed system-wide, so browsers on this"
echo "         Raspberry Pi will trust the certificates without warnings."
echo ""
echo "🌐 For other devices to trust the certificates, you'll need to:"
echo "   1. Copy $(mkcert -CAROOT)/rootCA.pem to other devices"
echo "   2. Install it as a trusted root certificate"