#!/bin/bash
# Deploy UQT proxy and sync to Hetzner bucket
# Run this on your server: bash deploy.sh

set -e

echo "🎵 UQT Server Deployment"
echo "======================="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -y nodejs > /dev/null 2>&1
  echo "   ✅ Node.js installed"
fi

# 1. Download proxy script
echo ""
echo "1️⃣  Setting up proxy..."
mkdir -p ~/uqt-proxy
cd ~/uqt-proxy

# Clone or download the latest code
if [ -d .git ]; then
  git pull origin master
else
  git clone https://github.com/rafapolo/uqt.git .
fi

# 2. Start proxy as haloyd service
echo ""
echo "2️⃣  Registering proxy with haloyd..."

# Create haloyd service config
mkdir -p ~/.haloyd/services
cat > ~/.haloyd/services/uqt-proxy.json << 'HALOYD_CONFIG'
{
  "name": "uqt-proxy",
  "description": "UQT Hetzner S3 Reverse Proxy",
  "command": "node",
  "args": ["proxy.js"],
  "cwd": "~/uqt-proxy",
  "port": 9001,
  "env": {},
  "restart": true,
  "public": true,
  "domain": "xn--2dk.xyz",
  "path": "/uqt"
}
HALOYD_CONFIG

echo "  ✅ Service config created"

# Or use systemd if haloyd isn't available
if ! command -v haloyd &> /dev/null; then
  echo "  ℹ️  haloyd not found, using systemd instead..."

  sudo tee /etc/systemd/system/uqt-proxy.service > /dev/null <<'SYSTEMD_CONFIG'
[Unit]
Description=UQT Hetzner Proxy
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/uqt-proxy
ExecStart=/usr/bin/node proxy.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SYSTEMD_CONFIG

  sudo systemctl daemon-reload
  sudo systemctl enable uqt-proxy
  sudo systemctl start uqt-proxy
  sleep 2

  if sudo systemctl is-active --quiet uqt-proxy; then
    echo "  ✅ Proxy running via systemd"
  else
    echo "  ❌ Proxy failed to start"
    sudo systemctl status uqt-proxy
    exit 1
  fi
else
  echo "  ✅ Proxy registered with haloyd"
  echo "     Service: uqt-proxy"
  echo "     Port: 9001"
fi

# 3. Sync JSON and covers to bucket
echo ""
echo "3️⃣  Syncing files to Hetzner bucket..."

export AWS_ACCESS_KEY_ID="REDACTED_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="REDACTED_SECRET_ACCESS_KEY"

# Test connectivity
echo "  Testing bucket access..."
aws s3 ls s3://sambaraiz/uqt/ \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1 2>/dev/null | head -1 > /dev/null && echo "  ✅ Bucket accessible" || {
  echo "  ⚠️  Bucket may be unreachable, continuing anyway..."
}

# Sync JSON
echo "  Uploading JSON..."
aws s3 cp js/uqt.json s3://sambaraiz/uqt/uqt.json \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1 && echo "  ✅ JSON uploaded" || echo "  ⚠️  JSON upload failed"

# Sync covers
echo "  Syncing album covers..."
aws s3 sync /Volumes/EXTRA/bkps/sambaderaiz/ \
  s3://sambaraiz/uqt/ \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1 \
  --exclude "*" \
  --include "capa.jpg" \
  --max-concurrent-requests 10 \
  --no-progress 2>&1 | grep -E "upload:|delete:" | tail -20 || true

# 4. Show stats
echo ""
echo "4️⃣  Bucket statistics:"
TOTAL=$(aws s3 ls s3://sambaraiz/uqt/ \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1 \
  --recursive 2>/dev/null | wc -l)
COVERS=$(aws s3 ls s3://sambaraiz/uqt/ \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1 \
  --recursive 2>/dev/null | grep '.jpg$' | wc -l)

echo "  Total objects: $TOTAL"
echo "  Covers: $COVERS"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Proxy running at:"
echo "   http://localhost:9001/uqt (local)"
echo "   http://xn--2dk.xyz:9001/uqt (public - if port 9001 exposed)"
echo ""
echo "📝 Next steps:"
if command -v haloyd &> /dev/null; then
  echo "   1. Reload haloyd: haloyd reload"
  echo "   2. Test: curl -I http://xn--2dk.xyz/uqt/uqt.json"
else
  echo "   1. Expose port 9001 publicly (firewall/DNS/reverse proxy)"
  echo "   2. Test: curl -I http://xn--2dk.xyz:9001/uqt/uqt.json"
fi
echo "   3. Check GitHub Pages for covers loading"
echo ""
