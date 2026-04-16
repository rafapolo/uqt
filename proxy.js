#!/usr/bin/env node
/**
 * Simple reverse proxy for Hetzner S3 bucket
 * Forwards all requests to your-objectstorage-endpoint/sambaraiz/uqt
 */
const http = require('http');
const https = require('https');
const url = require('url');

const BUCKET_URL = 'https://your-objectstorage-endpoint/sambaraiz';
const PORT = 9001;

const server = http.createServer((req, res) => {
  // Health check endpoint for haloyd/monitoring
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Build target URL - bucket structure is /sambaraiz/uqt/...
  const targetUrl = BUCKET_URL + req.url;

  // Set up CORS headers to prevent CORB blocking
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Range, ETag');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Forward the request to the bucket
  const options = url.parse(targetUrl);
  options.method = req.method;
  options.headers = req.headers;
  delete options.headers.host;

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  const proxyReq = https.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    const urlLower = req.url.toLowerCase();

    // Set proper Content-Type to prevent CORB blocking
    if (urlLower.endsWith('.mp3')) {
      headers['content-type'] = 'audio/mpeg';
    } else if (urlLower.endsWith('.mp4')) {
      headers['content-type'] = 'audio/mp4';
    } else if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) {
      headers['content-type'] = 'image/jpeg';
    } else if (urlLower.endsWith('.png')) {
      headers['content-type'] = 'image/png';
    } else if (urlLower.endsWith('.webp')) {
      headers['content-type'] = 'image/webp';
    } else if (urlLower.endsWith('.json')) {
      headers['content-type'] = 'application/json';
    }

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy error for ${targetUrl}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: ' + err.message);
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

server.listen(PORT, () => {
  console.log(`🎵 UQT Proxy listening on http://localhost:${PORT}`);
  console.log(`📍 Proxying to: ${BUCKET_URL}`);
  console.log(`🌍 Update BASE_URL in js/uqt.js to: https://haloy.xn--2dk.xyz/uqt`);
});
