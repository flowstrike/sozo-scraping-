var SOURCE_ID = 'mangapill';
var SITE = 'https://mangapill.com';
var REFERER = SITE + '/';
var CDN = 'https://cdn.readdetectiveconan.com';

function getInfo() {
  return {
    name: 'MangaPill',
    lang: 'en',
    baseUrl: SITE,
    logo: SITE + '/static/favicon/favicon.ico',
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
  if (s.indexOf('completed') !== -1 || s.indexOf('finished') !== -1) return 'completed';
  if (s.indexOf('hiatus') !== -1) return 'hiatus';
  if (s.indexOf('cancelled') !== -1 || s.indexOf('discontinued') !== -1) return 'cancelled';
  return 'unknown';
}

function search(query, page, opts) {
  var url = SITE + '/search?q=' + encodeURIComponent(query);
  console.log('mangapill search url: ' + url);
  return fetch(url).then(function(r) {
    console.log('mangapill search status: ' + r.status);
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var re = /<a[^>]+href="(\/manga\/\d+\/[^"]+)"[^>]*class="relative block"[^>]*>[\s\S]*?<img[^>]+data-src="([^"]+)"[^>]+alt="([^"]*)"[^>]*>/g;
    var matches = _allMatches(html, re);
    var seen = {};
    for (var i = 0; i < matches.length; i++) {
      var link = matches[i][1];
      var cover = matches[i][2];
      var title = _clean(matches[i][3].split(' ').slice(0, -1).join(' ') || matches[i][3]);
      if (!link || seen[link]) continue;
      seen[link] = true;
      var idM = link.match(/\/manga\/(\d+)\//);
      var id = idM ? idM[1] : link;
      results.push({
        id: id,
        title: title,
        url: SITE + link,
        cover: cover,
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('mangapill search count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('mangapill detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var titleM = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    var rawTitle = titleM ? _clean(titleM[1]) : '';
    var title = rawTitle.replace(/\s*Manga\s*-\s*Mangapill\s*$/i, '').trim();

    var coverM = html.match(/<meta\s+property="(og|twitter):image"\s+content="([^"]+)"/);
    var cover = coverM ? coverM[2] : '';

    var descM = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    var description = descM ? _clean(descM[1]) : '';

    var statusM = html.match(/<label[^>]*>Status<\/label>[\s\S]*?<div>([^<]+)<\/div>/i);
    var status = _normalizeStatus(statusM ? statusM[1] : '');

    var genres = [];
    var gRe = /<a[^>]+href="\/search\?genre=[^"]+"[^>]*>([^<]+)<\/a>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /<a[^>]+href="(\/chapters\/\d+-\d+\/[^"]+)"[^>]*title="\s*([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chLink = cm[1];
      var chTitle = _clean(cm[3] || cm[2]);
      var numMatch = chTitle.match(/(\d+(?:\.\d+)?)/);
      var num = numMatch ? parseFloat(numMatch[1]) : null;
      var chIdM = chLink.match(/\/chapters\/\d+-(\d+)\//);
      var chId = chIdM ? chIdM[1] : chLink;
      chapters.push({
        id: chId,
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: SITE + chLink,
        date: ''
      });
    }

    var idM = url.match(/\/manga\/(\d+)\//);
    var id = idM ? idM[1] : url;

    console.log('mangapill detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
    return {
      id: id,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: '',
      authors: [],
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
  console.log('mangapill pages url: ' + chapterUrl);
  return fetch(chapterUrl, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var re = /data-src="(https:\/\/cdn\.readdetectiveconan\.com\/file\/mangap\/[^"]+\.(?:jpg|jpeg|png|webp))"/g;
    var matches = _allMatches(html, re);
    for (var i = 0; i < matches.length; i++) {
      out.push({
        url: matches[i][1],
        index: i,
        headers: { Referer: REFERER }
      });
    }
    console.log('mangapill pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MangaPill is a manga-only source.', nextUrl: null };
}
