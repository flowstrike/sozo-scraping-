var vm = require('vm');
var fs = require('fs');
var path = require('path');

function htmlTextPolyfill(s) {
  return (s || '')
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'");
}

function nodeFetch(url, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  return fetch(url, { headers: headers }).then(function(r) {
    return r.text().then(function(body) {
      var allHeaders = {};
      r.headers.forEach(function(v, k) {
        if (k === 'set-cookie') {
          if (!allHeaders[k]) allHeaders[k] = [];
          allHeaders[k].push(v);
        } else {
          allHeaders[k] = v;
        }
      });
      return {
        status: r.status,
        body: body,
        headers: allHeaders
      };
    });
  });
}

function loadSource(filePath) {
  var code = fs.readFileSync(path.resolve(filePath), 'utf8');
  var ctx = vm.createContext({
    fetch: nodeFetch,
    htmlText: htmlTextPolyfill,
    console: console,
    Promise: Promise,
    setTimeout: setTimeout
  });
  vm.runInContext(code, ctx);
  return ctx;
}

var SOURCES = ['baozimh.js', 'kuaikan.js', 'manhuaren.js', 'mangabz.js', 'manhuagui.js'];
var SEARCH_QUERY = '斗破苍穹';

function assert(condition, msg) {
  if (!condition) throw new Error('ASSERT FAIL: ' + msg);
}

function logResult(sourceId, test, pass, detail) {
  var status = pass ? 'PASS' : 'FAIL';
  console.log('  [' + status + '] ' + sourceId + ' / ' + test + (detail ? ' — ' + detail : ''));
}

async function testSource(filePath) {
  var sourceId = filePath.replace('.js', '');
  var results = { source: sourceId, tests: [] };
  console.log('\n=== Testing ' + sourceId + ' ===');

  try {
    var ctx = loadSource(filePath);

    try {
      var info = ctx.getInfo();
      assert(info.name, 'getInfo must return name');
      assert(info.lang === 'zh', 'lang must be zh');
      assert(info.baseUrl, 'getInfo must return baseUrl');
      assert(info.type === 'manga', 'type must be manga');
      results.tests.push({ test: 'getInfo', pass: true });
      logResult(sourceId, 'getInfo', true, info.name + ' (' + info.lang + ')');
    } catch(e) {
      results.tests.push({ test: 'getInfo', pass: false, error: e.message });
      logResult(sourceId, 'getInfo', false, e.message);
    }

    var searchResults = [];
    try {
      searchResults = await ctx.search(SEARCH_QUERY, 1, {});
      assert(Array.isArray(searchResults), 'search must return array');
      if (searchResults.length > 0) {
        var first = searchResults[0];
        assert(first.id, 'search result must have id');
        assert(first.title, 'search result must have title');
        assert(first.url, 'search result must have url');
        assert(first.sourceId === sourceId, 'sourceId must match');
        results.tests.push({ test: 'search', pass: true });
        logResult(sourceId, 'search', true, searchResults.length + ' results');
      } else {
        results.tests.push({ test: 'search', pass: true, note: 'empty (expected for kuaikan)' });
        logResult(sourceId, 'search', true, '0 results (browse-only source)');
      }
    } catch(e) {
      results.tests.push({ test: 'search', pass: false, error: e.message });
      logResult(sourceId, 'search', false, e.message);
    }

    var detail = null;
    if (searchResults.length > 0) {
      try {
        detail = await ctx.getDetail(searchResults[0].url);
        assert(detail.title, 'detail must have title');
        assert(detail.url, 'detail must have url');
        assert(detail.sourceId === sourceId, 'detail sourceId must match');
        assert(Array.isArray(detail.chapters), 'detail must have chapters array');
        results.tests.push({ test: 'getDetail', pass: true });
        logResult(sourceId, 'getDetail', true, detail.title + ' — ' + (detail.chapters || []).length + ' chapters');
      } catch(e) {
        results.tests.push({ test: 'getDetail', pass: false, error: e.message });
        logResult(sourceId, 'getDetail', false, e.message);
      }
    } else {
      results.tests.push({ test: 'getDetail', pass: false, error: 'No search results to test' });
      logResult(sourceId, 'getDetail', false, 'No search results to test');
    }

    if (detail && detail.chapters && detail.chapters.length > 0) {
      try {
        var firstChapter = detail.chapters[0];
        var pages = await ctx.getPages(firstChapter.url);
        assert(Array.isArray(pages), 'getPages must return array');
        if (pages.length > 0) {
          assert(pages[0].url, 'page must have url');
          results.tests.push({ test: 'getPages', pass: true });
          logResult(sourceId, 'getPages', true, pages.length + ' pages');
        } else {
          results.tests.push({ test: 'getPages', pass: false, error: '0 pages returned' });
          logResult(sourceId, 'getPages', false, '0 pages returned');
        }
      } catch(e) {
        results.tests.push({ test: 'getPages', pass: false, error: e.message });
        logResult(sourceId, 'getPages', false, e.message);
      }
    } else {
      results.tests.push({ test: 'getPages', pass: false, error: 'No chapters to test' });
      logResult(sourceId, 'getPages', false, 'No chapters to test');
    }

  } catch(e) {
    results.tests.push({ test: 'load', pass: false, error: e.message });
    logResult(sourceId, 'load', false, e.message);
  }

  return results;
}

async function main() {
  console.log('=== Chinese Sources Test Runner ===');
  console.log('Testing ' + SOURCES.length + ' sources with query: "' + SEARCH_QUERY + '"\n');

  var allResults = [];
  for (var i = 0; i < SOURCES.length; i++) {
    var r = await testSource(SOURCES[i]);
    allResults.push(r);
  }

  console.log('\n=== Summary ===');
  var totalPass = 0;
  var totalFail = 0;
  for (var j = 0; j < allResults.length; j++) {
    var res = allResults[j];
    var passed = res.tests.filter(function(t) { return t.pass; }).length;
    var failed = res.tests.filter(function(t) { return !t.pass; }).length;
    totalPass += passed;
    totalFail += failed;
    console.log('  ' + res.source + ': ' + passed + '/' + (passed + failed) + ' passed' + (failed > 0 ? ' (' + failed + ' FAILED)' : ''));
  }
  console.log('\nTotal: ' + totalPass + ' passed, ' + totalFail + ' failed');
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(function(e) {
  console.error('Fatal error:', e);
  process.exit(1);
});
