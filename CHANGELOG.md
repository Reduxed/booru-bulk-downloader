# Changelog

All notable changes to Booru Bulk Downloader are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-10-09

Metadata and documentation release. No change to download behaviour.

### Added

- `@homepageURL` and `@supportURL` pointing at the GitHub repository, so the script page links
  back to its source and its issue tracker.

### Fixed

- Documentation only: every code span in `README.md`, `CHANGELOG.md` and `PUBLISHING.md` had a
  stray `⟩` (U+27E9) where a closing backtick belonged, so code spans did not render as code.
  The userscript source itself was never affected - it contains no backticks at all.

### Notes

- The script is now served from two places. The GitHub copy and the Greasy Fork copy are
  byte-identical apart from the `@downloadURL` / `@updateURL` lines Greasy Fork injects.

## [1.0.0] - 2026-10-08

Initial public release.

### Added

- Per-thumbnail checkbox and one-click download button injected directly into the gallery,
  so nothing requires visiting an individual post page.
- Three-tier original-file resolver: DOM attribute -> site JSON API -> post-page HTML
  (`og:image` plus tag links). Results are cached per post for the life of the page.
- Site adapters for the Danbooru, Gelbooru, Moebooru and e621 families, plus a generic
  adapter for anything exposing a `data-file-url`-style attribute.
- Tag-based filename pipeline: `{{tags}} {{id}} {{rating}} {{site}} {{user}} {{md5}} {{ext}}`
  tokens, filesystem sanitisation, Windows reserved-name guard, truncation on a tag
  boundary, and in-batch de-duplication.
- Batch engine with a configurable concurrency pool, per-item success/failure state and a
  Retry failed action.
- ZIP export built by an in-script store-only writer. No third-party library, no CDN, and
  no `@require`.
- Draggable options panel; all settings persisted per browser profile.
- Shift-click range selection, Select all, Clear, and Alt+D / Alt+A keyboard shortcuts.
- Auto-rescan via MutationObserver (infinite-scroll galleries) and on SPA navigation.
- `@license MIT` and an explicit `@run-at document-idle`.

### Verified

- Live DOM and API recon against safebooru.org and konachan.net.
- ZIP output round-tripped through an independent unzip implementation (JSZip) and an
  independent bit-by-bit CRC32, including a UTF-8 filename.
- End-to-end batch run through the real code path with a stubbed network layer.
