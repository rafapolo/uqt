#!/usr/bin/env python3
"""
Use AudD audio recognition to identify MP3s that still have no year tag
after MusicBrainz search, and write the year from the recognized release.

Usage:
    AUDD_KEY=yourtoken python3 script/fix-tags-audd.py

Get a free key (500 recognitions/month) at: https://dashboard.audd.io/
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

INPUT_FILE = '/tmp/untagged-final.txt'
AUDD_URL   = 'https://api.audd.io/'
RATE_LIMIT = 1.0  # conservative

# Only process albums with no year anywhere in path
SKIP_ALBUMS = set()  # can list folder names to skip


def fingerprint_segment(filepath, offset=0, duration=15):
    """Extract a PCM segment via ffmpeg and encode as base64 for AudD."""
    try:
        result = subprocess.run([
            'ffmpeg', '-ss', str(offset), '-t', str(duration),
            '-i', filepath,
            '-f', 's16le', '-ar', '44100', '-ac', '1', '-',
        ], capture_output=True, timeout=30)
        return result.stdout
    except Exception as e:
        print(f'  ffmpeg error: {e}', file=sys.stderr)
        return None


def audd_recognize(api_key, audio_bytes):
    """POST raw audio bytes to AudD, return parsed JSON response."""
    boundary = b'----AudDBoundary'
    body = (
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="api_token"\r\n\r\n' +
        api_key.encode() + b'\r\n'
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="return"\r\n\r\nspotify,apple_music,musicbrainz\r\n'
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="audio"; filename="clip.pcm"\r\n'
        b'Content-Type: application/octet-stream\r\n\r\n' +
        audio_bytes + b'\r\n'
        b'--' + boundary + b'--\r\n'
    )
    req = urllib.request.Request(
        AUDD_URL,
        data=body,
        headers={
            'Content-Type': f'multipart/form-data; boundary={boundary.decode()}',
            'User-Agent': 'uqt-tagger/1.0',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f'  AudD request error: {e}', file=sys.stderr)
        return None


def extract_year(response):
    if not response or response.get('status') != 'success':
        return 0, None
    result = response.get('result')
    if not result:
        return 0, None
    title  = result.get('title', '')
    artist = result.get('artist', '')
    # Try release_date from top-level result
    release_date = result.get('release_date', '') or ''
    m = re.match(r'^(\d{4})', release_date)
    if m:
        return int(m.group(1)), f'{artist} – {title}'
    # Try Apple Music
    am = result.get('apple_music') or {}
    release_date = am.get('releaseDate', '') or ''
    m = re.match(r'^(\d{4})', release_date)
    if m:
        return int(m.group(1)), f'{artist} – {title}'
    return 0, f'{artist} – {title} (no date)'


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
            m = re.match(r'^(.+\.mp3)\s+missing:', line)
            if not m:
                continue
            filepath = m.group(1).strip()
            if not os.path.exists(filepath):
                continue
            parts = filepath.split(os.sep)
            if any(re.match(r'^\d{4}\b', p) for p in parts):
                continue
            folder_name = os.path.basename(os.path.dirname(filepath))
            if folder_name in SKIP_ALBUMS:
                continue
            targets.append(filepath)
    return targets


def main():
    api_key = os.environ.get('AUDD_KEY', '').strip()
    if not api_key:
        print('Set AUDD_KEY env var. Free key (500/month): https://dashboard.audd.io/',
              file=sys.stderr)
        sys.exit(1)

    targets = load_targets()
    print(f'{len(targets)} files to recognize', file=sys.stderr)

    fixed = 0
    not_found = 0

    for i, filepath in enumerate(targets):
        rel = os.path.relpath(filepath, os.path.join(os.path.dirname(__file__), '..'))
        print(f'[{i+1}/{len(targets)}] {os.path.basename(filepath)}', file=sys.stderr)

        # Sample from 30s in to skip intros
        audio = fingerprint_segment(filepath, offset=30, duration=15)
        if not audio:
            not_found += 1
            continue

        response = audd_recognize(api_key, audio)
        year, match_info = extract_year(response)

        if year:
            ok = write_year(filepath, year)
            print(f'  → {match_info} ({year}) {"written" if ok else "WRITE FAILED"}',
                  file=sys.stderr)
            if ok:
                fixed += 1
        else:
            recognized = match_info or 'not recognized'
            print(f'  → {recognized}', file=sys.stderr)
            not_found += 1

        time.sleep(RATE_LIMIT)

    print(f'\nDone: {fixed} fixed, {not_found} not found/recognized', file=sys.stderr)


if __name__ == '__main__':
    main()
