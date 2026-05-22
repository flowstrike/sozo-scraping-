var SOURCE_ID = 'mangamikan';
var SITE = 'https://mangamikan.com';

function getInfo() {
  return {
    name: 'MangaMikan',
    lang: 'en',
    baseUrl: SITE,
    logo: SITE + '/assets/img/favicon.png',
    type: 'manga',
    version: '1.0.0'
  };
}

function _allMatches(html, regex) {
  var out = [];
  var m;
  regex.lastIndex = 0;
  while ((m = regex.exec(html)) !== null) {
    out.push(m);
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }
  return out;
}

function _clean(s) {
  return htmlText(s || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
}

function _decodeEntities(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function search(query, page, opts) {
  console.log('mangamikan browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var re = /href="\/manga\/([^"]+)"[^>]*>[^<]*<[^>]*>\s*<img[^>]+alt="([^"]*)"[^>]+>/g;
    var matches = _allMatches(html, re);
    var seen = {};
    for (var i = 0; i < matches.length; i++) {
      var slug = matches[i][1];
      var title = _clean(matches[i][2]) || slug.replace(/-/g, ' ');
      if (seen[slug]) continue;
      seen[slug] = true;
      results.push({
        id: slug,
        title: title,
        url: SITE + '/manga/' + slug,
        cover: '',
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    if (results.length === 0) {
      var slugRe = /href="\/manga\/([^"]+)"/g;
      var sm;
      while ((sm = slugRe.exec(html)) !== null) {
        var s = sm[1];
        if (!seen[s]) {
          seen[s] = true;
          results.push({
            id: s,
            title: s.replace(/-/g, ' '),
            url: SITE + '/manga/' + s,
            cover: '',
            sourceId: SOURCE_ID,
            type: 'manga'
          });
        }
      }
    }
    console.log('mangamikan browse count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('mangamikan detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/manga\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var titleM = html.match(/<div class="meta-title">([^<]+)<\/div>/);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var coverM = html.match(/data-src="(\/cover\.php\?[^"]+)"/);
    var cover = coverM ? SITE + _decodeEntities(coverM[1]) : '';

    var descM = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/);
    var description = descM ? _clean(descM[1]) : '';

    var genres = [];
    var gRe = /href="\/browse\?genre=([^"]+)"/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1].replace(/-/g, ' '));
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /<a[^>]+class="chapter-row"[^>]+href="(\/read\/[^"]+\/(\d+))"[^>]*>[\s\S]*?<div class="t"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<div class="subtext">([^<]*)<\/div>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chUrl = cm[1];
      var chId = cm[2];
      var chTitle = _clean(cm[3]);
      var chMeta = _clean(cm[4]);
      var dateM = chMeta.match(/\d{4}-\d{2}-\d{2}/);
      var date = dateM ? dateM[0] : '';
      var numM = chTitle.match(/(\d+(?:\.\d+)?)/);
      var num = numM ? parseFloat(numM[1]) : parseInt(chId, 10);
      chapters.push({
        id: chId,
        title: chTitle || ('Chapter ' + chId),
        number: isNaN(num) ? null : num,
        url: SITE + chUrl,
        date: date
      });
    }

    console.log('mangamikan detail: title=' + title + ' chapters=' + chapters.length);
    return {
      id: slug,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: '',
      authors: [],
      status: 'unknown',
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
  console.log('mangamikan pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var re = /data-src="(\/i\.php\?[^"]+)"/g;
    var matches = _allMatches(html, re);
    for (var i = 0; i < matches.length; i++) {
      out.push({
        url: SITE + _decodeEntities(matches[i][1]),
        index: i
      });
    }
    console.log('mangamikan pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MangaMikan is a manga-only source.', nextUrl: null };
}
