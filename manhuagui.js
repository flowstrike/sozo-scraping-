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

    var slE = '', slMstr = '';
    var slM1 = unpacked.match(/sl:\s*\{[^}]*e:\s*(\d+)/);
    if (slM1) slE = slM1[1];
    var slM2 = unpacked.match(/sl:\s*\{[^}]*m:\s*"([^"]+)"/);
    if (slM2) slMstr = slM2[1];

    var pages = [];
    for (var i = 0; i < files.length; i++) {
      var imgUrl = CDN_HOST + path + files[i] + '?e=' + slE + '&m=' + slMstr;
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
