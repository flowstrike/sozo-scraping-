# sozo-scraping

Custom source repo for the [Sozo Read](https://github.com/Spyou/Sozo-Read) Flutter app. Each `.js` file is a self-contained scraper for one manga site that the app installs at runtime — no app update required.

## How users install sources

The Sozo Read app uses a **manifest** model — one URL gives you the whole repo's worth of sources:

1. Open the app
2. **Settings → Sources → Repos tab → +**
3. Paste the manifest URL:

```
https://raw.githubusercontent.com/flowstrike/sozo-scraping-/main/index.json
```

4. The repo appears with every source listed
5. Tap **Install** next to the ones you want

## The manifest schema

`index.json` at the root of the repo describes the entire catalog:

```json
{
  "name": "Custom Manga Providers",
  "description": "Manga providers: MangaTown, MangaDex.",
  "sources": [
    {
      "id": "mangatown",
      "name": "MangaTown",
      "version": "1.0.0",
      "type": "manga",
      "lang": "en",
      "file": "mangatown.js",
      "logo": "https://www.mangatown.com/favicon.ico",
      "nsfw": false
    }
  ]
}
```

| Field      | Required | Notes                                                                                   |
|------------|----------|-----------------------------------------------------------------------------------------|
| `id`       | yes      | Stable lowercase id used in URLs + library rows. Don't rename after release.            |
| `name`     | yes      | Display name.                                                                           |
| `version`  | yes      | Semver-ish. Bump on every change so users see an Update prompt.                         |
| `type`     | yes      | `manga` or `novel`.                                                                     |
| `lang`     | yes      | ISO 639-1 (`en`, `ja`, `ko`, ...).                                                      |
| `file`     | yes      | Relative path to the `.js` from the manifest's directory. Absolute URLs also accepted.  |
| `logo`     | no       | Absolute URL to a square icon (drawn at 36x36 in the Repos list).                      |
| `nsfw`     | no       | `true` hides the source behind the NSFW gate. Defaults to `false`.                     |

## How devs add a new source

1. Copy an existing provider as a starting point.
2. Change `SOURCE_ID` and `SITE`, then fill in the five functions (`getInfo`, `search`, `getDetail`, `getChapters`, `getPages`).
3. Register it in `index.json` — add a new entry to the `sources` array.
4. Push.

```bash
git add mysource.js index.json
git commit -m "Add MySource provider"
git push
```

## Provider contract

A provider is a plain `.js` file exposing five global functions. The Sozo Read host gives you a small API (`fetch`, `htmlText`, regex helpers) — you don't get a DOM, just strings.

```js
function getInfo() {
  return {
    name: 'My Source',
    lang: 'en',
    baseUrl: 'https://...',
    logo: '<absolute logo URL>',
    type: 'manga',
    version: '1.0.0',
  };
}

async function search(query, page, opts) {
  return [
    { id, title, url, cover, sourceId: 'my-source', type: 'manga' },
  ];
}

async function getDetail(url) {
  return {
    id, sourceId, title, cover, url,
    author, status, description, genres: [],
    type: 'manga',
    chapters: [
      { id, title, number, url, date },
    ],
  };
}

async function getChapters(seriesUrl) {
  return [];
}

async function getPages(chapterUrl) {
  return [
    { url: 'https://cdn.example.com/p1.jpg', headers: { Referer: '...' } },
  ];
}
```

### What the host environment gives you

| Function / global          | What it does                                                                    |
|----------------------------|---------------------------------------------------------------------------------|
| `fetch(url, opts)`         | Network fetch. Returns `{ status, body, headers }`. Honours `opts.headers`.    |
| `htmlText(html)`           | Decodes HTML entities + collapses whitespace.                                   |
| `console.log(...)`         | Logs to `flutter logs` prefixed with `[sourceId/js log]`.                       |
| Standard JS (ES5-ish via QuickJS) | No DOM, no `XMLHttpRequest`, no `window`. Use regex to parse HTML.       |

## Sources shipped

| File              | Site                  | Type   | Notes                                                  |
|-------------------|-----------------------|--------|--------------------------------------------------------|
| `mangatown.js`    | mangatown.com         | manga  | Server-rendered HTML. Images require Referer header. |
| `mangadex.js`     | mangadex.org          | manga  | REST API. Official sozoread-providers code. |

## Hosting your own repo

You don't have to use this one. Anyone can fork or build their own:

1. Make a new GitHub repo (or use any static host that serves raw files)
2. Add `.js` source files
3. Add an `index.json` listing them
4. Share the manifest URL — users paste it into the Repos tab via **+**

## Versioning

Bump the `version` field in **both** the source's `getInfo()` return AND its entry in `index.json` when you change a source. Users with the source installed will see an Update affordance in the Repos tab.

## License

MIT
