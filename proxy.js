#!/usr/bin/env node
/**
 * Reverse proxy for Hetzner Object Storage (sambaraiz bucket).
 * Uses S3 SDK to fetch private objects; no direct bucket access from clients.
 */
const http = require('http');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = 'sambaraiz';
const PORT = 9001;

const s3 = new S3Client({
  endpoint: 'https://your-region.your-objectstorage.com',
  region: 'hel1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range, ETag, Accept-Ranges',
  'Cache-Control': 'public, max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
};

function mimeFor(key) {
  const k = key.toLowerCase();
  if (k.endsWith('.mp3')) return 'audio/mpeg';
  if (k.endsWith('.mp4') || k.endsWith('.m4a')) return 'audio/mp4';
  if (k.endsWith('.jpg') || k.endsWith('.jpeg')) return 'image/jpeg';
  if (k.endsWith('.png')) return 'image/png';
  if (k.endsWith('.webp')) return 'image/webp';
  if (k.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

async function handleObject(req, res, key) {
  const isHead = req.method === 'HEAD';
  try {
    const cmd = isHead
      ? new HeadObjectCommand({ Bucket: BUCKET, Key: key, Range: req.headers.range })
      : new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: req.headers.range });
    const obj = await s3.send(cmd);

    const headers = { ...corsHeaders, 'Content-Type': mimeFor(key) };
    if (obj.ContentLength != null) headers['Content-Length'] = String(obj.ContentLength);
    if (obj.ContentRange) headers['Content-Range'] = obj.ContentRange;
    if (obj.AcceptRanges) headers['Accept-Ranges'] = obj.AcceptRanges;
    if (obj.ETag) headers['ETag'] = obj.ETag;
    if (obj.LastModified) headers['Last-Modified'] = obj.LastModified.toUTCString();

    const status = obj.ContentRange ? 206 : 200;
    res.writeHead(status, headers);
    if (isHead || !obj.Body) return res.end();
    obj.Body.on('error', (e) => { console.error('stream err:', e.message); res.destroy(); });
    obj.Body.pipe(res);
  } catch (err) {
    const code = err.$metadata?.httpStatusCode ?? 500;
    console.error(`[${code}] ${req.method} ${key}: ${err.name}`);
    res.writeHead(code, { 'Content-Type': 'text/plain', ...corsHeaders });
    res.end(`${err.name}: ${err.message}`);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...corsHeaders, 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // Strip leading slash, drop query string, decode once.
  const path = decodeURI(req.url.replace(/^\/+/, '').split('?')[0]);
  if (!path) {
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);
  await handleObject(req, res, path);
});

server.listen(PORT, () => {
  console.log(`UQT Proxy listening on :${PORT} -> s3://${BUCKET}/`);
});
