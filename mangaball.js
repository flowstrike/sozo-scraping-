var SOURCE_ID = 'mangaball';
var SITE = 'https://mangaball.net';
var REFERER = SITE + '/';

function getInfo() {
  return {
    name: 'MangaBall',
    lang: 'en',
    baseUrl: SITE,
    logo: SITE + '/public/frontend/images/logo.svg',
    type: 'manga',
    version: '1.0.0'
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

function _getCsrfToken() {
  return fetch(SITE + '/', { headers: { Referer: REFERER } }).then(function(r) {
    var html = r.body || '';
    var m = html.match(/name="csrf-token"\s+content="([^"]+)"/);
    return m ? m[1] : '';
  });
}

function _apiPost(url, data, csrfToken) {
  var body = typeof data === 'string' ? data : JSON.stringify(data);
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': REFERER
    },
    body: body
  });
}

function search(query, page, opts) {
  page = page || 1;
  console.log('mangaball search: ' + query + ' page=' + page);
  return _getCsrfToken().then(function(csrf) {
    if (!csrf) {
      console.log('mangaball: no CSRF token, trying smart-search');
      return [];
    }
    return _apiPost(SITE + '/api/v1/smart-search/search/', {
      search_input: query
    }, csrf).then(function(r) {
      console.log('mangaball smart-search status: ' + r.status);
      if (r.status !== 200) return [];
      try {
        var json = JSON.parse(r.body);
        var items = (json.data && json.data.titles) || [];
        var results = [];
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var id = item.slug || item.id || '';
          var title = item.title || item.name || '';
          var cover = item.cover || item.image || item.thumbnail || '';
          var url = item.url || (SITE + '/manga/' + id);
          var status = item.status || '';
          results.push({
            id: String(id),
            title: title,
            url: url,
            cover: cover,
            sourceId: SOURCE_ID,
            type: 'manga',
            status: _normalizeStatus(status)
          });
        }
        return results;
      } catch (e) {
        console.log('mangaball smart-search parse error: ' + e.message);
        return [];
      }
    });
  }).then(function(results) {
    if (results && results.length > 0) return results;
    return _getCsrfToken().then(function(csrf) {
      if (!csrf) return [];
      return _apiPost(SITE + '/api/v1/title/search-advanced/', {
        search_input: query,
        page: page
      }, csrf).then(function(r) {
        console.log('mangaball search-advanced status: ' + r.status);
        if (r.status !== 200) return [];
        try {
          var json = JSON.parse(r.body);
          var items = json.data || [];
          var results2 = [];
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = item.slug || item.id || '';
            var title = item.title || item.name || '';
            var cover = item.cover || item.image || item.thumbnail || '';
            var url = item.url || (SITE + '/manga/' + id);
            results2.push({
              id: String(id),
              title: title,
              url: url,
              cover: cover,
              sourceId: SOURCE_ID,
              type: 'manga'
            });
          }
          return results2;
        } catch (e) {
          console.log('mangaball search-advanced parse error: ' + e.message);
          return [];
        }
      });
    });
  });
}

function getDetail(url) {
  console.log('mangaball detail url: ' + url);
  return fetch(url, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
              || html.match(/property="og:title"\s+content="([^"]+)"/);
    var title = _clean(titleM ? titleM[1] : '');

    var coverM = html.match(/property="og:image"\s+content="([^"]+)"/)
              || html.match(/<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*class="[^"]*cover[^"]*"/i);
    var cover = coverM ? coverM[1] : '';

    var descM = html.match(/name="description"\s+content="([^"]+)"/)
             || html.match(/class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
             || html.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    var description = _clean(descM ? descM[1] : '');

    var statusM = html.match(/status[^<]*<[^>]*>([^<]+)/i);
    var status = _normalizeStatus(statusM ? statusM[1] : '');

    var authors = [];
    var authM = html.match(/author[^<]*<[^>]*>([\s\S]*?)<\/span>/i);
    if (authM) {
      var parts = authM[1].replace(/<[^>]+>/g, '').split(/[,;]/);
      for (var i = 0; i < parts.length; i++) {
        var a = _clean(parts[i]);
        if (a) authors.push(a);
      }
    }

    var genres = [];
    var gRe = /<a[^>]+href="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/gi;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var idM = url.match(/\/manga\/([^\/?#]+)/)
           || url.match(/\/title[s]?\/([^\/?#]+)/);
    var id = idM ? idM[1] : url;

    return _getCsrfToken().then(function(csrf) {
      var chapters = [];
      if (csrf) {
        return _apiPost(SITE + '/api/v1/chapter/chapter-listing-by-title-id/', {
          title_id: id,
          userSettingsEnabled: true
        }, csrf).then(function(r) {
          if (r.status === 200) {
            try {
              var json = JSON.parse(r.body);
              var allCh = json.ALL_CHAPTERS || [];
              for (var i = 0; i < allCh.length; i++) {
                var ch = allCh[i];
                var translations = ch.translations || [];
                if (translations.length > 0) {
                  var t = translations[0];
                  var chTitle = t.name || ('Chapter ' + ch.number);
                  var chUrl = t.url || '';
                  if (chUrl && chUrl.charAt(0) === '/') chUrl = SITE + chUrl;
                  chapters.push({
                    id: String(t.id || ch.number),
                    title: chTitle,
                    number: ch.number_float || parseFloat(ch.number) || null,
                    url: chUrl,
                    date: t.date ? t.date.substring(0, 10) : ''
                  });
                }
              }
            } catch (e) {
              console.log('mangaball chapters parse error: ' + e.message);
            }
          }
          console.log('mangaball detail: title=' + title + ' chapters=' + chapters.length);
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
      }
      return {
        id: id, sourceId: SOURCE_ID, title: title, cover: cover, url: url,
        author: authors.join(', '), authors: authors, status: status,
        description: description, genres: genres, type: 'manga', chapters: chapters
      };
    });
  });
}

function getChapters(url) {
  return getDetail(url).then(function(detail) {
    return detail.chapters || [];
  });
}

function getPages(chapterUrl) {
  console.log('mangaball pages url: ' + chapterUrl);
  return fetch(chapterUrl, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var re = /<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*class="[^"]*(?:page|chapter-image|reader-img)[^"]*"/gi;
    var matches = [];
    var m;
    regex: {
      re.lastIndex = 0;
      while ((m = re.exec(html)) !== null) {
        matches.push(m);
      }
    }
    if (matches.length === 0) {
      re = /<img[^>]+(?:data-src|data-original|src)="(https?:\/\/[^"]*(?:bulbasaur|cdn|images?|chapter|page)[^"]*\.(?:jpg|jpeg|png|webp))"/gi;
      while ((m = re.exec(html)) !== null) {
        matches.push(m);
      }
    }
    if (matches.length === 0) {
      re = /<img[^>]+class="[^"]*image[^"]*"[^>]+src="([^"]+)"/gi;
      while ((m = re.exec(html)) !== null) {
        matches.push(m);
      }
    }
    for (var i = 0; i < matches.length; i++) {
      var src = matches[i][1];
      out.push({
        url: src,
        index: i,
        headers: { Referer: REFERER }
      });
    }
    console.log('mangaball pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MangaBall is a manga-only source.', nextUrl: null };
}
