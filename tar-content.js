/*
 * TAR — fills the existing page from the Google Sheet.
 * The HTML already on the page is the fallback: if the Sheet can't be reached,
 * visitors just see what's written in index.html.
 * Contact and Join forms are also sent to the Sheet (see the Inbox tab in the editor).
 */
(function () {
  'use strict';

  var API = (window.TAR_API || '').trim();
  if (!API || API.indexOf('PASTE_') === 0) return; // not connected yet: leave the page as-is

  var CACHE_KEY = 'tar_content_v1';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var safeUrl = function (u) { return /^https?:\/\//i.test(u || '') ? u : ''; };
  var isTrue = function (v) { return String(v).toUpperCase() === 'TRUE'; };
  var trunc = function (s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;
  };
  var initials = function (name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length || /^name tbd$/i.test(name)) return '—';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  };

  // A few styles for the small things this script adds (links, empty states).
  var style = document.createElement('style');
  style.textContent =
    '.tar-link{display:inline-block;font-family:"IBM Plex Sans",sans-serif;font-weight:600;font-size:13.5px;color:var(--ink);border-bottom:1.5px solid var(--red);text-decoration:none;padding-bottom:1px}' +
    '.tar-link:hover{color:var(--red)}' +
    '.tar-plain{color:inherit;text-decoration:none}' +
    '.tar-plain:hover{text-decoration:underline}' +
    '.tar-empty{font-family:"IBM Plex Sans",sans-serif;font-size:15px;opacity:.7;margin:0}' +
    '.tar-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '.avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}' +
    '.confirm-msg.tar-error{color:var(--red);border-color:var(--red)}';
  document.head.appendChild(style);

  // ---------- Rendering ----------
  function render(d) {
    [renderSettings, renderEpisodes, renderRaw, renderArticles, renderStaff, renderFeed].forEach(function (fn) {
      try { fn(d); } catch (e) { if (window.console) console.warn('TAR content:', fn.name, e); }
    });
  }

  function empty(msg) { return '<p class="tar-empty">' + esc(msg) + '</p>'; }

  function renderEpisodes(d) {
    var el = $('#tab-episodes .ep-grid');
    if (!el) return;
    var list = d.episodes || [];
    if (!list.length) { el.innerHTML = empty('No episodes yet. Check back soon.'); return; }
    el.innerHTML = list.map(function (e) {
      var link = safeUrl(e.video_url);
      return '<div class="ep-card">' +
        '<div class="ep-thumb">' + (e.number ? '<span class="num ui">EP. ' + esc(e.number) + '</span>' : '') + '</div>' +
        '<div class="ep-body">' +
        (e.meta ? '<div class="ep-meta">' + esc(e.meta) + '</div>' : '') +
        '<h3>' + esc(e.title) + '</h3>' +
        (e.description ? '<p>' + esc(e.description) + '</p>' : '') +
        (link ? '<a class="tar-link" href="' + esc(link) + '" target="_blank" rel="noopener">Watch the episode</a>' : '') +
        '</div></div>';
    }).join('');
  }

  function renderRaw(d) {
    var el = $('#tab-raw .raw-list');
    if (!el) return;
    var list = d.raw || [];
    if (!list.length) { el.innerHTML = empty('No raw footage posted yet.'); return; }
    el.innerHTML = list.map(function (r, i) {
      var link = safeUrl(r.video_url);
      var code = r.code || ('RAW · ' + String(i + 1).padStart(3, '0'));
      var title = link
        ? '<a class="tar-plain" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a>'
        : esc(r.title);
      return '<div class="raw-row"><div class="code ui">' + esc(code) + '</div><h4>' + title +
        '</h4><div class="len ui">' + esc(r.length) + '</div></div>';
    }).join('');
  }

  function articleTitle(a, tag) {
    var link = safeUrl(a.url);
    return link
      ? '<a class="tar-plain" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a>'
      : esc(a.title);
  }

  function renderArticles(d) {
    var list = d.articles || [];
    var featured = list.filter(function (a) { return isTrue(a.featured); })[0];
    var rest = list.filter(function (a) { return a !== featured; });

    var fEl = $('#page-articles .featured-article');
    if (fEl) {
      if (featured) {
        var link = safeUrl(featured.url);
        fEl.style.display = '';
        fEl.innerHTML = '<div class="art-thumb"></div><div>' +
          '<div class="tag">' + esc(featured.tag || 'Feature') + '</div>' +
          '<h2>' + articleTitle(featured) + '</h2>' +
          (featured.summary ? '<p class="dek">' + esc(featured.summary) + '</p>' : '') +
          (featured.byline ? '<div class="byline">' + esc(featured.byline) + '</div>' : '') +
          (link ? '<p><a class="tar-link" href="' + esc(link) + '" target="_blank" rel="noopener">Read the full story</a></p>' : '') +
          '</div>';
      } else {
        fEl.style.display = 'none';
      }
    }

    var gEl = $('#page-articles .article-grid');
    if (gEl) {
      gEl.innerHTML = rest.length ? rest.map(function (a) {
        var l = safeUrl(a.url);
        return '<div class="article-card"><div class="art-thumb-sm"></div>' +
          (a.tag ? '<div class="tag">' + esc(a.tag) + '</div>' : '') +
          '<h4>' + articleTitle(a) + '</h4>' +
          (a.summary ? '<p>' + esc(a.summary) + '</p>' : '') +
          (a.byline ? '<div class="byline">' + esc(a.byline) + '</div>' : '') +
          '</div>';
      }).join('') : (featured ? '' : empty('No articles yet. Check back soon.'));
    }
  }

  function renderStaff(d) {
    var el = $('#page-staff .staff-grid');
    if (!el) return;
    var list = d.staff || [];
    if (!list.length) { el.innerHTML = empty('Our team page is coming soon.'); return; }
    el.innerHTML = list.map(function (s) {
      var photo = safeUrl(s.photo_url);
      return '<div class="staff-card"><div class="avatar ui">' +
        (photo ? '<img src="' + esc(photo) + '" alt="' + esc(s.name) + '">' : esc(initials(s.name))) +
        '</div><h4>' + esc(s.name) + '</h4>' +
        (s.role ? '<div class="role ui">' + esc(s.role) + '</div>' : '') +
        (s.bio ? '<p class="bio">' + esc(s.bio) + '</p>' : '') + '</div>';
    }).join('');
  }

  function renderFeed(d) {
    var el = $('.feed-grid');
    if (!el) return;
    var items = [];
    (d.episodes || []).forEach(function (e) {
      items.push({ tag: e.number ? 'Episode ' + e.number : 'Episode', title: e.title, text: trunc(e.description, 130), url: e.video_url, thumb: true, date: e.date, home: e.home });
    });
    (d.raw || []).forEach(function (r) {
      items.push({ tag: 'Raw Footage', title: r.title, text: trunc(r.description, 130), url: r.video_url, thumb: true, date: r.date, home: r.home });
    });
    (d.articles || []).forEach(function (a) {
      items.push({ tag: 'Article', title: a.title, text: trunc(a.summary, 130), url: a.url, thumb: false, date: a.date, home: a.home });
    });
    items = items.filter(function (i) { return isTrue(i.home); });
    items.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    items = items.slice(0, 8);
    if (!items.length) { el.innerHTML = empty('New stories are on the way.'); return; }
    el.innerHTML = items.map(function (i) {
      var link = safeUrl(i.url);
      var title = link
        ? '<a class="tar-plain" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(i.title) + '</a>'
        : esc(i.title);
      return '<div class="feed-card">' + (i.thumb ? '<div class="thumb"></div>' : '') +
        '<div class="tag">' + esc(i.tag) + '</div><h4>' + title + '</h4>' +
        (i.text ? '<p>' + esc(i.text) + '</p>' : '') + '</div>';
    }).join('');
  }

  function renderSettings(d) {
    var s = d.settings || {};
    var setText = function (sel, val, idx) {
      if (!val) return;
      var els = $$(sel);
      var el = els[idx || 0];
      if (el) el.textContent = val;
    };
    var setHref = function (sel, val, idx) {
      var u = safeUrl(val);
      if (!u) return;
      var el = $$(sel)[idx || 0];
      if (el) { el.setAttribute('href', u); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
    };

    setText('.hero .eyebrow-plain', s.hero_eyebrow);
    if (s.hero_line1) {
      var h1 = $('.hero h1');
      if (h1) h1.innerHTML = esc(s.hero_line1) + '<br>' + esc(s.hero_line2 || '') +
        (s.hero_accent ? ' <span>' + esc(s.hero_accent) + '</span>' : '');
    }
    setText('.hero p.sub', s.hero_sub);

    if (s.mission_quote) {
      var pq = $('.pullquote');
      if (pq) {
        var cite = $('cite', pq);
        pq.innerHTML = esc('"' + s.mission_quote + '"') + (cite ? cite.outerHTML : '');
      }
    }

    ['who_lead', 'who_p2', 'who_p3', 'who_p4'].forEach(function (k, i) {
      setText('#page-who .mission-body p', s[k], i);
    });

    setText('#page-contact .discussion-box strong', s.contact_email);
    setHref('#page-contact .discussion-box a.btn', s.discord_url);

    ['youtube_url', 'instagram_url', 'tiktok_url', 'patreon_url'].forEach(function (k, i) {
      setHref('#page-findus .social-card a.btn', s[k], i);
    });
    setHref('#page-support .support-card.primary a.btn', s.patreon_url);

    if (s.cashapp_tag && /^\$?[A-Za-z0-9_]{1,20}$/.test(s.cashapp_tag)) {
      var tag = s.cashapp_tag.charAt(0) === '$' ? s.cashapp_tag : '$' + s.cashapp_tag;
      setText('#page-support .cashtag', tag);
      var cash = $('#page-support .support-card:not(.primary) a.btn');
      if (cash) cash.setAttribute('href', 'https://cash.app/' + tag);
    }

    setText('#page-join .discussion-box p', s.join_looking_for, 1);
  }

  // ---------- Load: cached copy first, then fresh ----------
  try {
    var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.ok) render(cached);
  } catch (e) { /* no cache; fine */ }

  fetch(API + (API.indexOf('?') > -1 ? '&' : '?') + 'action=content')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.ok) return;
      render(d);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) { /* storage full or blocked */ }
    })
    .catch(function () { /* offline or blocked: the built-in page stays */ });

  // ---------- Contact + Join forms → Google Sheet ----------
  ['leadForm', 'joinForm'].forEach(function (id) {
    var form = document.getElementById(id);
    if (!form) return;
    var hp = document.createElement('input');
    hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.className = 'tar-hp'; hp.setAttribute('aria-hidden', 'true');
    form.appendChild(hp);
  });

  // Capture phase on document runs before the page's own submit handlers,
  // so we can send the data to the Sheet before the form is reset.
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    var isLead = form.id === 'leadForm';
    var isJoin = form.id === 'joinForm';
    if (!isLead && !isJoin) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    var val = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var fields = isLead
      ? { name: val('name'), email: val('email'), topic: val('topic'), message: val('message'), anonymous: !!(document.getElementById('anon') || {}).checked }
      : { name: val('jname'), email: val('jemail'), role: val('jrole'), skills: val('jskills'), link: val('jlink'), message: val('jmessage') };

    var conf = document.getElementById(isLead ? 'confirmMsg' : 'joinConfirmMsg');
    var btn = form.querySelector('button[type=submit]');
    if (conf && !conf.dataset.ok) conf.dataset.ok = conf.textContent;
    if (btn) btn.disabled = true;

    fetch(API, {
      method: 'POST',
      body: JSON.stringify({ action: 'submit', type: isLead ? 'lead' : 'join', fields: fields, website: form.querySelector('[name=website]').value })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Something went wrong.');
        if (conf) { conf.textContent = conf.dataset.ok; conf.classList.remove('tar-error'); conf.classList.add('show'); }
        form.reset();
      })
      .catch(function (err) {
        if (conf) {
          var mail = ($('#page-contact .discussion-box strong') || {}).textContent || 'us';
          conf.textContent = (err && err.message ? err.message + ' ' : '') + 'It did not send. You can email ' + mail + ' instead.';
          conf.classList.add('tar-error', 'show');
        }
      })
      .then(function () { if (btn) btn.disabled = false; });
  }, true);
})();
