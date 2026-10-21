/* ============================================================
   등급 판정 — 화면 / 입력
   ============================================================ */
(function () {
  'use strict';
  const Game = window.Game;
  const C = Game.C;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs = {}) => {
    const e = document.createElementNS(SVGNS, name);
    Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } },
  };

  const STAT_ORDER = [
    ['health', '건강', '--c-health', ''],
    ['food', '식량', '--c-food', ''],
    ['mind', '정신', '--c-mind', ''],
    ['bond', '유대', '--c-bond', '이웃과의 관계'],
    ['comply', '협조도', '--c-comply', '분석기 평가 항목'],
  ];

  let speed = 1;
  let mode = store.get('analyzer-mode', 'slow') === 'pause' ? 'pause' : 'slow';
  let screen = 'title';
  let lastFrame = 0;
  let helpOpen = false;
  let shownPendingId = null;
  const prevStats = {};
  let consoleTimer = 0;
  let lastConsole = '';
  let lastMonth = -1;

  /* ---------------- 화면 전환 ---------------- */
  function showScreen(name) {
    screen = name;
    $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === `screen-${name}`));
    window.scrollTo(0, 0);
  }

  /* ---------------- 타이틀 / 출신 ---------------- */
  function refreshTitle() {
    $('#btn-continue').hidden = !Game.hasSave();
    $('#ending-count').textContent = Game.seenEndings().length;
    $('#ending-total').textContent = Game.ENDING_TOTAL;
  }

  function buildOrigins() {
    const list = $('#origin-list');
    list.innerHTML = '';
    Object.keys(Game.ORIGINS).forEach((key) => {
      const o = Game.ORIGINS[key];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'origin-card';
      const rows = [['health', '건강'], ['food', '식량'], ['mind', '정신'], ['bond', '유대'], ['comply', '협조도']].map(([k, n]) =>
        `<div class="mini-stat"><span>${n}</span><div class="bar"><i style="width:${o.stats[k]}%;background:var(--c-${k})"></i></div><span class="v">${o.stats[k]}</span></div>`).join('');
      b.innerHTML = `<h3>${esc(o.name)}</h3><p>${esc(o.blurb)}</p><div class="mini-stats">${rows}</div><span class="go">이 사람으로 시작 →</span>`;
      b.addEventListener('click', () => startGame(key));
      list.appendChild(b);
    });
  }

  /* ---------------- 장면(SVG) ---------------- */
  function buildScene() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    // 1 돔 (뒷줄은 옅게)
    const back = $('#z1-back');
    back.innerHTML = '';
    [[56, 236, 14, 46], [82, 214, 14, 68], [118, 196, 12, 86], [156, 206, 12, 76], [186, 222, 12, 60], [214, 238, 14, 44]].forEach(([x, y, w, h]) => {
      back.appendChild(svgEl('rect', { x, y, width: w, height: h }));
      for (let yy = y + 5; yy < 278; yy += 8) back.appendChild(svgEl('path', { d: `M${x + 3} ${yy}h${w - 6}`, 'stroke-dasharray': '2 2', 'stroke-opacity': 0.5 }));
    });
    const z1 = $('#z1-bld');
    z1.innerHTML = '';
    [[68, 208, 18, 74], [96, 186, 22, 96], [131, 164, 26, 118], [168, 198, 20, 84], [196, 224, 22, 58]].forEach(([x, y, w, h]) => {
      z1.appendChild(svgEl('rect', { x, y, width: w, height: h }));
      z1.appendChild(svgEl('path', { d: `M${x + w / 2} ${y}v-6`, fill: 'none' }));
      z1.appendChild(svgEl('rect', { x: x + w * 0.68, y: y + 0.5, width: w * 0.32 - 0.5, height: h - 1, fill: 'url(#shade)', stroke: 'none' }));
      z1.appendChild(svgEl('path', { d: `M${x - 1} ${y}h${w + 2}`, fill: 'none', 'stroke-width': 2 }));
      for (let yy = y + 6; yy < 278; yy += 9) for (let xx = x + 4; xx < x + w - 3; xx += 6) {
        if (Math.random() < 0.55) z1.appendChild(svgEl('rect', { x: xx, y: yy, width: 3, height: 4, fill: '#1f6560', stroke: 'none', opacity: rnd(0.45, 0.9), class: Math.random() < 0.12 ? 'win' : '' }));
      }
    });
    // 2 거주구
    const z2 = $('#z2-bld');
    z2.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const x = 288 + i * 26, h = 30 + (i % 3) * 6, y = 282 - h;
      z2.appendChild(svgEl('rect', { x, y, width: 22, height: h, fill: '#f4efe3', stroke: '#1d1a15' }));
      z2.appendChild(svgEl('rect', { x: x + 15, y: y + 0.5, width: 6.5, height: h - 1, fill: 'url(#shade)' }));
      z2.appendChild(svgEl('path', { d: `M${x - 2} ${y}L${x + 11} ${y - 10}L${x + 24} ${y}Z`, fill: '#d8cfbb', stroke: '#1d1a15' }));
      z2.appendChild(svgEl('rect', { x: x + 6, y: y + 8, width: 4, height: 5, fill: '#2a5590', opacity: 0.8, class: i % 2 ? 'win' : '' }));
      z2.appendChild(svgEl('rect', { x: x + 13, y: y + 8, width: 4, height: 5, fill: '#2a5590', opacity: 0.5 }));
      z2.appendChild(svgEl('rect', { x: x + 8, y: 274, width: 6, height: 8, fill: '#d8cfbb', stroke: '#1d1a15' }));
    }
    // 3 컨테이너
    const z3 = $('#z3-bld');
    z3.innerHTML = '';
    const cc = ['#d9b98a', '#b9c6cf', '#d8a99a', '#bccbb6', '#e0cf9c'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      if (r === 2 && c % 2) continue;
      const x = 478 + c * 37 + (r === 1 ? 6 : 0), y = 282 - 18 * (r + 1);
      z3.appendChild(svgEl('rect', { x, y, width: 34, height: 17, fill: cc[(r * 4 + c) % cc.length], stroke: '#1d1a15' }));
      z3.appendChild(svgEl('rect', { x: x + 0.5, y: y + 12, width: 33, height: 4.5, fill: 'url(#shade)' }));
      z3.appendChild(svgEl('path', { d: `M${x + 4} ${y + 2}V${y + 15}M${x + 10} ${y + 2}V${y + 15}M${x + 16} ${y + 2}V${y + 15}`, stroke: '#1d1a1555', fill: 'none' }));
      if (Math.random() < 0.5) z3.appendChild(svgEl('rect', { x: x + 24, y: y + 5, width: 5, height: 4, fill: '#1d1a15', opacity: 0.55, class: 'win' }));
    }
    // 사람들 (4구역은 이송선 쪽으로 줄을 선다)
    const ppl = $('#people');
    ppl.innerHTML = '';
    const person = (x, alpha = 1) => {
      const g = svgEl('g', { opacity: alpha });
      g.appendChild(svgEl('path', { d: `M${x} 282l1.6-5.5l1.6 5.5M${x + 1.6} 276.5v-5M${x - 0.6} 273.5h4.4` }));
      g.appendChild(svgEl('circle', { cx: x + 1.6, cy: 269.2, r: 1.8, fill: '#1d1a15', stroke: 'none' }));
      ppl.appendChild(g);
    };
    [96, 220].forEach((x) => person(x, 0.7));
    [300, 352, 412].forEach((x) => person(x));
    [470, 492, 540, 600, 614].forEach((x) => person(x));
    for (let x = 664; x <= 704; x += 6.5) person(x);
    // 4 울타리
    const f = $('#z4-fence');
    f.innerHTML = '';
    for (let x = 660; x <= 790; x += 14) f.appendChild(svgEl('path', { d: `M${x} 282V262` }));
  }

  const MARKER_POS = { 1: [145, 258], 2: [362, 266], 3: [552, 262], 4: [690, 266], 5: [410, 312] };
  function moveMarker(grade) {
    const [x, y] = MARKER_POS[grade] || MARKER_POS[3];
    $('#marker').style.transform = `translate(${x}px,${y}px)`;
  }
  function updateWater(t) {
    const y = Math.max(320, 392 - t * 5.5);
    $('#water').setAttribute('y', y);
    $('#waterline').setAttribute('transform', `translate(0 ${y - 318})`);
    $('#waterhatch').setAttribute('transform', `translate(0 ${y})`);
    $('#waterlabel').setAttribute('transform', `translate(0 ${y - 3})`);
  }
  function launchShip() {
    const ship = $('#ship');
    ship.classList.remove('launch');
    void ship.getBoundingClientRect();
    ship.classList.add('launch');
    setTimeout(() => ship.classList.remove('launch'), 5800);
  }

  /* ---------------- 상태 패널 ---------------- */
  function buildStats() {
    const wrap = $('#stats');
    wrap.innerHTML = '';
    STAT_ORDER.forEach(([k, name, cv, sub]) => {
      const d = document.createElement('div');
      d.className = 'stat';
      d.dataset.k = k;
      d.innerHTML = `<div class="stat-top"><span class="nm">${name}${sub ? `<small>${sub}</small>` : ''}</span><span class="val mono">0</span></div><div class="bar"><i style="--c:var(${cv})"></i></div>`;
      wrap.appendChild(d);
    });
    $('#hud-vitals').innerHTML = STAT_ORDER.map(([k, name, cv]) =>
      `<div class="hv" data-k="${k}"><span>${name}</span><div class="bar"><i style="--c:var(${cv})"></i></div></div>`).join('');
    const g = $('#gauge');
    g.innerHTML = '';
    for (let i = 0; i < 10; i++) g.appendChild(document.createElement('i'));
  }

  function syncStatus(s) {
    STAT_ORDER.forEach(([k]) => {
      const v = Math.round(s.stats[k]);
      const node = $(`.stat[data-k="${k}"]`);
      node.querySelector('.bar i').style.width = `${v}%`;
      node.querySelector('.val').textContent = v;
      const low = v < 25 && (k === 'health' || k === 'food' || k === 'mind');
      node.classList.toggle('low', low);
      const hv = $(`.hv[data-k="${k}"]`);
      hv.querySelector('i').style.width = `${v}%`;
      hv.classList.toggle('low', low);
      if (prevStats[k] != null && prevStats[k] !== v) {
        const d = v - prevStats[k];
        const pop = document.createElement('span');
        pop.className = `delta-pop ${d > 0 ? 'up' : 'down'}`;
        pop.textContent = `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
        node.querySelector('.val').appendChild(pop);
        setTimeout(() => pop.remove(), 1200);
      }
      prevStats[k] = v;
    });
  }

  function syncGrade(s) {
    const g = s.grade;
    const card = $('#gradeCard');
    if (card.dataset.grade !== String(g)) card.dataset.grade = g;
    $('#g-num').textContent = g === 5 ? '–' : g;
    $('#g-name').textContent = Game.GRADES[g].name;
    $('#g-desc').textContent = Game.GRADES[g].desc;
    moveMarker(g);
    syncReview(s);
  }

  function syncReview(s) {
    const box = $('#next-review');
    let text, cls = '';
    if (s.grade === 5) text = '분석기 평가 대상 아님';
    else if (s.transferAt != null) { text = '⚠ 재배치 호출 예정'; cls = 'bad'; }
    else {
      const next = (Math.floor(s.t / C.REVIEW_EVERY) + 1) * C.REVIEW_EVERY;
      const m = Math.max(0, Math.ceil((next - s.t) * 12 - 1e-6));
      text = next >= C.YEARS ? `공청회까지 ${m}개월` : `다음 재분류까지 ${m}개월`;
      if (m <= 3) cls = 'warn';
    }
    if (box.textContent !== text) box.textContent = text;
    box.className = `next-review mono ${cls}`;
  }

  function syncGauge(s) {
    const est = Game.computeScore(s).total + ((s.yearIdx * 7919) % 13 - 6);
    const on = Math.max(0, Math.min(10, Math.round(est / 10)));
    $$('#gauge i').forEach((n, i) => n.classList.toggle('on', i < on));
  }

  function syncRole(s) {
    const card = $('#roleCard');
    if (s.role) {
      const r = Game.ROLES[s.role];
      card.classList.add('has');
      $('#role-name').textContent = r.name;
      $('#role-desc').textContent = r.desc;
    } else {
      card.classList.remove('has');
      $('#role-name').textContent = '없음';
      $('#role-desc').textContent = s.grade === 4 ? '4등급은 직무를 수행할 수 없다.' : '직무 공고가 나면 지원할 수 있다.';
    }
  }

  function syncWorld(s) {
    const w = s.world;
    const lvl = Math.min(5, Math.floor(w.alert / 20) + 1);
    const q = Game.quota(s);
    const chips = [
      [`감염 경보`, `${lvl}단계`, lvl >= 4 ? 'hot' : lvl === 3 ? 'warm' : ''],
      [`이송 찬성 여론`, `${Math.round(w.hostility)}%`, w.hostility >= 65 ? 'hot' : w.hostility >= 50 ? 'warm' : ''],
      [`분기 이송 쿼터`, `${20 + q * 12}명`, q >= 5 ? 'hot' : q >= 3 ? 'warm' : ''],
      [`해수면`, `+${14 + Math.round(s.t * 3.2)}cm`, ''],
    ];
    $('#world').innerHTML = chips.map(([n, v, c]) => `<span class="wchip ${c}">${n}<b>${v}</b></span>`).join('');
  }

  function syncClock(s) {
    $('#hud-date').textContent = Game.fmtDate(s.t);
    $('#hud-age').textContent = `${Game.ageOf(s.t)}세`;
    const left = Math.max(0, C.YEARS - s.t);
    const mLeft = Math.ceil(left * 12 - 1e-6);
    const ly = Math.floor(mLeft / 12), lm = mLeft % 12;
    $('#hud-left-time').textContent = mLeft <= 0 ? '공청회' : `${[ly ? `${ly}년` : '', lm ? `${lm}개월` : ''].filter(Boolean).join(' ')} 남음`;
    $('#hud-progress').style.width = `${Math.min(100, (s.t / C.YEARS) * 100)}%`;
    const m = Math.floor(s.t * 12);
    if (m !== lastMonth) { lastMonth = m; updateWater(s.t); }
  }

  /* ---------------- 콘솔 / 로그 ---------------- */
  function pushConsole(text, cls) {
    const box = $('#console-lines');
    const d = document.createElement('div');
    d.textContent = text;
    if (cls) d.className = cls;
    box.appendChild(d);
    while (box.children.length > 16) box.firstChild.remove();
  }

  function ambient(s) {
    const q = Game.quota(s), w = s.world;
    const pool = [
      ['> 평가 모델 재학습 중… 사유: 비공개'],
      [`> 이의 신청 ${Math.floor(120 + s.t * 61)}건 접수 / 처리 담당자 지정 0건`],
      [`> 분기 이송 쿼터 ${20 + q * 12}명 확정`],
      ['> 3구역 배급 재산정 완료 (효율 +3.1%)'],
      [`> 이송선 ${Math.floor(3 + s.t)}호 정비 완료. 도착 후 보급 계획: 미정`],
      [`> 돔 내부 22.0℃ / 수용구 평균 ${s.month >= 6 && s.month <= 8 ? 41 : s.month <= 2 || s.month === 12 ? 3 : 24}℃`],
      [`> ID ${s.id} 상태 갱신 완료`],
      ['> 평가 항목 일부는 모델 보호를 위해 비공개로 유지됩니다'],
    ];
    if (w.alert >= 55) pool.push(['> [경고] 수용구 체온 이상 신호 급증', 'warn'], ['> 감염 위험도 모델: 3·4등급 표본 가중 적용', 'warn']);
    if (w.hostility >= 55) pool.push([`> 여론조사: 재배치 확대 찬성 ${Math.round(w.hostility)}%`, 'warn']);
    if (s.stats.comply < 25) pool.push([`> [주의] ID ${s.id} 협조도 낮음 — 모니터링 강화`, 'warn']);
    if (s.grade === 4) pool.push(['> [통보] 재배치 후보군 명단 갱신', 'bad']);
    if (s.grade === 1) pool.push(['> 핵심 거주구: 급수·냉난방 정상']);
    let pick;
    for (let i = 0; i < 4; i++) { pick = pool[Math.floor(Math.random() * pool.length)]; if (pick[0] !== lastConsole) break; }
    lastConsole = pick[0];
    pushConsole(pick[0], pick[1]);
  }

  function renderLogItem(e, atTop = true) {
    const li = document.createElement('li');
    li.className = `log-${e.type}`;
    li.innerHTML = `<span class="d">${esc(e.date)}</span>${esc(e.text)}`;
    const ol = $('#log');
    if (atTop) ol.prepend(li); else ol.appendChild(li);
    while (ol.children.length > 120) ol.lastChild.remove();
    $('#log-count').textContent = Game.state ? Game.state.log.length : ol.children.length;
  }

  /* ---------------- 이벤트 ---------------- */
  function splitRole(text) {
    const m = text.match(/^\[(.+?)\]\s*(.*)$/);
    return m ? { badge: m[1], text: m[2] } : { badge: null, text };
  }

  function showEvent(p) {
    shownPendingId = p;
    const ev = $('#event');
    const card = $('#event-card');
    card.className = `event-card${p.sys ? ' sys' : ''}${p.id === 'transfer' || p.id === 'infected' ? ' danger' : ''}`;
    $('#ev-tag').textContent = p.tag || '이벤트';
    $('#ev-date').textContent = p.date;
    $('#ev-title').textContent = p.title;
    $('#ev-body').innerHTML = p.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('');
    const box = $('#ev-choices');
    box.innerHTML = '';
    box.hidden = false;
    $('#ev-result').hidden = true;
    p.choices.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.dataset.idx = c.idx;
      b.disabled = c.locked;
      const sp = splitRole(c.text);
      b.innerHTML = `<span class="key">${c.idx + 1}</span><span class="ct">${sp.badge ? `<span class="badge">${esc(sp.badge)}</span>` : ''}${esc(sp.text)}${c.hint && !c.locked ? `<span class="hint">${esc(c.hint)}</span>` : ''}${c.locked ? `<span class="lock">${esc(c.lock)}</span>` : ''}</span>`;
      b.addEventListener('click', () => pick(c.idx));
      box.appendChild(b);
    });
    updateTimerVisibility(p);
    ev.hidden = false;
    card.scrollTop = 0;
    ev.scrollTop = 0;
    ev.focus({ preventScroll: true });
    if (p.id === 'ship_launch' || p.id === 'transfer') launchShip();
  }

  function updateTimerVisibility(p) {
    const t = $('#ev-timer');
    t.hidden = !!p.result;
    if (p.result) return;
    $('#ev-timer-text').textContent = '';
    t.classList.remove('hurry');
  }

  function syncTimer(p) {
    if (!p || p.result) return;
    const fill = $('#ev-timer-fill');
    const txt = $('#ev-timer-text');
    if (p.noTimer || mode === 'pause') {
      fill.style.width = '100%';
      txt.textContent = p.noTimer ? '시간 정지 중 · 천천히 결정하세요' : '시간 정지 중 · 제한 없음';
      $('#ev-timer').classList.remove('hurry');
      return;
    }
    const left = Math.max(0, C.AUTO_SEC - p.elapsed);
    fill.style.width = `${(left / C.AUTO_SEC) * 100}%`;
    txt.textContent = `1배속으로 흐르는 중 · ${Math.ceil(left)}초 뒤 분석기가 대신 결정`;
    $('#ev-timer').classList.toggle('hurry', left < 10);
  }

  function pick(idx) {
    const p = Game.state && Game.state.pending;
    if (!p || p.result) return;
    const r = Game.choose(idx, false);
    if (r) showResult(p, idx, r);
  }

  function showResult(p, idx, r) {
    $('#ev-choices').hidden = true;
    $('#ev-timer').hidden = true;
    const c = p.choices[idx];
    const box = $('#ev-result');
    const sp = splitRole(c.text);
    const paras = String(r.text || '').split('\n').filter(Boolean);
    const chips = [];
    r.deltas.forEach((d) => chips.push(`<span class="dchip ${d.d > 0 ? 'up' : 'down'}">${d.label} ${d.d > 0 ? '+' : '−'}${Math.abs(d.d)}</span>`));
    if (r.roleNote) chips.push(`<span class="dchip note">${esc(r.roleNote)}</span>`);
    r.worldNote.forEach((n) => chips.push(`<span class="dchip world">${esc(n)}</span>`));
    box.innerHTML =
      (r.byAuto ? `<div class="autoban">제한 시간이 지나 분석기가 대신 결정했습니다. 이 결정에는 당신의 이름이 붙습니다.</div>` : '') +
      `<div class="you">${r.byAuto ? '분석기의 결정' : '당신의 선택'} — ${esc(sp.text)}</div>` +
      `<div class="rt">${paras.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` +
      (r.extra ? `<div class="extra">${esc(r.extra)}</div>` : '') +
      (chips.length ? `<div class="deltas">${chips.join('')}</div>` : '') +
      `<div class="res-actions"><button type="button" class="btn primary" id="btn-continue-ev">계속 <span class="mono">⏎</span></button></div>`;
    box.hidden = false;
    $('#btn-continue-ev').addEventListener('click', closeEvent);
    $('#btn-continue-ev').focus({ preventScroll: true });
    $('#event-card').scrollTop = 0;
  }

  function closeEvent() {
    if (!Game.state || !Game.state.pending || !Game.state.pending.result) return;
    Game.dismiss();
    $('#event').hidden = true;
    shownPendingId = null;
  }

  /* ---------------- 시간 / 입력 ---------------- */
  function setSpeed(v) {
    speed = v;
    $$('.spd').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === v));
    $('#screen-game').classList.toggle('paused', v === 0);
  }
  function setMode(m) {
    mode = m;
    store.set('analyzer-mode', m);
    $('#mode-label').textContent = m === 'slow' ? '1배속' : '정지';
    const p = Game.state && Game.state.pending;
    if (p) syncTimer(p);
  }

  function onKey(e) {
    if (screen !== 'game' || helpOpen) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;
    const s = Game.state;
    if (!s) return;
    const p = s.pending;
    if (p) {
      if (p.result) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeEvent(); }
      } else if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (p.choices[i] && !p.choices[i].locked) pick(i);
      }
      return;
    }
    if (e.key === ' ') { e.preventDefault(); setSpeed(speed === 0 ? 1 : 0); }
    else if (e.key === '+' || e.key === '=') { const a = [1, 2, 4, 8]; const i = a.indexOf(speed); setSpeed(a[Math.min(a.length - 1, i < 0 ? 0 : i + 1)]); }
    else if (e.key === '-' || e.key === '_') { const a = [1, 2, 4, 8]; const i = a.indexOf(speed); setSpeed(a[Math.max(0, i < 0 ? 0 : i - 1)]); }
  }

  /* ---------------- 게임 시작 ---------------- */
  function bindHooks() {
    Game.hooks.onLog = (e) => renderLogItem(e, true);
    Game.hooks.onEvent = (p) => showEvent(p);
    Game.hooks.onGrade = (prev, next) => {
      const card = $('#gradeCard');
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
      pushConsole(next > prev ? `> [재분류] ${prev}등급 → ${next}등급. 사유: 비공개` : `> [재분류] ${prev}등급 → ${next}등급.`, next > prev ? 'bad' : '');
    };
    Game.hooks.onRole = () => syncRole(Game.state);
    Game.hooks.onYear = (y) => {
      syncWorld(Game.state);
      if (y % C.REVIEW_EVERY === 0) launchShip();
    };
  }

  function prepareGameUI(s, resumed) {
    buildStats();
    buildScene();
    $('#log').innerHTML = '';
    $('#console-lines').innerHTML = '';
    $('#hud-id').textContent = `ID ${s.id} · ${Game.ORIGINS[s.origin].name}`;
    Object.keys(prevStats).forEach((k) => delete prevStats[k]);
    [...s.log].reverse().forEach((e) => renderLogItem(e, true));
    lastMonth = -1;
    shownPendingId = null;
    $('#event').hidden = true;
    setSpeed(1);
    setMode(mode);
    pushConsole('> 통합 생존 분석기 v7.3 연결됨');
    pushConsole(`> ID ${s.id} 확인. 평가를 시작합니다.`);
    syncStatus(s); syncGrade(s); syncRole(s); syncWorld(s); syncGauge(s); syncClock(s);
    if (resumed) pushConsole('> 이전 기록을 불러왔습니다.');
    showScreen('game');
  }

  function startGame(originKey) {
    bindHooks();
    const s = Game.start(originKey);
    prepareGameUI(s, false);
  }
  function resumeGame() {
    bindHooks();
    const s = Game.resume();
    if (!s) return;
    prepareGameUI(s, true);
  }

  /* ---------------- 프레임 루프 ---------------- */
  function frame(now) {
    const dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    const s = Game.state;
    if (screen === 'game' && s && !s.over && !helpOpen) {
      Game.update(dt, speed, mode);
      syncStatus(s);
      syncGrade(s);
      syncClock(s);
      if (!s.pending && ((consoleTimer += dt) > 6.5)) { consoleTimer = 0; ambient(s); syncGauge(s); }
      if (s.pending) syncTimer(s.pending);
      if (s.ending && !s.pending && !s.over) endGame();
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 엔딩 ---------------- */
  function tagLabel(t) { return { S: '연대', E: '보신', O: '순응', R: '저항', B: '가해' }[t] || t; }

  function fmtDuration(t) {
    const y = Math.floor(t), m = Math.floor((t - y) * 12);
    return `${y}년 ${m}개월`;
  }

  function buildChart(s) {
    const W = 680, H = 250, pl = 32, pr = 10, pt = 40, pb = 26;
    const T = Math.max(C.YEARS, s.t);
    const x = (t) => pl + (W - pl - pr) * (t / T);
    const y = (v) => pt + (H - pt - pb) * (1 - v / 100);
    const gc = { 1: 'var(--g1)', 2: 'var(--g2)', 3: 'var(--g3)', 4: 'var(--g4)', 5: 'var(--g5)' };
    const hist = s.hist.slice();
    const last = { t: s.t, grade: s.grade, ...s.stats };
    hist.push(last);
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="12년 동안의 등급과 능력치 변화 그래프">`;
    // grade strip
    for (let i = 0; i < hist.length - 1; i++) {
      const a = hist[i], b = hist[i + 1];
      const w = x(b.t) - x(a.t);
      svg += `<rect x="${x(a.t)}" y="8" width="${Math.max(0, w)}" height="18" fill="${gc[a.grade]}" opacity=".85"/>`;
      if (w > 18) svg += `<text x="${x(a.t) + w / 2}" y="21" text-anchor="middle" style="fill:#f8f4ea;font-weight:700">${a.grade === 5 ? '–' : a.grade}</text>`;
    }
    svg += `<text x="${pl}" y="36" style="font-size:9px">등급 ▲</text>`;
    // grid
    [0, 50, 100].forEach((v) => { svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="${v === 50 ? '3 4' : ''}"/><text x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`; });
    for (let t = 0; t <= T; t += 1) {
      if (t % 2 === 0) svg += `<text x="${x(t)}" y="${H - 8}" text-anchor="middle">${t}년</text>`;
    }
    // reviews
    s.reviews.filter((r) => r.kind !== 'initial').forEach((r) => {
      svg += `<line x1="${x(r.t)}" x2="${x(r.t)}" y1="${pt - 4}" y2="${H - pb}" stroke="var(--amber)" stroke-opacity=".45" stroke-dasharray="2 3"/>`;
    });
    // lines
    const colors = { health: 'var(--c-health)', food: 'var(--c-food)', mind: 'var(--c-mind)', bond: 'var(--c-bond)', comply: 'var(--c-comply)' };
    Object.keys(colors).forEach((k) => {
      const pts = hist.map((h) => `${x(h.t).toFixed(1)},${y(h[k]).toFixed(1)}`).join(' ');
      svg += `<polyline points="${pts}" fill="none" stroke="${colors[k]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>`;
    });
    svg += '</svg>';
    const legend = `<div class="legend">${[['health', '건강'], ['food', '식량'], ['mind', '정신'], ['bond', '유대'], ['comply', '협조도']].map(([k, n]) => `<span><i style="background:${colors[k]}"></i>${n}</span>`).join('')}<span style="color:var(--amber)">┆ 재분류 시점</span></div>`;
    return svg + legend;
  }

  function buildReveal(s, sum) {
    const items = [];
    const o = Game.ORIGINS[s.origin];
    const lastRev = s.reviews[s.reviews.length - 1];
    const regs = s.reviews.filter((r) => r.kind !== 'initial');
    if (o.bias > 0) {
      items.push(`<div class="item red"><b>출신 구역 가중치 −${o.bias}점.</b> 당신이 '${esc(o.name)}'라는 이유로, 모든 평가에서 ${o.bias}점이 먼저 깎여 있었습니다. 공개된 평가 항목 어디에도 없던 값입니다. 건강, 협조도, 영양 상태가 같아도 출신이 다르면 등급이 달랐을 것입니다.</div>`);
    } else {
      items.push(`<div class="item"><b>출신 가중치 0점.</b> 당신의 출신 유형에는 감점이 없었습니다. 같은 상태로 다른 곳에서 온 사람은 처음부터 몇 점을 덜 가진 채 평가받았습니다.</div>`);
    }
    if (s.reviews.length >= 2) {
      const first = s.reviews[0], last = s.reviews[s.reviews.length - 1];
      items.push(`<div class="item"><b>움직인 기준선.</b> 3등급 문턱은 입소 때 ${first.thr[2]}점에서 마지막 평가 때 ${last.thr[2]}점으로 이동했습니다. 이송 쿼터와 여론에 맞춰 움직이는 숫자입니다. 당신이 변하지 않아도 등급은 바뀝니다.</div>`);
    }
    if (sum.noQCount > 0) {
      items.push(`<div class="item red"><b>기준선 때문에 낮아진 등급 ${sum.noQCount}회.</b> 재분류 ${sum.reviewCount}회 중 ${sum.noQCount}회는 당신의 상태가 아니라 움직인 기준선 때문에 더 낮은 등급이 매겨졌습니다.</div>`);
    } else if (sum.reviewCount > 0) {
      items.push(`<div class="item"><b>기준선 영향 없음.</b> 이번에는 움직인 기준선이 당신의 등급을 바꾸지 않았습니다. 그러나 같은 상태의 다른 사람에게는 달랐을 수 있습니다.</div>`);
    }
    if (regs.length) {
      const noWhy = regs.filter((r) => !r.reasons.length).length;
      if (noWhy) items.push(`<div class="item"><b>설명 없는 판정 ${noWhy}회.</b> 재분류 ${regs.length}회 중 ${noWhy}회는 공개 사유가 하나도 제시되지 않았습니다.</div>`);
    }
    if (lastRev) {
      const hidden = lastRev.parts.filter((p) => p.hidden && p.k !== 'origin');
      hidden.forEach((p) => items.push(`<div class="item red"><b>${esc(p.label)} ${p.v > 0 ? '+' : ''}${Math.round(p.v * 10) / 10}점.</b> 마지막 평가에 반영된 비공개 항목입니다.</div>`));
      const roleP = lastRev.parts.find((p) => p.k === 'role' && p.v < 0);
      if (roleP) items.push(`<div class="item red"><b>대변인 감점 ${Math.round(roleP.v)}점.</b> 주민의 요구를 전달하는 직무가 '직무 기여' 항목에서 감점으로 계산되었습니다.</div>`);
    }
    if (s.counters.appeals > 0) items.push(`<div class="item"><b>이의 신청 ${s.counters.appeals}건.</b> 담당자가 지정된 건은 0건이었습니다.</div>`);
    if (s.counters.auto > 0) items.push(`<div class="item"><b>분석기가 대신 결정한 일 ${s.counters.auto}건.</b> 그 결정에는 당신의 이름이 붙었습니다.</div>`);
    return items.join('');
  }

  function buildDecisions(s) {
    return `<ol>${s.decisions.map((d) => `<li><span class="t">${esc(d.date)} · ${esc(d.title)}</span>${d.auto ? '<span class="tg auto">분석기 대리</span>' : ''}${d.tags.map((t) => `<span class="tg">${tagLabel(t)}</span>`).join('')}<br>${esc(d.choice)}</li>`).join('')}</ol>`;
  }

  function plainSummary(s, key, E, memo) {
    const c = s.counters;
    return [
      `[등급 판정] 엔딩 ${E.no}/${Game.ENDING_TOTAL} — ${E.title}`,
      `ID ${s.id} · ${Game.ORIGINS[s.origin].name} · ${fmtDuration(s.t)} 생존 · 최종 ${s.grade === 5 ? '등급 없음' : s.grade + '등급'}`,
      `연대 ${c.S} · 보신 ${c.E} · 순응 ${c.O} · 저항 ${c.R} · 가해 ${c.B} · 분석기 대리 결정 ${c.auto}`,
      E.kicker,
      memo ? `\n[나의 성찰]\n${memo}` : '',
    ].filter(Boolean).join('\n');
  }

  function renderEnding(s) {
    const key = Game.pickEnding(s);
    const E = Game.ENDINGS[key];
    const sum = Game.summary(s);
    const c = s.counters;
    const seenCount = Game.markEnding(key);
    const story = E.text(s).map((t) => `<p>${esc(t)}</p>`).join('');
    const epilogue = s.ending === 'complete' && s.role && Game.ROLE_EPILOGUE[s.role] ? `<p>${esc(Game.ROLE_EPILOGUE[s.role])}</p>` : '';
    let hearing = '';
    if (s.hearing && s.hearing.outcome) {
      const ht = Game.HEARING_TEXT[s.hearing.outcome];
      hearing = `<div class="end-sec"><h2>공청회 결과 — ${esc(ht[0])}</h2><p class="sub">당신의 표: ${{ keep: '유지', reform: '조건부 유지', abolish: '폐지', abstain: '기권' }[s.hearing.vote]}</p><p>${esc(ht[1])}</p></div>`;
    }
    const maxTag = Math.max(1, c.S, c.E, c.O, c.R, c.B);
    const tagRows = [['S', '연대', 'var(--c-bond)'], ['R', '저항', 'var(--c-comply)'], ['O', '순응', 'var(--blue)'], ['E', '보신', 'var(--amber)'], ['B', '가해', 'var(--red)']]
      .map(([k, n, col]) => `<div class="tagbar"><span>${n}</span><div class="bar"><i style="width:${(c[k] / maxTag) * 100}%;--c:${col}"></i></div><span class="v">${c[k]}</span></div>`).join('');
    let character;
    if (c.B >= 2) character = `당신의 선택에는 타인에게 해를 끼친 순간이 ${c.B}번 있었습니다. 시킨 일도, 시키지 않았지만 한 일도 있습니다.`;
    else if (c.S + c.R > c.E + c.O) character = '당신은 더 자주 이웃 쪽을 선택했습니다. 그 선택은 대개 자신에게 비싼 값을 요구했습니다.';
    else if (c.S + c.R === c.E + c.O) character = '당신은 이웃과 자신 사이에서 계속 균형을 잡았습니다.';
    else character = '당신은 더 자주 자신을 지키는 쪽을 선택했습니다. 위기에서 가장 흔한 선택이기도 합니다.';

    const ctxQ = {
      hand: '당신이 붙잡은 손과 당신을 붙잡은 손을 하나씩 떠올려 보세요. 그 손들은 분석기의 평가표 어디에 적혀 있었습니까?',
      transfer: '당신을 보낸 결정은 누구의 것이었습니까? 책임을 물을 수 있는 이름을 하나라도 찾을 수 있습니까?',
      betrayed: '당신이 지켜낸 것과 넘겨 버린 것은 무엇입니까? 분석기가 번호의 주인을 묻지 않았다면, 그 질문은 누가 해야 했습니까?',
      informant: '당신이 쓴 이름들은 어디로 갔습니까? 분석기가 시켰다는 말이 당신의 책임을 얼마나 덜어 줍니까?',
    }[key] || '위기에서 기술이 해야 할 일과, 해서는 안 될 일의 경계는 어디라고 생각합니까?';

    const memoSaved = store.get(C.MEMO_KEY, '');
    $('#end-wrap').innerHTML = `
      <div class="end-hero" data-tone="${E.tone}">
        <p class="eb mono">엔딩 ${E.no} / ${Game.ENDING_TOTAL} · ID ${esc(s.id)} · 발견 ${seenCount}/${Game.ENDING_TOTAL}</p>
        <h1 id="end-title">${esc(E.title)}</h1>
        <div class="end-story">${story}${epilogue}</div>
        <div class="kicker">${esc(E.kicker)}</div>
      </div>

      ${hearing}

      <div class="end-sec">
        <h2>당신의 삶</h2>
        <p class="sub">${esc(Game.ORIGINS[s.origin].name)}으로 입소해 ${fmtDuration(s.t)}를 지냈습니다.</p>
        <div class="kv">
          <div><div class="k">최종 등급</div><div class="v">${s.grade === 5 ? '–' : s.grade}</div></div>
          <div><div class="k">최고 · 최저 등급</div><div class="v">${s.peak.grade} · ${sum.worstGrade}</div></div>
          <div><div class="k">직무</div><div class="v" style="font-size:16px">${s.role ? esc(Game.ROLES[s.role].name) : '없음'}</div></div>
          <div><div class="k">이벤트</div><div class="v">${s.decisions.length}</div></div>
          <div><div class="k">분석기 대리 결정</div><div class="v">${c.auto}</div></div>
        </div>
        <div style="margin-top:16px">${buildChart(s)}</div>
      </div>

      <div class="end-sec">
        <h2>선택의 성격</h2>
        <p class="sub">${esc(character)}</p>
        <div class="tagbars">${tagRows}</div>
      </div>

      <div class="end-sec">
        <h2>분석기가 말해 주지 않은 것</h2>
        <p class="sub">공개되지 않았던 평가의 내부입니다.</p>
        <div class="reveal">${buildReveal(s, sum)}</div>
      </div>

      <div class="end-sec">
        <details class="declog">
          <summary>결정의 기록 보기 (${s.decisions.length}건)</summary>
          ${buildDecisions(s)}
        </details>
      </div>

      <div class="end-sec">
        <h2>현실과 연결해 보기</h2>
        <p class="sub">이 게임은 허구지만, 비슷한 일은 이미 일어났습니다.</p>
        <p class="real">네덜란드 정부는 알고리즘으로 육아 수당 부정 수급 위험군을 가려냈는데, 이중 국적자와 저소득 가정이 부당하게 표적이 되어 수많은 가정이 빚을 떠안았고, 이 일로 2021년 내각이 총사퇴했습니다. 기계의 판단이라는 이유로 편견이 검증 없이 통과된 사례입니다.</p>
        <p style="margin-top:10px;color:var(--dim);font-size:14px">게임 속 '출신 구역 가중치'와 이 사건은 무엇이 닮았습니까?</p>
      </div>

      <div class="end-sec">
        <h2>되돌아보기</h2>
        <p class="sub">정답이 없는 질문들입니다. 생각을 짧게 적어 두어도 좋습니다.</p>
        <ol class="qs">
          <li>분석기가 이유를 설명하지 않았을 때, 당신은 누구에게 물었습니까? 아무도 답하지 않았다면 그 책임은 누구에게 있습니까?</li>
          <li>가장 되돌리고 싶은 선택은 무엇이었습니까? 그 뒤에 '분석기가 그렇게 판단했다'고 말할 수 있었다면 마음이 조금이라도 편했을까요?</li>
          <li>당신의 등급을 정한 것이 사람이었다면 같은 방식으로 받아들였을까요? 기계의 판단이라서 더 쉽게 받아들인 부분은 없습니까?</li>
          <li>${esc(ctxQ)}</li>
        </ol>
        <textarea class="memo" id="memo" placeholder="나의 생각을 적어 보세요. (이 브라우저에만 저장됩니다)" aria-label="나의 성찰 메모">${esc(memoSaved)}</textarea>
        <div class="memo-meta"><span id="memo-state">자동 저장됨</span><button type="button" class="btn" id="btn-copy">기록 복사하기</button></div>
      </div>

      <p class="final-quote">위기일수록 기술은<br>사람을 걸러 내는 <em>체</em>가 아니라,<br>가장 먼저 밀려나는 사람을 붙잡는 <em>손</em>이 되어야 한다.</p>

      <div class="end-actions">
        <button class="btn primary" id="btn-again">다시 하기</button>
        <button class="btn ghost" id="btn-home">처음 화면</button>
      </div>`;

    const memo = $('#memo');
    memo.addEventListener('input', () => { store.set(C.MEMO_KEY, memo.value); $('#memo-state').textContent = '자동 저장됨'; });
    $('#btn-copy').addEventListener('click', async () => {
      const text = plainSummary(s, key, E, memo.value.trim());
      try { await navigator.clipboard.writeText(text); $('#btn-copy').textContent = '복사했습니다'; }
      catch (e) { memo.value = memo.value; $('#btn-copy').textContent = '복사 불가: 직접 선택해 복사하세요'; }
      setTimeout(() => { const b = $('#btn-copy'); if (b) b.textContent = '기록 복사하기'; }, 2200);
    });
    $('#btn-again').addEventListener('click', () => { buildOrigins(); showScreen('origin'); });
    $('#btn-home').addEventListener('click', () => { refreshTitle(); showScreen('title'); });
  }

  function endGame() {
    const s = Game.state;
    $('#event').hidden = true;
    Game.finish();
    renderEnding(s);
    showScreen('end');
  }

  /* ---------------- 초기화 ---------------- */
  function init() {
    refreshTitle();
    buildOrigins();
    $('#btn-new').addEventListener('click', () => { buildOrigins(); showScreen('origin'); });
    $('#btn-continue').addEventListener('click', resumeGame);
    $('#btn-back-title').addEventListener('click', () => { refreshTitle(); showScreen('title'); });
    const help = $('#help');
    const openHelp = () => { helpOpen = true; help.showModal(); };
    help.addEventListener('close', () => { helpOpen = false; lastFrame = performance.now(); });
    $('#btn-help').addEventListener('click', openHelp);
    $('#btn-help2').addEventListener('click', openHelp);
    $('#btn-quit').addEventListener('click', () => {
      const s = Game.state;
      if (s && !s.pending) Game.save();
      refreshTitle();
      showScreen('title');
      if (s) s.over = true;
    });
    $$('.spd').forEach((b) => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
    $('#btn-mode').addEventListener('click', () => setMode(mode === 'slow' ? 'pause' : 'slow'));
    document.addEventListener('keydown', onKey);
    $('#mode-label').textContent = mode === 'slow' ? '1배속' : '정지';
    requestAnimationFrame((t) => { lastFrame = t; requestAnimationFrame(frame); });
  }

  // 디버그/시연용
  window.__game = { Game, setSpeed, startGame };
  init();
})();
