var SOURCE_ID = 'infrafandub';
var SITE = 'https://infrafandub.com';

function getInfo() {
  return {
    name: 'InfraFandub',
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
  if (s.indexOf('en curso') !== -1 || s.indexOf('ongoing') !== -1) return 'ongoing';
  if (s.indexOf('completado') !== -1 || s.indexOf('completed') !== -1) return 'completed';
  if (s.indexOf('hiatus') !== -1 || s.indexOf('pausado') !== -1) return 'hiatus';
  if (s.indexOf('cancelled') !== -1 || s.indexOf('cancelado') !== -1 || s.indexOf('discontinued') !== -1) return 'cancelled';
  return 'unknown';
}

function search(query, page, opts) {
  var q = (query || '').trim();
  if (!q) {
    return _browseHomepage();
  }
  var url = SITE + '/wp-admin/admin-ajax.php';
  var body = 'action=wp-manga-search-manga&title=' + encodeURIComponent(q);
  console.log('infrafandub search url: ' + url);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  }).then(function(r) {
    console.log('infrafandub search status: ' + r.status);
    if (r.status !== 200) return [];
    var json;
    try {
      json = JSON.parse(r.body || '');
    } catch (e) {
      return [];
    }
    if (!json || !json.success || !json.data) return [];
    var results = [];
    var seen = {};
    for (var i = 0; i < json.data.length; i++) {
      var item = json.data[i];
      var itemUrl = item.url || '';
      var slugM = itemUrl.match(/\/manga\/([^\/]+)\/?$/);
      if (!slugM) continue;
      var slug = slugM[1];
      if (seen[slug]) continue;
      seen[slug] = true;
      var title = _clean(item.title) || slug.replace(/-/g, ' ');
      results.push({
        id: slug,
        title: title,
        url: itemUrl,
        cover: '',
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('infrafandub search count: ' + results.length);
    return results;
  });
}

function _browseHomepage() {
  var url = SITE + '/manga/';
  console.log('infrafandub browse homepage: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var seen = {};
    var re = /href="https:\/\/infrafandub\.com\/manga\/([^"]+?)\/"/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      var slug = m[1];
      if (slug === 'feed') continue;
      if (/\/feed\/?/.test(slug)) continue;
      if (seen[slug]) continue;
      seen[slug] = true;
      var block = html.substring(Math.max(0, m.index - 800), m.index + m[0].length);
      var coverM = block.match(/<img[^>]+src="([^"]*wp-content\/uploads[^"]*)"/);
      var cover = coverM ? _clean(coverM[1]) : '';
      var title = slug.replace(/-/g, ' ');
      results.push({
        id: slug,
        title: title,
        url: SITE + '/manga/' + slug + '/',
        cover: cover,
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('infrafandub browse count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('infrafandub detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/manga\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');
    if (!title) title = slug.replace(/-/g, ' ');

    var cover = '';
    var coverRe = /<img[^>]+src="([^"]*wp-content\/uploads[^"]*)"[^>]*>/g;
    var cm;
    while ((cm = coverRe.exec(html)) !== null) {
      cover = _clean(cm[1]);
      break;
    }

    var descM = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    var description = descM ? _clean(descM[1]) : '';
    if (!description) {
      var descM2 = html.match(/<div[^>]+class="summary__content"[^>]*>([\s\S]*?)<\/div>/);
      description = descM2 ? _clean(descM2[1]) : '';
    }

    var status = 'unknown';
    var statusM = html.match(/Estado[\s\S]*?<[^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (statusM) status = _normalizeStatus(statusM[1]);
    if (status === 'unknown') {
      if (/en curso/i.test(html)) status = 'ongoing';
      else if (/completado/i.test(html)) status = 'completed';
    }

    var authors = [];
    var authRe = /Autor[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;
    var am;
    while ((am = authRe.exec(html)) !== null) {
      var a = _clean(am[1]);
      if (a && authors.indexOf(a) === -1) authors.push(a);
    }

    var genres = [];
    var gRe = /<a[^>]+href="[^"]*\/genre\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chSeen = {};
    var chRe = /href="(https:\/\/infrafandub\.com\/manga\/[^"]+\/capitulo-[^"]+\/?)"/gi;
    var chm;
    while ((chm = chRe.exec(html)) !== null) {
      var chUrl = chm[1];
      if (/\/feed\//.test(chUrl)) continue;
      if (chUrl === url || chUrl === url + '/') continue;
      if (chSeen[chUrl]) continue;
      chSeen[chUrl] = true;
      var numM = chUrl.match(/capitulo-(\d+(?:[._]\d+)?)/i);
      var num = numM ? parseFloat(numM[1].replace('_', '.')) : null;
      chapters.push({
        id: chUrl,
        title: 'Capitulo ' + (num !== null ? num : ''),
        number: isNaN(num) ? null : num,
        url: chUrl,
        date: ''
      });
    }

    chapters.sort(function(a, b) { return (b.number || 0) - (a.number || 0); });

    console.log('infrafandub detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
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
  console.log('infrafandub pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var seen = {};
    var re = /(?:src|data-src)\s*=\s*["']\s*([^"']*?(?:imgur\.com|wp-content\/uploads)[^"']*)\s*["']/gi;
    var matches = _allMatches(html, re);
    for (var i = 0; i < matches.length; i++) {
      var imgUrl = _clean(matches[i][1]);
      if (!imgUrl) continue;
      if (seen[imgUrl]) continue;
      seen[imgUrl] = true;
      out.push({
        url: imgUrl,
        index: out.length
      });
    }
    console.log('infrafandub pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'InfraFandub is a manga-only source.', nextUrl: null };
}
