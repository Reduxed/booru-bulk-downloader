# Publishing guide

**Status: PUBLISHED to Greasy Fork and mirrored to GitHub on 2026-10-09.**

| | |
| --- | --- |
| Live page | https://greasyfork.org/en/scripts/599354-booru-bulk-downloader |
| Install URL | https://update.greasyfork.org/scripts/599354/Booru%20Bulk%20Downloader.user.js |
| Script ID | 599354 |
| Version / licence / size | 1.0.0 / MIT / 43.8 KB |
| Published by | augdawg (Greasy Fork user 1051598) |

**GitHub mirror:** https://github.com/Reduxed/booru-bulk-downloader - public, branch main.

All five project files are committed there. The script is byte-identical to the copy Greasy Fork
serves (and therefore also to the local file apart from Greasy Fork's injected @downloadURL /
@updateURL lines), which was verified after committing by fetching each file back from
raw.githubusercontent.com and comparing hashes. Keeping that identity means the two sources cannot
silently diverge.

Verified after publishing:

- The served file is byte-identical to `booru-bulk-downloader.user.js` apart from the two
  `@downloadURL` / `@updateURL` lines Greasy Fork injects itself (checked by re-downloading the
  install URL and comparing after removing exactly those lines).
- The name, summary, Markdown description (3381 chars) and version 1.0.0 all persisted, and the
  "Applies to" list shows every matched host.
- No reCAPTCHA challenge blocked the submission.

**The adult-content requirement is satisfied, and not by the self-report.** Greasy Fork applied
the flag automatically from the matched domains:

> Your script has been marked as having adult content due to being for donmai.us, e621.net,
> gelbooru.com, konachan.com, konachan.net, rule34.xxx, and yande.re.

Two things learned that are worth keeping:

- `/en/scripts/<id>-<slug>/edit` returns 404. Script metadata is changed through the update
  form at `/en/scripts/<id>/versions/new`, which is also where the adult-content status is shown.
- The update form has no adult-content checkbox, because that flag is derived from the matched
  hosts rather than self-reported.

## Still open (optional)

- **OpenUserJS** mirror - https://openuserjs.org/ - needs a GitHub sign-in first.
- **GitHub** repo - DONE: https://github.com/Reduxed/booru-bulk-downloader exists and holds the
  full package. Adding a real `@homepageURL` / `@supportURL` to the script is still open, but it
  would make the script differ from the published v1.0.0, so it belongs with a v1.0.1 release.
- Shipping a future version: upload the new file at
  https://greasyfork.org/en/scripts/599354/versions/new (the form preloads the current code and
  description, so only the changed parts need touching).

## Where this should go

1. **Greasy Fork** - https://greasyfork.org/script_versions/new - the primary userscript
   repository and the one people actually search. Do this first.
2. **OpenUserJS** - https://openuserjs.org/ - a useful mirror, but it authenticates through
   GitHub, so sign in to GitHub first if you want it.
3. **GitHub** - optional but worth it: a canonical source, an issue tracker for the
   `@supportURL⟩ field, and somewhere to point `@homepageURL⟩. This folder works as the
   repo root as-is.

## Greasy Fork requirements this script already satisfies

Checked live against https://greasyfork.org/en/help/code-rules and
https://greasyfork.org/en/help/external-scripts:

- **Code must not be obfuscated or minified.** The script is 1120 lines of
  commented, readable source.
- **Under the 2 MB size limit.** It is roughly 44 KB.
- **The description must match what it does.** Both the `@description⟩ metadata and the
  listing copy below describe the real behaviour, including batch download and ZIP export.
- **External executable code is restricted.** The script now loads **nothing** external at
  runtime - the JSZip `@require⟩ was replaced with a built-in store-only ZIP writer. There
  is no `@require⟩, no `@resource⟩, no dynamic script injection and no eval.
- **Scripts for sites with adult content must be marked as such.** The rule, verbatim:

  > Scripts that ... contain adult content or are for sites with adult content must be
  > marked as such to allow other users the option of whether to see them.

  **Tick the adult-content / NSFW option on the upload form.** Gelbooru, Rule34 and e621
  are adult sites, so this is mandatory. Scripts get deleted over it.
- No `@antifeature⟩ disclaimer is needed: no tracking, no ads, no analytics, and no data
  leaving the browser beyond the image requests the user asked for.

### One thing to expect in review

`@connect *⟩ is intentionally broad, and it has to be: every booru serves originals from a
different CDN hostname (`img3.gelbooru.com⟩, `wimg.rule34.xxx⟩, `cdn.donmai.us⟩,
`files.yande.re⟩, `static1.e621.net⟩, and so on), and the script breaks on any host it
cannot enumerate. Greasy Fork permits it - it simply appears on the script page as a
cross-domain request permission. It is disclosed in the listing copy so nobody installs it
unaware.

## Listing copy

**Name**

```
Booru Bulk Downloader
```

**Summary / the `@description⟩ line**

```
Adds a checkbox and a download button to every thumbnail on a booru gallery. Saves the full-resolution original, names it from the post's tags, and can batch-download or ZIP a whole selection without leaving the results page.
```

**Long description (paste as Markdown)**

```markdown
Adds a **checkbox** and a **download button** to every thumbnail on a booru gallery.

- **Checkbox** - add the post to a batch selection. Shift-click for a range.
- **Download button** - save that one image at full resolution, immediately.
- **Panel** (bottom-right, draggable) - selection count, Download selected, Save as .zip,
  Select all, Clear, Retry failed, and the filename options.
- **Alt+D / Alt+A** - download the selection / select all on the page.

Nothing requires opening the individual post page. The gallery keeps working normally:
every injected control stops event propagation, so clicking it never navigates or opens the
site's lightbox.

### Filenames from tags

Files are named from the post's own tags, using a template you control:

    {{tags}}__{{id}}      ->  1girl_solo_long_hair__1234.jpg

Tokens: {{tags}} {{id}} {{rating}} {{site}} {{user}} {{md5}} {{ext}}

Illegal filesystem characters, control characters and Windows reserved names are handled,
long names are truncated on a tag boundary, and collisions inside one batch get a numeric
suffix.

### How the original is found

Three tiers, cheapest first, cached per post:

1. **DOM attribute** - where the gallery already exposes the original (Danbooru's
   data-file-url). No extra request.
2. **Site JSON API** - the booru's own dapi or post.json endpoint.
3. **Post page HTML** - reads og:image and the tag links. Universal, needs no API key.

### ZIP export

Bundles the selection into a .zip using a built-in store-only writer - no third-party
library is loaded at any point. Booru files are already compressed formats, so storing
costs essentially nothing.

### Options

Filename template, max tags, tag separator, parallel downloads, prefer JSON API, send
Referer, always use in-page blob download, and optional Gelbooru/Rule34 api_key / user_id.
All persisted per browser profile.

### Permissions, in plain language

- GM_download / GM_xmlhttpRequest - to save the original files.
- @connect * - **cross-domain requests to any host.** Required because every booru serves
  originals from a different CDN, and the userscript managers block unlisted hosts. The
  script only ever contacts the booru you are already on plus the CDN its files live on.
  There is **no** telemetry, analytics or phone-home.
- GM_getValue / GM_setValue - to remember your options.

### Supported sites

Danbooru (+ betabooru), Gelbooru, Safebooru, Rule34, xbooru, tbib, realbooru, e621,
yande.re, konachan (+ .net). Adding another booru is one entry in the ADAPTERS array plus a
@match line; sites that already expose a data-file-url-style attribute work with just the
@match line.

Source is MIT licensed and completely readable - no minification, no bundling.

### Known gotchas

- Chrome blocks the second automatic download from a page until you allow **Automatic
  downloads** for that site. Allow it once per booru.
- Gelbooru.com and rule34.xxx now require an API key for their JSON API. Paste your own
  api_key / user_id in the options; without them the script falls back to reading the post
  page, which is slower but needs no key.
- e621's API asks for a descriptive User-Agent, which a userscript cannot set. e621
  therefore uses the fast DOM tier, with the HTML tier as backup.

Report problems through the Feedback tab on this script's page.
```

## Steps to publish

1. Sign in to Greasy Fork (GitHub, Google, or a Greasy Fork account).
2. Open https://greasyfork.org/script_versions/new
3. Paste the full contents of `booru-bulk-downloader.user.js⟩ into the code box.
4. **Tick the adult/NSFW option.** Required - the supported sites are adult sites.
5. Use the name, summary and long description above.
6. Language: English. Licence: MIT. Leave `@updateURL⟩ / `@downloadURL⟩ alone - Greasy Fork
   fills those in itself.
7. Save, then open the script page and confirm the metadata block parsed correctly.

Once you are signed in this can be driven from the browser in a single pass; the only
manual parts are the sign-in itself and the adult-content checkbox.
