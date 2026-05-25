var SOURCE_ID = 'kuaikan';
var SITE = 'https://www.kuaikanmanhua.com';

function getInfo() {
  return {
    name: '快看漫画',
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
  console.log('kuaikan: no public search API, browsing homepage');
  return _browseHomepage();
}

function _browseHomepage() {
  console.log('kuaikan browse homepage');
  return fetch(SITE + '/').then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var seen = {};
    var re = /href="\/web\/topic\/(\d+)"[\s\S]*?src="(https:\/\/[^"]*kkmh\.com\/image\/[^"]+)"[\s\S]*?class="itemTitle"[^>]*>([\s\S]*?)<\/span>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      var id = m[1];
      if (seen[id]) continue;
      seen[id] = true;
      var title = _clean(m[3]) || ('Topic ' + id);
      results.push({
        id: id,
        title: title,
        url: SITE + '/web/topic/' + id,
        cover: m[2],
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    console.log('kuaikan browse results: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('kuaikan detail: ' + url);
  var topicIdM = url.match(/\/web\/topic\/(\d+)/);
  var topicId = topicIdM ? topicIdM[1] : '';
  if (!topicId) return Promise.reject(new Error('Invalid topic URL'));

  var apiUrl = SITE + '/v2/pweb/topic/' + topicId;
  return fetch(apiUrl).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    var json;
    try { json = JSON.parse(r.body); } catch(e) { throw new Error('JSON parse error'); }
    var info = json.data && json.data.topic_info;
    if (!info) throw new Error('No topic info');

    var title = info.title || '';
    var author = info.author && info.author.name ? info.author.name : '';
    var cover = info.cover_image_url || '';
    var description = info.description || '';

    var status = 'unknown';
    if (info.is_finish === true || info.is_finish === 1) status = 'completed';
    else status = 'ongoing';

    var genres = [];
    if (info.tag && info.tag.name) genres.push(info.tag.name);

    var chapters = [];
    var comics = info.comics || [];
    for (var i = comics.length - 1; i >= 0; i--) {
      var c = comics[i];
      if (c.locked) continue;
      chapters.push({
        id: '' + c.id,
        title: c.title || ('Ch. ' + (i + 1)),
        number: i + 1,
        url: SITE + '/web/comic/' + c.id,
        date: c.created_at || ''
      });
    }
    chapters.reverse();

    console.log('kuaikan detail: ' + title + ' chapters=' + chapters.length);
    return {
      id: topicId,
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
  console.log('kuaikan pages: ' + chapterUrl);
  var comicIdM = chapterUrl.match(/\/web\/comic\/(\d+)/);
  var comicId = comicIdM ? comicIdM[1] : '';
  if (!comicId) return Promise.resolve([]);

  var apiUrl = SITE + '/v2/pweb/comic/' + comicId;
  return fetch(apiUrl).then(function(r) {
    if (r.status !== 200) return [];
    var json;
    try { json = JSON.parse(r.body); } catch(e) { return []; }
    var images = json.data && json.data.comic_info && json.data.comic_info.comic_images;
    if (!images) return [];

    var pages = [];
    for (var i = 0; i < images.length; i++) {
      var imgUrl = images[i].url1280 || images[i].url || '';
      if (imgUrl) {
        pages.push({ url: imgUrl, index: i });
      }
    }
    console.log('kuaikan pages: ' + pages.length);
    return pages;
  });
}

function getChapterContent(chapterUrl) {
  return { text: '快看漫画 is a manga-only source.', nextUrl: null };
}
