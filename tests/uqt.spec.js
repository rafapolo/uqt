const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const fixturePath = path.join(__dirname, 'fixtures', 'albums.json.gz');
const fixtureGz = fs.readFileSync(fixturePath);

async function gotoWithFixture(page, url = '/') {
  // Clear persisted player state so shuffle/repeat start at defaults
  await page.addInitScript(() => {
    localStorage.removeItem('uqt-shuffle');
    localStorage.removeItem('uqt-repeat');
    localStorage.removeItem('uqt-volume');
  });
  await page.route('**/uqt-albums.json.gz', route => {
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/gzip', 'Content-Encoding': 'identity' },
      body: fixtureGz,
    });
  });
  // Block audio and image network requests to keep tests fast
  await page.route('**/*.mp3', route => route.fulfill({ status: 200, body: Buffer.alloc(0) }));
  await page.route('**/capa-min.jpg', route => route.fulfill({ status: 404 }));
  await page.goto(url);
  // Wait for albums grid to be populated
  await page.waitForSelector('.album-item', { timeout: 8000 });
}

// ── A. Initial Load & URL State ───────────────────────────────────────────

test('A1: albums render in grid after gzip fetch and decompress', async ({ page }) => {
  await gotoWithFixture(page);
  const items = page.locator('.album-item');
  // fixture has 10 albums
  await expect(items).toHaveCount(10);
});

test('A2: ?album= pre-selects album and shows track list', async ({ page }) => {
  await gotoWithFixture(page, '/?album=1971+-+Chico+Buarque+-+Constru%C3%A7%C3%A3o');
  await expect(page.locator('#track-list .track-item')).toHaveCount(3);
  await expect(page.locator('#album-header h2')).toContainText('Construção');
});

test('A3: ?q= pre-fills search and filters grid', async ({ page }) => {
  await gotoWithFixture(page, '/?q=Elis');
  await expect(page.locator('#search-input')).toHaveValue('Elis');
  const count = await page.locator('.album-item').count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThan(10);
});

test('A4: ?t= pre-selects a specific track and primes audio.src', async ({ page }) => {
  await gotoWithFixture(page, '/?album=1971+-+Chico+Buarque+-+Constru%C3%A7%C3%A3o&t=2');
  const audioSrc = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  expect(audioSrc).toContain('Deus');
});

test('A5: ?play=1 with album and track triggers audio load', async ({ page }) => {
  await gotoWithFixture(page, '/?album=1971+-+Chico+Buarque+-+Constru%C3%A7%C3%A3o&t=1&play=1');
  const audioSrc = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  expect(audioSrc).toContain('Constru');
});

test('A6: ?ano= filters to that exact year only', async ({ page }) => {
  await gotoWithFixture(page, '/?ano=1972');
  const count = await page.locator('.album-item').count();
  expect(count).toBe(1);
  await expect(page.locator('.album-item').first()).toContainText('Clube da Esquina');
});

// ── B. Search & Filtering ─────────────────────────────────────────────────

test('B7: search by album title (case-insensitive)', async ({ page }) => {
  await gotoWithFixture(page);
  await page.fill('#search-input', 'construção');
  await expect(page.locator('.album-item')).toHaveCount(1);
  await expect(page.locator('.album-item').first()).toContainText('Construção');
});

test('B8: search by artist name', async ({ page }) => {
  await gotoWithFixture(page);
  await page.fill('#search-input', 'Caetano');
  const count = await page.locator('.album-item').count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('B9: search matches track titles within albums', async ({ page }) => {
  await gotoWithFixture(page);
  await page.fill('#search-input', 'Águas de Março');
  await expect(page.locator('.album-item')).toHaveCount(1);
  await expect(page.locator('.album-item').first()).toContainText('Elis');
});

test('B10: clearing search (✕ button) resets to full list', async ({ page }) => {
  await gotoWithFixture(page);
  await page.fill('#search-input', 'Caetano');
  await expect(page.locator('.album-item')).not.toHaveCount(10);
  await page.click('#search-clear');
  await expect(page.locator('.album-item')).toHaveCount(10);
  await expect(page.locator('#search-input')).toHaveValue('');
});

test('B11: decade button filters to correct decade and clears search', async ({ page }) => {
  await gotoWithFixture(page);
  await page.fill('#search-input', 'Elis');
  await page.click('.decade-btn[data-decade="1970"]');
  await expect(page.locator('#search-input')).toHaveValue('');
  const count = await page.locator('.album-item').count();
  // 1971 Construção, 1972 Clube, 1974 Elis & Tom, 1976 Falso Brilhante
  expect(count).toBe(4);
});

test('B12: <1940 button shows albums with year < 1950', async ({ page }) => {
  await gotoWithFixture(page);
  await page.click('.decade-btn[data-decade="pre1940"]');
  await expect(page.locator('.album-item')).toHaveCount(1);
  await expect(page.locator('.album-item').first()).toContainText('Pixinguinha');
});

test('B13: ∞ button shows albums with no year', async ({ page }) => {
  await gotoWithFixture(page);
  await page.click('.decade-btn[data-decade="noyear"]');
  await expect(page.locator('.album-item')).toHaveCount(1);
  await expect(page.locator('.album-item').first()).toContainText('Sem Data');
});

// ── C. Album Selection & Track Priming ───────────────────────────────────

test('C14: clicking album card sets .active class on that card', async ({ page }) => {
  await gotoWithFixture(page);
  const items = page.locator('.album-item');
  const second = items.nth(1);
  await second.click();
  await expect(second).toHaveClass(/active/);
});

test('C15: clicking album renders correct track list', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  const tracks = page.locator('#track-list .track-item');
  await expect(tracks).toHaveCount(3);
  await expect(tracks.nth(0)).toContainText('Construção');
  await expect(tracks.nth(1)).toContainText('Deus lhe Pague');
});

test('C16: clicking album shows album header with name, artist, year', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Elis & Tom' }).click();
  await expect(page.locator('#album-header h2')).toContainText('Elis & Tom');
  await expect(page.locator('#album-header')).toContainText('1974');
  await expect(page.locator('#album-header')).toContainText('Elis Regina');
});

test('C17: clicking album primes audio.src but does NOT auto-play', async ({ page }) => {
  await gotoWithFixture(page);
  const items = page.locator('.album-item');
  await items.nth(3).click();
  const isPaused = await page.evaluate(() => {
    const audio = document.querySelector('#audio');
    return audio ? audio.paused : true;
  });
  expect(isPaused).toBe(true);
});

test('C18: clicking same album twice does not re-render track list', async ({ page }) => {
  await gotoWithFixture(page);
  const item = page.locator('.album-item', { hasText: 'Clube da Esquina' });
  await item.click();
  await page.evaluate(() => {
    const el = document.querySelector('#track-list .track-item');
    if (el) el.dataset.renderMarker = 'first-render';
  });
  await item.click();
  const marker = await page.evaluate(() =>
    document.querySelector('#track-list .track-item')?.dataset.renderMarker
  );
  expect(marker).toBe('first-render');
});

// ── D. Playback Controls ──────────────────────────────────────────────────

test('D19: clicking a track item sets audio.src and marks track as playing in list', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  await page.locator('#track-list .track-item').nth(1).click();
  // audio.src is set to the new track
  const audioSrc = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  expect(audioSrc).toContain('Deus');
  // The clicked track-item gets .playing class (synchronously set in renderTrackList)
  await expect(page.locator('#track-list .track-item').nth(1)).toHaveClass(/playing/);
  // Player title is updated synchronously in updateNowPlaying()
  await expect(page.locator('#player-title')).toContainText('Deus lhe Pague');
});

test('D20: play button toggles pause/resume', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  await page.locator('#track-list .track-item').first().click();
  await expect(page.locator('#btn-play')).toHaveClass(/playing/);
  await page.click('#btn-play');
  await expect(page.locator('#btn-play')).not.toHaveClass(/playing/);
  await page.click('#btn-play');
  await expect(page.locator('#btn-play')).toHaveClass(/playing/);
});

test('D21: next button advances to next track in same album', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  await page.locator('#track-list .track-item').first().click();
  const src1 = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  await page.click('#btn-next');
  const src2 = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  expect(src2).not.toBe(src1);
  expect(src2).toContain('Deus');
});

test('D22: prev button goes to previous track', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  await page.locator('#track-list .track-item').nth(1).click();
  const src1 = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  await page.click('#btn-prev');
  const src2 = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  expect(src2).not.toBe(src1);
  expect(src2).toContain('Constru');
});

test('D23: last track + next does nothing without repeat', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Getz' }).click();
  await page.locator('#track-list .track-item').nth(1).click();
  const src1 = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  const repeatMode = await page.evaluate(() => window.repeatMode ?? 'off');
  expect(repeatMode).toBe('off');
  await page.click('#btn-next');
  const src2 = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
  expect(src2).toBe(src1);
});

// ── E. Shuffle & Repeat ───────────────────────────────────────────────────

test('E24: shuffle button toggles .active class on #btn-shuffle', async ({ page }) => {
  await gotoWithFixture(page);
  // Default: shuffle off — button has no .active class
  await expect(page.locator('#btn-shuffle')).not.toHaveClass(/active/);
  await page.click('#btn-shuffle');
  await expect(page.locator('#btn-shuffle')).toHaveClass(/active/);
  await page.click('#btn-shuffle');
  await expect(page.locator('#btn-shuffle')).not.toHaveClass(/active/);
});

test('E25: with shuffle on, playNext picks varied tracks', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  await page.locator('#track-list .track-item').first().click();
  await page.click('#btn-shuffle');
  const srcs = new Set();
  for (let i = 0; i < 10; i++) {
    await page.click('#btn-next');
    const src = await page.evaluate(() => document.querySelector('#audio')?.src ?? '');
    srcs.add(src);
  }
  expect(srcs.size).toBeGreaterThan(1);
});

test('E26: repeat-one sets audio.loop; repeat-all activates button without loop', async ({ page }) => {
  await gotoWithFixture(page);
  // Default: repeat off — button inactive
  await expect(page.locator('#btn-repeat')).not.toHaveClass(/active/);
  const loopOff = await page.evaluate(() => document.querySelector('#audio')?.loop);
  expect(loopOff).toBe(false);
  // First click: repeat-one — audio.loop true, button active, title = 'Repetir faixa'
  await page.click('#btn-repeat');
  const loopOne = await page.evaluate(() => document.querySelector('#audio')?.loop);
  expect(loopOne).toBe(true);
  await expect(page.locator('#btn-repeat')).toHaveClass(/active/);
  await expect(page.locator('#btn-repeat')).toHaveAttribute('title', 'Repetir faixa');
  // Second click: repeat-all — audio.loop false, button still active, title = 'Repetir álbum'
  await page.click('#btn-repeat');
  const loopAll = await page.evaluate(() => document.querySelector('#audio')?.loop);
  expect(loopAll).toBe(false);
  await expect(page.locator('#btn-repeat')).toHaveClass(/active/);
  await expect(page.locator('#btn-repeat')).toHaveAttribute('title', 'Repetir álbum');
});

// ── F. URL Updates ────────────────────────────────────────────────────────

test('F27: selecting album updates URL ?album= param', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Clube da Esquina' }).click();
  await expect(page).toHaveURL(/album=/);
  const url = new URL(page.url());
  expect(url.searchParams.get('album')).toContain('Clube');
});

test('F28: playing a track updates URL ?t= param', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  await page.locator('#track-list .track-item').nth(1).click();
  await expect(page).toHaveURL(/t=2/);
});

test('F29: browser back navigates to previous album selection', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Construção' }).click();
  await page.locator('.album-item', { hasText: 'Clube da Esquina' }).click();
  await page.goBack();
  const url = new URL(page.url());
  expect(url.searchParams.get('album')).toContain('Constru');
});

// ── G. Artist Link Clicks ─────────────────────────────────────────────────

test('G30: clicking artist name in album header filters by that artist', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Elis & Tom' }).click();
  await page.locator('#album-header .artist-link').filter({ hasText: 'Elis Regina' }).first().click();
  await expect(page.locator('#search-input')).toHaveValue('Elis Regina');
  const count = await page.locator('.album-item').count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThan(10);
});

test('G31: clicking track-level artist in track list filters by that artist', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Getz' }).click();
  await page.locator('#track-list .track-artist .artist-link').first().click();
  await expect(page.locator('#search-input')).not.toHaveValue('');
});

// ── H. VirtualGrid Edge Cases ─────────────────────────────────────────────

test('H32: narrow viewport (320px) renders grid without JS errors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await gotoWithFixture(page);
  await expect(page.locator('.album-item').first()).toBeVisible();
  const relevantErrors = errors.filter(e => !e.includes('favicon') && !e.includes('umami'));
  expect(relevantErrors).toHaveLength(0);
});

test('H33: DOM node count stays bounded while scrolling', async ({ page }) => {
  await gotoWithFixture(page);
  const countBefore = await page.locator('.album-item').count();
  await page.locator('#albums-list').evaluate(el => el.scrollTop = 1000);
  await page.waitForTimeout(100);
  const countMid = await page.locator('.album-item').count();
  expect(countMid).toBeLessThanOrEqual(20);
  expect(countBefore).toBeGreaterThan(0);
});

test('H34: filtering to zero results shows empty-state element', async ({ page }) => {
  await gotoWithFixture(page);
  await page.fill('#search-input', 'XXXXXXXXXNOTAREAL');
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('.album-item')).toHaveCount(0);
});

// ── I. Mobile Drawer ──────────────────────────────────────────────────────

test('I35: on mobile viewport, clicking album opens mobile drawer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoWithFixture(page);
  const items = page.locator('.album-item');
  await items.nth(1).click();
  await expect(page.locator('#mobile-track-drawer')).toHaveClass(/open/);
});

test('I36: mobile drawer close button hides the drawer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoWithFixture(page);
  await page.locator('.album-item').nth(1).click();
  await expect(page.locator('#mobile-track-drawer')).toHaveClass(/open/);
  // Try various possible close button selectors
  const closeBtn = page.locator('.drawer-close, [id*="drawer-close"], #mobile-track-drawer button').first();
  await closeBtn.click();
  await expect(page.locator('#mobile-track-drawer')).not.toHaveClass(/open/);
});

// ── J. Bonus Edge Cases ───────────────────────────────────────────────────

test('J37: album with no cover shows placeholder on album header', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Acervo Raro' }).click();
  const coverImg = page.locator('#album-header .album-cover-large');
  await expect(coverImg).toHaveClass(/placeholder/);
});

test('J38: track-level artist shown when it differs from album artist', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Songbook' }).click();
  const trackArtists = page.locator('#track-list .track-artist');
  await expect(trackArtists.first()).toBeVisible();
});

test('J39: search-count pill shows filtered count when searching', async ({ page }) => {
  await gotoWithFixture(page);
  await page.fill('#search-input', 'Elis');
  await expect(page.locator('#search-count')).toHaveClass(/visible/);
  const text = await page.locator('#search-count').textContent();
  expect(text).toMatch(/álbun/);
});

test('J40: Todos button resets decade filter and shows all albums', async ({ page }) => {
  await gotoWithFixture(page);
  await page.click('.decade-btn[data-decade="1970"]');
  const filtered = await page.locator('.album-item').count();
  expect(filtered).toBeLessThan(10);
  await page.click('.decade-btn[data-decade="all"]');
  await expect(page.locator('.album-item')).toHaveCount(10);
});

test('J41: year link in album header filters by that year', async ({ page }) => {
  await gotoWithFixture(page);
  await page.locator('.album-item', { hasText: 'Elis & Tom' }).click();
  await page.locator('#album-header .year-link').click();
  const count = await page.locator('.album-item').count();
  expect(count).toBe(1);
});

test('J42: header stats show album and artist counts', async ({ page }) => {
  await gotoWithFixture(page);
  await expect(page.locator('#mobile-stat-albums')).not.toBeEmpty();
  await expect(page.locator('#mobile-stat-artists')).not.toBeEmpty();
});
