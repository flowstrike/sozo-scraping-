var SOURCE_ID = 'ehentai';
var SITE = 'https://e-hentai.org';

function getInfo() {
  return {
    name: 'E-Hentai',
    lang: 'en',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/\s+/g, ' ').trim();
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

function search(query, page, opts) {
  page = page || 1;
  var q = (query || '').trim();
  if (!q) q = '';
  var url = SITE + '/?f_search=' + encodeURIComponent(q) + (page > 1 ? '&page=' + (page - 1) : '');
  console.log('ehentai search url: ' + url);
  return fetch(url).then(function(r) {
    console.log('ehentai search status: ' + r.status);
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var idx = 0;
    var seen = {};
    while (true) {
      var pos = html.indexOf('class="glink">', idx);
      if (pos === -1) break;
      var end = html.indexOf('<', pos + 14);
      var title = html.substring(pos + 14, end).trim();
      var chunk = html.substring(Math.max(0, pos - 1500), pos);
      var hrefM = chunk.match(/href="(https:\/\/e-hentai\.org\/g\/(\d+)\/([a-f0-9]+)\/?)"/);
      var imgM = chunk.match(/src="(https:\/\/ehgt\.org\/[^"]+)"/) || chunk.match(/src="(https:\/\/ul\.ehgt\.org\/[^"]+)"/);
      if (hrefM && !seen[hrefM[1]]) {
        seen[hrefM[1]] = true;
        var gUrl = hrefM[1];
        var gId = hrefM[2];
        results.push({
          id: gId,
          title: title,
          url: gUrl,
          cover: imgM ? imgM[1] : '',
          sourceId: SOURCE_ID,
          type: 'manga'
        });
      }
      idx = end + 1;
    }
    console.log('ehentai search count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('ehentai detail url: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var titleM = html.match(/<h1 id="gn">([^<]+)<\/h1>/);
    var title = titleM ? titleM[1].trim() : '';

    var coverM = html.match(/gd1"><div[^>]*background:\s*transparent\s*url\(([^)]+)\)/);
    var cover = coverM ? coverM[1] : '';

    var descM = html.match(/<h1 id="gj">([^<]+)<\/h1>/);
    var description = descM ? descM[1].trim() : '';

    var countM = html.match(/Length:<\/td><td[^>]*>(\d+)\s*pages/);
    var pageCount = countM ? parseInt(countM[1], 10) : 0;

    var genres = [];
    var gRe = /<td class="tc[^"]*">([^<:]+):<\/td>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = gm[1].trim().toLowerCase();
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var numChapters = Math.ceil(pageCount / 40) || 1;
    for (var ci = 0; ci < numChapters; ci++) {
      var chUrl = url + (ci > 0 ? '?p=' + ci : '');
      var chTitle = numChapters === 1 ? (title || 'Gallery') : ('Part ' + (ci + 1));
      chapters.push({
        id: '' + (ci + 1),
        title: chTitle,
        number: ci + 1,
        url: chUrl,
        date: ''
      });
    }

    var idM = url.match(/\/g\/(\d+)\//);
    var id = idM ? idM[1] : url;

    console.log('ehentai detail: title=' + title + ' pages=' + pageCount + ' chapters=' + numChapters);
    return {
      id: id,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: '',
      authors: [],
      status: 'completed',
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

function _extractPageLinks(html) {
  var links = [];
  var re = /href="(https:\/\/e-hentai\.org\/s\/[^"]+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    if (links.indexOf(m[1]) === -1) links.push(m[1]);
  }
  return links;
}

function getPages(chapterUrl) {
  console.log('ehentai pages url: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var pageLinks = _extractPageLinks(html);
    console.log('ehentai found ' + pageLinks.length + ' page links, fetching images...');

    var promises = pageLinks.map(function(link, idx) {
      return fetch(link).then(function(pr) {
        var phtml = pr.body || '';
        var imgM = phtml.match(/id="img"[^>]*src="([^"]+)"/);
        return {
          url: imgM ? imgM[1] : '',
          index: idx,
          headers: { Referer: SITE + '/' }
        };
      }).catch(function() {
        return { url: '', index: idx };
      });
    });

    return Promise.all(promises).then(function(pages) {
      var valid = pages.filter(function(p) { return p.url.length > 0; });
      console.log('ehentai pages count: ' + valid.length);
      return valid;
    });
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'E-Hentai is a manga-only source.', nextUrl: null };
}
