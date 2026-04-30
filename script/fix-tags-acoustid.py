#!/usr/bin/env python3
"""
Fingerprint files from /tmp/untagged-final.txt that are missing year and have
no year in their path. Queries AcoustID → MusicBrainz to get the release year,
then writes it as a TDRC ID3 tag.

Usage:
    ACOUSTID_KEY=yourkey python3 script/fix-tags-acoustid.py

Get a free API key at: https://acoustid.org/api-key
"""

import os
import re
import sys
import json
import time
import subprocess
import urllib.request
import urllib.parse

from mutagen.id3 import ID3, ID3NoHeaderError, TDRC

INPUT_FILE  = '/tmp/untagged-final.txt'
ACOUSTID_URL = 'https://api.acoustid.org/v2/lookup'
MB_URL       = 'https://musicbrainz.org/ws/2/release/{mbid}?fmt=json'
RATE_LIMIT   = 0.34  # AcoustID allows ~3 req/s


def fingerprint(filepath):
    try:
        result = subprocess.run(
            ['fpcalc', '-json', filepath],
            capture_output=True, timeout=30
        )
        data = json.loads(result.stdout)
        return data['duration'], data['fingerprint']
    except Exception as e:
        return None, None


def acoustid_lookup(api_key, duration, fingerprint):
    params = urllib.parse.urlencode({
        'client':      api_key,
        'duration':    int(duration),
        'fingerprint': fingerprint,
        'meta':        'recordings+releases+releasegroups',
    })
    try:
        req = urllib.request.Request(
            f'{ACOUSTID_URL}?{params}',
            headers={'User-Agent': 'uqt-tagger/1.0 (rafael.polo@gmail.com)'}
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f'  AcoustID error: {e}', file=sys.stderr)
        return None


def extract_year(data):
    """Pull the earliest release year from an AcoustID response."""
    if not data or data.get('status') != 'ok':
        return 0
    best_score = 0
    best_year  = 0
    for result in data.get('results', []):
        score = result.get('score', 0)
        if score < 0.5:
            continue
        for rec in result.get('recordings', []):
            for rel in rec.get('releases', []):
                date = rel.get('date', {})
                y = date.get('year', 0)
                if y and (score > best_score or (score == best_score and y < best_year)):
                    best_score = score
                    best_year  = y
    return best_year


def write_year(filepath, year):
    try:
        try:
            tags = ID3(filepath)
        except ID3NoHeaderError:
            tags = ID3()
        tags.add(TDRC(encoding=3, text=str(year)))
        tags.save(filepath, v2_version=3)
        return True
    except Exception as e:
        print(f'  Write error: {e}', file=sys.stderr)
        return False


def load_targets():
    targets = []
    with open(INPUT_FILE) as f:
        for line in f:
            line = line.rstrip()
            if 'missing: year' not in line:
                continue
            m = re.match(r'^(.+\.mp3)\s+missing:\s+(.+)$', line)
            if not m:
                continue
            filepath = m.group(1).strip()
            if not os.path.exists(filepath):
                continue
            # Skip if any directory in path starts with a year — already fixable by path
            parts = filepath.split(os.sep)
            if any(re.match(r'^\d{4}\b', p) for p in parts):
                continue
            targets.append(filepath)
    return targets


def main():
    api_key = os.environ.get('ACOUSTID_KEY', '').strip()
    if not api_key:
        print('Set ACOUSTID_KEY env var. Get a free key at https://acoustid.org/api-key',
              file=sys.stderr)
        sys.exit(1)

    targets = load_targets()
    print(f'{len(targets)} files to fingerprint', file=sys.stderr)

    fixed = 0
    not_found = 0

    for i, filepath in enumerate(targets):
        rel = os.path.relpath(filepath, os.path.join(os.path.dirname(__file__), '..'))
        print(f'[{i+1}/{len(targets)}] {rel}', file=sys.stderr)

        duration, fp = fingerprint(filepath)
        if not fp:
            print('  fpcalc failed', file=sys.stderr)
            not_found += 1
            continue

        data = acoustid_lookup(api_key, duration, fp)
        year = extract_year(data)

        if year:
            ok = write_year(filepath, year)
            print(f'  → year {year} {"written" if ok else "WRITE FAILED"}', file=sys.stderr)
            if ok:
                fixed += 1
        else:
            print('  → not found in AcoustID', file=sys.stderr)
            not_found += 1

        time.sleep(RATE_LIMIT)

    print(f'\nDone: {fixed} fixed, {not_found} not found', file=sys.stderr)


if __name__ == '__main__':
    main()
