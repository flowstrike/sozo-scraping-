var SOURCE_ID = 'baozimh';
var SITE = 'https://www.baozimh.com';

function getInfo() {
  return {
    name: '包子漫画',
    lang: 'zh',
    baseUrl: SITE,
    logo: SITE + '/favicon.ico',
    type: 'manga',
    version: '1.0.0'
  };
}

function _clean(s) {
  return htmlText(s || '').replace(/\s+/g, ' ').trim();
}

function search(query, page, opts) {
  var q = (query || '').trim();
  if (!q) return _browseHomepage();
  var url = SITE + '/search?q=' + encodeURIComponent(q);
  console.log('baozimh search: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) return [];
    return _parseCards(r.body || '');
  });
}

function _browseHomepage() {
  console.log('baozimh browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    return _parseCards(r.body || '');
  });
}

function _parseCards(html) {
  var results = [];
  var seen = {};
  var re = /href="\/comic\/([^"]+)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?src="(https:\/\/static-tw\.baozimh\.com\/cover\/[^"]+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var slug = m[1];
    if (seen[slug]) continue;
    seen[slug] = true;
    var title = _clean(m[2]) || slug.replace(/-/g, ' ');
    results.push({
      id: slug,
      title: title,
      url: SITE + '/comic/' + slug,
      cover: m[3],
      sourceId: SOURCE_ID,
      type: 'manga'
    });
  }
  if (results.length === 0) {
    var re2 = /href="\/comic\/([^"]+)"[\s\S]*?title="([^"]*)"[\s\S]*?src="(https:\/\/static-tw\.baozimh\.com\/cover\/[^"]+)"/g;
    while ((m = re2.exec(html)) !== null) {
      var slug2 = m[1];
      if (seen[slug2]) continue;
      seen[slug2] = true;
      results.push({
        id: slug2,
        title: _clean(m[2]) || slug2.replace(/-/g, ' '),
        url: SITE + '/comic/' + slug2,
        cover: m[3],
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
  }
  console.log('baozimh results: ' + results.length);
  return results;
}

function getDetail(url) {
  console.log('baozimh detail: ' + url);
  return fetch(url).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var html = r.body || '';

    var slugM = url.match(/\/comic\/([^\/?]+)/);
    var slug = slugM ? slugM[1] : '';

    var titleM = html.match(/class="comics-detail__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
    var title = titleM ? _clean(titleM[1]) : slug.replace(/-/g, ' ');

    var authorM = html.match(/class="comics-detail__author[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
    var author = authorM ? _clean(authorM[1]) : '';

    var coverM = html.match(/src="(https:\/\/static-tw\.baozimh\.com\/cover\/[^"]+\.jpg[^"]*)"/);
    var cover = coverM ? coverM[1] : '';

    var descM = html.match(/class="comics-detail__desc[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    var description = descM ? _clean(descM[1]) : '';

    var status = 'unknown';
    if (/連載中|连载中/.test(html)) status = 'ongoing';
    else if (/已完結|已完结/.test(html)) status = 'completed';

    var genres = [];
    var gRe = /class="tag[^"]*">([^<]+)<\/span>/g;
    var gm;
    while ((gm = gRe.exec(html)) !== null) {
      var g = _clean(gm[1]);
      if (g && genres.indexOf(g) === -1) genres.push(g);
    }

    var chapters = [];
    var chRe = /href="([^"]+)"[^>]*class="comics-chapters__item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chUrl = cm[1].replace(/&amp;/g, '&');
      var chInner = cm[2];
      var chTitleM = chInner.match(/<span[^>]*>([\s\S]*?)<\/span>/);
      var chTitle = chTitleM ? _clean(chTitleM[1]) : '';
      if (!chTitle) chTitle = 'Ch. ' + (chapters.length + 1);
      var numM = chTitle.match(/(\d+(?:\.\d+)?)/);
      chapters.push({
        id: chUrl.indexOf('http') === 0 ? chUrl : SITE + chUrl,
        title: chTitle,
        number: numM ? parseFloat(numM[1]) : chapters.length + 1,
        url: chUrl.indexOf('http') === 0 ? chUrl : SITE + chUrl,
        date: ''
      });
    }

    console.log('baozimh detail: ' + title + ' chapters=' + chapters.length);
    return {
      id: slug,
      sourceId: SOURCE_ID,
      title: title,
      cover: cover,
      url: url,
      author: author,
      authors: author ? [author] : [],
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
  console.log('baozimh pages: ' + chapterUrl);
  return fetch(chapterUrl).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var pages = [];
    var re = /<amp-img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"[^>]*>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      pages.push({ url: m[1], index: pages.length });
    }
    if (pages.length === 0) {
      var re2 = /<img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"[^>]*>/g;
      while ((m = re2.exec(html)) !== null) {
        pages.push({ url: m[1], index: pages.length });
      }
    }
    console.log('baozimh pages: ' + pages.length);
    return pages;
  });
}

function getChapterContent(chapterUrl) {
  return { text: '包子漫画 is a manga-only source.', nextUrl: null };
}
