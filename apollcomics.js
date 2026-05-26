var SOURCE_ID = 'apollcomics';
var SITE = 'https://apollcomics.es';

function getInfo() {
  return {
    name: 'ApollComics',
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
  if (s.indexOf('hiatus') !== -1) return 'hiatus';
  if (s.indexOf('cancelado') !== -1 || s.indexOf('cancelled') !== -1 || s.indexOf('discontinued') !== -1) return 'cancelled';
  return 'unknown';
}

function search(query, page, opts) {
  var q = (query || '').trim();
  if (!q) {
    return _browseHomepage();
  }
  var url = SITE + '/wp-admin/admin-ajax.php';
  var body = 'action=wp-manga-search-manga&title=' + encodeURIComponent(q);
  console.log('apollcomics search url: ' + url + ' query: ' + q);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  }).then(function(r) {
    console.log('apollcomics search status: ' + r.status);
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
      var itemUrl = (item.url || '').replace(/\/$/, '');
      var slugM = itemUrl.match(/\/manga\/([^\/]+)\/?$/);
      var slug = slugM ? slugM[1] : itemUrl.split('/').pop();
      if (seen[slug]) continue;
      seen[slug] = true;
      var title = _clean(item.title) || slug.replace(/-/g, ' ');
      results.push({
        id: slug,
        title: title,
        url: itemUrl + '/',
        cover: '',
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    return _fillCovers(results);
  });
}

function _fillCovers(results) {
  if (results.length === 0) return Promise.resolve(results);
  var promises = results.map(function(item) {
    return fetch(item.url).then(function(r) {
      if (r.status !== 200) return item;
      var html = r.body || '';
      var coverM = html.match(/<img[^>]+src="([^"]*wp-content\/uploads[^"]*)"/);
      if (coverM) item.cover = coverM[1];
      return item;
    }).catch(function() {
      return item;
    });
  });
  return Promise.all(promises);
}

function _browseHomepage() {
  var url = SITE + '/manga/';
  console.log('apollcomics browse url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var seen = {};
    var re = /href="https?:\/\/apollcomics\.es\/manga\/([^\/"]+)\/"/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      var slug = m[1];
      if (seen[slug]) continue;
      seen[slug] = true;
      var block = html.substring(Math.max(0, m.index - 500), m.index + m[0].length + 500);
      var title = slug.replace(/-/g, ' ');
      var titleM = block.match(/<[^>]+title="([^"]+)"[^>]*>/);
      if (titleM) title = _clean(titleM[1]);
      var cover = '';
      var coverM = block.match(/src="([^"]*wp-content\/uploads[^"]*)"/);
      if (coverM) cover = coverM[1];
      results.push({
        id: slug,
        title: title,
        url: SITE + '/manga/' + slug + '/',
        cover: cover,
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('apollcomics browse count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('apollcomics detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/manga\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var cover = '';
    var coverRe = /<img[^>]+src="([^"]*wp-content\/uploads[^"]*)"/g;
    var cm;
    while ((cm = coverRe.exec(html)) !== null) {
      cover = cm[1];
      break;
    }

    var title = slug.replace(/-/g, ' ');
    var titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (titleM) title = _clean(titleM[1]) || title;
    if (!title) {
      var metaTitleM = html.match(/<title>([^<]+)/);
      if (metaTitleM) title = _clean(metaTitleM[1].split('-')[0]);
    }

    var descM = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    if (!descM) descM = html.match(/<div[^>]+class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    var statusM = html.match(/(?:status|estado)[^<]*?<[^>]*>([^<]+)/i);
    if (statusM) status = _normalizeStatus(_clean(statusM[1]));
    if (status === 'unknown') {
      if (/en curso/i.test(html)) status = 'ongoing';
      else if (/completado/i.test(html)) status = 'completed';
    }

    var authors = [];
    var authM = html.match(/(?:autor|author)[^<]*?<[^>]*>([\s\S]*?)<\/(?:a|span|div)>/i);
    if (authM) {
      authors = authM[1].split(/,/).map(function(s) { return _clean(s); }).filter(Boolean);
    }
    if (authors.length === 0) {
      var authRe = /<a[^>]+href="[^"]*(?:autor|author)[^"]*"[^>]*>([^<]+)<\/a>/gi;
      var am;
      while ((am = authRe.exec(html)) !== null) {
        var a = _clean(am[1]);
        if (a && authors.indexOf(a) === -1) authors.push(a);
      }
    }

    var genres = [];
    var gRe = /<a[^>]+href="[^"]*\/genre\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }
    if (genres.length === 0) {
      gRe = /<a[^>]+href="[^"]*(?:genre|genero)[^"]*"[^>]*>([^<]+)<\/a>/gi;
      while ((gm = gRe.exec(html)) !== null) {
        var g2 = _clean(gm[1]);
        if (g2 && genres.indexOf(g2) === -1) genres.push(g2);
      }
    }

    var chapters = [];
    var chSeen = {};
    var chRe = /href="(https?:\/\/apollcomics\.es\/manga\/[^\/]+\/[^\/"#]+\/?)"/g;
    var chm;
    while ((chm = chRe.exec(html)) !== null) {
      var chLink = chm[1];
      if (/\/feed\//.test(chLink)) continue;
      if (chLink === url || chLink === url.replace(/\/$/, '')) continue;
      var chSlug = chLink.replace(/\/$/, '').split('/').pop();
      if (chSlug === slug) continue;
      if (chSeen[chLink]) continue;
      chSeen[chLink] = true;
      var chTitle = chSlug.replace(/-/g, ' ');
      var numMatch = chSlug.match(/(\d+(?:\.\d+)?)/);
      var num = numMatch ? parseFloat(numMatch[1]) : null;
      chapters.push({
        id: chSlug,
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: chLink.replace(/\/$/, '') + '/',
        date: ''
      });
    }

    console.log('apollcomics detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
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
  console.log('apollcomics pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var seen = {};

    var dataSrcRe = /data-src="(\s*)(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g;
    var dm;
    while ((dm = dataSrcRe.exec(html)) !== null) {
      var imgUrl = dm[2].trim();
      if (seen[imgUrl]) continue;
      seen[imgUrl] = true;
      out.push({ url: imgUrl, index: out.length });
    }

    if (out.length === 0) {
      var srcRe = /<img[^>]+class="[^"]*wp-manga-chapter-img[^"]*"[^>]+src="([^"]+)"/g;
      var sm;
      while ((sm = srcRe.exec(html)) !== null) {
        var imgUrl2 = sm[1].trim();
        if (seen[imgUrl2]) continue;
        seen[imgUrl2] = true;
        out.push({ url: imgUrl2, index: out.length });
      }
    }

    if (out.length === 0) {
      var srcRe2 = /src="([^"]*"(?:jpg|jpeg|png|webp)[^"]*)"/g;
      var imgBlockRe = /<img[^>]+class="[^"]*wp-manga-chapter-img[^"]*"[^>]*>/g;
      var ibm;
      while ((ibm = imgBlockRe.exec(html)) !== null) {
        var tag = ibm[0];
        var srcM = tag.match(/(?:src|data-src)="([^"]+)"/);
        if (srcM) {
          var imgUrl3 = srcM[1].trim();
          if (!seen[imgUrl3]) {
            seen[imgUrl3] = true;
            out.push({ url: imgUrl3, index: out.length });
          }
        }
      }
    }

    console.log('apollcomics pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'ApollComics is a manga-only source.', nextUrl: null };
}
