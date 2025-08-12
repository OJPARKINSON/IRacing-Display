# mkcert SSL Setup for IRacing Telemetry Dashboard

This guide explains how to set up trusted SSL certificates using mkcert instead of self-signed certificates.

## Benefits of mkcert

✅ **No browser warnings** - Certificates are automatically trusted  
✅ **Works on all devices** (with some setup)  
✅ **Same nginx configuration** - No changes needed to existing setup  
✅ **Easy renewal** - Simple command to regenerate  

## Quick Setup (Raspberry Pi)

### Option 1: Automated Installation
```bash
# Install mkcert automatically (detects your Pi's architecture)
./install-mkcert-rpi.sh

# Generate certificates and start nginx
./setup-nginx.sh
```

### Option 2: Manual Installation

**For Raspberry Pi 4/5 (64-bit):**
```bash
curl -JLO https://dl.filippo.io/mkcert/latest?for=linux/arm64
chmod +x mkcert-v*-linux-arm64  
sudo mv mkcert-v*-linux-arm64 /usr/local/bin/mkcert
```

**For older Raspberry Pi (32-bit):**
```bash
curl -JLO https://dl.filippo.io/mkcert/latest?for=linux/arm
chmod +x mkcert-v*-linux-arm
sudo mv mkcert-v*-linux-arm /usr/local/bin/mkcert
```

**After installation:**
```bash
mkcert -install              # Install root CA
./setup-nginx.sh             # Generate certs and start nginx
```

## Accessing from Other Devices

### Trust on Your Computer
To access the dashboard from your laptop/desktop without warnings:

1. **Copy the root CA from your Pi:**
   ```bash
   # On your Pi, find the root CA location
   mkcert -CAROOT
   # Copy rootCA.pem to your computer
   ```

2. **Install on your computer:**
   - **macOS:** Double-click rootCA.pem → Add to System keychain
   - **Windows:** Double-click → Install Certificate → Local Machine → Trusted Root
   - **Linux:** Copy to `/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`

### Trust on Mobile Devices
For phones/tablets to trust the certificates:

1. Copy `rootCA.pem` to your mobile device
2. **iOS:** Settings → General → VPN & Device Management → Install Profile
3. **Android:** Settings → Security → Install from storage

## File Structure
```
IRacing-Display/
├── install-mkcert-rpi.sh       # Auto-installer for Raspberry Pi
├── generate-ssl-certs.sh       # Generate mkcert certificates  
├── setup-nginx.sh              # Full nginx setup with mkcert
├── nginx.conf                  # nginx configuration (unchanged)
└── ssl/
    ├── certs/
    │   ├── nginx-selfsigned.crt # mkcert certificate
    │   └── dhparam.pem         # DH parameters
    └── private/
        └── nginx-selfsigned.key # mkcert private key
```

## Commands Reference

```bash
# Check if mkcert is installed
mkcert -version

# Check CA root location
mkcert -CAROOT

# Generate certificates manually
mkcert -key-file ssl/private/nginx-selfsigned.key \
       -cert-file ssl/certs/nginx-selfsigned.crt \
       localhost 127.0.0.1 192.168.1.100

# Regenerate certificates (if IP changes)
./generate-ssl-certs.sh

# Uninstall mkcert CA (removes trust)
mkcert -uninstall
```

## Troubleshooting

### Still seeing warnings?
- Make sure you ran `mkcert -install`
- Check your IP address is included in the certificate
- Try regenerating: `./generate-ssl-certs.sh`

### Certificate not trusted on other devices?
- Install the root CA (`rootCA.pem`) on each device
- Make sure the CA is added to the system trust store, not user

### Can't find mkcert binary?
- Check architecture: `uname -m`  
- Verify download URL matches your Pi model
- Try the automated installer: `./install-mkcert-rpi.sh`

### Browser still showing "Not Secure"?
- Clear browser cache and restart
- Check certificate details in browser (should show "mkcert")
- Verify certificate includes your device's IP address

## Access URLs

After setup, access your dashboard at:
- `https://YOUR_PI_IP/` (Main dashboard)  
- `https://YOUR_PI_IP/grafana/` (Grafana)
- `https://YOUR_PI_IP/questdb/` (QuestDB)

No more security warnings! 🎉