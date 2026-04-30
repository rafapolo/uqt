#!/usr/bin/env python3
"""
For albums in unzips/ whose folder has no year, search MusicBrainz by
release title (+ artist when available) to find the release year, then
write it to all MP3s in that folder.

No API key needed — uses MusicBrainz public search.
"""

import os
import re
import sys
import json
import time
import urllib.request
import urllib.parse

from mutagen.id3 import ID3, ID3NoHeaderError, TDRC

INPUT_FILE = '/tmp/untagged-final.txt'
MB_SEARCH  = 'https://musicbrainz.org/ws/2/release/?query={q}&fmt=json&limit=5'
RATE_LIMIT = 1.1  # MusicBrainz allows 1 req/s for unauthenticated


def mb_search(title, artist=None):
    q = f'release:"{title}"'
    if artist and artist.lower() not in ('unknown', 'various artists'):
        q += f' artist:"{artist}"'
    url = MB_SEARCH.format(q=urllib.parse.quote(q))
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'uqt-tagger/1.0 (rafael.polo@gmail.com)'}
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        releases = data.get('releases', [])
        best_score = 0
        best_year  = 0
        for rel in releases:
            score = int(rel.get('score', 0))
            date  = rel.get('date', '') or ''
            m = re.match(r'^(\d{4})', date)
            if m and score > best_score:
                best_score = score
                best_year  = int(m.group(1))
        return best_year, best_score
    except Exception as e:
        print(f'  MB search error: {e}', file=sys.stderr)
        return 0, 0


def write_year_to_file(filepath, year):
    try:
        try:
            tags = ID3(filepath)
        except ID3NoHeaderError:
            tags = ID3()
        tags.add(TDRC(encoding=3, text=str(year)))
        tags.save(filepath, v2_version=3)
        return True
    except Exception as e:
        print(f'  Write error for {os.path.basename(filepath)}: {e}', file=sys.stderr)
        return False


def parse_folder_title_artist(folder_name):
    """Return (title, artist) from 'Artist - Album' or just 'Album' folder names."""
    parts = re.split(r' [–\-] ', folder_name, maxsplit=1)
    if len(parts) == 2:
        return parts[1].strip(), parts[0].strip()
    return folder_name.strip(), None


def load_albums():
    """Group untagged year-missing files by album folder (no year in any path part)."""
    albums = {}
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
            # Skip if any directory part starts with 4 digits (path-fixable)
            if any(re.match(r'^\d{4}\b', p) for p in parts):
                continue
            folder = os.path.dirname(filepath)
            folder_name = os.path.basename(folder)
            if folder_name not in albums:
                albums[folder_name] = {'folder': folder, 'files': []}
            albums[folder_name]['files'].append(filepath)
    return albums


def main():
    albums = load_albums()
    print(f'{len(albums)} albums to search', file=sys.stderr)

    total_fixed = 0
    not_found   = []

    for i, (folder_name, info) in enumerate(albums.items()):
        title, artist = parse_folder_title_artist(folder_name)
        print(f'\n[{i+1}/{len(albums)}] {folder_name}', file=sys.stderr)
        print(f'  Searching: title="{title}" artist="{artist}"', file=sys.stderr)

        year, score = mb_search(title, artist)
        time.sleep(RATE_LIMIT)

        if year and score >= 50:
            print(f'  → year {year} (score {score}) — writing to {len(info["files"])} files',
                  file=sys.stderr)
            ok = sum(1 for f in info['files'] if write_year_to_file(f, year))
            total_fixed += ok
        else:
            print(f'  → not found (best score {score})', file=sys.stderr)
            not_found.append(folder_name)

    print(f'\nDone: {total_fixed} files fixed', file=sys.stderr)
    if not_found:
        print(f'Not found ({len(not_found)}):', file=sys.stderr)
        for n in not_found:
            print(f'  {n}', file=sys.stderr)


if __name__ == '__main__':
    main()
