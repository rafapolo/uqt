#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const MC_ALIAS = 'hetzner';
const BUCKET   = 'sambaraiz';
const PREFIX   = 'uqt';
const MC_BASE  = `${MC_ALIAS}/${BUCKET}/${PREFIX}`;

let db;
eval(fs.readFileSync(path.resolve(__dirname, '../js/uqt-albums.js'), 'utf8'));
console.log(`DB loaded: ${db.albums.length} albums`);

console.log('Listing S3 paths...');
const mcOut = execSync(`mc ls "${MC_BASE}/"`, { encoding: 'utf8' });
const s3Paths = new Set(
  mcOut.split('\n')
    .map(l => { const m = l.match(/^\[.*?\]\s+\S+\s+(.*)\/$$/); return m ? m[1] : null; })
    .filter(Boolean)
);
console.log(`S3 has ${s3Paths.size} album directories`);

const filtered = db.albums.filter(a => s3Paths.has(a.path));
const removed  = db.albums.length - filtered.length;
console.log(`Keeping ${filtered.length} albums, removing ${removed} with no S3 path`);

const outDir  = path.resolve(__dirname, '../js');
const jsonStr = JSON.stringify({ albums: filtered });

fs.writeFileSync(
  path.join(outDir, 'uqt-albums.js'),
  'db = ' + JSON.stringify({ albums: filtered }, null, 2)
);
fs.writeFileSync(
  path.join(outDir, 'uqt-albums.json.gz'),
  zlib.gzipSync(Buffer.from(jsonStr))
);
console.log('Written: js/uqt-albums.js and js/uqt-albums.json.gz');
