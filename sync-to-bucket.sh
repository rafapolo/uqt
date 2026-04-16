#!/bin/bash
# Sync covers and JSON to Hetzner bucket
# Usage: ./sync-to-bucket.sh

set -e

export AWS_ACCESS_KEY_ID="REDACTED_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="REDACTED_SECRET_ACCESS_KEY"

echo "🎵 UQT Sync Script"
echo "=================="
echo ""

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
echo "2️⃣  Syncing covers (capa.jpg) to bucket..."
aws s3 sync /Volumes/EXTRA/bkps/sambaderaiz/ \
  s3://sambaraiz/uqt/ \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1 \
  --exclude "*" \
  --include "capa.jpg" \
  --include "*.txt" \
  --no-progress 2>&1 | grep -E "upload:|delete:" || echo "✅ Covers up to date"

echo ""
echo "3️⃣  Syncing updated JSON to bucket..."
aws s3 cp js/uqt.json \
  s3://sambaraiz/uqt/ \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1

echo ""
echo "4️⃣  Syncing all files (covers, MP3s, metadata)..."
aws s3 sync /Volumes/EXTRA/bkps/sambaderaiz/ \
  s3://sambaraiz/uqt/ \
  --endpoint-url https://your-region.your-objectstorage.com \
  --region hel1 \
  --no-progress 2>&1 | grep -E "upload:|delete:" || echo "✅ All files up to date"

echo ""
echo "✅ Sync complete!"
echo ""
echo "📊 Current bucket status:"
TOTAL=$(aws s3 ls s3://sambaraiz/uqt/ --endpoint-url https://your-region.your-objectstorage.com --region hel1 --recursive 2>/dev/null | wc -l)
COVERS=$(aws s3 ls s3://sambaraiz/uqt/ --endpoint-url https://your-region.your-objectstorage.com --region hel1 --recursive 2>/dev/null | grep '.jpg$' | wc -l)
MP3S=$(aws s3 ls s3://sambaraiz/uqt/ --endpoint-url https://your-region.your-objectstorage.com --region hel1 --recursive 2>/dev/null | grep '.mp3$' | wc -l)

echo "  Total: $TOTAL objects"
echo "  MP3s: $MP3S"
echo "  Covers: $COVERS"
echo ""
echo "🔄 To complete full sync of all files, run:"
echo "   aws s3 sync /Volumes/EXTRA/bkps/sambaderaiz/ s3://sambaraiz/uqt/ \\"
echo "     --endpoint-url https://your-region.your-objectstorage.com --region hel1"
