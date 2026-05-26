var SOURCE_ID = 'mundomanhwa';
var SITE = 'https://mundomanhwa.com';

function getInfo() {
  return {
    name: 'MundoManhwa',
    lang: 'es',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
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
  console.log('mundomanhwa search url: ' + url + ' q: ' + q);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  }).then(function(r) {
    console.log('mundomanhwa search status: ' + r.status);
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
    console.log('mundomanhwa search count: ' + results.length);
    return results;
  });
}

function _browseHomepage() {
  var url = SITE + '/manga/';
  console.log('mundomanhwa browse url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var seen = {};
    var re = /href="https?:\/\/mundomanhwa\.com\/manga\/([^\/]+)\/"[^>]*>([\s\S]*?)<\/a>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      var slug = m[1];
      if (seen[slug]) continue;
      seen[slug] = true;
      var rawTitle = m[2];
      var title = _clean(rawTitle);
      if (!title) title = slug.replace(/-/g, ' ');
      var cover = '';
      var coverRe = new RegExp('href="https?://mundomanhwa\\.com/manga/' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/"[\\s\\S]*?<img[^>]+src="([^"]*wp-content/uploads[^"]*)"', 'i');
      var coverM = html.match(coverRe);
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
    console.log('mundomanhwa browse count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('mundomanhwa detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/manga\/([^\/]+)/);
    var slug = slugM ? slugM[1] : '';

    var cover = '';
    var coverRe = /<img[^>]+src="([^"]*wp-content\/uploads[^"]*)"[^>]*>/g;
    var cm;
    while ((cm = coverRe.exec(html)) !== null) {
      var candidate = cm[1];
      if (candidate.indexOf('cover') !== -1 || candidate.indexOf('featured') !== -1 || !cover) {
        cover = candidate;
      }
    }

    var titleM = html.match(/<h1[^>]*class="[^"]*post-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var descM = html.match(/<div[^>]*class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    var statusRe = /(?:Estado|Status)[\s\S]*?<[^>]*>([\s\S]*?)<\/[^>]+>/i;
    var statusM = html.match(statusRe);
    if (statusM) status = _normalizeStatus(_clean(statusM[1]));
    if (status === 'unknown') {
      if (/en curso/i.test(html)) status = 'ongoing';
      else if (/completado/i.test(html)) status = 'completed';
    }

    var authors = [];
    var authRe = /(?:Autor|Author)[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;
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
    var chRe = /href="(https?:\/\/mundomanhwa\.com\/manga\/[^\/]+\/([^"]+))\/"/g;
    var chm;
    while ((chm = chRe.exec(html)) !== null) {
      var chUrl = chm[1];
      var chSlug = chm[2];
      if (chSlug === slug) continue;
      if (chSlug === 'feed') continue;
      if (/\/feed\//.test(chUrl)) continue;
      if (chSeen[chUrl]) continue;
      chSeen[chUrl] = true;
      var chTitle = chSlug.replace(/-/g, ' ');
      var numM = chSlug.match(/(\d+(?:\.\d+)?)/);
      var num = numM ? parseFloat(numM[1]) : null;
      chapters.push({
        id: chSlug,
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: chUrl,
        date: ''
      });
    }

    chapters.sort(function(a, b) {
      return (b.number || 0) - (a.number || 0);
    });

    console.log('mundomanhwa detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
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
  console.log('mundomanhwa pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];
    var seen = {};
    var re = /<img[^>]+class="[^"]*wp-manga-chapter-img[^"]*"[^>]*>/g;
    var imgRe = /data-src="([^"]+)"|src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var imgTag = m[0];
      var imgUrl = '';
      var dsM = imgTag.match(/data-src="([^"]+)"/);
      if (dsM) {
        imgUrl = dsM[1].trim();
      }
      if (!imgUrl) {
        var sM = imgTag.match(/src="([^"]+)"/);
        if (sM) imgUrl = sM[1].trim();
      }
      if (!imgUrl) continue;
      if (seen[imgUrl]) continue;
      seen[imgUrl] = true;
      out.push({ url: imgUrl, index: out.length });
    }
    if (out.length === 0) {
      var fallbackRe = /data-src="(https?:\/\/cdn\d*\.mundomanhwa\.com\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
      var fm;
      while ((fm = fallbackRe.exec(html)) !== null) {
        var fUrl = fm[1].trim();
        if (seen[fUrl]) continue;
        seen[fUrl] = true;
        out.push({ url: fUrl, index: out.length });
      }
    }
    console.log('mundomanhwa pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'MundoManhwa es una fuente solo de manga.', nextUrl: null };
}
