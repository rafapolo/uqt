#!/usr/bin/env node
/**
 * Reverse proxy for Hetzner Object Storage (BUCKET_NAME bucket).
 * Uses S3 SDK to fetch private objects; no direct bucket access from clients.
 */
const http = require('http');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = 'BUCKET_NAME';
const PORT = 9001;

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
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
    res.writeHead(code, { 'Content-Type': 'application/octet-stream', ...corsHeaders });
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

  const botRegex = [
    /scrapy|selenium|puppeteer|playwright|phantomjs|casperjs/i,
    /headless\s*(chrome|browser)?/i,
    /headlesschrome/i,
    /automation\s*tool|automated\s*browser|bot\s*automation/i,
    /httpclient|http\s*client/i,
    /axios\/\d+|node-fetch|got\/\d+/i,
    /mechanize|urllib|requests\/\d+/i,
    /okhttp|retrofit/i,
    /wget\/|httrack|aria2|lftp|webcopy/i,
    /web\s*scraper|data\s*scraper|content\s*scraper/i,
    /mass\s*(crawl|scrape|download)/i,
    /bulk\s*(crawl|download|fetch)/i,
    /site\s*crawler|link\s*crawler/i,
    /botkit|dialogflow|rasa|botpress/i,
    /datacenter\s*proxy|residential\s*proxy|rotating\s*proxy/i,
    /proxy\s*rotation|proxy\s*pool/i,
    /tor\s*exit|tor\s+network/i,
    /jsdom|cheerio/i,
    /selenium-webdriver/i,
    /aws\s*lambda|google\s*cloud\s*functions|azure\s*functions/i,
    /python-requests|python\s*urllib|aiohttp/i,
    /go-http-client|java\/\d+\.\d+/i,
    /bot\s*engine|crawler\s*engine|spider\s*engine/i,
    /auto\s*fetch|auto\s*scrape|auto\s*crawl/i
  ];

  const ua = req.headers['user-agent'] || '';
  if (botRegex.some(r => r.test(ua))) {
    console.log(`[BLOCKED] bot: ${ua}`);
    res.writeHead(403, { 'Content-Type': 'text/plain', ...corsHeaders });
    res.end('Forbidden');
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
