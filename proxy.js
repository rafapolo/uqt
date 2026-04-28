#!/usr/bin/env node
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const n = os.cpus().length;
  console.log(`Primary ${process.pid}: forking ${n} workers`);
  for (let i = 0; i < n; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} exited (${signal ?? code}), restarting`);
    cluster.fork();
  });
} else {
  const http = require('http');
  const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
  const { NodeHttpHandler } = require('@smithy/node-http-handler');

  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason);
  });

  const BUCKET = 'BUCKET_NAME';
  const PORT = 9001;
  const MAX_CONCURRENT = 80;
  const REQUEST_TIMEOUT = 30000;

  let activeRequests = 0;
  const ipCounts = new Map();

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'hel1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5000,
      socketTimeout: 30000,
      maxSockets: 150,
      maxFreeSockets: 30,
    }),
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

  async function handleObject(req, res, key, ip) {
    if (activeRequests >= MAX_CONCURRENT) {
      res.writeHead(503, { 'Content-Type': 'text/plain', ...corsHeaders });
      res.end('Too Many Requests');
      return;
    }

    const isHead = req.method === 'HEAD';
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT);
    activeRequests++;

    try {
      const cmd = isHead
        ? new HeadObjectCommand({ Bucket: BUCKET, Key: key, Range: req.headers.range })
        : new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: req.headers.range });
      const obj = await s3.send(cmd, { abortSignal: abort.signal });

      const headers = { ...corsHeaders, 'Content-Type': mimeFor(key) };
      if (obj.ContentLength != null) headers['Content-Length'] = String(obj.ContentLength);
      if (obj.ContentRange) headers['Content-Range'] = obj.ContentRange;
      if (obj.AcceptRanges) headers['Accept-Ranges'] = obj.AcceptRanges;
      if (obj.ETag) headers['ETag'] = obj.ETag;
      if (obj.LastModified) headers['Last-Modified'] = obj.LastModified.toUTCString();

      const status = obj.ContentRange ? 206 : 200;
      res.writeHead(status, headers);
      if (isHead || !obj.Body) { res.end(); return; }
      obj.Body.on('error', (e) => { console.error('stream err:', e.message); res.destroy(); });
      obj.Body.pipe(res);
    } catch (err) {
      const code = err.name === 'AbortError' ? 504 : (err.$metadata?.httpStatusCode ?? 500);
      console.error(`[${code}] ${req.method} ${key}: ${err.name}`);
      if (!res.headersSent) {
        res.writeHead(code, { 'Content-Type': 'text/plain', ...corsHeaders });
        res.end(err.name);
      }
    } finally {
      clearTimeout(timer);
      activeRequests--;
      if (ip) {
        const n = (ipCounts.get(ip) ?? 1) - 1;
        if (n <= 0) ipCounts.delete(ip); else ipCounts.set(ip, n);
      }
    }
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
    /auto\s*fetch|auto\s*scrape|auto\s*crawl/i,
  ];

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

    const ua = req.headers['user-agent'] || '';
    if (botRegex.some(r => r.test(ua))) {
      console.log(`[BLOCKED] bot: ${ua}`);
      res.writeHead(403, { 'Content-Type': 'text/plain', ...corsHeaders });
      res.end('Forbidden');
      return;
    }

    const path = decodeURI(req.url.replace(/^\/+/, '').split('?')[0]);
    if (!path) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const isAudio = /\.(mp3|mp4|m4a)$/i.test(path);
    const ip = isAudio
      ? ((req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress)
      : null;
    if (ip) {
      const ipActive = ipCounts.get(ip) ?? 0;
      if (ipActive >= 5) {
        res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '5', ...corsHeaders });
        res.end('Too Many Requests');
        return;
      }
      ipCounts.set(ip, ipActive + 1);
    }

    console.log(`[${new Date().toISOString()}] w${process.pid} ${req.method} ${path}`);
    await handleObject(req, res, path, ip);
  });

  server.maxConnections = 500;
  server.keepAliveTimeout = 10000;
  server.headersTimeout = 15000;
  server.setTimeout(REQUEST_TIMEOUT);

  server.on('error', (err) => console.error('server error:', err.message));

  server.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on :${PORT} -> s3://${BUCKET}/`);
  });
}
