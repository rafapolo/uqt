#!/bin/bash
# Deploy UQT proxy and sync to Hetzner bucket
# Run this on your server: bash deploy.sh

set -e

echo "🎵 UQT Server Deployment"
echo "======================="

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

# 2. Start proxy as service
echo ""
echo "2️⃣  Starting proxy service..."

# Stop old proxy if running
pkill node || true
sleep 1

# Start new proxy in background
nohup node proxy.js > proxy.log 2>&1 &
PROXY_PID=$!
sleep 2

if ps -p $PROXY_PID > /dev/null; then
  echo "✅ Proxy running (PID: $PROXY_PID)"
else
  echo "❌ Proxy failed to start. Check proxy.log"
  cat proxy.log
  exit 1
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
  --region hel1 \
  --max-items 1 > /dev/null && echo "  ✅ Bucket accessible" || {
  echo "  ❌ Cannot access bucket"
  exit 1
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
echo "   1. Expose port 9001 publicly (firewall/DNS/reverse proxy)"
echo "   2. Test: curl -I http://xn--2dk.xyz:9001/uqt/uqt.json"
echo "   3. Check GitHub Pages for covers loading"
echo ""
