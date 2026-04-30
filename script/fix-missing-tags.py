#!/usr/bin/env python3
"""
Read /tmp/untagged.txt (output of find-untagged.js) and fill in missing ID3 tags
by parsing the folder name (YYYY - Artist - Album) and filename (NN Title.mp3).
Only writes tags that are reported as missing — never overwrites existing ones.
"""

import sys
import re
import os
from mutagen.id3 import ID3, ID3NoHeaderError, TIT2, TPE1, TALB, TDRC, TRCK, ID3

INPUT_FILE = '/tmp/untagged.txt'


def parse_folder(folder_name):
    """Parse 'YYYY - Artist - Album Title' → (year, artist, album)."""
    # Handle both ' - ' and ' – ' (en dash) separators
    parts = re.split(r' [–-] ', folder_name, maxsplit=2)
    year_str = parts[0].strip()
    year = int(year_str) if re.fullmatch(r'\d{4}', year_str) else 0

    if len(parts) == 1:
        return year, 'Unknown', folder_name
    if len(parts) == 2:
        # YYYY - Album (compilation, no explicit artist)
        return year, 'Various Artists', parts[1].strip()
    # YYYY - Artist - Album
    return year, parts[1].strip(), parts[2].strip()


def parse_filename(filename):
    """Parse 'NN Track Title.mp3' or 'N. Track Title.mp3' → (tracknum, title)."""
    name = re.sub(r'\.mp3$', '', filename, flags=re.IGNORECASE).strip()
    # Match leading number optionally followed by dot or dash
    m = re.match(r'^(\d+)[.\s\-]+(.+)$', name)
    if m:
        return int(m.group(1)), m.group(2).strip()
    return 0, name


def fix_file(filepath, missing_tags):
    folder_name = os.path.basename(os.path.dirname(filepath))
    filename    = os.path.basename(filepath)

    year, artist, album = parse_folder(folder_name)
    tracknum, title     = parse_filename(filename)

    try:
        try:
            tags = ID3(filepath)
        except ID3NoHeaderError:
            tags = ID3()

        changed = False
        if 'title'  in missing_tags and title:
            tags.add(TIT2(encoding=3, text=title))
            changed = True
        if 'artist' in missing_tags and artist:
            tags.add(TPE1(encoding=3, text=artist))
            changed = True
        if 'album'  in missing_tags and album:
            tags.add(TALB(encoding=3, text=album))
            changed = True
        if 'year'   in missing_tags and year:
            tags.add(TDRC(encoding=3, text=str(year)))
            changed = True
        if 'track'  in missing_tags and tracknum:
            tags.add(TRCK(encoding=3, text=str(tracknum)))
            changed = True

        if changed:
            tags.save(filepath, v2_version=3)
            return True
        return False

    except Exception as e:
        print(f'ERROR {filepath}: {e}', file=sys.stderr)
        return False


def main():
    if not os.path.exists(INPUT_FILE):
        print(f'Input file not found: {INPUT_FILE}', file=sys.stderr)
        sys.exit(1)

    fixed = 0
    skipped = 0
    errors = 0

    with open(INPUT_FILE) as f:
        lines = [l.rstrip('\n') for l in f if l.strip()]

    total = len(lines)
    for i, line in enumerate(lines):
        # Format: /path/to/file.mp3  missing: tag1, tag2
        m = re.match(r'^(.+\.mp3)\s+missing:\s+(.+)$', line)
        if not m:
            skipped += 1
            continue

        filepath = m.group(1).strip()
        missing  = [t.strip() for t in m.group(2).split(',')]

        # Skip ffprobe errors
        if '(ffprobe error)' in missing or '(parse error)' in missing:
            skipped += 1
            continue

        if not os.path.exists(filepath):
            skipped += 1
            continue

        ok = fix_file(filepath, missing)
        if ok:
            fixed += 1
        else:
            errors += 1

        if (i + 1) % 200 == 0:
            print(f'  {i+1}/{total} processed, {fixed} fixed so far', file=sys.stderr)

    print(f'\nDone: {fixed} fixed, {skipped} skipped, {errors} errors out of {total} files',
          file=sys.stderr)
    print(fixed)


if __name__ == '__main__':
    main()
