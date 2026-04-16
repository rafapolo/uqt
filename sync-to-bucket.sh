#!/bin/bash
# Sync covers and JSON to Hetzner bucket
# Usage: ./sync-to-bucket.sh
# Requires: mc (MinIO Client) - brew install minio/stable/mc

set -e

source .env

echo "🎵 UQT Sync Script"
echo "=================="
echo ""

# Setup mc alias
if ! mc alias list sambaraiz &>/dev/null; then
  echo "Setting up mc alias..."
  mc alias set sambaraiz https://your-region.your-objectstorage.com "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY"
fi

# Step 1: Regenerate JSON from MP3 tags
echo "1️⃣  Regenerating JSON from MP3 tags..."
if command -v ruby &> /dev/null; then
  ruby uqt.rb
  echo "✅ JSON regenerated: js/uqt.json"
else
  echo "⚠️  Ruby not found, skipping JSON regeneration"
  echo "   Install ruby and run: ruby uqt.rb"
fi

echo ""
echo "2️⃣  Syncing all files to bucket..."
mc mirror "/Volumes/EXTRA/bkps/sambaderaiz/" sambaraiz/sambaraiz/uqt/ --overwrite --quiet

echo ""
echo "3️⃣  Syncing JSON to bucket..."
mc cp js/uqt.json sambaraiz/sambaraiz/uqt/uqt.json --quiet

echo ""
echo "✅ Sync complete!"

echo ""
echo "📊 Current bucket status:"
mc ls sambaraiz/sambaraiz/uqt/ --summarize 2>/dev/null | tail -5 || echo "   (check bucket for details)"
