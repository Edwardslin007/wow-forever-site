/* ============================================================
   WOW FOREVER — 交互逻辑
   分页切换 / 阵营双主题 / CG混剪 / 全局粒子
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const decks = $$('.deck');
  const app   = $('#app');
  let idx = 0;
  let busy = false;

  /* ══════════════ 1. 阵营系统 ══════════════ */

  const FAC_TEXT = {
    alliance: {
      line: '被誓言重塑的疆土',
      tag  : '联盟 · Alliance',
    },
    horde: {
      line: '故事开始的地方',
      tag  : '部落 · Horde',
    }
  };

  function setFaction(f, morph) {
    if (!FAC_TEXT[f]) f = 'horde';
    const html = document.documentElement;

    if (morph) {
      html.classList.add('fac-morph');
      setTimeout(() => html.classList.remove('fac-morph'), 820);
    }
    html.setAttribute('data-fac', f);

    $$('.fac-tabs button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
    const lineEl = $('#facLine');
    if (lineEl) {
      lineEl.textContent = FAC_TEXT[f].line;
      lineEl.animate(
        [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' },
         { opacity: 1, transform: 'none', filter: 'none' }],
        { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }
    try { localStorage.setItem('wowfac', f); } catch (e) {}
    syncFxColor();
  }

  $$('.fac-tabs button').forEach(b => {
    b.addEventListener('click', () => setFaction(b.dataset.f, true));
  });

  let savedFac = 'horde';
  try { savedFac = localStorage.getItem('wowfac') || 'horde'; } catch (e) {}
  setFaction(savedFac, false);

  /* ══════════════ 2. 导航构建 ══════════════ */

  const rail = $('#rail');
  const dots = $('#dots');
  const mobNav = $('#mobNav');

  decks.forEach((d, i) => {
    const label = d.dataset.nav || ('P' + (i + 1));
    const short = d.dataset.short || label;

    const b1 = document.createElement('button');
    b1.type = 'button';
    b1.innerHTML = '<i>' + short + '</i>';
    b1.setAttribute('aria-label', label);
    b1.addEventListener('click', () => go(i));
    rail.appendChild(b1);

    const b2 = document.createElement('button');
    b2.type = 'button';
    b2.title = label;
    b2.setAttribute('aria-label', label);
    b2.addEventListener('click', () => go(i));
    dots.appendChild(b2);

    const b3 = document.createElement('button');
    b3.type = 'button';
    b3.innerHTML = '<i>' + String(i + 1).padStart(2, '0') + '</i>' + label;
    b3.addEventListener('click', () => { go(i); setMenu(false); });
    mobNav.appendChild(b3);
  });

  const railBtns = $$('#rail button');
  const dotBtns  = $$('#dots button');
  const mobBtns  = $$('#mobNav button');

  function syncNav() {
    railBtns.forEach((b, i) => b.classList.toggle('on', i === idx));
    dotBtns.forEach((b, i) => b.classList.toggle('on', i === idx));
    mobBtns.forEach((b, i) => b.classList.toggle('on', i === idx));
    $('#pPrev').disabled = idx === 0;
    $('#pNext').disabled = idx === decks.length - 1;
    const d = decks[idx];
    const s = d.querySelector('.deck-scroll');
    if (s) s.scrollTop = 0;
    document.title = (d.dataset.nav ? d.dataset.nav + ' · ' : '') + '魔兽世界：无限 | World of Warcraft: Forever';
  }

  /* ══════════════ 3. 分页切换 ══════════════ */

  function go(n) {
    n = Math.max(0, Math.min(decks.length - 1, n));
    if (n === idx || busy) return;
    busy = true;

    const from = decks[idx];
    const to   = decks[n];
    const down = n > idx;

    from.classList.remove('on');
    from.classList.toggle('prev', !down);
    to.classList.remove('prev');
    // 强制 reflow 确保过渡生效
    void to.offsetWidth;
    to.classList.add('on');

    idx = n;
    syncNav();
    animateDeck(to);
    fitDeck(to);

    setTimeout(() => {
      from.classList.remove('prev');
      busy = false;
    }, 760);
  }

  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  $('#pNext').addEventListener('click', next);
  $('#pPrev').addEventListener('click', prev);

  /* 键盘 */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#mobNav').classList.contains('open')) { setMenu(false); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(decks.length - 1); }
  });

  /* 滚轮 / 触控板 —— 阈值累积，避免误触 */
  let wheelLock = 0, wheelAcc = 0;
  window.addEventListener('wheel', e => {
    const sc = decks[idx].querySelector('.deck-scroll');
    // 屏内可滚动时优先滚动内容
    if (sc && sc.scrollHeight - sc.clientHeight > 8) {
      const atTop = sc.scrollTop <= 1;
      const atBot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if (!(e.deltaY > 0 && atBot) && !(e.deltaY < 0 && atTop)) return;
    }
    const now = performance.now();
    if (now - wheelLock < 820) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 46) {
      wheelAcc > 0 ? next() : prev();
      wheelAcc = 0;
      wheelLock = now;
    }
  }, { passive: true });

  /* 触摸滑动 */
  let tY = 0, tX = 0, tLock = 0;
  window.addEventListener('touchstart', e => {
    tY = e.touches[0].clientY; tX = e.touches[0].clientX; tLock = 0;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (!tLock) tLock = 1;
    const dy = e.touches[0].clientY - tY;
    const dx = e.touches[0].clientX - tX;
    if (Math.abs(dx) > Math.abs(dy)) return;
    const sc = decks[idx].querySelector('.deck-scroll');
    if (sc && sc.scrollHeight - sc.clientHeight > 8) {
      const atTop = sc.scrollTop <= 1;
      const atBot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if (!(dy < 0 && atBot) && !(dy > 0 && atTop)) return;
    }
    if (dy < -78 && performance.now() - tLock > 0) { next(); tLock = performance.now(); }
    else if (dy > 78) { prev(); tLock = performance.now(); }
  }, { passive: true });

  /* data-go 跳转 */
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(+b.dataset.go)));

  /* ══════════════ 3.5 单屏自适应缩放与居中 ══════════════ */
  // 目标：任何 16:9 屏下内容都完整可见、垂直居中、留白均衡
  function fitDeck(deck) {
    const sc = deck.querySelector('.deck-scroll');
    const inner = deck.querySelector('.deck-inner')
      || deck.querySelector('.hero-in')
      || deck.querySelector('.fin');
    if (!sc || !inner) return;

    const isNarrow = window.innerWidth <= 900;
    if (isNarrow) {
      sc.classList.remove('fit-abs');
      inner.style.removeProperty('--fitS');
      inner.classList.remove('fit-scaled');
      return;
    }

    // 先复位到无缩放状态再测量
    inner.style.setProperty('--fitS', '1');
    inner.classList.remove('fit-scaled');
    sc.classList.add('fit-abs');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const avail = sc.clientHeight;
      if (!avail) return;

      // 用 offsetHeight 测量未受 transform 影响的真实高度
      const need = inner.offsetHeight;
      if (!need) return;

      if (need - avail > 2) {
        // 目标：内容占据可用高度的 ~86%，保证上下各留 ~7% 呼吸空间
        let k = Math.max(0.58, Math.min(1, (avail * 0.86) / need));
        inner.style.setProperty('--fitS', k.toFixed(4));
        inner.classList.add('fit-scaled');
      } else {
        inner.style.setProperty('--fitS', '1');
        inner.classList.remove('fit-scaled');
      }
    }));
  }

  /* ══════════════ 4. 移动端菜单 ══════════════ */

  const burger = $('#burger'), mobEl = $('#mobNav'), scrim = $('#scrim');
  function setMenu(open) {
    burger.classList.toggle('open', open);
    mobEl.classList.toggle('open', open);
    scrim.classList.toggle('on', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  burger.addEventListener('click', () => setMenu(!mobEl.classList.contains('open')));
  scrim.addEventListener('click', () => setMenu(false));

  /* ══════════════ 5. 顶栏吸顶 ══════════════ */

  const topbar = $('#topbar');
  function onScroll() {
    const sc = decks[idx].querySelector('.deck-scroll');
    topbar.classList.toggle('solid', !!sc && sc.scrollTop > 12);
  }
  document.addEventListener('scroll', () => onScroll(), true);

  /* ══════════════ 6. 分区内进场动效 ══════════════ */

  function animateDeck(deck) {
    $$('[data-rv]', deck).forEach(el => el.classList.remove('in'));
    // 进度条填充
    $$('[data-w]', deck).forEach(b => { b.style.width = '0%'; });
    $$('[data-c]', deck).forEach(n => { n.textContent = '0'; });

    const targets = $$('[data-rv]', deck);
    const io = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const delay = parseFloat(el.style.transitionDelay || 0) * 1000;
        setTimeout(() => el.classList.add('in'), reduce ? 0 : delay);
        io.unobserve(el);
      });
    }, { threshold: 0.08, root: deck.querySelector('.deck-scroll') });
    targets.forEach(el => io.observe(el));

    // 进度条：只作用于 .zbar > i 与 .trk > i，避免误伤卡片容器
    const BARS = '.zbar > i, .trk > i';
    $$(BARS, deck).forEach(b => { b.style.width = '0%'; });
    const io2 = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        setTimeout(() => { en.target.style.width = en.target.dataset.w + '%'; }, reduce ? 0 : 220);
        io2.unobserve(en.target);
      });
    }, { threshold: 0.3, root: deck.querySelector('.deck-scroll') });
    $$(BARS, deck).forEach(b => io2.observe(b));

    // 数字
    const io3 = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        countUp(en.target);
        io3.unobserve(en.target);
      });
    }, { threshold: 0.5, root: deck.querySelector('.deck-scroll') });
    $$('[data-c]', deck).forEach(n => io3.observe(n));
  }

  function countUp(el) {
    const target = parseFloat(el.dataset.c);
    const suf = el.dataset.suf || '';
    if (reduce) { el.textContent = target + suf; return; }
    const dur = 1400, t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  /* ══════════════ 7. CG 混剪 ══════════════ */

  const CLIPS = [
    'assets/video/clip1.mp4',
    'assets/video/clip2.mp4',
    'assets/video/clip3.mp4',
    'assets/video/clip4.mp4',
    'assets/video/clip5.mp4',
    'assets/video/clip6.mp4',
  ];

  const montage = $('#montage');
  const tagName = $('#mtName');
  let vids = [], vi = -1, playing = true;

  // 懒加载：仅首屏立即加载当前片段，其余等切到时再 load
  function loadClip(v) {
    if (!v || v.dataset.loaded) return;
    v.dataset.loaded = '1';
    v.load();
  }

  function buildMontage() {
    if (!montage) return;
    const grain = montage.querySelector('.grain');
    CLIPS.forEach((src, i) => {
      const v = document.createElement('video');
      v.src = src;
      v.muted = true; v.loop = false; v.playsInline = true;
      v.preload = 'none';
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.dataset.idx = i;
      // 未加载时给出兜底底色，避免透明
      v.style.background = '#05060a';
      montage.insertBefore(v, grain);
      v.addEventListener('ended', () => { if (playing) setClip((vi + 1) % CLIPS.length); });
      v.addEventListener('error', () => {
        v.hidden = true;
        if (vids.every(x => x.hidden || x.error)) montage.classList.add('no-video');
      });
      vids.push(v);
    });
    setClip(0);
  }

  function setClip(i) {
    if (!vids.length) return;
    vids.forEach(v => { if (v !== vids[i]) { v.classList.remove('on'); v.pause(); } });
    vi = i;
    const v = vids[i];
    loadClip(v);
    v.classList.add('on');
    try { v.currentTime = 0; } catch (e) {}
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
    if (tagName) tagName.textContent = 'CLIP ' + String(i + 1).padStart(2, '0') + ' / ' + CLIPS.length;
  }

  function togglePlay() {
    playing = !playing;
    const v = vids[vi];
    if (v) { if (playing) { v.play().catch(() => {}); } else { v.pause(); } }
    const btn = $('#vToggle');
    if (btn) btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }

  $('#vToggle').addEventListener('click', togglePlay);
  $('#vNext').addEventListener('click', () => { prefetchAround(1); setClip((vi + 1) % CLIPS.length); });
  $('#vPrev').addEventListener('click', () => { prefetchAround(-1); setClip((vi - 1 + CLIPS.length) % CLIPS.length); });

  // 预取相邻片段，切换更顺滑
  function prefetchAround(dir) {
    const a = vids[(vi + dir + CLIPS.length) % CLIPS.length];
    const b = vids[(vi + dir * 2 + CLIPS.length) % CLIPS.length];
    loadClip(a); loadClip(b);
  }

  // 进入 hero 才播放，离开暂停以省资源
  function mountVideo(on) {
    if (!vids.length) return;
    if (on) { if (playing) vids[vi].play().catch(() => {}); }
    else vids.forEach(v => v.pause());
  }
  const origGo = go;
  const ioDeck = new IntersectionObserver(ents => {
    ents.forEach(en => mountVideo(en.isIntersecting && en.intersectionRatio > 0.5));
  }, { threshold: [0, 0.5, 1] });
  decks.forEach(d => ioDeck.observe(d));

  buildMontage();

  /* ══════════════ 8. 粒子系统 ══════════════ */

  const fx = $('#fx');
  let fxc = null, parts = [], raf = null, w = 0, h = 0, dpr = 1;
  let facCol = [209, 85, 58];

  function syncFxColor() {
    const a = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const m = a.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) facCol = [+m[1], +m[2], +m[3]];
  }

  function initFx() {
    if (!fx || reduce) return;
    fxc = fx.getContext('2d');
    resizeFx();
    spawn();
    loop();
  }

  function resizeFx() {
    if (!fxc) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = fx.clientWidth; h = fx.clientHeight;
    fx.width = w * dpr; fx.height = h * dpr;
    fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn() {
    const n = Math.round(Math.min(Math.max((w * h) / 15000, 40), 120));
    parts = Array.from({ length: n }, () => mk(true));
  }

  function mk(init) {
    return {
      x: Math.random() * w,
      y: init ? Math.random() * h : h + 14,
      r: Math.random() * 1.9 + .4,
      vx: (Math.random() - .5) * .22,
      vy: -(Math.random() * .42 + .08),
      a: Math.random() * .5 + .14,
      tw: Math.random() * Math.PI * 2,
      tws: Math.random() * .026 + .006,
      big: Math.random() > .88,
    };
  }

  function loop() {
    if (!fxc) return;
    fxc.clearRect(0, 0, w, h);
    const [R, G, B] = facCol;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.tw += p.tws;
      if (p.y < -16) parts[i] = mk(false);
      else if (p.x < -16) p.x = w + 12;
      else if (p.x > w + 16) p.x = -12;

      const al = p.a * (.5 + .5 * Math.sin(p.tw));
      const rr = p.r * (p.big ? 7 : 4.4);
      const g = fxc.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      g.addColorStop(0, 'rgba(' + R + ',' + G + ',' + B + ',' + (al * (p.big ? 1 : .8)) + ')');
      g.addColorStop(1, 'rgba(' + R + ',' + G + ',' + B + ',0)');
      fxc.fillStyle = g;
      fxc.beginPath();
      fxc.arc(p.x, p.y, rr, 0, Math.PI * 2);
      fxc.fill();
    }
    raf = requestAnimationFrame(loop);
  }

  /* 指针引力（轻微） */
  if (fxc) {
    let mx = -999, my = -999;
    window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function pull() {
      if (fxc && mx > -900) {
        for (const p of parts) {
          const dx = p.x - mx, dy = p.y - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < 26000 && d2 > 1) {
            const f = (1 - d2 / 26000) * .55;
            const d = Math.sqrt(d2);
            p.x += (dx / d) * f; p.y += (dy / d) * f;
          }
        }
      }
      requestAnimationFrame(pull);
    })();
  }

  /* ══════════════ 9. 3D 倾斜 ══════════════ */

  if (!reduce && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.zone, .raid, .sys, .cmp, .stat, .pillar, .ed, .race-card').forEach(el => {
      const max = 6;
      el.style.transition = el.style.transition || '';
      el.addEventListener('mousemove', e => {
        // 父级处于缩放状态时禁用 3D 倾斜，避免 transform 冲突导致错位
        if (el.closest('.fit-scaled')) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5;
        const py = (e.clientY - r.top) / r.height - .5;
        el.style.transform = 'perspective(1000px) rotateX(' + (-py * max) + 'deg) rotateY(' + (px * max) + 'deg) translateY(-6px)';
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ══════════════ 10. 倒计时 ══════════════ */

  const LAUNCH = Date.UTC(2026, 10, 4, 23, 0, 0);
  const cd = { d: $('#cd-d'), h: $('#cd-h'), m: $('#cd-m'), s: $('#cd-s') };
  const pad = n => (n < 10 ? '0' : '') + n;
  function tick() {
    let df = LAUNCH - Date.now();
    if (df < 0) df = 0;
    const s = Math.floor(df / 1000);
    cd.d.textContent = pad(Math.floor(s / 86400));
    cd.h.textContent = pad(Math.floor(s % 86400 / 3600));
    cd.m.textContent = pad(Math.floor(s % 3600 / 60));
    cd.s.textContent = pad(s % 60);
  }
  tick();
  setInterval(tick, 1000);

  /* ══════════════ 11. 启动 ══════════════ */

  function resize() {
    resizeFx();
    if (window.innerWidth > 1080) setMenu(false);
  }
  let rzT = null;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { resize(); fitDeck(decks[idx]); }, 180); });

  syncNav();
  fitDeck(decks[0]);
  animateDeck(decks[0]);
  initFx();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { syncNav(); });
  }
})();

