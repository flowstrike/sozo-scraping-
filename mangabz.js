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
  var re = /\('((?:[^'\\]|\\.)*)',(\d+),(\d+),'((?:[^'\\]|\\.)*)'/;
  var m = packedStr.match(re);
  if (!m) return '';
  var p = m[1].replace(/\\'/g, "'");
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
    var re = /href="\/(\d+bz\/)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<\/a>[\s\S]*?href="\/\1"[^>]*>([^<]+)<\/a>/g;
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
  var re = /class="mh-item"[\s\S]*?href="([^"]+)"[\s\S]*?src="([^"]*)"[\s\S]*?class="title"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
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
    var chRe = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*detail-list-form-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
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
  var m;
  m = html.match(new RegExp('var\\s+' + varName + '\\s*=\\s*"([^"]*)"'));
  if (m) return m[1];
  m = html.match(new RegExp("var\\s+" + varName + "\\s*=\\s*'([^']*)'"));
  if (m) return m[1];
  m = html.match(new RegExp('var\\s+' + varName + '\\s*=\\s*([^\\s;]+)'));
  return m ? m[1] : '';
}

function _parseCookies(headers) {
  var sc = headers && (headers['set-cookie'] || headers['Set-Cookie'] || '');
  if (!sc) return '';
  var cookies = [];
  var parts = Array.isArray(sc) ? sc : [sc];
  for (var i = 0; i < parts.length; i++) {
    var cv = (parts[i] || '').split(';')[0].trim();
    if (cv && cv.indexOf('=') > 0) cookies.push(cv);
  }
  return cookies.join('; ');
}

function getPages(chapterUrl) {
  console.log('mangabz pages: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var cookieHeader = _parseCookies(r.headers);

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
      return fetch(apiUrl, { headers: { Cookie: cookieHeader, Referer: chapterUrl } }).then(function(ar) {
        if (ar.status !== 200) return;
        var body = ar.body || '';
        if (!body) return;
        try {
          eval(body);
        } catch(e) {
          var unpacked = _unpackPacked(body);
          try { eval(unpacked); } catch(e2) {}
        }
        if (typeof d !== 'undefined' && Array.isArray(d)) {
          for (var i = 0; i < d.length; i++) {
            var url = d[i];
            if (url && !seen[url]) {
              seen[url] = true;
              pages.push({ url: url, index: pages.length, headers: { Referer: SITE + '/' } });
            }
          }
        }
        d = undefined;
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
