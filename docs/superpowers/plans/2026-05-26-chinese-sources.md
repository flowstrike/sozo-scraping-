# Chinese Manga Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 Chinese manga scrapers (baozimh, kuaikan, manhuaren, mangabz, manhuagui) plus a test runner to the Sozo Read source repo.

**Architecture:** Each scraper is a self-contained CommonJS `.js` file exposing 5 global functions (`getInfo`, `search`, `getDetail`, `getChapters`, `getPages`) using regex-based HTML parsing. Sites with obfuscated chapter images use a Dean Edwards unpacker utility. A `test.js` runner loads each scraper via Node.js `vm` module with polyfills for `fetch` and `htmlText`, then validates search/detail/pages end-to-end.

**Tech Stack:** Node.js 18+ (native `fetch`), `vm` module for sandboxed loading, regex for HTML parsing, Dean Edwards unpacker for obfuscated JS, LZ-String decompressor for manhuagui.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `baozimh.js` | 包子漫画 scraper — simple AMP HTML, direct `amp-img[src]` extraction |
| `kuaikan.js` | 快看漫画 scraper — JSON API for detail/pages, homepage browse only |
| `manhuaren.js` | 漫画人 scraper — HTML search/detail, Dean Edwards packed JS for pages |
| `mangabz.js` | MangaBZ scraper — HTML search/detail, packed JS API for pages |
| `manhuagui.js` | 漫画柜 scraper — HTML search/detail, LZ-String + packed JS for pages |
| `test.js` | Test runner — loads all scrapers, validates search→detail→pages pipeline |
| `index.json` | Updated manifest with 5 new `zh` entries |

---

### Task 1: Create baozimh.js

**Files:**
- Create: `baozimh.js`

**Site structure (from probe):**
- Search: `GET /search?q={query}` — results in `comics-card` divs
- Browse (empty query): homepage cards
- Detail: `GET /comic/{slug}` — title in `h1.comics-detail__title`, author in `h2.comics-detail__author`, chapters in `a.comics-chapters__item[href]`
- Pages: `GET /user/page_direct?comic_id=...&section_slot=...&chapter_slot=...` — images as `amp-img[src]`
- Cover CDN: `https://static-tw.baozimh.com/cover/{slug}.jpg`
- No anti-bot, fully server-rendered AMP HTML

- [ ] **Step 1: Create baozimh.js**

```js
var SOURCE_ID = 'baozimh';
var SITE = 'https://www.baozimh.com';

function getInfo() {
  return {
    name: '包子漫画',
    lang: 'zh',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/\s+/g, ' ').trim();
}

function search(query, page, opts) {
  var q = (query || '').trim();
  if (!q) return _browseHomepage();
  var url = SITE + '/search?q=' + encodeURIComponent(q);
  console.log('baozimh search: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    return _parseCards(r.body || '');
  });
}

function _browseHomepage() {
  console.log('baozimh browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    return _parseCards(r.body || '');
  });
}

function _parseCards(html) {
  var results = [];
  var seen = {};
  var re = /href="\/comic\/([^"]+)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?src="(https:\/\/static-tw\.baozimh\.com\/cover\/[^"]+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var slug = m[1];
    if (seen[slug]) continue;
    seen[slug] = true;
    var title = _clean(m[2]) || slug.replace(/-/g, ' ');
    results.push({
      id: slug,
      title: title,
      url: SITE + '/comic/' + slug,
      cover: m[3],
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  if (results.length === 0) {
    var re2 = /href="\/comic\/([^"]+)"[\s\S]*?title="([^"]*)"[\s\S]*?src="(https:\/\/static-tw\.baozimh\.com\/cover\/[^"]+)"/g;
    while ((m = re2.exec(html)) !== null) {
      var slug2 = m[1];
      if (seen[slug2]) continue;
      seen[slug2] = true;
      results.push({
        id: slug2,
        title: _clean(m[2]) || slug2.replace(/-/g, ' '),
        url: SITE + '/comic/' + slug2,
        cover: m[3],
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
  }
  console.log('baozimh results: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('baozimh detail: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/comic\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var titleM = html.match(/class="comics-detail__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var authorM = html.match(/class="comics-detail__author[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
    var author = authorM ? _clean(authorM[1]) : '';

    var coverM = html.match(/src="(https:\/\/static-tw\.baozimh\.com\/cover\/[^"]+\.jpg[^"]*)"/);
    var cover = coverM ? coverM[1] : '';

    var descM = html.match(/class="comics-detail__desc[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    if (/連載中|连载中/.test(html)) status = 'ongoing';
    else if (/已完結|已完结/.test(html)) status = 'completed';

    var genres = [];
    var gRe = /class="tag[^"]*">([^<]+)<\/span>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /class="comics-chapters__item[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chUrl = cm[1];
      var chInner = cm[2];
      var chTitleM = chInner.match(/<span[^>]*>([\s\S]*?)<\/span>/);
      var chTitle = chTitleM ? _clean(chTitleM[1]) : '';
      if (!chTitle) chTitle = 'Ch. ' + (chapters.length + 1);
      var numM = chTitle.match(/(\d+(?:\.\d+)?)/);
      chapters.push({
        id: chUrl.indexOf('http') === 0 ? chUrl : SITE + chUrl,
        title: chTitle,
        number: numM ? parseFloat(numM[1]) : chapters.length + 1,
        url: chUrl.indexOf('http') === 0 ? chUrl : SITE + chUrl,
        date: ''
      });
    }

    console.log('baozimh detail: ' + title + ' chapters=' + chapters.length);
    return {
      id: slug,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: author,
      authors: author ? [author] : [],
      status: status,
      description: description,
      genres: genres,
      type: 'manga',
      chapters: chapters
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function(d) { return d.chapters || []; });
}

function getPages(chapterUrl) {
  console.log('baozimh pages: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var pages = [];
    var re = /<amp-img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"[^>]*>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      pages.push({ url: m[1], index: pages.length });
    }
    if (pages.length === 0) {
      var re2 = /<img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"[^>]*>/g;
      while ((m = re2.exec(html)) !== null) {
        pages.push({ url: m[1], index: pages.length });
      }
    }
    console.log('baozimh pages: ' + pages.length);
    return pages;
  });
}

function getChapterContent(chapterUrl) {
  return { text: '包子漫画 is a manga-only source.', nextUrl: null };
}
```

- [ ] **Step 2: Commit baozimh.js**

```bash
git add baozimh.js
git commit -m "Add baozimh (包子漫画) scraper"
```

---

### Task 2: Create kuaikan.js

**Files:**
- Create: `kuaikan.js`

**Site structure (from probe):**
- Search: No public API — `search()` returns empty, browse via homepage
- Detail: JSON API `GET /v2/pweb/topic/{topicId}` — returns `data.topic_info` with title, author, comics[] chapters
- Pages: JSON API `GET /v2/pweb/comic/{comicId}` — returns `data.comic_info.comic_images[]` with signed URLs
- Homepage: SSR HTML with topic links in `a[href^="/web/topic/"]`
- Fully API-based for detail and pages — no HTML parsing needed for those functions

- [ ] **Step 1: Create kuaikan.js**

```js
var SOURCE_ID = 'kuaikan';
var SITE = 'https://www.kuaikanmanhua.com';

function getInfo() {
  return {
    name: '快看漫画',
    lang: 'zh',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/\s+/g, ' ').trim();
}

function search(query, page, opts) {
  var q = (query || '').trim();
  if (!q) return _browseHomepage();
  console.log('kuaikan: no public search API, browsing homepage');
  return _browseHomepage();
}

function _browseHomepage() {
  console.log('kuaikan browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var seen = {};
    var re = /href="\/web\/topic\/(\d+)"[^>]*>([\s\S]*?)<img[^>]+src="(https:\/\/[^"]+)"/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      var id = m[1];
      if (seen[id]) continue;
      seen[id] = true;
      var titleM = m[2].match(/class="itemTitle[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      var title = titleM ? _clean(titleM[1]) : ('Topic ' + id);
      results.push({
        id: id,
        title: title,
        url: SITE + '/web/topic/' + id,
        cover: m[3],
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('kuaikan browse results: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('kuaikan detail: ' + url);
  var topicIdM = url.match(/\/web\/topic\/(\d+)/);
  var topicId = topicIdM ? topicIdM[1] : '';
  if (!topicId) return Promise.reject(new Error('Invalid topic URL'));

  var apiUrl = SITE + '/v2/pweb/topic/' + topicId;
  return fetch(apiUrl).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var json;
    try { json = JSON.parse(r.body); } catch(e) { throw new Error('JSON parse error'); }
    var info = json.data && json.data.topic_info;
    if (!info) throw new Error('No topic info');

    var title = info.title || '';
    var author = info.author && info.author.name ? info.author.name : '';
    var cover = info.cover_image_url || '';
    var description = info.description || '';

    var status = 'unknown';
    if (info.is_finish === true || info.is_finish === 1) status = 'completed';
    else status = 'ongoing';

    var genres = [];
    if (info.tag && info.tag.name) genres.push(info.tag.name);

    var chapters = [];
    var comics = info.comics || [];
    for (var i = comics.length - 1; i >= 0; i--) {
      var c = comics[i];
      if (c.locked) continue;
      chapters.push({
        id: '' + c.id,
        title: c.title || ('Ch. ' + (i + 1)),
        number: i + 1,
        url: SITE + '/web/comic/' + c.id,
        date: c.created_at || ''
      });
    }
    chapters.reverse();

    console.log('kuaikan detail: ' + title + ' chapters=' + chapters.length);
    return {
      id: topicId,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: author,
      authors: author ? [author] : [],
      status: status,
      description: description,
      genres: genres,
      type: 'manga',
      chapters: chapters
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function(d) { return d.chapters || []; });
}

function getPages(chapterUrl) {
  console.log('kuaikan pages: ' + chapterUrl);
  var comicIdM = chapterUrl.match(/\/web\/comic\/(\d+)/);
  var comicId = comicIdM ? comicIdM[1] : '';
  if (!comicId) return Promise.resolve([]);

  var apiUrl = SITE + '/v2/pweb/comic/' + comicId;
  return fetch(apiUrl).then(function(r) {
    if (r.status !== 200) return [];
    var json;
    try { json = JSON.parse(r.body); } catch(e) { return []; }
    var images = json.data && json.data.comic_info && json.data.comic_info.comic_images;
    if (!images) return [];

    var pages = [];
    for (var i = 0; i < images.length; i++) {
      var imgUrl = images[i].url1280 || images[i].url || '';
      if (imgUrl) {
        pages.push({ url: imgUrl, index: i });
      }
    }
    console.log('kuaikan pages: ' + pages.length);
    return pages;
  });
}

function getChapterContent(chapterUrl) {
  return { text: '快看漫画 is a manga-only source.', nextUrl: null };
}
```

- [ ] **Step 2: Commit kuaikan.js**

```bash
git add kuaikan.js
git commit -m "Add kuaikan (快看漫画) scraper"
```

---

### Task 3: Create manhuaren.js

**Files:**
- Create: `manhuaren.js`

**Site structure (from probe):**
- Search: `GET /search?title={query}` — results in `ul.book-list > li` with `.book-list-info-title`, `.book-list-cover-img`
- Detail: `GET /manhua-{slug}/` — title in `.detail-main-info-title`, chapters in `ul.detail-list-1 > li > a.chapteritem`
- Pages: Chapter reader at `/m{cid}/` — images in Dean Edwards packed `eval()` block, decodes to `var newImgs = [...]`
- Images require `Referer: https://www.manhuaren.com/` header
- CDN: `{cdn_subdomain}.cdndm5.com`

- [ ] **Step 1: Create manhuaren.js**

```js
var SOURCE_ID = 'manhuaren';
var SITE = 'https://www.manhuaren.com';

function getInfo() {
  return {
    name: '漫画人',
    lang: 'zh',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/\s+/g, ' ').trim();
}

function _baseConv(n, base) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  var r = '';
  do {
    r = chars.charAt(n % base) + r;
    n = Math.floor(n / base);
  } while (n > 0);
  return r;
}

function _unpackPacked(packedStr) {
  var m = packedStr.match(/\('([^']*)',(\d+),(\d+),'([^']*)'/);
  if (!m) return '';
  var p = m[1];
  var a = parseInt(m[2], 10);
  var c = parseInt(m[3], 10);
  var k = m[4].split('|');
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + _baseConv(c, a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

function search(query, page, opts) {
  var q = (query || '').trim();
  if (!q) return _browseHomepage();
  var url = SITE + '/search?title=' + encodeURIComponent(q);
  console.log('manhuaren search: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    return _parseSearchResults(r.body || '');
  });
}

function _browseHomepage() {
  console.log('manhuaren browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    return _parseSearchResults(r.body || '');
  });
}

function _parseSearchResults(html) {
  var results = [];
  var seen = {};
  var re = /class="book-list-cover"[^>]*>[\s\S]*?href="([^"]+)"[\s\S]*?src="([^"]*)"[\s\S]*?class="book-list-info-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var href = m[1];
    var slugM = href.match(/\/manhua-([^\/]+)/);
    var slug = slugM ? slugM[1] : href;
    if (seen[slug]) continue;
    seen[slug] = true;
    var title = _clean(m[3]) || slug.replace(/-/g, ' ');
    results.push({
      id: slug,
      title: title,
      url: SITE + href,
      cover: m[2],
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  console.log('manhuaren results: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('manhuaren detail: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/manhua-([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var titleM = html.match(/class="detail-main-info-title[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var coverM = html.match(/class="detail-main-info[^"]*"[^>]*>[\s\S]*?src="([^"]+)"/);
    var cover = coverM ? coverM[1] : '';

    var authorM = html.match(/class="detail-main-info-author[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    var authors = [];
    if (authorM) {
      var aRe = /<a[^>]*>([^<]+)<\/a>/g;
      var am;
      while ((am = aRe.exec(authorM[1])) !== null) {
        var a = _clean(am[1]);
        if (a) authors.push(a);
      }
    }

    var descM = html.match(/class="detail-desc[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    if (/连载中|連載中/.test(html)) status = 'ongoing';
    else if (/已完结|已完結/.test(html)) status = 'completed';

    var genres = [];
    var gRe = /class="detail-main-info-class[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /<a[^>]*class="[^"]*chapteritem[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chHref = cm[1];
      var chTitle = _clean(cm[2]);
      if (!chTitle) chTitle = 'Ch. ' + (chapters.length + 1);
      var chIdM = chHref.match(/\/m(\d+)/);
      chapters.push({
        id: chIdM ? chIdM[1] : chHref,
        title: chTitle,
        number: chapters.length + 1,
        url: chHref.indexOf('http') === 0 ? chHref : SITE + chHref,
        date: ''
      });
    }

    console.log('manhuaren detail: ' + title + ' chapters=' + chapters.length);
    return {
      id: slug,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: authors.join(', '),
      authors: authors,
      status: status,
      description: description,
      genres: genres,
      type: 'manga',
      chapters: chapters
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function(d) { return d.chapters || []; });
}

function getPages(chapterUrl) {
  console.log('manhuaren pages: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';

    var pages = [];
    var imgRe = /var\s+newImgs\s*=\s*\[([\s\S]*?)\];/;
    var imgM = html.match(imgRe);
    if (imgM) {
      var urlRe = /'([^']+)'/g;
      var um;
      while ((um = urlRe.exec(imgM[1])) !== null) {
        pages.push({ url: um[1], index: pages.length, headers: { Referer: SITE + '/' } });
      }
    }

    if (pages.length === 0) {
      var unpacked = _unpackPacked(html);
      var unpackedImgM = unpacked.match(/var\s+newImgs\s*=\s*\[([\s\S]*?)\];/);
      if (unpackedImgM) {
        var urlRe2 = /'([^']+)'/g;
        var um2;
        while ((um2 = urlRe2.exec(unpackedImgM[1])) !== null) {
          pages.push({ url: um2[1], index: pages.length, headers: { Referer: SITE + '/' } });
        }
      }
    }

    if (pages.length === 0) {
      var cdnRe = /https?:\/\/[a-z0-9]+\.cdndm5\.com\/[^'"\s]+\.(?:jpg|jpeg|png|webp)[^'"\s]*/g;
      var cm2;
      while ((cm2 = cdnRe.exec(html)) !== null) {
        pages.push({ url: cm2[0], index: pages.length, headers: { Referer: SITE + '/' } });
      }
    }

    console.log('manhuaren pages: ' + pages.length);
    return pages;
  });
}

function getChapterContent(chapterUrl) {
  return { text: '漫画人 is a manga-only source.', nextUrl: null };
}
```

- [ ] **Step 2: Commit manhuaren.js**

```bash
git add manhuaren.js
git commit -m "Add manhuaren (漫画人) scraper"
```

---

### Task 4: Create mangabz.js

**Files:**
- Create: `mangabz.js`

**Site structure (from probe):**
- Search: `GET /search?title={query}&page={n}` — results in `ul.mh-list > li` with `.mh-cover`, `h2.title a`
- Detail: `GET /{id}bz/` — title in `.detail-info-title`, chapters in `#chapterlistload a.detail-list-form-item`
- Pages: Chapter page `/m{cid}/` contains JS vars (`MANGABZ_CID`, `MANGABZ_MID`, `MANGABZ_VIEWSIGN`, `MANGABZ_VIEWSIGN_DT`, `MANGABZ_IMAGE_COUNT`). Image URLs from API `GET /chapterimage.ashx?cid={cid}&page={n}&key=&_cid={cid}&_mid={mid}&_dt={dt}&_sign={sign}` which returns Dean Edwards packed JS decoding to a URL array. Each call returns 2 images.
- Images require `Referer` header containing `mangabz.com`

- [ ] **Step 1: Create mangabz.js**

```js
var SOURCE_ID = 'mangabz';
var SITE = 'https://mangabz.com';

function getInfo() {
  return {
    name: 'MangaBZ',
    lang: 'zh',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/\s+/g, ' ').trim();
}

function _baseConv(n, base) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  var r = '';
  do {
    r = chars.charAt(n % base) + r;
    n = Math.floor(n / base);
  } while (n > 0);
  return r;
}

function _unpackPacked(packedStr) {
  var m = packedStr.match(/\('([^']*)',(\d+),(\d+),'([^']*)'/);
  if (!m) return '';
  var p = m[1];
  var a = parseInt(m[2], 10);
  var c = parseInt(m[3], 10);
  var k = m[4].split('|');
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + _baseConv(c, a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

function search(query, page, opts) {
  var q = (query || '').trim();
  var p = page || 1;
  if (!q) return _browseHomepage();
  var url = SITE + '/search?title=' + encodeURIComponent(q) + '&page=' + p;
  console.log('mangabz search: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    return _parseSearchResults(r.body || '');
  });
}

function _browseHomepage() {
  console.log('mangabz browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var seen = {};
    var re = /href="\/(\d+bz\/)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?class="[^"]*title[^"]*"[^>]*>([^<]+)/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      var slug = m[1];
      if (seen[slug]) continue;
      seen[slug] = true;
      results.push({
        id: slug,
        title: _clean(m[3]) || slug,
        url: SITE + '/' + slug,
        cover: m[2],
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('mangabz browse results: ' + results.length);
    return results;
  });
}

function _parseSearchResults(html) {
  var results = [];
  var seen = {};
  var re = /class="mh-item[\s\S]*?href="([^"]+)"[\s\S]*?src="([^"]*)"[\s\S]*?class="title[^"]*"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var href = m[1];
    var slugM = href.match(/\/(\d+bz\/)/);
    var slug = slugM ? slugM[1] : href;
    if (seen[slug]) continue;
    seen[slug] = true;
    results.push({
      id: slug,
      title: _clean(m[3]) || slug,
      url: href.indexOf('http') === 0 ? href : SITE + href,
      cover: m[2],
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  console.log('mangabz search results: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('mangabz detail: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/(\d+bz\/?)/);
    var slug = slugM ? slugM[1] : '';

    var titleM = html.match(/class="detail-info-title[^"]*"[^>]*>([\s\S]*?)<\//);
    var title = titleM ? _clean(titleM[1]) : slug;

    var coverM = html.match(/class="detail-info-cover[^"]*"[^>]*src="([^"]+)"/);
    var cover = coverM ? coverM[1] : '';

    var authorM = html.match(/class="detail-info-tip[\s\S]*?<span[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    var author = authorM ? _clean(authorM[1]) : '';

    var descM = html.match(/class="detail-info-content[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    if (/连载中|連載中|ongoing/i.test(html)) status = 'ongoing';
    else if (/已完结|已完結|completed/i.test(html)) status = 'completed';

    var genres = [];
    var gRe = /class="detail-info-tip[\s\S]*?<span class="item"[^>]*><a[^>]*>([^<]+)<\/a>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /<a[^>]*class="[^"]*detail-list-form-item[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chHref = cm[1];
      var chTitle = _clean(cm[2]);
      if (!chTitle) chTitle = 'Ch. ' + (chapters.length + 1);
      var numM = chTitle.match(/(\d+(?:\.\d+)?)/);
      chapters.push({
        id: chHref.replace(/[\/m]/g, ''),
        title: chTitle,
        number: numM ? parseFloat(numM[1]) : chapters.length + 1,
        url: chHref.indexOf('http') === 0 ? chHref : SITE + chHref,
        date: ''
      });
    }

    console.log('mangabz detail: ' + title + ' chapters=' + chapters.length);
    return {
      id: slug,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: author,
      authors: author ? [author] : [],
      status: status,
      description: description,
      genres: genres,
      type: 'manga',
      chapters: chapters
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function(d) { return d.chapters || []; });
}

function _extractJsVar(html, varName) {
  var re = new RegExp('var\\s+' + varName + '\\s*=\\s*["\']?([^"\'\\s;]+)');
  var m = html.match(re);
  return m ? m[1] : '';
}

function getPages(chapterUrl) {
  console.log('mangabz pages: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';

    var cid = _extractJsVar(html, 'MANGABZ_CID');
    var mid = _extractJsVar(html, 'MANGABZ_MID');
    var sign = _extractJsVar(html, 'MANGABZ_VIEWSIGN');
    var dt = _extractJsVar(html, 'MANGABZ_VIEWSIGN_DT');
    var imageCount = parseInt(_extractJsVar(html, 'MANGABZ_IMAGE_COUNT'), 10) || 0;

    if (!cid || !mid || !sign || !dt) {
      console.log('mangabz pages: missing JS vars');
      return [];
    }

    var pages = [];
    var seen = {};

    function fetchPage(pageNum) {
      var apiUrl = SITE + '/chapterimage.ashx?cid=' + cid + '&page=' + pageNum + '&key=&_cid=' + cid + '&_mid=' + mid + '&_dt=' + encodeURIComponent(dt) + '&_sign=' + sign;
      return fetch(apiUrl).then(function(ar) {
        if (ar.status !== 200) return;
        var body = ar.body || '';
        var unpacked = _unpackPacked(body);
        var urlRe = /https?:\/\/image\.mangabz\.com\/[^'"\s]+/g;
        var um;
        while ((um = urlRe.exec(unpacked)) !== null) {
          if (!seen[um[0]]) {
            seen[um[0]] = true;
            pages.push({ url: um[0], index: pages.length, headers: { Referer: SITE + '/' } });
          }
        }
      }).catch(function() {});
    }

    var promises = [];
    for (var i = 1; i <= imageCount; i++) {
      promises.push(fetchPage(i));
    }

    return Promise.all(promises).then(function() {
      pages.sort(function(a, b) { return a.index - b.index; });
      console.log('mangabz pages: ' + pages.length);
      return pages;
    });
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MangaBZ is a manga-only source.', nextUrl: null };
}
```

- [ ] **Step 2: Commit mangabz.js**

```bash
git add mangabz.js
git commit -m "Add mangabz scraper"
```

---

### Task 5: Create manhuagui.js

**Files:**
- Create: `manhuagui.js`

**Site structure (from probe):**
- Search: `GET /s/{query}.html` — results in `div.book-result > ul > li`
- Detail: `GET /comic/{id}/` — title in `div.book-title > h1`, chapters in `div.chapter-list > ul > li > a`
- Pages: Chapter page `/comic/{bid}/{cid}.html` — inline packed JS with LZ-String compressed keywords. Unpacking reveals `SMH.imgData({bid, cid, files[], path, sl{e,m}}).preInit()`. Image URLs: `https://eu.hamreus.com{path}{filename}?e={sl.e}&m={sl.m}`
- CDN hosts: `eu.hamreus.com`, `us.hamreus.com`
- Images require `Referer: https://www.manhuagui.com/`

- [ ] **Step 1: Create manhuagui.js**

```js
var SOURCE_ID = 'manhuagui';
var SITE = 'https://www.manhuagui.com';
var CDN_HOST = 'https://eu.hamreus.com';

function getInfo() {
  return {
    name: '漫画柜',
    lang: 'zh',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/\s+/g, ' ').trim();
}

function _baseConv(n, base) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  var r = '';
  do {
    r = chars.charAt(n % base) + r;
    n = Math.floor(n / base);
  } while (n > 0);
  return r;
}

function _unpackPacked(packedStr) {
  var m = packedStr.match(/\('([^']*)',(\d+),(\d+),'([^']*)'/);
  if (!m) return '';
  var p = m[1];
  var a = parseInt(m[2], 10);
  var c = parseInt(m[3], 10);
  var k = m[4].split('|');
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + _baseConv(c, a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

function _lzDecompress(input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var revIdx = {};
  for (var i = 0; i < keyStr.length; i++) revIdx[keyStr.charAt(i)] = i;
  var pos = 0, buf = 0, bufLen = 0;
  function read(n) {
    var r = 0, b = 0;
    while (b < n) {
      if (bufLen === 0) {
        if (pos >= input.length) return -1;
        buf = revIdx[input.charAt(pos++)] || 0;
        bufLen = 6;
      }
      r |= (buf & 1) << b;
      buf >>= 1;
      bufLen--;
      b++;
    }
    return r;
  }
  var numBits = 8;
  var c = read(numBits);
  if (c < 0) return '';
  var w = String.fromCharCode(c);
  var result = w;
  var dict = {};
  var size = 256;
  var enlargeCounter = Math.pow(2, numBits);
  while (true) {
    c = read(numBits);
    if (c < 0) break;
    var entry;
    if (c === 0) {
      c = read(8);
      if (c < 0) break;
      entry = String.fromCharCode(c);
    } else if (c === 1) {
      c = read(16);
      if (c < 0) break;
      entry = String.fromCharCode(c);
    } else if (c === 2) {
      break;
    } else {
      entry = dict[c];
      if (!entry) break;
    }
    result += entry;
    dict[size++] = w + entry.charAt(0);
    w = entry;
    if (--enlargeCounter === 0) {
      numBits++;
      enlargeCounter = Math.pow(2, numBits);
    }
  }
  return result;
}

function _unpackPackedLz(packedStr) {
  var m = packedStr.match(/\('([^']*)',(\d+),(\d+),'([^']*)'/);
  if (!m) return '';
  var p = m[1];
  var a = parseInt(m[2], 10);
  var c = parseInt(m[3], 10);
  var compressed = m[4];
  var k = _lzDecompress(compressed).split('|');
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + _baseConv(c, a) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

function search(query, page, opts) {
  var q = (query || '').trim();
  var p = page || 1;
  if (!q) return _browseHomepage();
  var url = SITE + '/s/' + encodeURIComponent(q) + '.html' + (p > 1 ? '?page=' + p : '');
  console.log('manhuagui search: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    return _parseSearchResults(r.body || '');
  });
}

function _browseHomepage() {
  console.log('manhuagui browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    return _parseHomepageCards(r.body || '');
  });
}

function _parseSearchResults(html) {
  var results = [];
  var seen = {};
  var re = /class="book-result[\s\S]*?<a[^>]+href="\/comic\/(\d+)\/"[^>]*title="([^"]*)"[^>]*>[\s\S]*?src="([^"]+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var id = m[1];
    if (seen[id]) continue;
    seen[id] = true;
    results.push({
      id: id,
      title: _clean(m[2]) || ('Comic ' + id),
      url: SITE + '/comic/' + id + '/',
      cover: m[3],
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  console.log('manhuagui search results: ' + results.length);
  return results;
}

function _parseHomepageCards(html) {
  var results = [];
  var seen = {};
  var re = /href="\/comic\/(\d+)\/"[^>]*>[\s\S]*?src="([^"]+)"[\s\S]*?title="([^"]*)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var id = m[1];
    if (seen[id]) continue;
    seen[id] = true;
    results.push({
      id: id,
      title: _clean(m[3]) || ('Comic ' + id),
      url: SITE + '/comic/' + id + '/',
      cover: m[2],
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  console.log('manhuagui browse results: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('manhuagui detail: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var html = r.body || '';

    var idM = url.match(/\/comic\/(\d+)/);
    var id = idM ? idM[1] : '';

    var titleM = html.match(/class="book-title[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/);
    var title = titleM ? _clean(titleM[1]) : ('Comic ' + id);

    var coverM = html.match(/class="book-cover[\s\S]*?<img[^>]+src="([^"]+)"/);
    var cover = coverM ? coverM[1] : '';

    var authorM = html.match(/class="detail-list[^>]*>[\s\S]*?作者[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    var author = authorM ? _clean(authorM[1]) : '';

    var descM = html.match(/class="intro[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    if (/连载中/.test(html)) status = 'ongoing';
    else if (/已完结/.test(html)) status = 'completed';

    var genres = [];
    var gRe = /class="detail-list[^>]*>[\s\S]*?类型[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /class="chapter-list[\s\S]*?<a[^>]*href="(\/comic\/\d+\/\d+\.html)"[^>]*title="([^"]*)"/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chTitle = _clean(cm[2]);
      var numM = chTitle.match(/(\d+(?:\.\d+)?)/);
      chapters.push({
        id: cm[1],
        title: chTitle || ('Ch. ' + (chapters.length + 1)),
        number: numM ? parseFloat(numM[1]) : chapters.length + 1,
        url: SITE + cm[1],
        date: ''
      });
    }

    console.log('manhuagui detail: ' + title + ' chapters=' + chapters.length);
    return {
      id: id,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: author,
      authors: author ? [author] : [],
      status: status,
      description: description,
      genres: genres,
      type: 'manga',
      chapters: chapters
    };
  });
}

function getChapters(url) {
  return getDetail(url).then(function(d) { return d.chapters || []; });
}

function getPages(chapterUrl) {
  console.log('manhuagui pages: ' + chapterUrl);
  return fetch(chapterUrl, { headers: { Referer: SITE + '/' } }).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';

    var unpacked = '';
    var packedLzRe = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('[^']*',\d+,\d+,'[^']*'\)\)/;
    var packedLzM = html.match(packedLzRe);
    if (packedLzM) {
      unpacked = _unpackPackedLz(packedLzM[0]);
    }

    if (!unpacked) {
      var packedRe = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('[^']*',\d+,\d+,'[^']*'\)\)/;
      var packedM = html.match(packedRe);
      if (packedM) {
        unpacked = _unpackPacked(packedM[0]);
      }
    }

    if (!unpacked) {
      console.log('manhuagui pages: could not unpack');
      return [];
    }

    var files = [];
    var filesM = unpacked.match(/files:\s*\[([\s\S]*?)\]/);
    if (filesM) {
      var fRe = /"([^"]+)"/g;
      var fm;
      while ((fm = fRe.exec(filesM[1])) !== null) {
        files.push(fm[1]);
      }
    }

    var path = '';
    var pathM = unpacked.match(/path:\s*"([^"]+)"/);
    if (pathM) path = pathM[1];

    var slE = '', slM = '';
    var slM1 = unpacked.match(/sl:\s*\{[^}]*e:\s*(\d+)/);
    if (slM1) slE = slM1[1];
    var slM2 = unpacked.match(/sl:\s*\{[^}]*m:\s*"([^"]+)"/);
    if (slM2) slM = slM2[1];

    var pages = [];
    for (var i = 0; i < files.length; i++) {
      var imgUrl = CDN_HOST + path + files[i] + '?e=' + slE + '&m=' + slM;
      pages.push({
        url: imgUrl,
        index: i,
        headers: { Referer: SITE + '/' }
      });
    }

    console.log('manhuagui pages: ' + pages.length);
    return pages;
  });
}

function getChapterContent(chapterUrl) {
  return { text: '漫画柜 is a manga-only source.', nextUrl: null };
}
```

- [ ] **Step 2: Commit manhuagui.js**

```bash
git add manhuagui.js
git commit -m "Add manhuagui (漫画柜) scraper"
```

---

### Task 6: Create test.js

**Files:**
- Create: `test.js`

**Purpose:** Loads each scraper via Node.js `vm` module with `fetch` and `htmlText` polyfills. Validates the search → detail → pages pipeline for every source. Cross-checks that URLs from one stage resolve in the next.

- [ ] **Step 1: Create test.js**

```js
var vm = require('vm');
var fs = require('fs');
var path = require('path');

function htmlTextPolyfill(s) {
  return (s || '')
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'");
}

function nodeFetch(url, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  return fetch(url, { headers: headers }).then(function(r) {
    return r.text().then(function(body) {
      return {
        status: r.status,
        body: body,
        headers: Object.fromEntries(r.headers.entries())
      };
    });
  });
}

function loadSource(filePath) {
  var code = fs.readFileSync(path.resolve(filePath), 'utf8');
  var ctx = vm.createContext({
    fetch: nodeFetch,
    htmlText: htmlTextPolyfill,
    console: console,
    Promise: Promise,
    setTimeout: setTimeout
  });
  vm.runInContext(code, ctx);
  return ctx;
}

var SOURCES = ['baozimh.js', 'kuaikan.js', 'manhuaren.js', 'mangabz.js', 'manhuagui.js'];
var SEARCH_QUERY = '斗破苍穹';

function assert(condition, msg) {
  if (!condition) throw new Error('ASSERT FAIL: ' + msg);
}

function logResult(sourceId, test, pass, detail) {
  var status = pass ? 'PASS' : 'FAIL';
  console.log('  [' + status + '] ' + sourceId + ' / ' + test + (detail ? ' — ' + detail : ''));
}

async function testSource(filePath) {
  var sourceId = filePath.replace('.js', '');
  var results = { source: sourceId, tests: [] };
  console.log('\n=== Testing ' + sourceId + ' ===');

  try {
    var ctx = loadSource(filePath);

    // Test 1: getInfo
    try {
      var info = ctx.getInfo();
      assert(info.name, 'getInfo must return name');
      assert(info.lang === 'zh', 'lang must be zh');
      assert(info.baseUrl, 'getInfo must return baseUrl');
      assert(info.type === 'manga', 'type must be manga');
      results.tests.push({ test: 'getInfo', pass: true });
      logResult(sourceId, 'getInfo', true, info.name + ' (' + info.lang + ')');
    } catch(e) {
      results.tests.push({ test: 'getInfo', pass: false, error: e.message });
      logResult(sourceId, 'getInfo', false, e.message);
    }

    // Test 2: search
    var searchResults = [];
    try {
      searchResults = await ctx.search(SEARCH_QUERY, 1, {});
      assert(Array.isArray(searchResults), 'search must return array');
      if (searchResults.length > 0) {
        var first = searchResults[0];
        assert(first.id, 'search result must have id');
        assert(first.title, 'search result must have title');
        assert(first.url, 'search result must have url');
        assert(first.sourceId === sourceId, 'sourceId must match');
        results.tests.push({ test: 'search', pass: true });
        logResult(sourceId, 'search', true, searchResults.length + ' results');
      } else {
        results.tests.push({ test: 'search', pass: true, note: 'empty (expected for kuaikan)' });
        logResult(sourceId, 'search', true, '0 results (browse-only source)');
      }
    } catch(e) {
      results.tests.push({ test: 'search', pass: false, error: e.message });
      logResult(sourceId, 'search', false, e.message);
    }

    // Test 3: getDetail (from first search result or homepage browse)
    var detail = null;
    if (searchResults.length > 0) {
      try {
        detail = await ctx.getDetail(searchResults[0].url);
        assert(detail.title, 'detail must have title');
        assert(detail.url, 'detail must have url');
        assert(detail.sourceId === sourceId, 'detail sourceId must match');
        assert(Array.isArray(detail.chapters), 'detail must have chapters array');
        results.tests.push({ test: 'getDetail', pass: true });
        logResult(sourceId, 'getDetail', true, detail.title + ' — ' + (detail.chapters || []).length + ' chapters');
      } catch(e) {
        results.tests.push({ test: 'getDetail', pass: false, error: e.message });
        logResult(sourceId, 'getDetail', false, e.message);
      }
    } else {
      results.tests.push({ test: 'getDetail', pass: false, error: 'No search results to test' });
      logResult(sourceId, 'getDetail', false, 'No search results to test');
    }

    // Test 4: getPages (from first chapter)
    if (detail && detail.chapters && detail.chapters.length > 0) {
      try {
        var firstChapter = detail.chapters[0];
        var pages = await ctx.getPages(firstChapter.url);
        assert(Array.isArray(pages), 'getPages must return array');
        if (pages.length > 0) {
          assert(pages[0].url, 'page must have url');
          results.tests.push({ test: 'getPages', pass: true });
          logResult(sourceId, 'getPages', true, pages.length + ' pages');
        } else {
          results.tests.push({ test: 'getPages', pass: false, error: '0 pages returned' });
          logResult(sourceId, 'getPages', false, '0 pages returned');
        }
      } catch(e) {
        results.tests.push({ test: 'getPages', pass: false, error: e.message });
        logResult(sourceId, 'getPages', false, e.message);
      }
    } else {
      results.tests.push({ test: 'getPages', pass: false, error: 'No chapters to test' });
      logResult(sourceId, 'getPages', false, 'No chapters to test');
    }

  } catch(e) {
    results.tests.push({ test: 'load', pass: false, error: e.message });
    logResult(sourceId, 'load', false, e.message);
  }

  return results;
}

async function main() {
  console.log('=== Chinese Sources Test Runner ===');
  console.log('Testing ' + SOURCES.length + ' sources with query: "' + SEARCH_QUERY + '"\n');

  var allResults = [];
  for (var i = 0; i < SOURCES.length; i++) {
    var r = await testSource(SOURCES[i]);
    allResults.push(r);
  }

  console.log('\n=== Summary ===');
  var totalPass = 0;
  var totalFail = 0;
  for (var j = 0; j < allResults.length; j++) {
    var res = allResults[j];
    var passed = res.tests.filter(function(t) { return t.pass; }).length;
    var failed = res.tests.filter(function(t) { return !t.pass; }).length;
    totalPass += passed;
    totalFail += failed;
    console.log('  ' + res.source + ': ' + passed + '/' + (passed + failed) + ' passed' + (failed > 0 ? ' (' + failed + ' FAILED)' : ''));
  }
  console.log('\nTotal: ' + totalPass + ' passed, ' + totalFail + ' failed');
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(function(e) {
  console.error('Fatal error:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Commit test.js**

```bash
git add test.js
git commit -m "Add test runner for Chinese sources"
```

---

### Task 7: Run tests and fix issues

**Files:**
- Possibly modify: `baozimh.js`, `kuaikan.js`, `manhuaren.js`, `mangabz.js`, `manhuagui.js`

- [ ] **Step 1: Run the test runner**

```bash
node test.js
```

Expected: All 5 sources pass getInfo, search, getDetail, and getPages tests. Some sources may fail on specific tests due to live site variations.

- [ ] **Step 2: For each failing test, investigate and fix the scraper**

If a test fails:
1. Check the error message in the test output
2. Fetch the URL manually with `curl` or `node -e "..."` to see the actual HTML
3. Adjust the regex patterns in the scraper
4. Re-run `node test.js` to verify the fix

Common issues:
- Regex patterns don't match the actual HTML structure — fetch the page, inspect HTML, adjust regex
- Packed JS extraction fails — inspect the packed string format, adjust `_unpackPacked` or `_unpackPackedLz`
- API responses differ from expected — check actual JSON structure, adjust parsing
- Pages return 0 images — investigate the chapter reader page structure

- [ ] **Step 3: Re-run tests until all pass**

```bash
node test.js
```

Expected: All tests pass.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "Fix scraper issues found during testing"
```

---

### Task 8: Update index.json

**Files:**
- Modify: `index.json`

- [ ] **Step 1: Add 5 Chinese source entries to index.json**

Update `index.json` to include all 5 new sources in the `sources` array:

```json
{
  "name": "Custom Manga Providers",
  "description": "Manga providers for Sozo Read: MangaFreak, E-Hentai, 包子漫画, 快看漫画, 漫画人, MangaBZ, 漫画柜.",
  "sources": [
    {
      "id": "mangafreak",
      "name": "MangaFreak",
      "version": "1.0.0",
      "type": "manga",
      "lang": "en",
      "file": "mangafreak.js",
      "logo": "https://www.mangafreak.me/favicon.ico",
      "nsfw": false
    },
    {
      "id": "ehentai",
      "name": "E-Hentai",
      "version": "1.0.0",
      "type": "manga",
      "lang": "en",
      "file": "ehentai.js",
      "logo": "https://e-hentai.org/favicon.ico",
      "nsfw": true
    },
    {
      "id": "baozimh",
      "name": "包子漫画",
      "version": "1.0.0",
      "type": "manga",
      "lang": "zh",
      "file": "baozimh.js",
      "logo": "https://www.baozimh.com/favicon.ico",
      "nsfw": false
    },
    {
      "id": "kuaikan",
      "name": "快看漫画",
      "version": "1.0.0",
      "type": "manga",
      "lang": "zh",
      "file": "kuaikan.js",
      "logo": "https://www.kuaikanmanhua.com/favicon.ico",
      "nsfw": false
    },
    {
      "id": "manhuaren",
      "name": "漫画人",
      "version": "1.0.0",
      "type": "manga",
      "lang": "zh",
      "file": "manhuaren.js",
      "logo": "https://www.manhuaren.com/favicon.ico",
      "nsfw": false
    },
    {
      "id": "mangabz",
      "name": "MangaBZ",
      "version": "1.0.0",
      "type": "manga",
      "lang": "zh",
      "file": "mangabz.js",
      "logo": "https://mangabz.com/favicon.ico",
      "nsfw": false
    },
    {
      "id": "manhuagui",
      "name": "漫画柜",
      "version": "1.0.0",
      "type": "manga",
      "lang": "zh",
      "file": "manhuagui.js",
      "logo": "https://www.manhuagui.com/favicon.ico",
      "nsfw": false
    }
  ]
}
```

- [ ] **Step 2: Final test run to confirm everything works**

```bash
node test.js
```

Expected: All tests pass.

- [ ] **Step 3: Commit and push**

```bash
git add index.json
git commit -m "Register 5 Chinese manga sources in index.json"
```
