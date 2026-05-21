var SOURCE_ID = 'mangago';
var SITE = 'https://www.mangago.me';
var REFERER = SITE + '/';

function getInfo() {
  return {
    name: 'Mangago',
    lang: 'en',
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
  if (s.indexOf('ongoing') !== -1) return 'ongoing';
  if (s.indexOf('completed') !== -1) return 'completed';
  if (s.indexOf('hiatus') !== -1) return 'hiatus';
  if (s.indexOf('cancelled') !== -1 || s.indexOf('discontinued') !== -1) return 'cancelled';
  return 'unknown';
}

var _sbox = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];

var _invSbox = [
  0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
  0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
  0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
  0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
  0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
  0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
  0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
  0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
  0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
  0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
  0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
  0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
  0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
  0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
  0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
  0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d
];

var _rcon = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

function _subWord(w) {
  return [_sbox[w[0]], _sbox[w[1]], _sbox[w[2]], _sbox[w[3]]];
}

function _rotWord(w) {
  return [w[1], w[2], w[3], w[0]];
}

function _xorWords(a, b) {
  return [a[0]^b[0], a[1]^b[1], a[2]^b[2], a[3]^b[3]];
}

function _keyExpansion(key) {
  var nk = 4;
  var nr = 10;
  var w = [];
  var i;
  for (i = 0; i < nk; i++) {
    w[i] = [key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]];
  }
  for (i = nk; i < 4*(nr+1); i++) {
    var temp = w[i-1].slice();
    if (i % nk === 0) {
      temp = _xorWords(_subWord(_rotWord(temp)), [_rcon[i/nk-1], 0, 0, 0]);
    }
    w[i] = _xorWords(w[i-nk], temp);
  }
  return w;
}

function _invSubBytes(s) {
  for (var i = 0; i < 4; i++)
    for (var j = 0; j < 4; j++)
      s[i][j] = _invSbox[s[i][j]];
}

function _invShiftRows(s) {
  var t;
  t = s[1][0]; s[1][0] = s[1][1]; s[1][1] = s[1][2]; s[1][2] = s[1][3]; s[1][3] = t;
  t = s[2][0]; s[2][0] = s[2][2]; s[2][2] = t;
  t = s[2][1]; s[2][1] = s[2][3]; s[2][3] = t;
  t = s[3][0]; s[3][0] = s[3][3]; s[3][3] = s[3][2]; s[3][2] = s[3][1]; s[3][1] = t;
}

function _gmul(a, b) {
  var p = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    var hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function _invMixColumns(s) {
  for (var i = 0; i < 4; i++) {
    var a = [s[0][i], s[1][i], s[2][i], s[3][i]];
    s[0][i] = _gmul(a[0],0x0e) ^ _gmul(a[1],0x0b) ^ _gmul(a[2],0x0d) ^ _gmul(a[3],0x09);
    s[1][i] = _gmul(a[0],0x09) ^ _gmul(a[1],0x0e) ^ _gmul(a[2],0x0b) ^ _gmul(a[3],0x0d);
    s[2][i] = _gmul(a[0],0x0d) ^ _gmul(a[1],0x09) ^ _gmul(a[2],0x0e) ^ _gmul(a[3],0x0b);
    s[3][i] = _gmul(a[0],0x0b) ^ _gmul(a[1],0x0d) ^ _gmul(a[2],0x09) ^ _gmul(a[3],0x0e);
  }
}

function _addRoundKey(s, rk) {
  for (var i = 0; i < 4; i++)
    for (var j = 0; j < 4; j++)
      s[j][i] ^= rk[i][j];
}

function _bytesToState(b) {
  return [[b[0],b[4],b[8],b[12]],[b[1],b[5],b[9],b[13]],[b[2],b[6],b[10],b[14]],[b[3],b[7],b[11],b[15]]];
}

function _stateToBytes(s) {
  return [s[0][0],s[1][0],s[2][0],s[3][0],s[0][1],s[1][1],s[2][1],s[3][1],s[0][2],s[1][2],s[2][2],s[3][2],s[0][3],s[1][3],s[2][3],s[3][3]];
}

function _aesDecryptBlock(block, w) {
  var s = _bytesToState(block);
  _addRoundKey(s, w.slice(40, 44));
  for (var r = 9; r >= 1; r--) {
    _invShiftRows(s);
    _invSubBytes(s);
    _addRoundKey(s, w.slice(r*4, r*4+4));
    _invMixColumns(s);
  }
  _invShiftRows(s);
  _invSubBytes(s);
  _addRoundKey(s, w.slice(0, 4));
  return _stateToBytes(s);
}

function _hexToBytes(hex) {
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function _b64ToBytes(b64) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var bytes = [];
  var buf = 0, bits = 0;
  for (var i = 0; i < b64.length; i++) {
    var c = chars.indexOf(b64.charAt(i));
    if (c === -1) continue;
    buf = (buf << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return bytes;
}

function _decryptAesCbc(ciphertext, keyHex, ivHex) {
  var key = _hexToBytes(keyHex);
  var iv = _hexToBytes(ivHex);
  var w = _keyExpansion(key);
  var plaintext = [];
  for (var i = 0; i < ciphertext.length; i += 16) {
    var block = ciphertext.slice(i, i + 16);
    var dec = _aesDecryptBlock(block, w);
    for (var j = 0; j < 16; j++) {
      dec[j] ^= iv[j];
    }
    plaintext = plaintext.concat(dec);
    iv = block;
  }
  while (plaintext.length > 0 && plaintext[plaintext.length - 1] === 0) {
    plaintext.pop();
  }
  var result = '';
  for (i = 0; i < plaintext.length; i++) {
    result += String.fromCharCode(plaintext[i]);
  }
  return result;
}

function _decryptImgsrcs(imgsrcs) {
  var ciphertext = _b64ToBytes(imgsrcs);
  var plaintext = _decryptAesCbc(ciphertext, 'e11adc3949ba59abbe56e057f20f883e', '1234567890abcdef1234567890abcdef');
  var parts = plaintext.split(',');
  var urls = [];
  for (var i = 0; i < parts.length - 1; i++) {
    if (parts[i].indexOf('cspiclink') < 0 && parts[i].length > 0) {
      if (parts[i].indexOf('http') === 0) {
        urls.push(parts[i]);
      }
    }
  }
  return urls;
}

function search(query, page, opts) {
  page = page || 1;
  var url = SITE + '/r/l_search/?name=' + encodeURIComponent(query) + (page > 1 ? '&page=' + page : '');
  console.log('mangago search url: ' + url);
  return fetch(url, { headers: { Referer: REFERER } }).then(function(r) {
    console.log('mangago search status: ' + r.status);
    if (r.status !== 200) return [];
    var html = r.body || '';
    var results = [];
    var re = /<a[^>]+href="(https?:\/\/www\.mangago\.me\/read-manga\/[^\/]+\/)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<span[^>]*>([^<]+)<\/span>/g;
    var matches = _allMatches(html, re);
    if (matches.length === 0) {
      re = /<a[^>]+href="(\/read-manga\/[^\/]+\/)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>/g;
      matches = _allMatches(html, re);
    }
    var seen = {};
    for (var i = 0; i < matches.length; i++) {
      var link = matches[i][1];
      var cover = matches[i][2];
      var title = matches.length > 3 ? _clean(matches[i][3]) : '';
      if (seen[link]) continue;
      seen[link] = true;
      if (link.charAt(0) === '/') link = SITE + link;
      var slugM = link.match(/\/read-manga\/([^\/]+)\//);
      var id = slugM ? slugM[1] : link;
      if (!title) {
        var titleM2 = id.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        title = titleM2;
      }
      results.push({
        id: id,
        title: title,
        url: link,
        cover: cover,
        sourceId: SOURCE_ID,
        type: 'manga'
      });
    }
    if (results.length === 0) {
      re = /<div[^>]*class="[^"]*left[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]*\/read-manga\/[^\/]+\/)[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>/g;
      matches = _allMatches(html, re);
      for (i = 0; i < matches.length; i++) {
        link = matches[i][1];
        cover = matches[i][2];
        title = _clean(matches[i][3]);
        if (seen[link]) continue;
        seen[link] = true;
        if (link.charAt(0) === '/') link = SITE + link;
        slugM = link.match(/\/read-manga\/([^\/]+)\//);
        id = slugM ? slugM[1] : link;
        results.push({
          id: id,
          title: title,
          url: link,
          cover: cover,
          sourceId: SOURCE_ID,
          type: 'manga'
        });
      }
    }
    console.log('mangago search count: ' + results.length);
    return results;
  });
}

function getDetail(url) {
  console.log('mangago detail url: ' + url);
  return fetch(url, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) throw new Error('detail HTTP ' + r.status);
    var html = r.body || '';

    var titleM = html.match(/<title>([^<]+)/);
    var rawTitle = titleM ? titleM[1] : '';
    var title = rawTitle.replace(/\s*manga\s*-?\s*Mangago\s*/i, '').trim() || rawTitle;

    var coverM = html.match(/<img[^>]+src="(https?:\/\/i\d+\.mangapicgallery\.com\/[^"]+)"/)
              || html.match(/property="og:image"\s+content="([^"]+)"/)
              || html.match(/<img[^>]+class="[^"]*cover[^"]*"[^>]+src="([^"]+)"/);
    var cover = coverM ? coverM[1] : '';

    var statusM = html.match(/Status:\s*<\/span>\s*<span[^>]*>([^<]+)/i)
              || html.match(/Status[^<]*<[^>]*>([^<]+)/i);
    var status = _normalizeStatus(statusM ? statusM[1] : '');

    var authors = [];
    var authM = html.match(/Author:\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
    if (authM) {
      var authParts = authM[1].replace(/<[^>]+>/g, '').split(/[,;]/);
      for (var ai = 0; ai < authParts.length; ai++) {
        var a = _clean(authParts[ai]);
        if (a) authors.push(a);
      }
    }

    var genres = [];
    var genreBlock = html.match(/Genre\(s\):\s*([\s\S]*?)(?:<\/div>|<\/li>|Alternative)/i);
    if (genreBlock) {
      var gRe = />([^<]+)<\/a>/g;
      var gm;
      while ((gm = gRe.exec(genreBlock[1])) !== null) {
        var g = _clean(gm[1]);
        if (g && genres.indexOf(g) === -1) genres.push(g);
      }
    }

    var descM = html.match(/Summary[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i)
             || html.match(/class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    var description = descM ? _clean(descM[1]) : '';

    var chapters = [];
    var chRe = /<a[^>]+href="(https?:\/\/www\.mangago\.me\/read-manga\/[^"]+\/(?:mdx|me)\/(?:d_|br_|to_)chapter-[^"]+\/pg-\d+\/?)"[^>]*>([\s\S]*?)<\/a>/g;
    var seen = {};
    var cm;
    while ((cm = chRe.exec(html)) !== null) {
      var chUrl = cm[1];
      var chInner = cm[2];
      if (seen[chUrl]) continue;
      seen[chUrl] = true;
      var dateM = chInner.match(/<small[^>]*>([^<]+)<\/small>/);
      var chDate = dateM ? _clean(dateM[1]) : '';
      var chTitleSrc = dateM ? chInner.replace(dateM[0], '') : chInner;
      var chTitle = _clean(chTitleSrc);
      if (!chTitle || chTitle.toLowerCase().indexOf('start reading') !== -1) continue;
      var numM = chTitle.match(/(?:chapter|ch\.?)\s*#?([0-9.]+)/i) || chUrl.match(/chapter-([0-9.]+)/i);
      var num = numM ? parseFloat(numM[1]) : null;
      var chIdM = chUrl.match(/\/((?:d_|br_|to_)chapter-\d+)\/pg-/);
      var chId = chIdM ? chIdM[1] : chUrl;
      chapters.push({
        id: chId,
        title: chTitle,
        number: isNaN(num) ? null : num,
        url: chUrl,
        date: chDate
      });
    }

    var slugM = url.match(/\/read-manga\/([^\/]+)/);
    var id = slugM ? slugM[1] : url;

    console.log('mangago detail: title=' + title + ' chapters=' + chapters.length);
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
  });
}

function getChapters(url) {
  return getDetail(url).then(function(detail) {
    return detail.chapters || [];
  });
}

function getPages(chapterUrl) {
  console.log('mangago pages url: ' + chapterUrl);
  return fetch(chapterUrl, { headers: { Referer: REFERER } }).then(function(r) {
    if (r.status !== 200) return [];
    var html = r.body || '';

    var totalPagesM = html.match(/var\s+total_pages\s*=\s*(\d+)/);
    var totalPages = totalPagesM ? parseInt(totalPagesM[1]) : 1;

    var midM = html.match(/var\s+mid\s*=\s*"([^"]+)"/);
    var hostM = html.match(/var\s+host\s*=\s*"([^"]+)"/);
    var mid = midM ? midM[1] : '';
    var host = hostM ? hostM[1] : 'mdx';

    var allUrls = [];

    function extractPageUrls(pageHtml) {
      var imgsrcsM = pageHtml.match(/var\s+imgsrcs\s*=\s*'([^']+)'/);
      if (!imgsrcsM) {
        imgsrcsM = pageHtml.match(/var\s+imgsrcs\s*=\s*"([^"]+)"/);
      }
      if (!imgsrcsM) return [];
      try {
        return _decryptImgsrcs(imgsrcsM[1]);
      } catch (e) {
        console.log('mangago decrypt error: ' + e.message);
        return [];
      }
    }

    var page1Urls = extractPageUrls(html);
    for (var i = 0; i < page1Urls.length; i++) {
      allUrls.push(page1Urls[i]);
    }

    if (totalPages <= 1) {
      console.log('mangago pages count: ' + allUrls.length);
      var out = [];
      for (i = 0; i < allUrls.length; i++) {
        out.push({ url: allUrls[i], index: i, headers: { Referer: REFERER } });
      }
      return out;
    }

    var curlM = html.match(/id="curl"[^>]*value="([^"]+)"/);
    var curlTemplate = curlM ? curlM[1] : '';

    var promises = [];
    for (var p = 2; p <= totalPages; p++) {
      var pageUrl;
      if (curlTemplate) {
        pageUrl = SITE + '/read-manga/' + mid + '/' + host + '/' + curlTemplate.replace('{page}', String(p));
      } else {
        pageUrl = chapterUrl.replace(/\/pg-\d+\/?/, '/pg-' + p + '/');
      }
      promises.push(
        fetch(pageUrl, { headers: { Referer: REFERER } }).then(function(pr) {
          if (pr.status !== 200) return [];
          return extractPageUrls(pr.body || '');
        })
      );
    }

    return Promise.all(promises).then(function(pageResults) {
      for (var j = 0; j < pageResults.length; j++) {
        for (var k = 0; k < pageResults[j].length; k++) {
          allUrls.push(pageResults[j][k]);
        }
      }
      console.log('mangago pages count: ' + allUrls.length);
      var result = [];
      for (var idx = 0; idx < allUrls.length; idx++) {
        result.push({ url: allUrls[idx], index: idx, headers: { Referer: REFERER } });
      }
      return result;
    });
  });
}

function getChapterContent(chapterUrl) {
  return { text: 'Mangago is a manga-only source.', nextUrl: null };
}
