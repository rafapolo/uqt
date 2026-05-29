#!/usr/bin/env python3
"""
Extract embedded ID3 APIC art from MP3s → capa-min.jpg (400×400) per album folder.
Usage: python3 script/extract-covers.py [--force]
"""
import os, sys, glob
from mutagen.id3 import ID3, ID3NoHeaderError
from PIL import Image
import io

UNZIPS = os.path.join(os.path.dirname(__file__), '..', 'unzips')
FORCE  = '--force' in sys.argv
SIZE   = 400

def best_mp3(album_dir):
    mp3s = sorted(glob.glob(os.path.join(album_dir, '*.mp3')))
    return mp3s[0] if mp3s else None

def extract_apic(mp3_path):
    try:
        tags = ID3(mp3_path)
        frames = tags.getall('APIC')
        if not frames:
            return None
        # prefer front cover (type 3) if multiple
        front = next((f for f in frames if f.type == 3), frames[0])
        return front.data
    except (ID3NoHeaderError, Exception):
        return None

done = skipped = failed = no_art = 0
albums = sorted(os.listdir(UNZIPS))

for album in albums:
    album_dir = os.path.join(UNZIPS, album)
    if not os.path.isdir(album_dir):
        continue

    out = os.path.join(album_dir, 'capa-min.jpg')
    if os.path.exists(out) and not FORCE:
        skipped += 1
        continue

    # prefer existing capa.jpg, fall back to embedded ID3 art
    capa_path = os.path.join(album_dir, 'capa.jpg')
    if os.path.exists(capa_path):
        try:
            img = Image.open(capa_path).convert('RGB')
        except Exception:
            no_art += 1
            continue
    else:
        mp3 = best_mp3(album_dir)
        if not mp3:
            no_art += 1
            continue
        data = extract_apic(mp3)
        if not data:
            no_art += 1
            continue
        try:
            img = Image.open(io.BytesIO(data)).convert('RGB')
        except Exception:
            no_art += 1
            continue

    try:
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
        img.save(out, 'JPEG', quality=85, optimize=True)
        done += 1
        if done % 200 == 0:
            print(f'  {done} extracted...')
    except Exception as e:
        failed += 1

print(f'done={done} skipped={skipped} no_art={no_art} failed={failed}')
