# Plan: Fix album-header-info scrolling issue

## Context
When an album has long text in `album-header-info` (e.g., long album title, artist, or year), the header scrolls internally instead of pushing the track-list down. This creates a confusing UX where users must scroll within the header to see all info.

## Problem
File: `assets/uqt.css`

```css
.album-header {
  max-height: 350px;
  overflow-y: auto;
  /* ... */
}
```

The `max-height: 350px` and `overflow-y: auto` on `.album-header` causes:
1. Header to scroll internally when content exceeds 350px
2. Track-list position stays fixed regardless of header size

## Solution
Make `.album-header` grow naturally to fit its content, pushing the track-list down.

### CSS Change

File: `assets/uqt.css`

Remove from `.album-header`:
- `max-height: 350px;`
- `overflow-y: auto;`

The `.track-list` already has `flex: 1` (line 477), so it will automatically fill remaining space.

### Implementation

```css
.album-header {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;
  flex-shrink: 0;
  /* removed: overflow-y: auto; */
  /* removed: max-height: 350px; */
}
```

## Verification
1. Open an album with very long title/artist (e.g., "1977 - Various Artists - 100 Hits Para Ouvir e Dançar O Dia Inteiro - Vol. 3")
2. Confirm the header info displays fully without scrolling
3. Confirm track-list starts below the header and is scrollable independently
4. Test on mobile to ensure layout still works