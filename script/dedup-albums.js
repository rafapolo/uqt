const zlib = require('zlib'), fs = require('fs');

const data = JSON.parse(zlib.gunzipSync(fs.readFileSync('js/uqt-albums.json.gz')));
let albums = data.albums;

// User-confirmed duplicate: track names differ slightly (3 variants) so fingerprint won't catch it
const REMOVE_PATHS = new Set(['1986 - Chôro no céu Chôros famosos, solistas inesquecíveis']);

function uppercaseRatio(tracks) {
  const str = tracks.map(t => t.title).join('');
  const upper = [...str].filter(c => c >= 'A' && c <= 'Z').length;
  return str.length > 0 ? upper / str.length : 0;
}

const groups = {};
albums.forEach(a => {
  const fp = a.tracks.map(t => t.title.toLowerCase().trim()).sort().join('|');
  (groups[fp] ??= []).push(a);
});

Object.values(groups).filter(g => g.length > 1).forEach(group => {
  group.sort((a, b) => {
    const diff = uppercaseRatio(b.tracks) - uppercaseRatio(a.tracks);
    if (Math.abs(diff) > 0.001) return diff;
    const pathUpper = x => [...x.path].filter(c => c >= 'A' && c <= 'Z').length;
    return pathUpper(b) - pathUpper(a);
  });
  console.log(`KEEP:   ${group[0].path}`);
  group.slice(1).forEach(a => {
    console.log(`REMOVE: ${a.path}`);
    REMOVE_PATHS.add(a.path);
  });
  console.log();
});

albums = albums.filter(a => !REMOVE_PATHS.has(a.path));

const jsonStr = JSON.stringify({ albums });
fs.writeFileSync('js/uqt-albums.json.gz', zlib.gzipSync(Buffer.from(jsonStr)));
fs.writeFileSync('js/uqt-albums.js', `db = ${JSON.stringify({ albums }, null, 2)}`);
console.log(`Removed ${REMOVE_PATHS.size} albums. ${albums.length} remaining.`);
