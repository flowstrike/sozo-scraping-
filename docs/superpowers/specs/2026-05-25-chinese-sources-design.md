# Chinese Manga Sources — Design Spec

## Overview

Add 5 Chinese manga/manhua scrapers to the Sozo Read source repo. Each scraper follows the existing provider contract (regex-based HTML parsing, no DOM, ES5-ish CommonJS). A test runner validates and cross-checks all sources.

## Sources

| # | File | Source ID | Site | URL | Notes |
|---|------|-----------|------|-----|-------|
| 1 | `baozimh.js` | `baozimh` | 包子漫画 | `www.baozimh.com` | Server-rendered AMP/Nuxt. Clean `comics-card` markup. No anti-bot. |
| 2 | `manhuagui.js` | `manhuagui` | 漫画柜 | `www.manhuagui.com` | Server-rendered HTML. `chapter-list > ul > li > a` for chapters. |
| 3 | `manhuaren.js` | `manhuaren` | 漫画人 | `www.manhuaren.com` | Server-rendered HTML. `book-list` search results. Light fingerprint script only. |
| 4 | `mangabz.js` | `mangabz` | MangaBZ | `mangabz.com` | Server-rendered HTML. Cloudflare analytics-only (no challenge). |
| 5 | `kuaikan.js` | `kuaikan` | 快看漫画 | `www.kuaikanmanhua.com` | Nuxt SSR for browse/detail/reader. Search returns empty (no public API found). |

Language code: `zh` for all sources.

## Per-Source Architecture

Each file follows the identical pattern as `mangafreak.js` and `ehentai.js`:

```js
var SOURCE_ID = '<id>';
var SITE = 'https://<domain>';

function getInfo() { ... }
function search(query, page, opts) { ... }
function getDetail(url) { ... }
function getChapters(url) { ... }
function getPages(chapterUrl) { ... }
function getChapterContent(chapterUrl) { ... }
```

### Source-Specific Details

#### baozimh.js
- Search: `GET /search?q={query}` — results in `comics-card` divs with `href="/comic/{slug}"`
- Browse (empty query): homepage `comics-card` divs
- Detail: `GET /comic/{slug}` — title in `h1.comics-detail__title`, author in `h2.comics-detail__author`, cover in `amp-img[src]`, chapters in `a.comics-chapters__item`
- Pages: `GET /user/page_direct?comic_id={slug}&section_slot={s}&chapter_slot={c}` — images as `amp-img[src]`
- Cover CDN: `static-tw.baozimh.com/cover/{slug}.jpg`

#### manhuagui.js
- Search: `GET /s/{query}.html` — results in `div.book-result > ul > li` with title in `dl > dt > a[title]`, cover in `img[src]`
- Detail: `GET /comic/{id}/` — title in `div.book-title > h1`, chapters in `div.chapter-list > ul > li > a[href][title]`
- Pages: `GET /comic/{id}/{chapterId}.html` — images loaded via JS; need to investigate if regex can extract initial image URLs or if there's an inline data structure

#### manhuaren.js
- Search: `GET /search?title={query}` — results in `ul.book-list > li` with title in `.book-list-info-title`, cover in `.book-list-cover-img`
- Detail: `GET /manhua-{slug}/` — title in `.detail-main-info-title`, chapters in `ul.detail-list-1 > li > a.chapteritem`
- Pages: `GET /m{id}/` — images served from `mhfm{N}us.cdndm5.com`; may require Referer header

#### mangabz.js
- Search: `GET /search?title={query}&page={n}` — results in `ul.mh-list > li` with title in `h2.title a`
- Detail: `GET /{id}bz/` — title in `.detail-info-title`, chapters in `#chapterlistload a.detail-list-form-item`
- Pages: `GET /m{id}/` — images likely loaded via JS variables (`MANGABZ_COMIC_MID` etc.); need investigation

#### kuaikan.js
- Search: Returns empty array (no public search API). Browse by fetching homepage.
- Detail: `GET /web/topic/{topicId}` — title in `h3.title`, author in `.nickname`, cover in `.TopicHeader img`, first chapter in `a.firstBtn[data-href]`
- Pages: `GET /web/comic/{comicId}` — images in `div.imgList > div.img-box > img[src]`. Image URLs are signed (`sign` + `t` params).
- Chapter list: Extracted from detail page or discovered sequentially via `/webs/comic-next/{comicId}`

## index.json Updates

Add 5 entries to the `sources` array, all with `"lang": "zh"`.

## Test Runner (`test.js`)

A Node.js script that validates all sources end-to-end:

1. **Smoke test**: Call `getInfo()` on each source, verify required fields
2. **Search test**: Call `search('斗破苍穹', 1)` (or site-appropriate query), verify results array with valid `id`, `title`, `url`, `cover`, `sourceId`
3. **Detail test**: Take first search result URL, call `getDetail()`, verify `title`, `cover`, `url`, `chapters` array non-empty
4. **Pages test**: Take first chapter URL from detail, call `getPages()`, verify image URLs returned
5. **Cross-check**: Search result URLs produce valid details; detail chapter URLs produce valid pages
6. **Report**: Print per-source pass/fail with a summary table

The test runner uses the actual `fetch` API (Node 18+) and a minimal `htmlText` polyfill (decode HTML entities + collapse whitespace). No jsdom needed — scrapers use regex only.

## Implementation Order

1. `baozimh.js` — simplest, cleanest HTML, good first target
2. `manhuaren.js` — similar simplicity, different structure
3. `mangabz.js` — clean but need to investigate page image extraction
4. `manhuagui.js` — need to investigate chapter reader image loading
5. `kuaikan.js` — most complex (SSR + signed images + no search)
6. `test.js` — validates all sources
7. Update `index.json` with all 5 entries
