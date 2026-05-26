var SOURCE_ID = 'herenscan';
var SITE = 'https://herenscan.com';

function getInfo() {
  return {
    name: 'HerenScan',
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
  var url = SITE + '/?s=' + encodeURIComponent(q) + '&post_type=wp-manga';
  console.log('herenscan search url: ' + url);
  return fetch(url).then(function(r) {
    console.log('herenscan search status: ' + r.status);
    if (r.status !== 200) return [];
    var html = r.body || '';
    return _parseSearchResults(html);
  });
}

function _browseHomepage() {
  var url = SITE + '/manga/';
  console.log('herenscan browse homepage: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    return _parseSearchResults(html);
  });
}

function _parseSearchResults(html) {
  var results = [];
  var re = /href="https?:\/\/herenscan\.com\/manga\/([^\/]+)\/"/g;
  var seen = {};
  var m;
  while ((m = re.exec(html)) !== null) {
    var slug = m[1];
    if (slug === 'feed') continue;
    if (seen[slug]) continue;
    seen[slug] = true;

    var start = m.index;
    var blockStart = html.lastIndexOf('<div', start);
    var blockEnd = html.indexOf('</div>', start);
    if (blockEnd === -1) blockEnd = html.indexOf('</a>', start);
    var block = blockStart >= 0 ? html.substring(blockStart, blockEnd + 6) : html.substring(start - 500, start + 500);

    var titleM = block.match(/<img[^>]+alt="([^"]+)"/);
    if (!titleM) {
      var context = html.substring(Math.max(0, start - 300), start + m[0].length + 100);
      titleM = context.match(/title="([^"]+)"/);
    }
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var coverM = block.match(/<img[^>]+src="([^"]+)"/);
    if (!coverM) {
      var ctx2 = html.substring(Math.max(0, start - 500), start + m[0].length + 200);
      coverM = ctx2.match(/<img[^>]+src="([^"]+)"/);
    }
    var cover = coverM ? coverM[1].trim() : '';

    results.push({
      id: slug,
      title: title,
      url: SITE + '/manga/' + slug + '/',
      cover: cover,
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  console.log('herenscan search count: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('herenscan detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/manga\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var titleM = html.match(/<title>([^<]+?)(?:\s*[–\-]\s*Heren[^<]*)?<\/title>/i);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var coverM = html.match(/<img[^>]+src="([^"]*wp-content\/uploads[^"]+)"/);
    var cover = coverM ? coverM[1].trim() : '';

    var descM = html.match(/<div[^>]+class="manga-excerpt[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!descM) descM = html.match(/<div[^>]+class="description-summary[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    var statusM = html.match(/class="summary-heading"[^>]*>[\s\S]*?Autor[\s\S]*?<\/div>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i);
    if (!statusM) statusM = html.match(/<[^>]*>(En curso|Completado|Ongoing|Completed)<\/[^>]+>/i);
    if (statusM) status = _normalizeStatus(statusM[1]);
    if (status === 'unknown') {
      if (/En curso/i.test(html)) status = 'ongoing';
      else if (/Completado/i.test(html)) status = 'completed';
    }

    var authors = [];
    var authM = html.match(/Autor[^<]*<\/[^>]+>[\s\S]*?<a[^>]+>([^<]+)<\/a>/i);
    if (!authM) authM = html.match(/Autor[\s\S]*?<a[^>]+>([\s\S]*?)<\/a>/i);
    if (authM) authors = authM[1].split(/,/).map(function(s) { return _clean(s); }).filter(Boolean);

    var genres = [];
    var gRe = /<a[^>]+href="[^"]*\/manga-genre\/[^"]+[^>]*>([\s\S]*?)<\/a>/gi;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chSeen = {};
    var chRe = /href="(https?:\/\/herenscan\.com\/manga\/([^\/]+)\/capitulo-([^\/]+)\/)"/gi;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chUrl = cm[1];
      var chSlug = cm[2];
      var chNumRaw = cm[3];
      if (chSeen[chUrl]) continue;
      chSeen[chUrl] = true;
      var numMatch = chNumRaw.match(/(\d+(?:\.\d+)?)/);
      var num = numMatch ? parseFloat(numMatch[1]) : null;

      var titleContext = html.substring(Math.max(0, cm.index - 200), cm.index);
      var chTitleM = titleContext.match(/>([^<]{3,})<\s*$/);
      var chTitle = chTitleM ? _clean(chTitleM[1]) : 'Capitulo ' + chNumRaw;
      if (chTitle.indexOf('capitulo') === -1 && chTitle.indexOf('Capitulo') === -1 && chTitle.indexOf('Capítulo') === -1) {
        chTitle = 'Capitulo ' + chNumRaw;
      }

      chapters.push({
        id: 'capitulo-' + chNumRaw,
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: chUrl,
        date: ''
      });
    }

    if (chapters.length === 0) {
      var chRe2 = /href="([^"]*\/manga\/[^\/]+\/[^"]*capitulo[^"]*\/)"/gi;
      while ((cm = chRe2.exec(html)) !== null) {
        var chUrl2 = cm[1];
        if (chSeen[chUrl2]) continue;
        chSeen[chUrl2] = true;
        var numM2 = chUrl2.match(/capitulo-?(\d+(?:\.\d+)?)/i);
        var num2 = numM2 ? parseFloat(numM2[1]) : null;
        var chNumLabel = numM2 ? numM2[1] : '?';
        chapters.push({
          id: 'capitulo-' + chNumLabel,
          title: 'Capitulo ' + chNumLabel,
          number: isNaN(num2) ? null : num2,
          url: chUrl2,
          date: ''
        });
      }
    }

    chapters.reverse();

    console.log('herenscan detail: title=' + title + ' chapters=' + chapters.length + ' status=' + status);
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
  console.log('herenscan pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var out = [];

    var re = /class="wp-manga-chapter-img"[^>]*src="\s*([^"]+)"/g;
    var matches = _allMatches(html, re);
    if (matches.length === 0) {
      re = /<img[^>]+class="[^"]*wp-manga-chapter-img[^"]*"[^>]*src="\s*([^"]+)"/g;
      matches = _allMatches(html, re);
    }
    if (matches.length === 0) {
      re = /src="\s*(https?:\/\/herenscan\.com\/wp-content\/uploads\/[^\s"]+\.(?:jpg|jpeg|png|webp))"/g;
      matches = _allMatches(html, re);
    }
    if (matches.length === 0) {
      re = /class="page-break[^"]*"[^>]*>[\s\S]*?<img[^>]+src="\s*([^"]+)"/g;
      matches = _allMatches(html, re);
    }

    for (var i = 0; i < matches.length; i++) {
      var imgUrl = matches[i][1].trim();
      if (imgUrl) {
        out.push({
          url: imgUrl,
          index: i
        });
      }
    }
    console.log('herenscan pages count: ' + out.length);
    return out;
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'HerenScan is a manga-only source.', nextUrl: null };
}
