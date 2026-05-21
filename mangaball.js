var SOURCE_ID = 'mangaball';
var SITE = 'https://mangaball.net';
var REFERER = SITE + '/';

var _session = { csrf: '', cookie: '' };

function getInfo() {
  return {
    name: 'MangaBall',
    lang: 'en',
    baseUrl: SITE,
    logo: SITE + '/public/frontend/images/logo.svg',
    type: 'manga',
    version: '2.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
}

function _normalizeStatus(s) {
  s = (s || '').toLowerCase();
  if (s.indexOf('ongoing') !== -1) return 'ongoing';
  if (s.indexOf('completed') !== -1) return 'completed';
  if (s.indexOf('hiatus') !== -1 || s.indexOf('on-hold') !== -1) return 'hiatus';
  if (s.indexOf('cancelled') !== -1 || s.indexOf('discontinued') !== -1) return 'cancelled';
  return 'unknown';
}

function _initSession() {
  return fetch(SITE + '/', { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': REFERER } }).then(function(r) {
    var html = r.body || '';
    var m = html.match(/name="csrf-token"\s+content="([^"]+)"/);
    _session.csrf = m ? m[1] : '';

    var cookieStr = '';
    var hdrs = r.headers || {};
    var sc = hdrs['set-cookie'] || hdrs['Set-Cookie'] || '';
    var pm = String(sc).match(/PHPSESSID=([^;]+)/);
    if (pm) {
      cookieStr = 'PHPSESSID=' + pm[1];
    }
    if (!cookieStr) {
      var allHdrs = JSON.stringify(hdrs);
      pm = allHdrs.match(/PHPSESSID=([^;\\"]+)/);
      if (pm) cookieStr = 'PHPSESSID=' + pm[1];
    }
    _session.cookie = cookieStr;
    console.log('mangaball session: csrf=' + (_session.csrf ? 'ok' : 'missing') + ' cookie=' + (cookieStr ? 'ok' : 'missing'));
    return _session.csrf && cookieStr;
  });
}

function _apiPost(url, data) {
  var body = typeof data === 'string' ? data : JSON.stringify(data);
  var hdrs = {
    'Content-Type': 'application/json',
    'X-CSRF-TOKEN': _session.csrf,
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': REFERER
  };
  if (_session.cookie) hdrs['Cookie'] = _session.cookie;
  return fetch(url, { method: 'POST', headers: hdrs, body: body });
}

function search(query, page, opts) {
  page = page || 1;
  console.log('mangaball search: ' + query);
  return _initSession().then(function(ok) {
    if (!ok) return [];
    return _apiPost(SITE + '/api/v1/smart-search/search/', {
      search_input: query
    }).then(function(r) {
      console.log('mangaball search status: ' + r.status);
      if (r.status !== 200) return [];
      try {
        var json = JSON.parse(r.body);
        var items = [];
        if (json.data) {
          items = json.data.manga || json.data.titles || json.data || [];
        }
        if (!Array.isArray(items)) items = [];
        var results = [];
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var title = _clean(item.title || item.name || '');
          var cover = item.img || item.cover || item.image || item.thumbnail || '';
          var url = item.url || '';
          if (url && url.charAt(0) === '/') url = SITE + url;
          var id = '';
          var idM = url.match(/-([0-9a-f]{20,})\/?$/);
          if (idM) id = idM[1];
          if (!id) id = url;
          var status = _normalizeStatus(item.status || '');
          results.push({
            id: id,
            title: title,
            url: url,
            cover: cover,
            sourceId: SOURCE_ID,
            type: 'manga',
            status: status
          });
        }
        console.log('mangaball search count: ' + results.length);
        return results;
      } catch (e) {
        console.log('mangaball search error: ' + e.message);
        return [];
      }
    });
  });
}

function getDetail(url) {
  console.log('mangaball detail: ' + url);
  var id = '';
  var idM = url.match(/-([0-9a-f]{20,})\/?$/);
  if (idM) id = idM[1];

  return _initSession().then(function() {
    return fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': REFERER } }).then(function(r) {
      if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
      var html = r.body || '';

      var titleM = html.match(/<title>([^<]+)<\/title>/);
      var rawTitle = titleM ? _clean(titleM[1]) : '';
      var title = rawTitle.replace(/\s*(Online Free|Manga Ball).*$/i, '').replace(/\s*\/\s*/g, ' - ').trim() || rawTitle.split(' - ')[0] || rawTitle.split(' / ')[0];

      var coverM = html.match(/property="og:image"\s+content="([^"]+)"/);
      var cover = coverM ? coverM[1] : '';

      var descM = html.match(/name="description"\s+content="([^"]+)"/);
      var description = _clean(descM ? descM[1] : '');

      var status = 'unknown';
      var stM = html.match(/status-(ongoing|completed|hiatus|cancelled)-title/);
      if (stM) status = _normalizeStatus(stM[1]);

      var authors = [];
      var authRe = /Author[^<]*<[^>]*>([\s\S]*?)<\/(?:span|a)>/gi;
      var am;
      while ((am = authRe.exec(html)) !== null) {
        var a = _clean(am[1].replace(/<[^>]+>/g, ''));
        if (a) authors.push(a);
      }

      var genres = [];
      var gRe = /<a[^>]+href="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/gi;
      var gm;
      while ((gm = gRe.exec(html)) !== null) {
        var g = _clean(gm[1]);
        if (g && genres.indexOf(g) === -1) genres.push(g);
      }

      if (!id) {
        idM = url.match(/-([0-9a-f]{20,})\/?$/);
        if (idM) id = idM[1];
        if (!id) id = url;
      }

      return _apiPost(SITE + '/api/v1/chapter/chapter-listing-by-title-id/', {
        title_id: id,
        userSettingsEnabled: true
      }).then(function(r2) {
        var chapters = [];
        if (r2.status === 200) {
          try {
            var json = JSON.parse(r2.body);
            var allCh = json.ALL_CHAPTERS || [];
            for (var i = 0; i < allCh.length; i++) {
              var ch = allCh[i];
              var translations = ch.translations || [];
              var enTr = null;
              for (var ti = 0; ti < translations.length; ti++) {
                if (translations[ti].language === 'en') { enTr = translations[ti]; break; }
              }
              var t = enTr || translations[0];
              if (!t) continue;
              var chTitle = _clean(t.name || ('Chapter ' + ch.number));
              var chUrl = t.url || '';
              if (chUrl && chUrl.indexOf('http') !== 0) chUrl = SITE + (chUrl.charAt(0) === '/' ? '' : '/') + chUrl;
              if (chUrl.indexOf('http://') === 0) chUrl = chUrl.replace('http://', 'https://');
              var num = ch.number_float || parseFloat(ch.number) || null;
              chapters.push({
                id: String(t.id || ch.number),
                title: chTitle,
                number: isNaN(num) ? null : num,
                url: chUrl,
                date: t.date ? t.date.substring(0, 10) : ''
              });
            }
          } catch (e) {
            console.log('mangaball chapters error: ' + e.message);
          }
        }
        console.log('mangaball detail: title=' + title.substring(0, 30) + ' chapters=' + chapters.length);
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
      }).catch(function() {
        return {
          id: id, sourceId: SOURCE_ID, title: title, cover: cover, url: url,
          author: authors.join(', '), authors: authors, status: status,
          description: description, genres: genres, type: 'manga', chapters: []
        };
      });
    });
  });
}

function getChapters(url) {
  return getDetail(url).then(function(d) { return d.chapters || []; });
}

function getPages(chapterUrl) {
  console.log('mangaball pages: ' + chapterUrl);
  var fixedUrl = chapterUrl;
  if (fixedUrl.indexOf('http://') === 0) fixedUrl = fixedUrl.replace('http://', 'https://');

  return fetch(fixedUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': REFERER } }).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';

    var imgsM = html.match(/chapterImages\s*=\s*JSON\.parse\(`(\[[\s\S]*?\])`\)/);
    if (!imgsM) {
      imgsM = html.match(/chapterImages\s*=\s*JSON\.parse\('(\[[\s\S]*?\])'\)/);
    }
    if (!imgsM) {
      imgsM = html.match(/chapterImages\s*=\s*(\[[\s\S]*?\]);/);
    }

    var urls = [];
    if (imgsM) {
      try {
        urls = JSON.parse(imgsM[1].replace(/\\n/g, '').replace(/\\u([0-9a-fA-F]{4})/g, function(m, c) {
          return String.fromCharCode(parseInt(c, 16));
        }));
      } catch (e) {
        console.log('mangaball image parse error: ' + e.message);
      }
    }

    if (urls.length === 0) {
      var re = /https?:\/\/[a-z]+\.poke-black-and-white\.net\/storage\/[^"'\s,]+\.(?:webp|jpg|png)/g;
      var m;
      while ((m = re.exec(html)) !== null) {
        urls.push(m[0]);
      }
    }

    var out = [];
    for (var i = 0; i < urls.length; i++) {
      out.push({
        url: urls[i],
        index: i,
        headers: { 'Referer': REFERER }
      });
    }
    console.log('mangaball pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MangaBall is a manga-only source.', nextUrl: null };
}
