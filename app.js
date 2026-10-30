// Twosky 상호작용(점진적 향상). JS가 없거나 이 파일이 깨져도 모든 쪽의 내용·링크는 그대로 보인다.
// 데이터·설정은 빌드가 만든 data.js(window.TWOSKY)에서 받는다. 사양서 docs/spec.md 3장.
(function () {
  'use strict';
  var D = window.TWOSKY;
  if (!D) return;
  var root = document.documentElement;
  var base = root.getAttribute('data-root') || '';
  var M = D.config.motion;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var sectionOf = {};
  D.sections.forEach(function (s) { sectionOf[s.id] = s; });
  var STATUS = { live: '공개', private: '비공개', next: '만드는 중' };
  var show = function (el) { if (el) el.hidden = false; };

  // ── 시드 난수(검증용 ?seed=) ──
  var seed = parseInt(params.get('seed'), 10);
  var rand = isFinite(seed) ? (function (a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  })(seed) : Math.random;

  // ── 테마 ──
  var themeBtn = $('[data-theme-toggle]');
  function syncTheme() {
    var day = root.getAttribute('data-theme') === 'day';
    $('[data-theme-label]', themeBtn).textContent = day ? '밤 하늘로 바꾸기' : '낮 하늘로 바꾸기';
    themeBtn.title = day ? '밤 하늘로' : '낮 하늘로';
  }
  if (themeBtn) {
    show(themeBtn);
    syncTheme();
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'day' ? 'night' : 'day';
      root.classList.add('theme-switch'); // 바꾸는 순간엔 색 전환을 끈다: 바탕만 늦게 바뀌면 글자 대비가 잠깐 1:1까지 떨어진다
      root.setAttribute('data-theme', next);
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('theme-switch'); }); });
      try { localStorage.setItem(D.config.theme.storageKey, next); } catch (e) { /* 이번 방문만 */ }
      syncTheme();
    });
  }

  // ── 명령 팔레트 ──
  var palette = $('#palette'), input = $('#palette-q'), list = $('#palette-list');
  var openBtn = $('[data-open-palette]');
  var entries = [], results = [], active = 0, opener = null;
  function url(page) { return base + page; }
  D.pages.forEach(function (p) { entries.push({ kind: '쪽', name: p.name, note: '', go: url(p.page), page: true }); });
  D.sections.forEach(function (s) { entries.push({ kind: '섹션', name: s.name, note: s.sub, go: url(s.page), page: true, glow: s.id }); });
  D.works.forEach(function (w) {
    var hay = [w.name, w.note, sectionOf[w.section].name, STATUS[w.status], w.detail ? '구조도' : ''].join(' ').toLowerCase();
    entries.push({ kind: sectionOf[w.section].name + ' · ' + (w.detail ? '구조도' : STATUS[w.status]), name: w.name, note: w.note, work: w, hay: hay, glow: w.section });
  });
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return entries.filter(function (e) { return e.page; });
    var hits = entries.filter(function (e) {
      var hay = e.hay || (e.name + ' ' + e.note).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    });
    var rank = function (e) { var n = e.name.toLowerCase(); return n.indexOf(words[0]) === 0 ? 0 : n.indexOf(words[0]) !== -1 ? 1 : 2; };
    return hits.map(function (e, i) { return [rank(e), i, e]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; })
      .slice(0, D.config.palette.max).map(function (x) { return x[2]; });
  }
  function render() {
    list.textContent = '';
    if (!results.length) {
      var none = document.createElement('li');
      none.className = 'palette-empty';
      none.setAttribute('role', 'presentation'); // listbox 안에 option 아닌 자식을 두지 않는다
      none.textContent = '찾는 작업이 없습니다';
      list.appendChild(none);
      input.removeAttribute('aria-activedescendant');
      return;
    }
    results.forEach(function (e, i) {
      var li = document.createElement('li');
      li.className = 'palette-item';
      li.id = 'pal-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      if (e.glow) li.style.setProperty('--glow', 'var(--c-' + e.glow + ')');
      var dot = document.createElement('span'); dot.className = 'palette-dot'; dot.setAttribute('aria-hidden', 'true');
      var name = document.createElement('span'); name.className = 'palette-name'; name.textContent = e.name;
      var kind = document.createElement('span'); kind.className = 'palette-kind'; kind.textContent = e.kind;
      li.appendChild(dot); li.appendChild(name); li.appendChild(kind);
      if (e.note) { var note = document.createElement('span'); note.className = 'palette-note'; note.textContent = e.note; li.appendChild(note); }
      li.addEventListener('mousemove', function () { if (active !== i) { active = i; mark(); } });
      li.addEventListener('click', function () { go(e); });
      list.appendChild(li);
    });
    mark();
  }
  function mark() {
    $$('.palette-item', list).forEach(function (li, i) { li.setAttribute('aria-selected', i === active ? 'true' : 'false'); });
    var cur = $('#pal-' + active);
    if (cur) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
  }
  function go(e) {
    var w = e.work;
    closePalette();
    if (!w) { location.href = e.go; return; }
    if (w.detail) location.href = url('work/' + w.id + '.html');
    else if (w.section === 'motion') location.href = url('motion.html') + '#w-' + w.id; // 영상은 그 쪽 안에서 재생(사양서 3장)
    else if (w.status === 'live') window.open(w.href, '_blank', 'noopener');
    else location.href = url('all.html') + '?q=' + encodeURIComponent(w.name) + '#w-' + w.id;
  }
  function openPalette() {
    if (!palette || palette.open) return;
    opener = document.activeElement;
    input.value = '';
    results = search(''); active = 0; render();
    palette.showModal();
    input.focus();
  }
  function closePalette() { if (palette && palette.open) palette.close(); }
  if (palette && input && list && typeof palette.showModal === 'function') {
    show(openBtn);
    if (/Mac|iPhone|iPad/.test(navigator.platform || '')) $('[data-kbd]', openBtn).textContent = '⌘K';
    openBtn.addEventListener('click', openPalette);
    input.addEventListener('input', function () { results = search(input.value); active = 0; render(); });
    input.addEventListener('keydown', function (ev) {
      if (ev.isComposing || ev.keyCode === 229) return; // 한글 조합을 확정하는 Enter가 두 번 오는 브라우저가 있다
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!results.length) return;
        active = (active + (ev.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        mark();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (results[active]) go(results[active]);
      }
    });
    palette.addEventListener('click', function (ev) { if (ev.target === palette) closePalette(); });
    palette.addEventListener('close', function () { if (opener && opener.focus) opener.focus(); });
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault();
        if (palette.open) closePalette(); else openPalette();
        return;
      }
      var t = ev.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (ev.key === '/' && !typing && !ev.ctrlKey && !ev.metaKey && !document.querySelector('dialog[open]')) { ev.preventDefault(); openPalette(); }
    });
  }

  // ── 전체 작업물: 필터·검색·정렬·주소 ──
  var filters = $('[data-filters]');
  if (filters) {
    var grid = $('[data-cards]'), cards = $$('.card', grid), empty = $('[data-empty]');
    var shown = $('[data-shown]', filters), q = $('#filter-q', filters), sortSel = $('#filter-sort', filters);
    var OK = { s: D.sections.map(function (s) { return s.id; }), st: ['live', 'detail', 'private', 'next'], sort: ['section', 'name'] };
    var st = {
      s: OK.s.indexOf(params.get('s')) !== -1 ? params.get('s') : '',
      st: OK.st.indexOf(params.get('st')) !== -1 ? params.get('st') : '',
      q: (params.get('q') || '').slice(0, 60),
      sort: OK.sort.indexOf(params.get('sort')) !== -1 ? params.get('sort') : 'section',
    };
    var byId = {};
    D.works.forEach(function (w) { byId[w.id] = w; });
    // 검색 범위는 이름·한 줄·섹션·상태만(카드의 '열기'·'새 탭' 같은 글자로 걸리지 않게)
    var hayOf = function (c) {
      var w = byId[c.id.slice(2)];
      return [w.name, w.note, sectionOf[w.section].name, STATUS[w.status], w.detail ? '구조도' : ''].join(' ').toLowerCase();
    };
    var order = cards.slice();
    var byName = cards.slice().sort(function (a, b) { return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'), 'ko'); });
    var apply = function () {
      var words = st.q.toLowerCase().split(/\s+/).filter(Boolean), n = 0;
      cards.forEach(function (c) {
        var ok = (!st.s || c.getAttribute('data-section') === st.s)
          && (!st.st || (st.st === 'detail' ? c.hasAttribute('data-detail') : c.getAttribute('data-status') === st.st))
          && words.every(function (w) { return hayOf(c).indexOf(w) !== -1; });
        c.hidden = !ok;
        if (ok) { n++; c.classList.add('in'); }
      });
      (st.sort === 'name' ? byName : order).forEach(function (c) { grid.appendChild(c); });
      shown.textContent = n;
      empty.hidden = n !== 0;
      $$('[data-s]', filters).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-s') === st.s ? 'true' : 'false'); });
      $$('[data-st]', filters).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-st') === st.st ? 'true' : 'false'); });
      var p = new URLSearchParams();
      if (st.s) p.set('s', st.s);
      if (st.st) p.set('st', st.st);
      if (st.q) p.set('q', st.q);
      if (st.sort !== 'section') p.set('sort', st.sort);
      var qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    };
    show(filters);
    q.value = st.q;
    sortSel.value = st.sort;
    filters.addEventListener('submit', function (ev) { ev.preventDefault(); });
    filters.addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip');
      if (!b) return;
      if (b.hasAttribute('data-s')) st.s = b.getAttribute('data-s'); else st.st = b.getAttribute('data-st');
      apply();
    });
    q.addEventListener('input', function () { st.q = q.value.slice(0, 60); apply(); });
    sortSel.addEventListener('change', function () { st.sort = sortSel.value; apply(); });
    $('[data-reset]').addEventListener('click', function () { st = { s: '', st: '', q: '', sort: 'section' }; q.value = ''; sortSel.value = 'section'; apply(); q.focus(); });
    apply();
    // 주소의 #w-<id> 카드가 필터에 걸려 숨었으면 필터를 풀어 보이게 한다
    var hashed = /^#w-[a-z0-9-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    if (hashed && hashed.hidden) { st = { s: '', st: '', q: '', sort: st.sort }; q.value = ''; apply(); }
  }

  // ── #w-<id> 로 왔을 때 그 카드 강조 ──
  var target = /^#w-[a-z0-9-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
  if (target) {
    target.classList.add('in', 'flash');
    target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(function () { target.classList.remove('flash'); }, M.flashMs);
  }

  // ── 아무거나 하나 뽑기 ──
  var pickBtn = $('[data-pick]'), pick = $('#pick');
  if (pickBtn && pick && typeof pick.showModal === 'function') {
    var pool = D.works.filter(function (w) { return w.status === 'live'; });
    var last = null;
    var card = $('[data-pick-card]', pick), openA = $('[data-pick-open]', pick);
    var draw = function () {
      var choices = pool.length > 1 ? pool.filter(function (w) { return w !== last; }) : pool;
      var w = choices[Math.floor(rand() * choices.length)];
      last = w;
      card.textContent = '';
      card.style.setProperty('--glow', 'var(--c-' + w.section + ')');
      var cov;
      if (w.cover) { cov = document.createElement('img'); cov.className = 'cover'; cov.src = base + 'covers/' + w.cover; cov.alt = ''; cov.width = 480; cov.height = 320; }
      else { cov = document.createElement('span'); cov.className = 'cover cover--type cover--' + w.section; cov.setAttribute('aria-hidden', 'true'); var cw = document.createElement('span'); cw.className = 'cover-word'; cw.textContent = w.name; cov.appendChild(cw); }
      var h = document.createElement('p'); h.className = 'pick-name'; h.textContent = w.name;
      var n = document.createElement('p'); n.className = 'pick-note'; n.textContent = sectionOf[w.section].name + ' · ' + w.note;
      card.appendChild(cov); card.appendChild(h); card.appendChild(n);
      var inPage = w.section === 'motion';
      openA.href = inPage ? base + 'motion.html#w-' + w.id : w.href;
      if (inPage) { openA.removeAttribute('target'); } else { openA.target = '_blank'; }
      $('[data-pick-label]', pick).textContent = inPage ? '보러 가기 →' : '열기 ↗';
      $('[data-pick-newtab]', pick).hidden = inPage;
      card.classList.remove('spin'); void card.offsetWidth; card.classList.add('spin');
    };
    show(pickBtn);
    pickBtn.addEventListener('click', function () { draw(); pick.showModal(); $('[data-pick-again]', pick).focus(); });
    $('[data-pick-again]', pick).addEventListener('click', draw);
    $('[data-pick-close]', pick).addEventListener('click', function () { pick.close(); });
    pick.addEventListener('click', function (ev) { if (ev.target === pick) pick.close(); });
    pick.addEventListener('close', function () { pickBtn.focus(); });
  }

  // ── Work 상세: 단계 ↔ 구조도 상자 강조(SVG 원본은 그대로, 위에 테두리만 얹는다) ──
  var svg = $('.d-fig svg');
  if (svg) {
    var NS = 'http://www.w3.org/2000/svg';
    var hl = document.createElementNS(NS, 'rect');
    hl.setAttribute('class', 'hl-node');
    hl.setAttribute('rx', '8');
    hl.style.display = 'none';
    svg.appendChild(hl);
    var steps = $$('.steps .step');
    var light = function (i) {
      steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      var chip = svg.querySelector('text[data-step="' + (i + 1) + '"]');
      var node = chip && chip.previousElementSibling && chip.previousElementSibling.previousElementSibling;
      if (!node) { hl.style.display = 'none'; return; }
      ['x', 'y', 'width', 'height'].forEach(function (a) { hl.setAttribute(a, node.getAttribute(a)); });
      hl.style.display = '';
      return node;
    };
    steps.forEach(function (s, i) {
      var no = $('.step-no', s);
      if (no) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'step-no';
        b.textContent = no.textContent;
        b.setAttribute('aria-label', '구조도에서 ' + (i + 1) + '단계 보기');
        no.replaceWith(b);
        b.addEventListener('click', function () {
          var node = light(i), r = node && node.getBoundingClientRect();
          if (r && (r.top < 80 || r.bottom > innerHeight)) node.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        });
      }
      s.addEventListener('mouseenter', function () { light(i); });
      s.addEventListener('focusin', function () { light(i); });
    });
  }

  // ── 지평선 다이얼(홈 첫 화면): 단추에 올리면 해·하늘을 그 시간으로 미리 옮기고, 누르면 그 섹션으로 간다 ──
  var hz = $('[data-horizon]');
  if (hz) {
    var dials = $$('[data-dial]', hz);
    var preview = function (b) {
      dials.forEach(function (x) { x.classList.toggle('on', x === b); });
      if (b) { hz.setAttribute('data-at', b.getAttribute('data-dial')); hz.style.setProperty('--p', b.getAttribute('data-orb')); }
      else { hz.removeAttribute('data-at'); hz.style.removeProperty('--p'); }
    };
    dials.forEach(function (b) {
      b.addEventListener('pointerenter', function () { preview(b); });
      b.addEventListener('focus', function () { preview(b); });
      // 이동은 기본 앵커에 맡긴다: 방문 기록이 쌓여 뒤로 가기가 되고, 부드러운 스크롤은 CSS가 모션 축소를 실시간으로 따른다.
      b.addEventListener('click', function (ev) {
        if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return; // 새 탭·새 창으로 여는 클릭은 이 쪽 포커스를 건드리지 않는다
        var band = document.getElementById(b.getAttribute('href').slice(1));
        var h = band && $('h2', band);
        if (h) setTimeout(function () { h.focus({ preventScroll: true }); }, 0); // 키보드 사용자는 그 섹션 제목에서 이어 간다
      });
    });
    $('.dial', hz).addEventListener('pointerleave', function () { if (!hz.contains(document.activeElement)) preview(null); });
    hz.addEventListener('focusout', function (ev) { if (!hz.contains(ev.relatedTarget)) preview(null); });
    // 부드러운 스크롤 도중에 뒤로·앞으로 가면 앞 스크롤이 이어져 엉뚱한 곳에 멈춘다 → 주소의 자리로 다시 보낸다
    window.addEventListener('popstate', function () {
      var at = location.hash && document.getElementById(location.hash.slice(1));
      if (at) at.scrollIntoView({ behavior: 'instant' }); else window.scrollTo({ top: 0, behavior: 'instant' }); // 되돌아가기는 정확한 자리가 먼저
    });
  }

  // ── 하루 스크롤(홈): 화면 높이 40% 선에 걸린 섹션 블록 → body data-time · 목차 표시 · 머리 메뉴 현재 표시 ──
  var bands = $$('.days .band[data-time]');
  if (bands.length && 'IntersectionObserver' in window) {
    var railLinks = $$('[data-rail]'), navLinks = $$('[data-nav]');
    var setTime = function (id) {
      document.body.setAttribute('data-time', id || 'dawn');
      railLinks.forEach(function (a) {
        var on = a.getAttribute('data-rail') === id;
        a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
      navLinks.forEach(function (a) { if (a.getAttribute('data-nav') === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    var inView = {};
    var dayIo = new IntersectionObserver(function (list) {
      list.forEach(function (en) { inView[en.target.getAttribute('data-time')] = en.isIntersecting; });
      var cur = null;
      bands.forEach(function (b) { if (inView[b.getAttribute('data-time')]) cur = b.getAttribute('data-time'); });
      setTime(cur);
    }, { rootMargin: '-40% 0px -59% 0px', threshold: 0 });
    bands.forEach(function (b) { dayIo.observe(b); });
  }

  // ── 숫자 올라가기 ──
  var counters = $$('[data-count]');
  var countUp = function (el) {
    var to = parseInt(el.getAttribute('data-count'), 10), t0 = performance.now();
    var step = function (now) {
      var k = Math.min((now - t0) / M.countMs, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  };

  // ── 스크롤 등장(맨 마지막: 여기까지 왔으면 html.fx 를 붙여도 안전하다) ──
  var reveals = $$('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    root.classList.add('fx');
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        if (en.target.hasAttribute('data-count')) countUp(en.target); else en.target.classList.add('in');
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
    reveals.forEach(function (el) { io.observe(el); });
    counters.forEach(function (el) { io.observe(el); });
    setTimeout(function () { reveals.forEach(function (el) { el.classList.add('in'); }); }, M.revealFailsafeMs);
  }
})();
