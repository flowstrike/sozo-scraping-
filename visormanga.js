var SOURCE_ID = 'visormanga';
var SITE = 'https://visormanga.com';

function getInfo() {
  return {
    name: 'VisorManga',
    lang: 'es',
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
  if (s.indexOf('ongoing') !== -1 || s.indexOf('publicandose') !== -1 || s.indexOf('publicándose') !== -1) return 'ongoing';
  if (s.indexOf('completed') !== -1 || s.indexOf('finalizado') !== -1) return 'completed';
  if (s.indexOf('hiatus') !== -1 || s.indexOf('pausa') !== -1) return 'hiatus';
  if (s.indexOf('cancelled') !== -1 || s.indexOf('cancelado') !== -1 || s.indexOf('discontinued') !== -1) return 'cancelled';
  return 'unknown';
}

function search(query, page, opts) {
  var q = (query || '').trim();
  var url = SITE + '/biblioteca' + (q ? '?q=' + encodeURIComponent(q) : '');
  console.log('visormanga search url: ' + url);
  return fetch(url).then(function(r) {
    console.log('visormanga search status: ' + r.status);
    if (r.status !== 200) return [];
    var html = r.body || '';
    return _parseSearchResults(html);
  });
}

function _parseSearchResults(html) {
  var results = [];
  var re = /href="https:\/\/visormanga\.com\/manga\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]*)"[^>]*>[\s\S]*?<[^>]+>([^<]*)/g;
  var seen = {};
  var m;
  while ((m = re.exec(html)) !== null) {
    var slug = m[1];
    if (seen[slug]) continue;
    seen[slug] = true;
    var cover = m[2];
    var title = _clean(m[3]) || slug.replace(/-/g, ' ');
    results.push({
      id: slug,
      title: title,
      url: SITE + '/manga/' + slug,
      cover: cover,
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  if (results.length === 0) {
    var cardRe = /href="https:\/\/visormanga\.com\/manga\/([^"]+)"[\s\S]*?(?:src="([^"]*(?:thumbs\.visormanga\.com|visor)[^"]*)")/g;
    while ((m = cardRe.exec(html)) !== null) {
      var slug2 = m[1];
      if (seen[slug2]) continue;
      seen[slug2] = true;
      results.push({
        id: slug2,
        title: slug2.replace(/-/g, ' '),
        url: SITE + '/manga/' + slug2,
        cover: m[2] || '',
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
  }
  console.log('visormanga search count: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('visormanga detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/manga\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var coverM = html.match(/<img[^>]+src="(https:\/\/thumbs\.visormanga\.com\/[^"]+)"/);
    var cover = coverM ? coverM[1] : '';

    var titleM = html.match(/<title>([^<]+?)(?:\s*[-|]\s*VisorManga)?<\/title>/i);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var descM = html.match(/<meta\s+(?:name|property)="description"\s+content="([^"]+)"/);
    if (!descM) descM = html.match(/(?:sinopsis|synopsis|description)[^<]*<[^>]*>([\s\S]*?)<\/p>/i);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    var statusM = html.match(/(?:estado|status)[^<]*<[^>]*>([^<]+)/i);
    if (statusM) status = _normalizeStatus(_clean(statusM[1]));
    if (status === 'unknown') {
      if (/ongoing|public[aá]ndose/i.test(html)) status = 'ongoing';
      else if (/completed|finalizado/i.test(html)) status = 'completed';
    }

    var authors = [];
    var authM = html.match(/(?:autor|author)[^<]*<[^>]*>([\s\S]*?)<\/(?:a|span|div|p)>/i);
    if (authM) {
      authors = authM[1].replace(/<[^>]+>/g, ',').split(/,/).map(function(s) { return _clean(s); }).filter(Boolean);
    }

    var genres = [];
    var gRe = /<a[^>]+href="[^"]*\/genre\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
    if (genres.length === 0) {
      gRe = /<a[^>]+href="[^"]*genero[^"]*"[^>]*>([^<]+)<\/a>/gi;
    }
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chSeen = {};
    var chRe = /href="(https:\/\/visormanga\.com\/leer\/([^"]+))"[^>]*>([\s\S]*?)<\/a>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chUrl = cm[1];
      var chSlug = cm[2];
      var chTitle = _clean(cm[3]) || chSlug;
      if (chSeen[chUrl]) continue;
      chSeen[chUrl] = true;
      var numMatch = chSlug.match(/-(\d+(?:\.\d+)?)$/);
      var num = numMatch ? parseFloat(numMatch[1]) : null;
      if (isNaN(num)) num = null;
      chapters.push({
        id: chSlug,
        title: chTitle || ('Capítulo ' + (num || chSlug)),
        number: num,
        url: chUrl,
        date: ''
      });
    }

    chapters.sort(function(a, b) { return (b.number || 0) - (a.number || 0); });

    console.log('visormanga detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
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
  console.log('visormanga pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var seen = {};
    var re = /(?:src|data-src)="(https:\/\/[^"]*(?:imgvtmo|visor)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/g;
    var matches = _allMatches(html, re);
    for (var i = 0; i < matches.length; i++) {
      var imgUrl = matches[i][1];
      if (seen[imgUrl]) continue;
      seen[imgUrl] = true;
      out.push({
        url: imgUrl,
        index: out.length
      });
    }
    console.log('visormanga pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'VisorManga is a manga-only source.', nextUrl: null };
}
