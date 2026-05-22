var SOURCE_ID = 'mangafreak';
var SITE = 'https://www.mangafreak.me';
var IMG = 'https://images.mangafreak.me';

function getInfo() {
  return {
    name: 'MangaFreak',
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
  var q = (query || '').trim();
  if (!q) {
    return _browseHomepage();
  }
  var url = SITE + '/Find/' + encodeURIComponent(q);
  console.log('mangafreak search url: ' + url);
  return fetch(url).then(function(r) {
    console.log('mangafreak search status: ' + r.status);
    if (r.status !== 200) return [];
    var html = r.body || '';
    return _parseSearchResults(html);
  });
}

function _browseHomepage() {
  var url = SITE + '/';
  console.log('mangafreak browse homepage: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var re = /datamanga="[^"]*"[^>]*href="\/Manga\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+alt="([^"]*)"[^>]*>/g;
    var m;
    var seen = {};
    while ((m = re.exec(html)) !== null) {
      var slug = m[1];
      var title = _clean(m[2]) || slug.replace(/_/g, ' ');
      if (seen[slug]) continue;
      seen[slug] = true;
      var cover = IMG + '/manga_images/' + slug.toLowerCase() + '.jpg';
      results.push({
        id: slug,
        title: title,
        url: SITE + '/Manga/' + slug,
        cover: cover,
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('mangafreak browse count: ' + results.length);
    return results;
  });
}

function _parseSearchResults(html) {
  var results = [];
  var re = /<a[^>]+href="\/Manga\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  var seen = {};
  var m;
  while ((m = re.exec(html)) !== null) {
    var slug = m[1];
    var rawTitle = m[2];
    if (seen[slug]) continue;
    seen[slug] = true;
    var title = _clean(rawTitle);
    if (!title) title = slug.replace(/_/g, ' ');
    var cover = IMG + '/manga_images/' + slug.toLowerCase() + '.jpg';
    results.push({
      id: slug,
      title: title,
      url: SITE + '/Manga/' + slug,
      cover: cover,
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  console.log('mangafreak search count: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('mangafreak detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/Manga\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var coverM = html.match(/<img[^>]+src="(https:\/\/images\.mangafreak\.me\/manga_images\/[^"]+)"/);
    var cover = coverM ? coverM[1] : '';

    var titleM = html.match(/<title>([^<]+?)\s*Manga/i);
    var title = titleM ? _clean(titleM[1]).replace(/:?\s*$/, '') : slug.replace(/_/g, ' ');

    var descM = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    if (/ON-GOING/i.test(html)) status = 'ongoing';
    else if (/Completed/i.test(html)) status = 'completed';

    var authors = [];
    var authM = html.match(/Written By:\s*([^<]+)/i);
    if (authM) authors = authM[1].split(/,/).map(function(s) { return _clean(s); }).filter(Boolean);

    var genres = [];
    var gRe = /<a[^>]+href="\/Genre\/[^"]+">([^<]+)<\/a>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /<a[^>]+href="(\/Read1_[^"]+)">([^<]*)<\/a>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chLink = cm[1];
      var chTitle = _clean(cm[2]);
      var numMatch = chTitle.match(/(\d+(?:\.\d+)?)/);
      var num = numMatch ? parseFloat(numMatch[1]) : null;
      chapters.push({
        id: chLink.replace('/Read1_', ''),
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: SITE + chLink,
        date: ''
      });
    }

    console.log('mangafreak detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
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
  console.log('mangafreak pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var re = /src="(https:\/\/images\.mangafreak\.me\/mangas\/[^"]+\.(?:jpg|jpeg|png|webp))"/g;
    var matches = _allMatches(html, re);
    for (var i = 0; i < matches.length; i++) {
      out.push({
        url: matches[i][1],
        index: i
      });
    }
    console.log('mangafreak pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MangaFreak is a manga-only source.', nextUrl: null };
}
