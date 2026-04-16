#!/usr/bin/env node
/**
 * Simple reverse proxy for Hetzner S3 bucket
 * Forwards all requests to your-objectstorage-endpoint/uqt
 */
const http = require('http');
const https = require('https');
const url = require('url');

const BUCKET_URL = 'https://your-objectstorage-endpoint';
const BUCKET_PATH = '/uqt';
const PORT = 9001;

const server = http.createServer((req, res) => {
  // Health check endpoint for haloyd/monitoring
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Build target URL
  const targetPath = BUCKET_PATH + req.url;
  const targetUrl = BUCKET_URL + targetPath;

  // Set up CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=31536000');

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
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
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
  console.log(`📍 Proxying to: ${BUCKET_URL}${BUCKET_PATH}`);
  console.log(`🌍 Update BASE_URL in js/uqt.js to: http://xn--2dk.xyz:${PORT}/uqt (once public)`);
});
