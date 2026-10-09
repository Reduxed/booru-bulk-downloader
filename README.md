# Booru Bulk Downloader

A dependency-free userscript for Tampermonkey, Violentmonkey and Greasemonkey. On a booru
gallery it puts a **checkbox and a download button on every thumbnail**, so you can save
full-resolution originals - one image or a whole selection - **without leaving the results
page**. Files are named from the post's tags.

[Source: booru-bulk-downloader.user.js](booru-bulk-downloader.user.js)
- version 1.0.1 - MIT - 1122 lines / ~44 KB - no external dependencies

## Install

**Greasy Fork (recommended):** [greasyfork.org/en/scripts/599354](https://greasyfork.org/en/scripts/599354-booru-bulk-downloader).
Open the script page and Tampermonkey / Violentmonkey / Greasemonkey will offer to install it,
and Greasy Fork keeps it updated for you.

**GitHub:** install directly from
[booru-bulk-downloader.user.js](https://raw.githubusercontent.com/Reduxed/booru-bulk-downloader/main/booru-bulk-downloader.user.js).
Your userscript manager will offer to install from that raw URL; updates are then manual unless
you add your own `@updateURL`.

Both copies are the same file. Greasy Fork's copy carries two extra lines - `@downloadURL` and
`@updateURL` - which Greasy Fork injects itself.

## What it does

| Control | Where | Action |
| --- | --- | --- |
| Checkbox | top-left of each thumbnail | adds that post to the batch selection (shift-click selects a range) |
| Download arrow | next to the checkbox | downloads that one image at full resolution, immediately |
| Panel | bottom-right, draggable | count, Download selected, Save as .zip, Select all, Clear, Retry failed, options |
| Alt+D / Alt+A | anywhere | download selected / select all on page |

Injected controls stop event propagation, so using them never navigates the tab or opens
the site's own lightbox.

## How it finds the original file (3 tiers, cheapest first)

1. **DOM attribute** - e.g. Danbooru's `img[data-file-url]`. Zero extra requests.
2. **Site JSON API** - `/index.php?page=dapi&s=post&q=index&json=1&id=N` or
   `/post.json?tags=id:N` -> `file_url` + `tags`. Used for the Gelbooru and Moebooru families.
3. **Post page HTML** - fetch the post page, read `<meta property="og:image">` and the tag
   links. Universal fallback, needs no API key.

Results are cached per post id for the life of the page.

### Verified against live markup (2026-10-08)

* **safebooru.org** (Gelbooru family) - gallery items are `span.thumb > a > img.preview`;
  the tags are already in `img[title]` as plain space-separated tags plus `score:N rating:X`.
  dapi JSON confirmed: `file_url`, `tags`, `rating`, `hash`, `image`, `directory`.
* **konachan.net** (Moebooru family) - gallery items are `ul#post-list-posts > li#p<id>`;
  `img[title]` is `Rating: Safe Score: N Tags: a b c User: X`. `post.json?tags=id:N`
  answered 200. On the post page the **true original** is `a.original-file-unchanged`
  (`/image/<md5>/...`); `a#highres` / `a.original-file-changed` is only the converted
  `/jpeg/` "larger version", and `og:image` is the `/sample/` - the selector list prefers
  `/image/` for that reason.
* **danbooru** and **e621** markup was written from their documented conventions, not
  verified live (see *Uncertainty* below).

## Filename pipeline

Template tokens: `{{tags}} {{id}} {{rating}} {{site}} {{user}} {{md5}} {{ext}}`
Default: `{{tags}}__{{id}}` -> `1girl_solo_long_hair__1234.jpg`

* tags are joined with the configured separator, capped by **Max tags** (default 20)
* the extension comes from the real file URL (or the API's `file_ext`), not the thumbnail
* the sanitizer strips `\ / : * ? " < > |` and control characters, collapses whitespace,
  trims leading/trailing dots, and guards Windows reserved names (`CON`, `LPT1`...)
* names are truncated on a tag boundary at ~170 chars, keeping paths inside the OS limit
* duplicates inside one batch get `_2`, `_3` suffixes

## Download engine

* Prefers **`GM_download`** (a real download-manager entry with the exact filename you
  asked for).
* Falls back to **`GM_xmlhttpRequest` -> blob -> `URL.createObjectURL` -> `<a download>`**,
  which is also forced by the *Always use in-page blob download* option.
* A plain `<a download>` is never used alone: the `download` attribute is ignored for
  cross-origin URLs, so it would just navigate the tab.
* Concurrency-limited pool (default 3, throttled with a 350 ms gap), per-item success/error
  state on the button, and a **Retry failed** action.

## ZIP export

The selection is bundled into a `.zip` by a **built-in store-only ZIP writer** - roughly
110 lines of CRC32 and header assembly living in the script itself. No JSZip, no
`@require`, no CDN, no third-party code at all. Every booru file format is already
compressed, so storing costs essentially nothing in size, and the script keeps working if a
CDN is down.

Verified by round-tripping the output through an independent unzip implementation (JSZip)
and an independent bit-by-bit CRC32, including a UTF-8 filename, plus an end-to-end batch
run through the real code path with a stubbed network layer.

## Options (persisted per browser profile)

Filename template, max tags, tag separator, parallel downloads, prefer JSON API,
send `Referer`, always use blob download, and optional Gelbooru/Rule34 `api_key` + `user_id`.

## Adding another booru

Append one object to the `ADAPTERS` array (host regex, `itemSel`, `idFrom`, `linkFrom`,
plus `origFrom`/`tagsFromDom` and `api`/`parseApi` if the site has them) and add a
`@match` line. If the site already exposes a `data-file-url`-style attribute, the built-in
**generic** adapter handles it with just a `@match` line.

## Known gotchas

* **Chrome blocks the second automatic download** from a page unless you allow it:
  *Settings -> Site settings -> Automatic downloads -> allow the booru host*.
  Tampermonkey's `GM_download` avoids most of this but not all of it.
* `@connect *` is intentionally broad because image CDNs vary wildly between boorus.
  Narrow it to the CDN hosts you actually use if you want a tighter permission set.
* **Gelbooru.com and rule34.xxx now require an API key** for the dapi. Paste your own
  `api_key`/`user_id` in Options; without them the script silently falls through to the
  post-page HTML tier, which is slower but key-free.
* **e621's API wants a descriptive User-Agent**, which a userscript cannot set (Chrome
  forbids overriding it). e621 therefore relies on the DOM attribute tier; if that misses,
  the HTML tier still resolves the post.
* The **ZIP build** holds the images in memory before generating the archive, and is capped
  at 3.8 GB. Fine for a few dozen; for hundreds, prefer normal batch download.

## Uncertainty / not verified

* Live-rendered DOM was checked against HTML fetched from safebooru.org and konachan.net.
  Danbooru, Gelbooru.com and e621 markup is written from their documented conventions, and
  the script degrades to the post-page HTML tier if the fast tiers miss.
* Actual file writes to disk, Chrome's automatic-download permission and `GM_download`'s
  filename behaviour can only be confirmed by a real run in your browser.

## Publishing

See [PUBLISHING.md](PUBLISHING.md) for the repository
requirements, ready-to-paste listing copy and the exact submission steps.

## License

MIT - see [LICENSE](LICENSE).
