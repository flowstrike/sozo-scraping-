var SOURCE_ID = 'mangatown';
var SITE = 'https://www.mangatown.com';
var REFERER = SITE + '/';

function getInfo() {
  return {
    name: 'MangaTown',
    lang: 'en',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
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

function _normalizeStatus(s) {
  s = (s || '').toLowerCase();
  if (s.indexOf('ongoing') !== -1) return 'ongoing';
  if (s.indexOf('completed') !== -1) return 'completed';
  if (s.indexOf('hiatus') !== -1) return 'hiatus';
  if (s.indexOf('cancelled') !== -1 || s.indexOf('discontinued') !== -1) return 'cancelled';
  return 'unknown';
}

function search(query, page, opts) {
  page = page || 1;
  var url = SITE + '/search?name=' + encodeURIComponent(query) + (page > 1 ? '&page=' + page : '');
  console.log('mangatown search url: ' + url);
  return fetch(url, { headers: { Referer: REFERER } }).then(function(r) {
    console.log('mangatown search status: ' + r.status);
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var re = /<li>\s*<a[^>]+class="manga_cover"[^>]+href="([^"]+)"[^>]*title="([^"]*)"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>/g;
    var matches = _allMatches(html, re);
    var seen = {};
    for (var i = 0; i < matches.length; i++) {
      var link = matches[i][1];
      var title = _clean(matches[i][2]);
      var cover = matches[i][3];
      if (!link || seen[link]) continue;
      seen[link] = true;
      if (cover.indexOf('//') === 0) cover = 'https:' + cover;
      var id = link.replace(/^\/manga\//, '').replace(/\/$/, '');
      results.push({
        id: id,
        title: title,
        url: SITE + link,
        cover: cover,
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    if (results.length === 0) {
      re = /<a[^>]+class="manga_cover"[^>]+href="(\/manga\/[^\/]+\/)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/g;
      matches = _allMatches(html, re);
      for (i = 0; i < matches.length; i++) {
        link = matches[i][1];
        title = _clean(matches[i][2]);
        cover = matches[i][3];
        if (!link || seen[link]) continue;
        seen[link] = true;
        if (cover.indexOf('//') === 0) cover = 'https:' + cover;
        id = link.replace(/^\/manga\//, '').replace(/\/$/, '');
        results.push({
          id: id,
          title: title,
          url: SITE + link,
          cover: cover,
          sourceId: SOURCE_ID,
          type: 'manga'
        });
      }
    }
    console.log('mangatown search count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('mangatown detail url: ' + url);
  return fetch(url, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var titleM = html.match(/<h1[^>]*class="title-top"[^>]*>([\s\S]*?)<\/h1>/);
    var title = _clean(titleM ? titleM[1] : '');

    var coverM = html.match(/<div[^>]*class="detail_info[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/);
    var cover = coverM ? coverM[1] : '';
    if (cover.indexOf('//') === 0) cover = 'https:' + cover;

    var descM = html.match(/<span[^>]+id="hide"[^>]*>([\s\S]*?)<\/span>/);
    var description = _clean(descM ? descM[1] : '');

    var statusM = html.match(/<b>Status\(s\):<\/b>([^<]+)/i);
    var status = _normalizeStatus(statusM ? statusM[1] : '');

    var authors = [];
    var authRe = /<b>Author\(s\):<\/b>[\s\S]*?<a[^>]*class="color_0077"[^>]*>([\s\S]*?)<\/a>/g;
    var am;
    while ((am = authRe.exec(html)) !== null) {
      var a = _clean(am[1]);
      if (a) authors.push(a);
    }

    var genres = [];
    var gRe = /<b>Genre\(s\):<\/b>([\s\S]*?)<\/li>/i;
    var gBlock = gRe.exec(html);
    if (gBlock) {
      var gLinkRe = /<a[^>]+title="([^"]+)"[^>]*>/g;
      var gm;
      while ((gm = gLinkRe.exec(gBlock[1])) !== null) {
        var g = _clean(gm[1]);
        if (g && genres.indexOf(g) === -1) genres.push(g);
      }
    }

    var chapters = [];
    var chRe = /<a[^>]+href="(\/manga\/[^\/]+\/c[^\/]+\/)"[^>]*name="[^"]*"\s*>([\s\S]*?)<\/a>\s*<span[^>]*class="time"[^>]*>([\s\S]*?)<\/span>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chLink = cm[1];
      var chTitle = _clean(cm[2]);
      var chDate = _clean(cm[3]);
      var numMatch = chTitle.match(/(\d+(?:\.\d+)?)/);
      var num = numMatch ? parseFloat(numMatch[1]) : null;
      var chId = chLink.replace(/.*\/(c[^\/]+)\/$/, '$1');
      chapters.push({
        id: chId,
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: SITE + chLink,
        date: chDate
      });
    }

    var idMatch = url.match(/\/manga\/([^\/]+)\/?$/);
    var id = idMatch ? idMatch[1] : url;

    console.log('mangatown detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
    return {
      id: id,
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
  return fetch(url, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var chapters = [];
    var chRe = /<a[^>]+href="(\/manga\/[^\/]+\/c[^\/]+\/)"[^>]*name="[^"]*"\s*>([\s\S]*?)<\/a>\s*<span[^>]*class="time"[^>]*>([\s\S]*?)<\/span>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chLink = cm[1];
      var chTitle = _clean(cm[2]);
      var chDate = _clean(cm[3]);
      var numMatch = chTitle.match(/(\d+(?:\.\d+)?)/);
      var num = numMatch ? parseFloat(numMatch[1]) : null;
      var chId = chLink.replace(/.*\/(c[^\/]+)\/$/, '$1');
      chapters.push({
        id: chId,
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: SITE + chLink,
        date: chDate
      });
    }
    return chapters;
  });
}

function getPages(chapterUrl) {
  console.log('mangatown pages url: ' + chapterUrl);
  return fetch(chapterUrl, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var re = /<img[^>]+src="(\/\/[^"]+)"[^>]+class="image"[^>]*>/g;
    var matches = _allMatches(html, re);
    if (matches.length === 0) {
      re = /<img[^>]+class="image"[^>]+src="(\/\/[^"]+)"[^>]*>/g;
      matches = _allMatches(html, re);
    }
    for (var i = 0; i < matches.length; i++) {
      var src = matches[i][1];
      if (src.indexOf('//') === 0) src = 'https:' + src;
      out.push({
        url: src,
        index: i,
        headers: { Referer: REFERER }
      });
    }
    console.log('mangatown pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MangaTown is a manga-only source.', nextUrl: null };
}
