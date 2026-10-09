# Publishing guide

**Status: PUBLISHED to Greasy Fork and mirrored to GitHub. Current release: v1.0.1 (2026-10-09).**

| | |
| --- | --- |
| Live page | https://greasyfork.org/en/scripts/599354-booru-bulk-downloader |
| Install URL | https://update.greasyfork.org/scripts/599354/Booru%20Bulk%20Downloader.user.js |
| Script ID | 599354 |
| Version / licence / size | 1.0.1 / MIT / 43.9 KB |
| Published by | augdawg (Greasy Fork user 1051598) |

**GitHub mirror:** https://github.com/Reduxed/booru-bulk-downloader - public, branch main.

Install from GitHub:
https://raw.githubusercontent.com/Reduxed/booru-bulk-downloader/main/booru-bulk-downloader.user.js

All five project files are committed there, and the script is byte-identical to the copy Greasy
Fork serves apart from the two `@downloadURL` / `@updateURL` lines Greasy Fork injects.

The verification method matters here, because two obvious checks give wrong answers. Comparing
byte counts is unreliable on files containing non-ASCII characters - characters are not bytes, and
a same-length comparison against UTF-8 bytes produces false mismatches. And
raw.githubusercontent.com can serve a stale copy for a while after a commit. The dependable check
is to compute the file's Git blob SHA-1 locally and compare it against the sha returned by
https://api.github.com/repos/Reduxed/booru-bulk-downloader/contents/<path>

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

## Still open

- **OpenUserJS** mirror - https://openuserjs.org/ - **not published.** Its /login is account
  creation, not a plain sign-in: the form at /auth/ requires choosing a **username that the page
  says will be displayed to everyone**, picking an OAuth provider (GitHub, Google, Imgur, Reddit,
  Steam), and ticking a box agreeing to their **binding Terms of Service**. Choosing a public
  handle and accepting terms on another person's behalf is not something to automate. It takes the
  account owner about a minute, after which the listing can be posted at
  https://openuserjs.org/scripts/new.
- **Shipping a future version:** upload the new file at
  https://greasyfork.org/en/scripts/599354/versions/new. The form preloads the current code,
  description, name and markup, so only the changed parts need touching, and it has a changelog
  field. There is no adult-content checkbox on the update form - that flag is derived from the
  matched hosts.
- **Greasy Fork's update CDN lags behind its own database.** Right after 1.0.1 was posted, the
  script page reported Version 1.0.1 and Size 43.9 KB and meta.js served 1.0.1, but
  update.greasyfork.org/scripts/599354/...user.js still returned the 1.0.0 body on four
  consecutive reads. A stale CDN read is not a failed upload - check the script page itself, and
  re-read later before telling anyone the release did not land.

## v1.0.1 - what changed, and two defects it fixes

Metadata and documentation release. No change to download behaviour.

- Added `@homepageURL` and `@supportURL` so the script page links back to its source and to the
  issue tracker that field points at.
- **Fixed two real defects that were already live on GitHub:**
  1. Every code span in README.md, CHANGELOG.md and PUBLISHING.md carried a stray pointing-bracket
     character (U+27E9) where a **closing** backtick belonged - 63, 6 and 17 occurrences. A
     placeholder substitution used while writing those docs converted only the opening token, so
     the closing token survived into the published files and the code spans did not render as
     code. The userscript source itself was never affected: it contains no backticks at all.
  2. README.md linked to Dassi-only project:// URIs, which are meaningless to a reader on GitHub.
     Three links were made repo-relative, and a real Install section was added.
- The Greasy Fork description was checked for the same stray character and was already clean.

## Where this went

1. **Greasy Fork** - DONE. https://greasyfork.org/en/scripts/599354-booru-bulk-downloader
2. **OpenUserJS** - pending the account sign-up described above.
3. **GitHub** - DONE. https://github.com/Reduxed/booru-bulk-downloader is the canonical source and
   provides the issue tracker that `@supportURL` points at.

## Greasy Fork requirements this script already satisfies

Checked live against https://greasyfork.org/en/help/code-rules and
https://greasyfork.org/en/help/external-scripts:

- **Code must not be obfuscated or minified.** The script is 1122 lines of
  commented, readable source.
- **Under the 2 MB size limit.** It is roughly 44 KB.
- **The description must match what it does.** Both the `@description` metadata and the
  listing copy below describe the real behaviour, including batch download and ZIP export.
- **External executable code is restricted.** The script now loads **nothing** external at
  runtime - the JSZip `@require` was replaced with a built-in store-only ZIP writer. There
  is no `@require`, no `@resource`, no dynamic script injection and no eval.
- **Scripts for sites with adult content must be marked as such.** The rule, verbatim:

  > Scripts that ... contain adult content or are for sites with adult content must be
  > marked as such to allow other users the option of whether to see them.

  **Tick the adult-content / NSFW option on the upload form.** Gelbooru, Rule34 and e621
  are adult sites, so this is mandatory. Scripts get deleted over it.
- No `@antifeature` disclaimer is needed: no tracking, no ads, no analytics, and no data
  leaving the browser beyond the image requests the user asked for.

### One thing to expect in review

`@connect *` is intentionally broad, and it has to be: every booru serves originals from a
different CDN hostname (`img3.gelbooru.com`, `wimg.rule34.xxx`, `cdn.donmai.us`,
`files.yande.re`, `static1.e621.net`, and so on), and the script breaks on any host it
cannot enumerate. Greasy Fork permits it - it simply appears on the script page as a
cross-domain request permission. It is disclosed in the listing copy so nobody installs it
unaware.

## Listing copy

**Name**

```
Booru Bulk Downloader
```

**Summary / the `@description` line**

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
3. Paste the full contents of `booru-bulk-downloader.user.js` into the code box.
4. **Tick the adult/NSFW option.** Required - the supported sites are adult sites.
5. Use the name, summary and long description above.
6. Language: English. Licence: MIT. Leave `@updateURL` / `@downloadURL` alone - Greasy Fork
   fills those in itself.
7. Save, then open the script page and confirm the metadata block parsed correctly.

Once you are signed in this can be driven from the browser in a single pass; the only
manual parts are the sign-in itself and the adult-content checkbox.
