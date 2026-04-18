#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

// ── Config ────────────────────────────────────────────────────────────────────

const LOCAL_DIR  = '/Volumes/EXTRA/bkps/sambaderaiz';
const BUCKET     = 'sambaraiz';
const PREFIX     = 'uqt/';
const ENDPOINT   = 'https://your-region.your-objectstorage.com';
const CONCURRENCY = 20;

// ── Load .env ─────────────────────────────────────────────────────────────────

function loadEnv(file = '.env') {
  const lines = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([\w]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

loadEnv();

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: 'hel1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkDir(dir, base = dir) {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push(...walkDir(full, base));
    } else {
      entries.push({ localPath: full, relativePath: path.relative(base, full), size: stat.size });
    }
  }
  return entries;
}

async function listAllS3Objects(bucket, prefix) {
  const map = new Map(); // key → { size, etag }
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, ContinuationToken: token,
    }));
    for (const obj of res.Contents ?? []) {
      map.set(obj.Key, { size: obj.Size, etag: obj.ETag?.replace(/"/g, '') });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return map;
}

async function uploadFile(localPath, key) {
  const body = fs.createReadStream(localPath);
  const ext  = path.extname(localPath).toLowerCase();
  const mime = { '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                 '.png': 'image/png',  '.json': 'application/json' }[ext] ?? 'application/octet-stream';
  const up = new Upload({
    client: s3,
    params: { Bucket: BUCKET, Key: key, Body: body, ContentType: mime },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  });
  await up.done();
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function renderBar(done, total, startMs) {
  const pct    = total ? done / total : 0;
  const width  = 30;
  const filled = Math.round(pct * width);
  const bar    = '='.repeat(filled) + (filled < width ? '>' : '') + ' '.repeat(Math.max(0, width - filled - 1));
  const elapsed = (Date.now() - startMs) / 1000;
  const rate   = elapsed > 0 ? (done / elapsed).toFixed(1) : '0.0';
  const pctStr = (pct * 100).toFixed(1).padStart(5);
  process.stdout.write(`\r  [${bar}] ${pctStr}%  ${done}/${total} files  ${rate} files/s   `);
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function runPool(tasks, concurrency, fn) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      await fn(task);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  UQT Sync\n  ────────\n');

  // Step 1: walk local dir
  console.log('  1/2  Scanning local files…');
  if (!fs.existsSync(LOCAL_DIR)) {
    console.error(`\n  Error: local dir not found: ${LOCAL_DIR}`);
    process.exit(1);
  }
  const localFiles = walkDir(LOCAL_DIR);
  console.log(`       ${localFiles.length.toLocaleString()} files found\n`);

  // Step 2: list S3
  console.log('  2/2  Listing S3 objects…');
  const s3Map = await listAllS3Objects(BUCKET, PREFIX);
  console.log(`       ${s3Map.size.toLocaleString()} objects in bucket\n`);

  // Diff
  const toUpload = localFiles.filter(({ relativePath, size }) => {
    const key   = PREFIX + relativePath.replace(/\\/g, '/');
    const s3obj = s3Map.get(key);
    return !s3obj || s3obj.size !== size;
  });

  if (toUpload.length === 0) {
    console.log('  All files up to date. Nothing to upload.\n');
    return;
  }

  const totalBytes = toUpload.reduce((acc, f) => acc + f.size, 0);
  console.log(`  Uploading ${toUpload.length.toLocaleString()} files  (${(totalBytes / 1e9).toFixed(2)} GB)\n`);

  let done = 0;
  const startMs = Date.now();
  renderBar(0, toUpload.length, startMs);

  await runPool(toUpload, CONCURRENCY, async ({ localPath, relativePath }) => {
    const key = PREFIX + relativePath.replace(/\\/g, '/');
    await uploadFile(localPath, key);
    done++;
    renderBar(done, toUpload.length, startMs);
  });

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  process.stdout.write('\n');
  console.log(`\n  Done — ${toUpload.length.toLocaleString()} files uploaded in ${elapsed}s\n`);
}

main().catch(err => { console.error('\n  Error:', err.message); process.exit(1); });
