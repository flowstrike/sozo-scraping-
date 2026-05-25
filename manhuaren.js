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
  var re = /class="book-list-cover"[^>]*>[\s\S]*?href="([^"]+)"[\s\S]*?src="([^"]*)"[\s\S]*?class="book-list-info-title[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
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
    var chRe = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*chapteritem[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
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
