// ==UserScript==
// @name         Booru Bulk Downloader
// @namespace    https://aug.quest/booru-bulk-downloader
// @version      1.0.1
// @description  Adds a checkbox + download button to every thumbnail on a booru gallery. Fetches the full-resolution ORIGINAL and names the file from the post's tags. Batch select, progress, optional ZIP. Never leaves the gallery page.
// @author       Aug
// @license      MIT
// @homepageURL  https://github.com/Reduxed/booru-bulk-downloader
// @supportURL   https://github.com/Reduxed/booru-bulk-downloader/issues
// @run-at       document-idle
// @match        *://*.gelbooru.com/*
// @match        *://*.safebooru.org/*
// @match        *://*.rule34.xxx/*
// @match        *://*.xbooru.com/*
// @match        *://*.tbib.org/*
// @match        *://*.realbooru.com/*
// @match        *://*.danbooru.donmai.us/*
// @match        *://*.betabooru.donmai.us/*
// @match        *://*.yande.re/*
// @match        *://*.konachan.com/*
// @match        *://*.konachan.net/*
// @match        *://*.e621.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @noframes
// ==/UserScript==

/*
 *  HOW IT FINDS THE ORIGINAL FILE  (three tiers, cheapest first)
 *    1. DOM attribute  -> e.g. danbooru's img[data-file-url]. No extra request.
 *    2. Site JSON API  -> booru dapi /  post.json?tags=id:N   => file_url + tags
 *    3. Post page HTML -> fetch the post page, read <meta property="og:image">
 *                         plus its tag links. Universal, needs no API key.
 *
 *  TO ADD A SITE: append one object to ADAPTERS. Minimum: host, itemSel,
 *  idFrom(), linkFrom(). Add origFrom()/tagsFromDom() for zero-request mode and
 *  api()/parseApi() for tier 2. Tier 3 is automatic for any adapter.
 */

(function () {
  'use strict';

  /* ===================================================== 0. configuration */

  var DEFAULTS = {
    template: '{{tags}}__{{id}}',
    maxTags: 20,
    tagSep: '_',
    concurrency: 3,
    gapMs: 350,
    forceBlob: false,
    preferApi: true,
    sendReferer: false,
    apiKey: '',
    apiUserId: '',
    collapsed: false,
    panelX: null,
    panelY: null
  };

  function loadCfg() {
    var c = {}, k;
    for (k in DEFAULTS) { if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) c[k] = DEFAULTS[k]; }
    try {
      var saved = (typeof GM_getValue === 'function') ? GM_getValue('bbd-cfg', null) : null;
      if (!saved) { var raw = localStorage.getItem('bbd-cfg'); if (raw) saved = JSON.parse(raw); }
      if (saved && typeof saved === 'object') {
        for (k in saved) { if (Object.prototype.hasOwnProperty.call(saved, k)) c[k] = saved[k]; }
      }
    } catch (e) {}
    return c;
  }
  function saveCfg() {
    try { if (typeof GM_setValue === 'function') GM_setValue('bbd-cfg', CFG); } catch (e) {}
    try { localStorage.setItem('bbd-cfg', JSON.stringify(CFG)); } catch (e2) {}
  }

  var CFG = loadCfg();

  /* ===================================================== 1. site adapters */

  function host() { return location.hostname.replace(/^www\./, ''); }

  var ADAPTERS = [
    /* ---- Danbooru family: the gallery <img> already carries everything ---- */
    {
      id: 'danbooru',
      label: 'Danbooru',
      host: /(^|\.)(danbooru\.donmai\.us|betabooru\.donmai\.us|hijiribe\.donmai\.us|sonohara\.donmai\.us|safebooru\.donmai\.us)$/,
      itemSel: '#posts article.post-preview, #posts div.post-preview, article.post-preview, div.post-preview, li.post-preview',
      idFrom: function (item, img) {
        var a = item.querySelector('a[href*="/posts/"]');
        var m = a && ((a.getAttribute('href') || '').match(/\/posts\/(\d+)/));
        if (m) return m[1];
        return item.getAttribute('data-id') || (img && img.getAttribute('data-id')) || null;
      },
      linkFrom: function (item) {
        var a = item.querySelector('a[href*="/posts/"]');
        return a ? a.href : null;
      },
      origFrom: function (item) {
        var img = item.querySelector('img[data-file-url]');
        return img ? img.getAttribute('data-file-url') : null;
      },
      tagsFromDom: function (item) {
        var img = item.querySelector('img[data-tags]');
        var t = img ? (img.getAttribute('data-tags') || '') : '';
        return t ? t.trim().split(/\s+/) : null;
      },
      ratingFromDom: function (item) {
        var img = item.querySelector('img[data-rating]');
        return img ? img.getAttribute('data-rating') : null;
      },
      api: function (id) { return location.origin + '/posts/' + id + '.json'; },
      parseApi: function (j) {
        if (!j || typeof j !== 'object') return null;
        return {
          fileUrl: j.file_url || j.large_file_url || null,
          tags: (j.tag_string || '').split(/\s+/).filter(Boolean),
          rating: j.rating || null,
          id: j.id || null,
          user: j.uploader_name || null,
          ext: j.file_ext || null
        };
      }
    },

    /* ---- Gelbooru family: thumbnail title holds the tags; API for the file ---- */
    {
      id: 'gelbooru',
      label: 'Gelbooru / Safebooru / Rule34',
      host: /(^|\.)(gelbooru\.com|safebooru\.org|rule34\.xxx|xbooru\.com|tbib\.org|realbooru\.com|hypnohub\.net|allgirlbooru\.com)$/,
      itemSel: 'span.thumb, div.thumbnail-preview, article.thumbnail-preview, .image-list-item, .thumb',
      idFrom: function (item, img) {
        var own = item.id || '';
        var m = own.match(/^[sp](\d+)$/);
        if (m) return m[1];
        var a = item.querySelector('a[href]');
        var h = a ? (a.getAttribute('href') || '') : '';
        m = h.match(/[?&]id=(\d+)/) || h.match(/\/posts?\/(\d+)/) || h.match(/\/post\/show\/(\d+)/);
        if (m) return m[1];
        // fall back to the thumbnail filename: /thumbnails/339/thumbnail_<md5>.jpg?<id>
        var src = (img && (img.getAttribute('src') || '')) || '';
        m = src.match(/\?(\d+)$/);
        return m ? m[1] : null;
      },
      linkFrom: function (item) {
        var a = item.querySelector('a[href]');
        return a ? a.href : null;
      },
      tagsFromDom: function (item) {
        var img = item.querySelector('img');
        if (!img) return null;
        var t = img.getAttribute('title') || img.getAttribute('alt') || '';
        t = t.replace(/\b(score|rating|user|parent|source|status|id):[^\s]*/gi, ' ');
        t = t.replace(/^Tags:\s*/i, ' ');
        t = t.replace(/\s+User:.*$/i, ' ');
        var tags = t.trim().split(/\s+/).filter(Boolean);
        return tags.length ? tags : null;
      },
      ratingFromDom: function (item) {
        var img = item.querySelector('img');
        var t = img ? (img.getAttribute('title') || '') : '';
        var m = t.match(/\brating:([a-z]+)/i);
        return m ? m[1] : null;
      },
      apiBase: function () {
        if (/rule34\.xxx$/.test(host())) return 'https://api.rule34.xxx/index.php';
        return location.origin + '/index.php';
      },
      api: function (id) {
        var u = this.apiBase() + '?page=dapi&s=post&q=index&json=1&id=' + encodeURIComponent(id);
        if (CFG.apiKey) u += '&api_key=' + encodeURIComponent(CFG.apiKey);
        if (CFG.apiUserId) u += '&user_id=' + encodeURIComponent(CFG.apiUserId);
        return u;
      },
      parseApi: function (j) {
        if (Array.isArray(j)) j = j[0];
        else if (j && j.post) j = Array.isArray(j.post) ? j.post[0] : j.post;
        if (!j || typeof j !== 'object' || (j.id === undefined && !j.file_url)) return null;
        return {
          fileUrl: j.file_url || j.sample_url || null,
          tags: (j.tags || '').split(/\s+/).filter(Boolean),
          rating: j.rating || null,
          id: j.id || null,
          user: j.owner || null,
          md5: j.hash || null,
          ext: (j.image || '').split('.').pop() || null
        };
      }
    },

    /* ---- Moebooru family: li#p<id>, thumb title = "Rating: X Score: N Tags: ... User: Y" ---- */
    {
      id: 'moebooru',
      label: 'Moebooru (yande.re / konachan)',
      host: /(^|\.)(yande\.re|konachan\.com|konachan\.net|sakugabooru\.com|moe\.imouto\.us|lolibooru\.moe)$/,
      itemSel: 'ul#post-list-posts > li, #post-list > div.post, div.post',
      idFrom: function (item, img) {
        var m = (item.id || '').match(/^p(\d+)$/);
        if (m) return m[1];
        var a = item.querySelector('a[href*="/post/show/"]') || item.querySelector('a[href*="/post/"]');
        m = a && ((a.getAttribute('href') || '').match(/\/post\/(?:show\/)?(\d+)/));
        return m ? m[1] : null;
      },
      linkFrom: function (item) {
        var a = item.querySelector('a[href*="/post/show/"]') || item.querySelector('a[href*="/post/"]');
        return a ? a.href : null;
      },
      tagsFromDom: function (item) {
        var img = item.querySelector('img');
        var t = img ? (img.getAttribute('title') || img.getAttribute('alt') || '') : '';
        var m = t.match(/\bTags:\s*(.+?)(?:\s+User:.*)?$/i);
        return m ? m[1].trim().split(/\s+/).filter(Boolean) : null;
      },
      ratingFromDom: function (item) {
        var img = item.querySelector('img');
        var t = img ? (img.getAttribute('title') || '') : '';
        var m = t.match(/\bRating:\s*([A-Za-z]+)/i);
        return m ? m[1].toLowerCase() : null;
      },
      api: function (id) { return location.origin + '/post.json?tags=id:' + encodeURIComponent(id); },
      parseApi: function (j) {
        var p = Array.isArray(j) ? j[0] : (j && j.posts ? j.posts[0] : j);
        if (!p || !p.id) return null;
        return {
          fileUrl: p.file_url || p.jpeg_url || p.sample_url || null,
          tags: (p.tags || '').split(/\s+/).filter(Boolean),
          rating: p.rating || null,
          id: p.id,
          user: p.author || null,
          md5: p.md5 || null,
          ext: (p.file_url || '').split('.').pop() || null
        };
      }
    },

    /* ---- e621: gallery thumbs carry data-* urls; API needs a real UA ---- */
    {
      id: 'e621',
      label: 'e621',
      host: /(^|\.)e621\.net$/,
      itemSel: 'article.post-preview, div.post-preview, .post-preview',
      idFrom: function (item, img) {
        var a = item.querySelector('a[href*="/posts/"]');
        var m = a && ((a.getAttribute('href') || '').match(/\/posts\/(\d+)/));
        return item.getAttribute('data-id') || (img && img.getAttribute('data-id')) || (m ? m[1] : null);
      },
      linkFrom: function (item) {
        var a = item.querySelector('a[href*="/posts/"]');
        return a ? a.href : null;
      },
      origFrom: function (item) {
        var img = item.querySelector('img[data-file-url]');
        return img ? img.getAttribute('data-file-url') : null;
      },
      tagsFromDom: function (item) {
        var img = item.querySelector('img[data-tags]');
        var t = img ? (img.getAttribute('data-tags') || '') : '';
        return t ? t.trim().split(/\s+/) : null;
      },
      ratingFromDom: function () { return null; },
      api: function (id) { return location.origin + '/posts/' + id + '.json'; },
      parseApi: function (j) {
        var p = j && j.post;
        if (!p) return null;
        return {
          fileUrl: (p.file && p.file.url) || null,
          tags: [].concat(p.tags && p.tags.general || [], p.tags && p.tags.species || []),
          rating: p.rating || null,
          id: p.id || null,
          ext: (p.file && p.file.ext) || null
        };
      }
    },

    /* ---- Generic: anything exposing the original in a data-* attribute ---- */
    {
      id: 'generic',
      label: 'Generic booru',
      host: /.*/,
      itemSel: 'img[data-file-url], img[data-large-file-url], img[data-original], img[data-original-url]',
      imageLevel: true,
      idFrom: function (item, img) {
        var a = img.closest('a[href]');
        var h = a ? (a.getAttribute('href') || '') : '';
        var m = h.match(/(?:posts?|view)[^0-9]*(\d{2,})/) || h.match(/(\d{3,})\s*$/);
        return m ? m[1] : null;
      },
      linkFrom: function (item, img) {
        var a = img.closest('a[href]');
        return a ? a.href : null;
      },
      origFrom: function (item, img) {
        return img.getAttribute('data-file-url') || img.getAttribute('data-large-file-url') ||
               img.getAttribute('data-original') || img.getAttribute('data-original-url');
      },
      tagsFromDom: function (item, img) {
        var t = img.getAttribute('data-tags') || '';
        return t ? t.trim().split(/\s+/) : null;
      },
      ratingFromDom: function () { return null; }
    }
  ];

  function adapter() {
    var h = host(), i;
    for (i = 0; i < ADAPTERS.length; i++) {
      var a = ADAPTERS[i];
      if (a.id !== 'generic' && a.host.test(h)) return a;
    }
    // Unknown host: fall back to the generic data-* adapter, so a new booru only
    // needs an extra @match line when its thumbnails already expose a data-* url.
    return ADAPTERS[ADAPTERS.length - 1];
  }

  /* ====================================================== 2. small helpers */

  function safe(fn) { try { return fn(); } catch (e) { return null; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function log() { try { console.log.apply(console, ['[BBD]'].concat([].slice.call(arguments))); } catch (e) {} }

  function gmRequest(opts) {
    return new Promise(function (resolve, reject) {
      if (typeof GM_xmlhttpRequest !== 'function') {
        return reject(new Error('GM_xmlhttpRequest unavailable - check the @grant block'));
      }
      var o = {};
      for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k]; }
      o.onload = function (r) { resolve(r); };
      o.onerror = function () { reject(new Error('network error')); };
      o.ontimeout = function () { reject(new Error('timeout')); };
      GM_xmlhttpRequest(o);
    });
  }

  function stripQuery(u) { return String(u || '').split('#')[0].split('?')[0]; }

  function extFromUrl(u) {
    var m = stripQuery(u).match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toLowerCase() : 'jpg';
  }

  /* ================================================= 3. filename pipeline */

  var WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  function sanitize(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/[\u0000-\u001f\u007f]/g, '');
    s = s.replace(/[\\/:*?"<>|]/g, '_');
    s = s.replace(/\s+/g, '_');
    s = s.replace(/_{2,}/g, '_');
    s = s.replace(/^[.\s_]+/, '').replace(/[.\s_]+$/, '');
    if (WIN_RESERVED.test(s)) s = '_' + s;
    return s;
  }

  function truncate(s, n) {
    if (s.length <= n) return s;
    s = s.slice(0, n);
    var cut = s.lastIndexOf('_');
    if (cut > n * 0.6) s = s.slice(0, cut);
    return s.replace(/[.\s_]+$/, '');
  }

  function makeNamer() {
    var used = Object.create(null);
    return {
      build: function (meta) {
        var m = meta || {};
        var tags = (m.tags || []).slice(0, Math.max(0, CFG.maxTags));
        var map = {
          tags: tags.join(CFG.tagSep || '_'),
          id: m.id == null ? '' : String(m.id),
          rating: m.rating || '',
          site: adapter() ? adapter().id : host(),
          user: m.user || '',
          md5: m.md5 || '',
          ext: m.ext || extFromUrl(m.fileUrl)
        };
        var name = String(CFG.template || DEFAULTS.template)
          .replace(/\{\{\s*(\w+)\s*\}\}/g, function (_m, k) {
            return Object.prototype.hasOwnProperty.call(map, k) ? String(map[k]) : '';
          });
        name = sanitize(name);
        if (!name) name = 'image_' + (m.id || Date.now());
        var ext = sanitize(map.ext || '').replace(/^_+|_+$/g, '') || extFromUrl(m.fileUrl);
        name = name.replace(/\.[a-z0-9]{1,5}$/i, '');
        name = truncate(name, 170);
        if (!name) name = 'image_' + (m.id || Date.now());
        var final = name, n = 2;
        while (used[final.toLowerCase() + '.' + ext]) { final = name + '_' + n; n++; }
        used[(final.toLowerCase() + '.' + ext)] = true;
        return final + '.' + ext;
      }
    };
  }

  /* ==================================================== 4. metadata resolve */

  var META_CACHE = new Map();   // key -> promise
  var ERRORS = [];

  function parsePostHtml(html, baseUrl) {
    var out = {};
    var doc = new DOMParser().parseFromString(html, 'text/html');

    // highest-priority explicit "original" links first
    // Moebooru: a.original-file-unchanged -> /image/<md5>/<name>.<ext> (the real original)
    //           a.original-file-changed / a#highres -> /jpeg/... (a "larger version", NOT the source)
    var cands = [
      'a.original-file-unchanged', 'a[href*="/image/"]', 'a#png',
      'a.original-file-changed', 'a#highres', 'a#image-link', 'a[download]'
    ];
    for (var i = 0; i < cands.length && !out.fileUrl; i++) {
      var el = doc.querySelector(cands[i]);
      if (el && el.getAttribute('href')) out.fileUrl = new URL(el.getAttribute('href'), baseUrl).href;
    }
    if (!out.fileUrl) {
      var og = doc.querySelector('meta[property="og:image"], meta[name="og:image"]');
      if (og && og.getAttribute('content')) out.fileUrl = new URL(og.getAttribute('content'), baseUrl).href;
    }
    if (!out.fileUrl) {
      var im = doc.querySelector('img#image, img#image-resize, #image-container img');
      if (im && im.getAttribute('src')) out.fileUrl = new URL(im.getAttribute('src'), baseUrl).href;
    }

    var tags = [];
    var tagSels = ['ul#tag-sidebar a', 'section#tags a', '#tags-list a', 'a.tag',
                   'a[href*="tags="]', 'a[href*="/posts?tags="]', '.tag-list a'];
    for (var s = 0; s < tagSels.length && tags.length < 4; s++) {
      doc.querySelectorAll(tagSels[s]).forEach(function (a) {
        var t = (a.textContent || '').replace(/\s+/g, ' ').trim().replace(/ /g, '_');
        if (!t || t.length > 80) return;
        if (/[?&=<>\\\/:]/.test(t)) return;   // url fragment, not a tag
        if (!/[a-z0-9]/i.test(t)) return;      // punctuation only
        if (/^[-+]/.test(t)) return;
        if (tags.indexOf(t) >= 0 || tags.length >= 60) return;
        tags.push(t);
      });
    }
    if (tags.length) out.tags = tags;

    var r = doc.querySelector('a[href*="rating:"]');
    if (r) { var rm = (r.getAttribute('href') || '').match(/rating:([a-z]+)/i); if (rm) out.rating = rm[1]; }
    return out;
  }

  function mergeMeta(a, b) {
    if (!b) return a;
    var m = {};
    m.fileUrl = (a && a.fileUrl) || b.fileUrl || null;
    m.tags = (a && a.tags && a.tags.length) ? a.tags : (b.tags || []);
    m.rating = (a && a.rating) || b.rating || null;
    m.id = (a && a.id) || b.id || null;
    m.user = (a && a.user) || b.user || null;
    m.md5 = (a && a.md5) || b.md5 || null;
    m.ext = (a && a.ext) || b.ext || null;
    m.site = (a && a.site) || b.site || null;
    return m;
  }

  async function resolveMeta(post) {
    var key = post.site + ':' + (post.id || post.origUrl || post.uid);
    if (META_CACHE.has(key)) return META_CACHE.get(key);
    var p = (async function () {
      var ad = adapter() || { };
      var meta = {
        fileUrl: post.origUrl || null,
        tags: post.domTags || [],
        rating: post.rating || null,
        id: post.id || null,
        site: post.site,
        user: null, md5: null, ext: null
      };

      // tier 2: site JSON API
      if (CFG.preferApi && ad.api && post.id && (!meta.fileUrl || !meta.tags.length)) {
        try {
          var r = await gmRequest({
            method: 'GET',
            url: ad.api.call(ad, post.id),
            headers: { Accept: 'application/json, text/plain, */*' },
            timeout: 20000
          });
          if (r.status >= 200 && r.status < 300 && r.responseText) {
            var txt = r.responseText.replace(/^\uFEFF/, '').trim();
            var j = JSON.parse(txt);
            var parsed = ad.parseApi ? ad.parseApi(j) : null;
            if (parsed) meta = mergeMeta(meta, parsed);
          }
        } catch (e) { log('api tier failed', post.id, e && e.message); }
      }

      // tier 3: post page HTML (og:image + tag links)
      if ((!meta.fileUrl || !meta.tags.length) && post.href) {
        try {
          var r2 = await gmRequest({ method: 'GET', url: post.href, timeout: 25000 });
          if (r2.status >= 200 && r2.status < 300 && r2.responseText) {
            meta = mergeMeta(meta, parsePostHtml(r2.responseText, post.href));
          }
        } catch (e2) { log('html tier failed', post.href, e2 && e2.message); }
      }

      if (!meta.fileUrl) throw new Error('could not resolve an original file url');
      meta.fileUrl = meta.fileUrl.replace(/&amp;/g, '&');
      if (!meta.ext) meta.ext = extFromUrl(meta.fileUrl);
      return meta;
    })();
    META_CACHE.set(key, p);
    p.catch(function () { META_CACHE.delete(key); });
    return p;
  }

  /* ==================================================== 5. download engine */

  function anchorSave(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 120000);
  }

  function refererHeaders() {
    return CFG.sendReferer ? { Referer: location.origin + '/' } : undefined;
  }

  function downloadOne(meta, filename) {
    return new Promise(function (resolve, reject) {
      if (!CFG.forceBlob && typeof GM_download === 'function') {
        GM_download({
          url: meta.fileUrl,
          name: filename,
          saveAs: false,
          headers: refererHeaders(),
          onload: function () { resolve('GM_download'); },
          onerror: function (e) {
            reject(new Error('GM_download: ' + ((e && (e.error || e.details)) || 'failed')));
          },
          ontimeout: function () { reject(new Error('GM_download timed out')); }
        });
        return;
      }
      gmRequest({
        method: 'GET',
        url: meta.fileUrl,
        responseType: 'blob',
        headers: refererHeaders(),
        timeout: 60000
      }).then(function (r) {
        if (r.status < 200 || r.status >= 300) return reject(new Error('HTTP ' + r.status));
        if (!r.response) return reject(new Error('empty response'));
        anchorSave(r.response, filename);
        resolve('blob');
      }).catch(reject);
    });
  }

  function fetchBlob(url) {
    return gmRequest({ method: 'GET', url: url, responseType: 'blob', headers: refererHeaders(), timeout: 120000 })
      .then(function (r) {
        if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
        if (!r.response) throw new Error('empty response');
        return r.response;
      });
  }

  /* ------------------------------------------- 5b. zip writer (no deps) */
  /* Store-only ZIP: no compression, no third-party code, works offline.
     Every booru file format is already compressed, so 'stored' costs ~0%.
     ZIP64 is deliberately not implemented; the caller guards the 4 GB limit. */

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256), n, k, c;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosStamp(d) {
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | (Math.floor(d.getSeconds() / 2) & 31),
      date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
  }

  function ZipWriter() {
    this.parts = [];
    this.entries = [];
    this.size = 0;
  }

  ZipWriter.prototype.add = function (name, bytes) {
    var nameBytes = new TextEncoder().encode(name);
    var crc = crc32(bytes);
    var dt = dosStamp(new Date());
    var head = new Uint8Array(30 + nameBytes.length);
    var v = new DataView(head.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true);      // flags: UTF-8 filename
    v.setUint16(8, 0, true);           // method: 0 = stored
    v.setUint16(10, dt.time, true);
    v.setUint16(12, dt.date, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, bytes.length, true);
    v.setUint32(22, bytes.length, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true);          // extra field length
    head.set(nameBytes, 30);
    this.entries.push({ name: nameBytes, crc: crc, size: bytes.length, offset: this.size, time: dt.time, date: dt.date });
    this.parts.push(head, bytes);
    this.size += head.length + bytes.length;
  };

  ZipWriter.prototype.finish = function () {
    var cd = [], cdSize = 0, i, e, ch, v;
    for (i = 0; i < this.entries.length; i++) {
      e = this.entries[i];
      ch = new Uint8Array(46 + e.name.length);
      v = new DataView(ch.buffer);
      v.setUint32(0, 0x02014b50, true);
      v.setUint16(4, 20, true);        // version made by
      v.setUint16(6, 20, true);        // version needed
      v.setUint16(8, 0x0800, true);    // flags
      v.setUint16(10, 0, true);        // method
      v.setUint16(12, e.time, true);
      v.setUint16(14, e.date, true);
      v.setUint32(16, e.crc, true);
      v.setUint32(20, e.size, true);
      v.setUint32(24, e.size, true);
      v.setUint16(28, e.name.length, true);
      v.setUint16(30, 0, true);        // extra
      v.setUint16(32, 0, true);        // comment
      v.setUint16(34, 0, true);        // disk start
      v.setUint16(36, 0, true);        // internal attrs
      v.setUint32(38, 0, true);        // external attrs
      v.setUint32(42, e.offset, true);
      ch.set(e.name, 46);
      cd.push(ch);
      cdSize += ch.length;
    }
    var end = new Uint8Array(22);
    var v2 = new DataView(end.buffer);
    v2.setUint32(0, 0x06054b50, true);
    v2.setUint16(4, 0, true);
    v2.setUint16(6, 0, true);
    v2.setUint16(8, this.entries.length, true);
    v2.setUint16(10, this.entries.length, true);
    v2.setUint32(12, cdSize, true);
    v2.setUint32(16, this.size, true);
    v2.setUint16(20, 0, true);
    return new Blob(this.parts.concat(cd, [end]), { type: 'application/zip' });
  };

  /* =========================================================== 6. the panel */

  var CSS = [
    '.bbd-box{position:absolute;top:6px;left:6px;z-index:2147483000;display:flex;gap:4px;align-items:center;font:12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;opacity:.35;transition:opacity .12s}',
    '.bbd-host:hover > .bbd-box,.bbd-box:focus-within,.bbd-box.bbd-on{opacity:1}',
    '.bbd-host{position:relative}',
    '.bbd-check{width:16px;height:16px;margin:0;cursor:pointer;accent-color:#22c55e}',
    '.bbd-btn{all:unset;box-sizing:border-box;cursor:pointer;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:4px;background:rgba(15,23,42,.8);color:#e2e8f0;border:1px solid rgba(148,163,184,.5);font-size:12px;line-height:1;text-align:center}',
    '.bbd-btn:hover{background:#2563eb;border-color:#2563eb;color:#fff}',
    '.bbd-btn.bbd-busy{background:#f59e0b;border-color:#f59e0b;color:#111}',
    '.bbd-btn.bbd-ok{background:#22c55e;border-color:#22c55e;color:#06210f}',
    '.bbd-btn.bbd-err{background:#ef4444;border-color:#ef4444;color:#fff}',
    '.bbd-host.bbd-sel{outline:3px solid #22c55e;outline-offset:-3px;border-radius:4px}',
    '#bbd-panel{position:fixed;right:14px;bottom:14px;z-index:2147483001;width:286px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.45);font:12px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}',
    '#bbd-panel *{box-sizing:border-box}',
    '#bbd-panel .h{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1e293b;border-radius:9px 9px 0 0;cursor:move;user-select:none;font-weight:600}',
    '#bbd-panel .h .sp{margin-left:auto;cursor:pointer;opacity:.7;padding:0 4px}',
    '#bbd-panel .h .sp:hover{opacity:1}',
    '#bbd-panel .b{padding:10px}',
    '#bbd-panel.min .b{display:none}',
    '#bbd-panel .row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
    '#bbd-panel button.act{all:unset;cursor:pointer;padding:5px 9px;border-radius:6px;background:#1e293b;border:1px solid #334155;color:#e2e8f0;text-align:center}',
    '#bbd-panel button.act:hover{background:#334155}',
    '#bbd-panel button.act.pri{background:#2563eb;border-color:#2563eb;color:#fff}',
    '#bbd-panel button.act.pri:hover{background:#1d4ed8}',
    '#bbd-panel .count{font-weight:700;color:#4ade80}',
    '#bbd-panel details{margin:2px 0 8px}',
    '#bbd-panel summary{cursor:pointer;opacity:.85;padding:2px 0}',
    '#bbd-panel label.f{display:block;margin:6px 0 2px;opacity:.75}',
    '#bbd-panel input[type=text],#bbd-panel input[type=number]{width:100%;padding:4px 6px;border-radius:5px;border:1px solid #334155;background:#020617;color:#e2e8f0;font:inherit}',
    '#bbd-panel input[type=checkbox]{accent-color:#22c55e}',
    '#bbd-panel .status{margin-top:4px;padding-top:7px;border-top:1px solid #1e293b;opacity:.85;min-height:16px;word-break:break-word}',
    '#bbd-panel .status.err{color:#fca5a5}',
    '#bbd-panel .hint{opacity:.55;font-size:11px;margin-top:6px}'
  ].join('\n');

  var PANEL = null, STATUS_EL = null, COUNT_EL = null;

  function setStatus(msg, isErr) {
    if (!STATUS_EL) { log('status:', msg); return; }
    STATUS_EL.textContent = msg;
    STATUS_EL.className = 'status' + (isErr ? ' err' : '');
  }

  function buildPanel() {
    if (PANEL) return PANEL;
    var st = document.createElement('style');
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);

    var p = document.createElement('div');
    p.id = 'bbd-panel';
    if (CFG.collapsed) p.classList.add('min');

    var html = '';
    html += '<div class="h"><span>&#11015; Booru Bulk</span><span class="sp" id="bbd-min">&#8722;</span></div>';
    html += '<div class="b">';
    html += '<div class="row"><span>Selected: <span class="count" id="bbd-count">0</span></span></div>';
    html += '<div class="row">';
    html += '<button class="act pri" id="bbd-go">Download selected</button>';
    html += '<button class="act" id="bbd-zip">Save as .zip</button>';
    html += '</div>';
    html += '<div class="row">';
    html += '<button class="act" id="bbd-all">Select all</button>';
    html += '<button class="act" id="bbd-none">Clear</button>';
    html += '<button class="act" id="bbd-retry">Retry failed</button>';
    html += '</div>';
    html += '<details id="bbd-opts"><summary>Filename &amp; options</summary>';
    html += '<label class="f">Filename template</label>';
    html += '<input type="text" id="bbd-tpl" value="">';
    html += '<label class="f">Max tags</label><input type="number" id="bbd-maxtags" min="1" max="200">';
    html += '<label class="f">Tag separator</label><input type="text" id="bbd-sep" maxlength="3">';
    html += '<label class="f">Parallel downloads</label><input type="number" id="bbd-conc" min="1" max="8">';
    html += '<label class="f"><input type="checkbox" id="bbd-api"> Prefer site JSON API</label>';
    html += '<label class="f"><input type="checkbox" id="bbd-ref"> Send Referer header</label>';
    html += '<label class="f"><input type="checkbox" id="bbd-forceblob"> Always use in-page blob download</label>';
    html += '<label class="f">Gelbooru/Rule34 api_key (optional)</label><input type="text" id="bbd-key">';
    html += '<label class="f">&#8230; user_id (optional)</label><input type="text" id="bbd-uid">';
    html += '<div class="hint">Tokens: {{tags}} {{id}} {{rating}} {{site}} {{user}} {{md5}} {{ext}}</div>';
    html += '</details>';
    html += '<div class="status" id="bbd-status">Ready.</div>';
    html += '</div>';
    p.innerHTML = html;
    document.body.appendChild(p);
    PANEL = p;

    STATUS_EL = p.querySelector('#bbd-status');
    COUNT_EL = p.querySelector('#bbd-count');

    var tpl = p.querySelector('#bbd-tpl');
    var maxTags = p.querySelector('#bbd-maxtags');
    var sep = p.querySelector('#bbd-sep');
    var conc = p.querySelector('#bbd-conc');
    var api = p.querySelector('#bbd-api');
    var ref = p.querySelector('#bbd-ref');
    var fblob = p.querySelector('#bbd-forceblob');
    var key = p.querySelector('#bbd-key');
    var uid = p.querySelector('#bbd-uid');

    tpl.value = CFG.template;
    maxTags.value = CFG.maxTags;
    sep.value = CFG.tagSep;
    conc.value = CFG.concurrency;
    api.checked = !!CFG.preferApi;
    ref.checked = !!CFG.sendReferer;
    fblob.checked = !!CFG.forceBlob;
    key.value = CFG.apiKey || '';
    uid.value = CFG.apiUserId || '';

    function sync() {
      CFG.template = tpl.value || DEFAULTS.template;
      CFG.maxTags = Math.max(1, parseInt(maxTags.value, 10) || DEFAULTS.maxTags);
      CFG.tagSep = sep.value || '_';
      CFG.concurrency = Math.min(8, Math.max(1, parseInt(conc.value, 10) || 1));
      CFG.preferApi = !!api.checked;
      CFG.sendReferer = !!ref.checked;
      CFG.forceBlob = !!fblob.checked;
      CFG.apiKey = key.value.trim();
      CFG.apiUserId = uid.value.trim();
      saveCfg();
      META_CACHE.clear();
    }
    [tpl, maxTags, sep, conc, api, ref, key, uid, fblob].forEach(function (el) {
      el.addEventListener('change', sync);
      el.addEventListener('input', function () { if (el.type === 'text') sync(); });
    });

    p.querySelector('#bbd-min').addEventListener('click', function (e) {
      e.stopPropagation();
      p.classList.toggle('min');
      CFG.collapsed = p.classList.contains('min');
      saveCfg();
    });
    p.querySelector('#bbd-go').addEventListener('click', function () { batch(false); });
    p.querySelector('#bbd-zip').addEventListener('click', function () { batch(true); });
    p.querySelector('#bbd-all').addEventListener('click', selectAll);
    p.querySelector('#bbd-none').addEventListener('click', clearSel);
    p.querySelector('#bbd-retry').addEventListener('click', retryFailed);

    makeDraggable(p, p.querySelector('.h'));
    if (CFG.panelX != null && CFG.panelY != null) {
      p.style.left = CFG.panelX + 'px';
      p.style.top = CFG.panelY + 'px';
      p.style.right = 'auto';
      p.style.bottom = 'auto';
    }
    refreshCount();
    return p;
  }

  function makeDraggable(el, handle) {
    var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.addEventListener('mousedown', function (e) {
      if (e.target && e.target.id === 'bbd-min') return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      var r = el.getBoundingClientRect();
      ox = r.left; oy = r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var x = ox + (e.clientX - sx), y = oy + (e.clientY - sy);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      var r = el.getBoundingClientRect();
      CFG.panelX = Math.round(r.left); CFG.panelY = Math.round(r.top);
      saveCfg();
    });
  }

  /* ========================================================= 7. selection */

  var POSTS = Object.create(null);
  var ORDER = [];
  var SEL = new Set();
  var LAST = -1;
  var UID = 0;
  var FAILED = [];

  function refreshCount() {
    if (COUNT_EL) COUNT_EL.textContent = String(SEL.size);
    ORDER.forEach(function (u) {
      var post = POSTS[u];
      if (!post || !post.el) return;
      var on = SEL.has(u);
      post.el.classList.toggle('bbd-sel', on);
      if (post.cb && post.cb.checked !== on) post.cb.checked = on;
      if (post.box) post.box.classList.toggle('bbd-on', on);
    });
  }

  function toggle(uid, on) {
    if (on) { SEL.add(uid); } else { SEL.delete(uid); }
    var post = POSTS[uid];
    if (post && post.box) post.box.classList.toggle('bbd-on', !!on || !!(post.cb && post.cb.checked));
    refreshCount();
  }

  function rangeSelect(a, b) {
    var lo = Math.min(a, b), hi = Math.max(a, b);
    for (var i = lo; i <= hi; i++) if (ORDER[i]) SEL.add(ORDER[i]);
    refreshCount();
  }

  function selectAll() {
    ORDER.forEach(function (u) { SEL.add(u); });
    refreshCount();
    setStatus('Selected ' + SEL.size + ' across ' + ORDER.length + ' items.');
  }

  function clearSel() {
    SEL.clear();
    refreshCount();
    setStatus('Selection cleared.');
  }

  /* ========================================================= 8. injection */

  function injectUI(item, post) {
    var uid = 'bbd-' + (++UID);
    post.uid = uid;
    post.el = item;
    POSTS[uid] = post;
    ORDER.push(uid);

    item.classList.add('bbd-host');

    var box = document.createElement('div');
    box.className = 'bbd-box';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'bbd-check';
    cb.title = 'Add to batch (shift-click for a range)';
    cb.addEventListener('click', function (e) {
      e.stopPropagation();
      var idx = ORDER.indexOf(uid);
      if (e.shiftKey && LAST >= 0) { rangeSelect(LAST, idx); cb.checked = true; }
      LAST = idx;
    });
    cb.addEventListener('change', function (e) { e.stopPropagation(); toggle(uid, cb.checked); });
    cb.addEventListener('mousedown', function (e) { e.stopPropagation(); });

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bbd-btn';
    btn.textContent = '\u2913';
    btn.title = 'Download this image at full resolution';
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      one(post, btn);
    });
    btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });

    box.appendChild(cb);
    box.appendChild(btn);
    item.appendChild(box);

    post.cb = cb;
    post.btn = btn;
    post.box = box;
    return uid;
  }

  function scan() {
    var ad = adapter();
    if (!ad) return 0;
    var added = 0;
    var items = document.querySelectorAll(ad.itemSel);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.nodeType !== 1) continue;
      var holder = ad.imageLevel ? item.parentElement : item;
      if (!holder || holder.dataset.bbdReady === '1') continue;
      var img = ad.imageLevel ? item : item.querySelector('img');
      if (!img) continue;
      var id = safe(function () { return ad.idFrom(item, img); });
      var origUrl = safe(function () { return ad.origFrom ? ad.origFrom(item, img) : null; });
      if (!id && !origUrl) continue;
      var post = {
        site: ad.id,
        id: id,
        href: safe(function () { return ad.linkFrom ? ad.linkFrom(item, img) : null; }),
        origUrl: origUrl,
        domTags: safe(function () { return ad.tagsFromDom ? ad.tagsFromDom(item, img) : null; }),
        rating: safe(function () { return ad.ratingFromDom ? ad.ratingFromDom(item, img) : null; })
      };
      if (post.href && !/^https?:/i.test(post.href)) post.href = null;
      holder.dataset.bbdReady = '1';
      injectUI(holder, post);
      added++;
    }
    if (added) log('added controls to', added, 'items');
    return added;
  }

  /* ==================================================== 9. batch machinery */

  function setBtn(btn, cls) {
    if (!btn) return;
    btn.classList.remove('bbd-busy', 'bbd-ok', 'bbd-err');
    if (cls) btn.classList.add(cls);
  }

  async function one(post, btn) {
    setBtn(btn, 'bbd-busy');
    try {
      setStatus('Resolving ' + (post.id || 'image') + '\u2026');
      var meta = await resolveMeta(post);
      var name = makeNamer().build(meta);
      setStatus('Saving ' + name + '\u2026');
      await downloadOne(meta, name);
      setBtn(btn, 'bbd-ok');
      setStatus('Saved: ' + name);
    } catch (err) {
      setBtn(btn, 'bbd-err');
      setStatus('Failed (' + (post.id || '?') + '): ' + (err && err.message || err), true);
      FAILED.push(post);
    }
  }

  async function pool(items, limit, worker) {
    var next = 0, done = 0, failed = 0;
    async function runner() {
      for (;;) {
        var my = next++;
        if (my >= items.length) return;
        try { await worker(items[my], my, done + failed); }
        catch (e) {
          failed++;
          log('item failed', e && e.message);
        }
        done++;
        setStatus('Working\u2026 ' + (done + failed) + '/' + items.length + (failed ? ' (' + failed + ' failed)' : ''));
        await sleep(Math.max(0, CFG.gapMs));
      }
    }
    var runners = [];
    for (var i = 0; i < Math.min(Math.max(1, limit), items.length); i++) runners.push(runner());
    await Promise.all(runners);
    return { failed: failed, done: done };
  }

  async function batch(asZip) {
    var posts = ORDER.filter(function (u) { return SEL.has(u); }).map(function (u) { return POSTS[u]; });
    if (!posts.length) { setStatus('Nothing selected yet.', true); return; }
    var namer = makeNamer();
    var collected = [];
    FAILED = [];

    if (asZip) {
      var zw = new ZipWriter();
      var res = await pool(posts, CFG.concurrency, async function (post) {
        var meta = await resolveMeta(post);
        var name = namer.build(meta);
        var blob = await fetchBlob(meta.fileUrl);
        var bytes = new Uint8Array(await blob.arrayBuffer());
        if (zw.size + bytes.length > 3800000000) {
          throw new Error('this archive would pass 3.8 GB - use Download selected instead');
        }
        zw.add(name, bytes);
        collected.push(name);
        if (post.btn) setBtn(post.btn, 'bbd-ok');
      });
      setStatus('Packaging ' + collected.length + ' files\u2026');
      var zipName = 'booru_selection_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.zip';
      anchorSave(zw.finish(), zipName);
      setStatus('ZIP built: ' + zipName + ' (' + collected.length + ' files, ' + res.failed + ' failed)');
      return;
    }

    var res2 = await pool(posts, CFG.concurrency, async function (post) {
      if (post.btn) setBtn(post.btn, 'bbd-busy');
      try {
        var meta = await resolveMeta(post);
        var name = namer.build(meta);
        await downloadOne(meta, name);
        if (post.btn) setBtn(post.btn, 'bbd-ok');
      } catch (e) {
        if (post.btn) setBtn(post.btn, 'bbd-err');
        FAILED.push(post);
        throw e;
      }
    });
    setStatus('Done: ' + (posts.length - res2.failed) + ' saved' + (res2.failed ? ', ' + res2.failed + ' failed (see Retry failed)' : '') + '.', !!res2.failed);
  }

  async function retryFailed() {
    if (!FAILED.length) { setStatus('No failed items to retry.'); return; }
    var list = FAILED.slice();
    FAILED = [];
    list.forEach(function (post) {
      if (post.uid) { SEL.add(post.uid); }
    });
    refreshCount();
    setStatus('Retrying ' + list.length + '\u2026');
    var namer = makeNamer();
    var res = await pool(list, CFG.concurrency, async function (post) {
      var meta = await resolveMeta(post);
      var name = namer.build(meta);
      await downloadOne(meta, name);
      if (post.btn) setBtn(post.btn, 'bbd-ok');
    });
    setStatus('Retry finished: ' + (list.length - res.failed) + ' ok, ' + res.failed + ' still failing.', !!res.failed);
  }

  /* ============================================================== 10. boot */

  function boot() {
    if (document.getElementById('bbd-panel')) return;
    buildPanel();
    var n = scan();
    setStatus(n ? ('Found ' + n + ' image' + (n === 1 ? '' : 's') + ' on this page.') : 'No supported images found on this page yet.');

    var pending = null;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = setTimeout(function () { pending = null; scan(); refreshCount(); }, 400);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    var lastUrl = location.href;
    setInterval(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        META_CACHE.clear();
        POSTS = Object.create(null); ORDER = []; SEL = new Set(); LAST = -1;
        refreshCount();
        setTimeout(function () { scan(); refreshCount(); }, 700);
      }
    }, 800);

    window.addEventListener('keydown', function (e) {
      if (!e.altKey) return;
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); batch(false); }
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); selectAll(); }
    });

    log('ready on', host());
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot);
})();
