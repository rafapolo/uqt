#!/usr/bin/env python3
"""
Fetch missing album covers from Discogs (primary) and iTunes (fallback).
Downloads capa.jpg + capa-min.jpg (200px wide) locally and uploads to S3.

Usage:
    python3 script/fetch-covers.py [--dry-run]
    DISCOGS_TOKEN=yourtoken python3 script/fetch-covers.py
"""

import os
import re
import sys
import json
import time
import urllib.request
import urllib.parse
import io

from PIL import Image
import boto3

DRY_RUN = '--dry-run' in sys.argv

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
REPO_DIR    = os.path.join(SCRIPT_DIR, '..')
UNZIPS_DIR  = os.path.join(REPO_DIR, 'unzips')
ALBUMS_JS   = os.path.join(REPO_DIR, 'js', 'uqt-albums.js')
ENV_FILE    = os.path.join(REPO_DIR, '.env')

DISCOGS_SEARCH = 'https://api.discogs.com/database/search'
ITUNES_SEARCH  = 'https://itunes.apple.com/search'
USER_AGENT     = 'uqt-cover-fetcher/1.0 +https://github.com/rafapolo/uqt'
RATE_LIMIT     = 1.2  # seconds between Discogs requests


def load_env():
    if not os.path.exists(ENV_FILE):
        return
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            m = re.match(r'^([A-Z_]+)=["\']?([^"\']*)["\']?$', line)
            if m:
                os.environ.setdefault(m.group(1), m.group(2))


def load_albums():
    with open(ALBUMS_JS, 'r', encoding='utf-8') as f:
        src = f.read()
    db = {}
    exec(src.replace('db =', 'db.update('), {'db': db})  # noqa: S102
    # fallback: simple eval
    try:
        ns = {}
        exec('db = ' + src[src.index('{'):], ns)  # noqa: S102
        return ns['db']['albums']
    except Exception:
        pass
    import ast
    return json.loads(src[src.index('{'):])['albums']


def load_albums_safe():
    with open(ALBUMS_JS, 'r', encoding='utf-8') as f:
        src = f.read()
    # file is: db = {...}
    json_str = src[src.index('{'):]
    return json.loads(json_str)['albums']


def http_get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        **(headers or {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(), r.geturl()
    except Exception as e:
        return None, str(e)


def search_discogs(artist, title, token=None, with_country=True):
    q = f'{artist} {title}' if artist and artist.lower() not in ('various artists', 'unknown') else title
    params = {'q': q, 'type': 'release', 'per_page': '5'}
    if with_country:
        params['country'] = 'Brazil'
    url = f'{DISCOGS_SEARCH}?{urllib.parse.urlencode(params)}'
    hdrs = {}
    if token:
        hdrs['Authorization'] = f'Discogs token={token}'
    data, _ = http_get(url, hdrs)
    if not data:
        return None
    try:
        resp = json.loads(data)
    except Exception:
        return None
    results = resp.get('results', [])
    for r in results:
        score = int(r.get('community', {}).get('want', 0)) or 0
        img = r.get('cover_image', '')
        if img and 'spacer' not in img and not img.endswith('no_cover.gif'):
            return img
    return None


def search_itunes(artist, title):
    term = f'{artist} {title}' if artist and artist.lower() not in ('various artists', 'unknown') else title
    params = {'term': term, 'entity': 'album', 'limit': '5', 'country': 'BR'}
    url = f'{ITUNES_SEARCH}?{urllib.parse.urlencode(params)}'
    data, _ = http_get(url)
    if not data:
        return None
    try:
        resp = json.loads(data)
    except Exception:
        return None
    for r in resp.get('results', []):
        art = r.get('artworkUrl100', '')
        if art:
            return art.replace('100x100bb', '600x600bb')
    return None


def download_image(url):
    data, final_url = http_get(url, timeout=30)
    if not data:
        return None
    try:
        img = Image.open(io.BytesIO(data)).convert('RGB')
        return img
    except Exception:
        return None


def resize_to_min(img):
    w, h = img.size
    new_h = int(h * 200 / w)
    return img.resize((200, new_h), Image.LANCZOS)


def save_images(img, folder_path):
    os.makedirs(folder_path, exist_ok=True)
    orig_path = os.path.join(folder_path, 'capa.jpg')
    mini_path = os.path.join(folder_path, 'capa-min.jpg')
    img.save(orig_path, 'JPEG', quality=92)
    resize_to_min(img).save(mini_path, 'JPEG', quality=80)
    return orig_path, mini_path


def upload_to_s3(s3_client, bucket, album_path, orig_path, mini_path):
    for local, key_suffix in [(orig_path, 'capa.jpg'), (mini_path, 'capa-min.jpg')]:
        with open(local, 'rb') as f:
            data = f.read()
        s3_client.put_object(
            Bucket=bucket,
            Key=f'uqt/{album_path}/{key_suffix}',
            Body=data,
            ContentType='image/jpeg',
        )


def make_s3_client():
    return boto3.client(
        's3',
        endpoint_url=os.environ['S3_ENDPOINT'],
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        region_name='hel1',
    )


def main():
    load_env()
    token = os.environ.get('DISCOGS_TOKEN', '').strip() or None

    albums = load_albums_safe()
    targets = [
        a for a in albums
        if not a.get('has_cover')
        and not os.path.exists(os.path.join(UNZIPS_DIR, a['path'], 'capa.jpg'))
    ]

    print(f'{len(targets)} albums without covers', file=sys.stderr)
    if DRY_RUN:
        print('[DRY RUN — no files will be written]', file=sys.stderr)

    s3 = None if DRY_RUN else make_s3_client()
    bucket = os.environ.get('S3_BUCKET', 'sambaraiz')

    covered = 0
    not_found = 0

    for i, album in enumerate(targets):
        path   = album['path']
        artist = album.get('artist', '')
        title  = album.get('title', path)
        print(f'[{i+1}/{len(targets)}] {path}', file=sys.stderr)

        # --- Discogs (with Brazil filter first, then without) ---
        img_url = search_discogs(artist, title, token, with_country=True)
        time.sleep(RATE_LIMIT)
        if not img_url:
            img_url = search_discogs(artist, title, token, with_country=False)
            time.sleep(RATE_LIMIT)

        source = 'discogs'

        # --- iTunes fallback ---
        if not img_url:
            img_url = search_itunes(artist, title)
            source = 'itunes'

        if not img_url:
            print(f'  → not found', file=sys.stderr)
            not_found += 1
            continue

        print(f'  → {source}: {img_url[:80]}', file=sys.stderr)

        if DRY_RUN:
            covered += 1
            continue

        img = download_image(img_url)
        if not img:
            print(f'  → download failed', file=sys.stderr)
            not_found += 1
            continue

        folder = os.path.join(UNZIPS_DIR, path)
        orig_path, mini_path = save_images(img, folder)

        try:
            upload_to_s3(s3, bucket, path, orig_path, mini_path)
            print(f'  → uploaded ({img.size[0]}x{img.size[1]})', file=sys.stderr)
            covered += 1
        except Exception as e:
            print(f'  → S3 upload failed: {e}', file=sys.stderr)
            not_found += 1

    print(f'\nDone: {covered} covered, {not_found} not found/failed', file=sys.stderr)


if __name__ == '__main__':
    main()
