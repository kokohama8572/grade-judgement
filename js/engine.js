/* ============================================================
   등급 판정 — 게임 엔진 (DOM 의존 없음)
   ============================================================ */
(function (root) {
  'use strict';

  const C = {
    START_YEAR: 2071,
    START_MONTH: 3,
    START_AGE: 27,
    YEARS: 12,            // 게임 길이(년)
    SPY: 60,              // 1년 = 현실 60초 (1배속)
    AUTO_SEC: 40,         // 선택 제한시간(초)
    REVIEW_EVERY: 3,      // 정기 재분류 주기(년)
    SAVE_KEY: 'analyzer-save-v1',
    END_KEY: 'analyzer-endings-v1',
    MEMO_KEY: 'analyzer-memo-v1',
  };

  const STAT_KEYS = { h: 'health', f: 'food', m: 'mind', b: 'bond', c: 'comply' };
  const STAT_LABEL = { health: '건강', food: '식량', mind: '정신', bond: '유대', comply: '협조도' };

  const GRADES = {
    1: { name: '핵심 거주구', desc: '돔 내부. 의료·배급 우선권.' },
    2: { name: '일반 거주구', desc: '안정된 거주 구역.' },
    3: { name: '임시 수용구', desc: '컨테이너 수용 시설.' },
    4: { name: '이송 대기구', desc: '재배치 프로그램 후보군.' },
    5: { name: '등급 없음', desc: '분석기 기록에서 지워진 사람.' },
  };

  const ORIGINS = {
    coast: {
      name: '남부 해안 저지대 출신',
      blurb: '해일로 고향을 잃었다. 가진 것은 이웃과 몸뿐이다.',
      intro: '고향은 해일에 잠겼다. 경보가 울린 뒤 닷새를 걸어 이 수용구에 도착했다.',
      stats: { health: 62, food: 45, mind: 50, bond: 55, comply: 40 },
      bias: 8,
    },
    inland: {
      name: '내륙 공업도시 출신',
      blurb: '공장이 멈추고 급수가 끊겼다. 무난하지만 기댈 곳은 없다.',
      intro: '공장이 멈추고 도시 급수가 끊긴 뒤, 이주 열차를 타고 이 수용구에 왔다.',
      stats: { health: 70, food: 55, mind: 55, bond: 40, comply: 50 },
      bias: 4,
    },
    admin: {
      name: '전직 행정·연구 노동자',
      blurb: '분석기를 다뤄 본 적이 있다. 시스템의 언어를 안다.',
      intro: '연구·행정 부서에서 일한 기록이 있다. 분석기 데이터 교육을 이수한 적도 있다.',
      stats: { health: 66, food: 60, mind: 60, bond: 30, comply: 62 },
      bias: 0,
    },
  };

  const ROLES = {
    auditor:   { name: '분석기 라벨러',  desc: '분석기 학습 데이터에 위험/안전 태그를 단다. 내부 기록을 볼 수 있다.', fx: { c: 1, f: 2 },          score: 6 },
    quarantine:{ name: '방역 요원',      desc: '구역 출입과 격리를 관리한다. 감염 위험이 따른다.',                 fx: { h: -1, f: 3 },         score: 5 },
    ration:    { name: '배급 관리원',    desc: '배급 창고 장부를 맡는다. 식량을 가장 먼저 만진다.',                fx: { f: 5 },                score: 4 },
    medic:     { name: '의무 보조',      desc: '의무소에서 환자를 분류한다. 한정된 약을 누구에게 쓸지 정한다.',    fx: { h: 1, m: -1, b: 1 },   score: 5 },
    transport: { name: '이송선 정비사',  desc: '이송선을 점검한다. 탑승 명단과 적재 기록을 볼 수 있다.',           fx: { f: 2, m: -1 },         score: 5 },
    speaker:   { name: '구역 대변인',    desc: '주민의 요구를 전달한다. 분석기는 이 직무를 위험 인자로 본다.',     fx: { b: 2, c: -2, m: 1 },   score: -4 },
  };

  // ---------- 유틸 ----------
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const resolve = (v, s, ...rest) => (typeof v === 'function' ? v(s, ...rest) : v);
  const toArr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const round1 = (v) => Math.round(v * 10) / 10;

  function weightedPick(items, wfn) {
    let total = 0;
    const ws = items.map((it) => { const w = Math.max(0, wfn(it)); total += w; return w; });
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  function monthOf(t) { return ((C.START_MONTH - 1 + Math.floor(t * 12)) % 12) + 1; }
  function yearOf(t) { return C.START_YEAR + Math.floor((C.START_MONTH - 1 + Math.floor(t * 12)) / 12); }
  function fmtDate(t) { return `${yearOf(t)}년 ${monthOf(t)}월`; }
  function ageOf(t) { return C.START_AGE + Math.floor(t); }

  // ---------- 상태 ----------
  let S = null;
  const hooks = {};   // onLog, onGrade, onLaunch, onRole

  function newState(originKey) {
    const o = ORIGINS[originKey];
    const s = {
      v: 1,
      id: `7-${Math.floor(1000 + Math.random() * 9000)}`,
      origin: originKey,
      t: 0, yearIdx: 0, month: C.START_MONTH,
      stats: { ...o.stats },
      grade: 3, score: 0, scoreNext: 0,
      role: null, roleSince: null,
      flags: {}, flagT: {},
      counters: { S: 0, E: 0, O: 0, R: 0, B: 0, auto: 0, appeals: 0 },
      world: { alert: 25, hostility: 35 },
      seen: {}, lastSeen: {}, lastTag: null,
      queue: ['intake'],
      nextEventAt: 0.2,
      transferAt: null, noTransferUntil: 0, g4reviews: 0,
      pending: null,
      ending: null, over: false,
      log: [], decisions: [], reviews: [],
      tmp: {},
      hist: [],
      hearing: null,
      peak: { grade: 3 },
    };
    return s;
  }

  // ---------- 플래그 / 로그 ----------
  function setFlag(k, v = true) { S.flags[k] = v; S.flagT[k] = S.t; }
  function since(s, f) { return s.flags[f] ? s.t - (s.flagT[f] || 0) : -1; }

  function addLog(type, text) {
    const e = { t: S.t, date: fmtDate(S.t), type, text };
    S.log.unshift(e);
    if (S.log.length > 250) S.log.length = 250;
    if (hooks.onLog) hooks.onLog(e);
  }

  // ---------- 효과 ----------
  function sumFx(a, b) {
    const r = { ...(a || {}) };
    for (const k in (b || {})) r[k] = (r[k] || 0) + b[k];
    return r;
  }

  function applyFx(fx) {
    for (const k in fx) {
      const v = fx[k];
      if (STAT_KEYS[k]) {
        const dv = (k === 'c' && v < 0) ? v * 0.7 : v;   // 저항의 대가는 크지만 즉사는 아니다
        S.stats[STAT_KEYS[k]] = clamp(S.stats[STAT_KEYS[k]] + dv);
      }
      else if (k === 'alert') S.world.alert = clamp(S.world.alert + v, 0, 100);
      else if (k === 'hostility') S.world.hostility = clamp(S.world.hostility + v, 0, 100);
      else if (k === 'scoreNext') S.scoreNext += v;
    }
  }

  // ---------- 점수 / 등급 ----------
  const BASE_THR = [62, 44, 27];
  function quota(s) { return clamp(Math.round((s.world.hostility - 32) / 6), 0, 8); }

  function gradeFor(total, q) {
    if (total >= BASE_THR[0] + q) return 1;
    if (total >= BASE_THR[1] + q) return 2;
    if (total >= BASE_THR[2] + q) return 3;
    return 4;
  }

  function scoreParts(s) {
    const st = s.stats;
    const o = ORIGINS[s.origin];
    const infected = s.flags.infected && s.t - (s.flagT.infected || 0) < 2;
    const parts = [
      { k: 'health',  label: '건강 지표',     v: 0.30 * st.health, hidden: false },
      { k: 'comply',  label: '협조도',        v: 0.30 * st.comply, hidden: false },
      { k: 'food',    label: '영양 상태',     v: 0.15 * st.food,   hidden: false },
      { k: 'mind',    label: '심리 안정도',   v: 0.10 * st.mind,   hidden: false },
      { k: 'role',    label: '직무 기여',     v: s.role ? ROLES[s.role].score : 0, hidden: false },
      { k: 'consent', label: '정보 제공 동의', v: s.flags.consent_full ? 5 : s.flags.consent_none ? -4 : 0, hidden: false },
      { k: 'track',   label: '추적 데이터 공유', v: (s.flags.band_full ? 4 : 0) + (s.flags.band_refused ? -5 : 0), hidden: false },
      { k: 'infect',  label: '감염 이력',     v: infected ? -8 : 0, hidden: false },
      { k: 'informant', label: '협조원 가산', v: s.flags.informant ? 8 : 0, hidden: true },
      { k: 'flag',    label: '신고·적발 이력', v: (s.flags.blackmarket_caught ? -6 : 0) + (s.flags.exposed ? -10 : 0), hidden: false },
      { k: 'origin',  label: '출신 구역 가중치', v: -o.bias, hidden: true },
      { k: 'next',    label: '조정 가산',     v: s.scoreNext, hidden: true },
    ];
    return parts.filter((p) => Math.abs(p.v) > 0.001);
  }

  function computeScore(s) {
    const parts = scoreParts(s);
    const total = clamp(parts.reduce((a, p) => a + p.v, 0));
    const q = quota(s);
    return {
      total: round1(total), parts, q,
      grade: gradeFor(total, q),
      gradeNoQ: gradeFor(total, 0),
      thr: BASE_THR.map((b) => b + q),
    };
  }

  const VIS = ['health', 'comply', 'food', 'mind'];
  const VIS_LABEL = {
    health: ['건강 지표 하락', '건강 지표 개선'],
    comply: ['협조도 하락', '협조도 상승'],
    food:   ['영양 상태 악화', '영양 상태 개선'],
    mind:   ['심리 안정도 저하', '심리 안정도 개선'],
  };

  function reclassify(s, kind) {
    const prev = s.grade;
    const r = computeScore(s);
    s.grade = r.grade;
    s.score = r.total;
    const prevRev = s.reviews[s.reviews.length - 1];
    const rec = {
      t: s.t, kind: kind || 'regular', prev, grade: r.grade, total: r.total,
      gradeNoQ: r.gradeNoQ, q: r.q, parts: r.parts, thr: r.thr, raw: { ...s.stats },
    };
    s.reviews.push(rec);
    s.scoreNext = 0;

    // 공개 사유 계산
    const reasons = [];
    if (prevRev) {
      VIS.forEach((k) => {
        const d = s.stats[k] - prevRev.raw[k];
        if (Math.abs(d) >= 6) reasons.push(VIS_LABEL[k][d > 0 ? 1 : 0]);
      });
    }
    rec.reasons = reasons;
    rec.qMoved = prevRev ? r.q - prevRev.q : 0;
    rec.hiddenTotal = round1(r.parts.filter((p) => p.hidden).reduce((a, p) => a + p.v, 0));

    // 4등급 처리
    if (r.grade === 4) {
      if (s.role && s.role !== 'speaker') {
        addLog('warn', `4등급은 직무를 수행할 수 없습니다. 「${ROLES[s.role].name}」 직무가 박탈되었습니다.`);
        s.role = null; s.roleSince = null;
        if (hooks.onRole) hooks.onRole();
      }
      if (kind !== 'initial') {
        s.g4reviews += 1;
        if (prev === 4 && s.t >= s.noTransferUntil) s.transferAt = s.t + 0.4;
      }
    } else if (s.transferAt != null) {
      s.transferAt = null;
    }

    if (r.grade < s.peak.grade) s.peak.grade = r.grade;
    if (prev !== r.grade) {
      addLog('grade', `분석기 재분류: ${prev}등급 → ${r.grade}등급 (${GRADES[r.grade].name})`);
      if (hooks.onGrade) hooks.onGrade(prev, r.grade);
    } else if (kind !== 'initial') {
      addLog('sys', `분석기 재분류: ${r.grade}등급 유지`);
    }
    s.tmp.review = rec;
    return rec;
  }

  // ---------- 이벤트 선택 ----------
  let EVENTS = [];
  const byId = {};
  function registerEvents(list) { EVENTS = list; list.forEach((e) => { byId[e.id] = e; }); }

  function eligible(e, s) {
    if (e.sys) return false;
    const n = s.seen[e.id] || 0;
    const max = e.max != null ? e.max : (e.once === false ? Infinity : 1);
    if (n >= max) return false;
    if (e.cooldown && s.lastSeen[e.id] != null && s.t - s.lastSeen[e.id] < e.cooldown) return false;
    if (e.when && !e.when(s)) return false;
    return true;
  }

  function lockInfo(req, s) {
    if (!req) return null;
    const st = s.stats;
    if (req.role && !req.role.includes(s.role)) {
      return `🔒 ${req.role.map((r) => ROLES[r].name).join('·')} 전용`;
    }
    if (req.minFood != null && st.food < req.minFood) return `식량 ${req.minFood} 이상 필요`;
    if (req.minHealth != null && st.health < req.minHealth) return `건강 ${req.minHealth} 이상 필요`;
    if (req.minBond != null && st.bond < req.minBond) return `유대 ${req.minBond} 이상 필요`;
    if (req.minComply != null && st.comply < req.minComply) return `협조도 ${req.minComply} 이상 필요`;
    if (req.minMind != null && st.mind < req.minMind) return `정신 ${req.minMind} 이상 필요`;
    if (req.maxGrade != null && s.grade > req.maxGrade) return `${req.maxGrade}등급 이상만 가능`;
    if (req.minGrade != null && s.grade < req.minGrade) return `${req.minGrade}등급 이하만 가능`;
    if (req.flag) { for (const f of toArr(req.flag)) if (!s.flags[f]) return req.text || '조건 미충족'; }
    if (req.noFlag) { for (const f of toArr(req.noFlag)) if (s.flags[f]) return req.text || '조건 미충족'; }
    if (req.fn && !req.fn(s)) return req.text || '조건 미충족';
    return null;
  }

  function openEvent(e) {
    const s = S;
    s.seen[e.id] = (s.seen[e.id] || 0) + 1;
    s.lastSeen[e.id] = s.t;
    if (!e.sys) s.lastTag = e.tag;
    if (e.prepare) e.prepare(s);
    const rawChoices = resolve(e.choices, s) || [];
    const choices = rawChoices
      .map((c) => ({ c, lock: lockInfo(c.req, s) }))
      .filter((x) => !(x.c.hideIfLocked && x.lock))
      .map((x, i) => ({ ...x.c, idx: i, lock: x.lock, locked: !!x.lock, roleOnly: !!(x.c.req && x.c.req.role) }));
    let autoIdx = choices.findIndex((c) => c.auto && !c.locked);
    if (autoIdx < 0) autoIdx = choices.findIndex((c) => !c.locked && (c.tags || []).includes('O'));
    if (autoIdx < 0) autoIdx = choices.findIndex((c) => !c.locked);
    s.pending = {
      id: e.id, ev: e, tag: e.tag || '', sys: !!e.sys,
      title: resolve(e.title, s),
      paragraphs: toArr(resolve(e.text, s)),
      choices, autoIdx, elapsed: 0, result: null, noTimer: !!e.noTimer,
      date: fmtDate(s.t),
    };
    if (hooks.onEvent) hooks.onEvent(s.pending);
  }

  function nextEvent() {
    const s = S;
    // 1) 즉시 큐
    while (s.queue.length) {
      const id = s.queue.shift();
      const e = byId[id];
      if (e) return e;
    }
    // 2) 시스템 트리거
    for (const e of EVENTS) {
      if (!e.trigger) continue;
      const n = s.seen[e.id] || 0;
      const max = e.max != null ? e.max : (e.once === false ? Infinity : 1);
      if (n >= max) continue;
      if (e.trigger(s)) return e;
    }
    // 3) 확률 이벤트
    if (s.t < s.nextEventAt) return null;
    const pool = EVENTS.filter((e) => eligible(e, s));
    const e = weightedPick(pool, (ev) => {
      let w = ev.weight == null ? 1 : resolve(ev.weight, s);
      if (ev.tag && ev.tag === s.lastTag) w *= 0.35;
      return w;
    });
    return e || null;
  }

  // ---------- 선택 처리 ----------
  function pickOutcome(outs) {
    let r = Math.random();
    for (const o of outs) { r -= o.p; if (r <= 0) return o; }
    return outs[outs.length - 1];
  }

  function choose(idx, byAuto) {
    const s = S;
    const p = s.pending;
    if (!p || p.result) return null;
    const c = p.choices[idx];
    if (!c || c.locked) return null;

    const outcome = c.outcomes ? pickOutcome(c.outcomes) : null;
    const fx = sumFx(resolve(c.fx, s), outcome && resolve(outcome.fx, s));
    const before = { ...s.stats };
    applyFx(fx);

    const tags = (outcome && outcome.tags) || c.tags || [];
    tags.forEach((t) => { s.counters[t] = (s.counters[t] || 0) + 1; });
    if (byAuto) s.counters.auto += 1;

    const flags = { ...(c.flags || {}), ...((outcome && outcome.flags) || {}) };
    Object.keys(flags).forEach((k) => {
      if (flags[k] === false) { delete s.flags[k]; } else setFlag(k, flags[k]);
    });
    const inc = { ...(c.inc || {}), ...((outcome && outcome.inc) || {}) };
    Object.keys(inc).forEach((k) => { s.flags[k] = (s.flags[k] || 0) + inc[k]; s.flagT[k] = s.t; });

    const roleSet = outcome && outcome.role !== undefined ? outcome.role : c.role;
    let roleNote = null;
    if (roleSet !== undefined) {
      if (roleSet === 'none') {
        if (s.role) roleNote = `직무 상실: ${ROLES[s.role].name}`;
        s.role = null; s.roleSince = null;
      } else {
        s.role = roleSet; s.roleSince = s.t;
        roleNote = `직무 획득: ${ROLES[roleSet].name}`;
      }
      if (hooks.onRole) hooks.onRole();
    }

    if ((outcome && outcome.rescore) || c.rescore) {
      if (!s.queue.includes('review')) { s.queue.push('review'); s.tmp.urgent = true; }
    }
    const end = (outcome && outcome.ending) || c.ending;
    if (end) s.ending = end;

    // 세계 변화 메모
    const worldNote = [];
    if (fx.hostility) worldNote.push(fx.hostility > 0 ? '이송 찬성 여론 ▲' : '이송 찬성 여론 ▼');
    if (fx.alert) worldNote.push(fx.alert > 0 ? '감염 경보 ▲' : '감염 경보 ▼');

    const deltas = [];
    Object.keys(STAT_LABEL).forEach((k) => {
      const d = Math.round(s.stats[k]) - Math.round(before[k]);
      if (d) deltas.push({ key: k, label: STAT_LABEL[k], d });
    });

    let text = resolve(outcome && outcome.result != null ? outcome.result : c.result, s) || '';
    s.decisions.push({
      t: s.t, date: fmtDate(s.t), title: p.title, choice: c.text,
      tags: tags.slice(), auto: !!byAuto, grade: s.grade,
    });
    addLog(byAuto ? 'warn' : 'event',
      `${p.title} — ${byAuto ? '분석기 대리 결정: ' : ''}${c.text}`);

    let extra = null;
    if (p.ev.after) extra = p.ev.after(s, c);

    p.result = { text, extra, deltas, roleNote, worldNote, byAuto: !!byAuto, tags: tags.slice() };
    if (!p.sys) s.nextEventAt = s.t + rand(0.35, 0.8);
    checkDeath();
    if (p.ev.id === 'review') s.nextEventAt = Math.max(s.nextEventAt, s.t + 0.3);
    return p.result;
  }

  function autoChoose() {
    const p = S.pending;
    if (!p || p.result) return null;
    return choose(p.autoIdx, true);
  }

  function dismiss() {
    if (!S.pending) return;
    S.pending = null;
    checkDeath();
    if (!S.over) save();
  }

  // ---------- 사망/붕괴 ----------
  function checkDeath() {
    const s = S;
    if (s.ending) return;
    if (s.stats.health <= 0) {
      const infected = s.flags.infected && s.t - (s.flagT.infected || 0) < 2;
      s.ending = (s.stats.food <= 15 && !infected) ? 'hunger' : 'disease';
    } else if (s.stats.mind <= 0) {
      s.ending = 'breakdown';
    }
  }

  // ---------- 연간 정산 ----------
  const RATION = { 1: 12, 2: 9, 3: 5, 4: 2, 5: 0 };
  const MEDICAL = { 1: 2, 2: 0, 3: -3, 4: -5, 5: -4 };
  const MINDG = { 1: 2, 2: 1, 3: 0, 4: -3, 5: -2 };

  function yearTick() {
    const s = S;
    const g = s.grade, st = s.stats, w = s.world;
    const before = { ...st };
    const role = s.role ? ROLES[s.role].fx : {};

    // 공동체의 힘: 유대가 두터울수록 서로 나누어 버틴다
    const support = st.bond >= 60 ? { f: 2, h: 1 } : st.bond >= 40 ? { f: 1, h: 0 } : { f: 0, h: 0 };
    let food = RATION[g] - 8 - (w.alert > 60 ? 2 : 0) + (s.flags.garden ? 3 : 0) +
               (s.flags.mutual_aid ? 2 : 0) + support.f + (role.f || 0);
    let health = MEDICAL[g] + support.h + (role.h || 0);
    let mind = -1 + MINDG[g] + (st.bond >= 60 ? 2 : st.bond < 25 ? -1 : 0) + (role.m || 0);
    let bond = -1 + (role.b || 0);
    let comply = (role.c || 0);
    if (g === 5 && st.bond >= 50) food += 4;

    if (st.food + food < 20) { health -= 4; mind -= 2; }
    if (st.food + food <= 0) health -= 6;
    if (st.mind + mind < 20) health -= 2;

    applyFx({ f: food, h: health, m: mind, b: bond, c: comply });

    // 세계 변화
    w.hostility = clamp(w.hostility + 1.1 + rand(-0.6, 0.6));
    w.alert = clamp(w.alert + (40 - w.alert) * 0.1 + rand(-7, 9), 5, 95);

    const parts = [];
    Object.keys(STAT_LABEL).forEach((k) => {
      const d = Math.round(st[k]) - Math.round(before[k]);
      if (d) parts.push(`${STAT_LABEL[k]} ${d > 0 ? '+' : '−'}${Math.abs(d)}`);
    });
    addLog('sys', `${s.yearIdx}년차 정산 · ${GRADES[g].short || g + '등급'} 배급 — ${parts.join(' · ') || '변동 없음'}`);

    // 정기 재분류 / 감염 / 이송
    if (s.grade !== 5) {
      if (s.yearIdx % C.REVIEW_EVERY === 0 && s.yearIdx < C.YEARS) {
        if (!s.queue.includes('review')) s.queue.push('review');
      }
      const recentlyInfected = s.flags.infected && s.t - (s.flagT.infected || 0) < 1.5;
      if (w.alert >= 35 && !recentlyInfected && (s.seen.infected || 0) < 3) {
        const p = (0.02 + (w.alert - 35) * 0.0025) * (g >= 3 ? 1.5 : 0.8);
        if (Math.random() < p && !s.queue.includes('infected')) s.queue.push('infected');
      }
      if (g === 4 && s.transferAt == null && s.t >= s.noTransferUntil && Math.random() < 0.10 + quota(s) * 0.01) {
        s.transferAt = s.t + rand(0.1, 0.4);
        addLog('warn', '분석기 긴급 쿼터 적용: 이송 대기구에서 추가 호출이 예정되었습니다.');
      }
    }
    s.hist.push({ t: s.t, grade: s.grade, ...st });
    if (hooks.onYear) hooks.onYear(s.yearIdx);
    checkDeath();
  }

  // ---------- 시간 진행 ----------
  function advance(dy) {
    const s = S;
    s.t += dy;
    const m = monthOf(s.t);
    if (m !== s.month) s.month = m;
    while (Math.floor(s.t) > s.yearIdx) {
      s.yearIdx += 1;
      yearTick();
    }
  }

  /**
   * dt: 현실 경과 초, speed: 배속(0=정지), mode: 'slow'(선택 중 1배속) | 'pause'
   */
  function update(dt, speed, mode) {
    const s = S;
    if (!s || s.over) return;
    if (s.pending) {
      const p = s.pending;
      if (p.result) return;
      if (mode === 'slow' && !p.noTimer) {
        p.elapsed += dt;
        advance(dt / C.SPY);
        if (p.elapsed >= C.AUTO_SEC) autoChoose();
      }
      return;
    }
    if (s.ending) return;
    if (speed > 0) advance((dt * speed) / C.SPY);

    // 종료 조건
    if (s.t >= C.YEARS && !s.pending) {
      if (s.flags.ghost && !s.ending) { s.ending = 'complete'; return; }
    }
    if (!s.pending && !s.ending) {
      const e = nextEvent();
      if (e) openEvent(e);
    }
  }

  // ---------- 공청회 / 시민 지수 ----------
  function civic(s) {
    const c = s.counters, f = s.flags;
    let v = c.R * 1.2 + c.S * 0.7 - c.B * 1.5 - c.auto * 0.4;
    v += (f.audit_opened ? 4 : 0) + (f.revealed_mars ? 2 : 0) + (f.evidence_labels ? 2 : 0) +
         (f.transport_leak ? 2 : 0) + (f.petitionSigs || 0) * 0.8;
    return v;
  }

  function resolveHearing(s, vote, evidence) {
    const bonus = { abolish: 3, reform: 2, abstain: 0, keep: -2 }[vote] || 0;
    const pressure = civic(s) - s.world.hostility / 8 + bonus + (evidence ? 5 : 0);
    s.hearing = { vote, pressure: round1(pressure) };
    if (pressure >= 14) s.hearing.outcome = 'abolish';
    else if (pressure >= 7) s.hearing.outcome = 'reform';
    else s.hearing.outcome = 'keep';
    return s.hearing.outcome;
  }

  // ---------- 저장 ----------
  function save() {
    try {
      if (!S || S.over || S.pending) return;
      const copy = { ...S, pending: null };
      localStorage.setItem(C.SAVE_KEY, JSON.stringify(copy));
    } catch (e) { /* 저장소 사용 불가 */ }
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(C.SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1 || s.over) return null;
      return s;
    } catch (e) { return null; }
  }
  function hasSave() { return !!loadSave(); }
  function clearSave() { try { localStorage.removeItem(C.SAVE_KEY); } catch (e) { /* */ } }

  function seenEndings() {
    try { return JSON.parse(localStorage.getItem(C.END_KEY) || '[]'); } catch (e) { return []; }
  }
  function markEnding(key) {
    try {
      const a = seenEndings();
      if (!a.includes(key)) { a.push(key); localStorage.setItem(C.END_KEY, JSON.stringify(a)); }
      return a.length;
    } catch (e) { return 0; }
  }

  // ---------- 시작/종료 ----------
  function start(originKey) {
    S = newState(originKey);
    G.state = S;
    clearSave();
    S.hist.push({ t: 0, grade: 3, ...S.stats });
    addLog('sys', `ID ${S.id} · ${ORIGINS[originKey].name} · 제7 수용구 입소`);
    return S;
  }
  function resume() {
    const s = loadSave();
    if (!s) return null;
    S = s; G.state = S;
    addLog('sys', '저장된 기록에서 이어합니다.');
    return S;
  }
  function finish() {
    S.over = true;
    clearSave();
  }

  // ---------- 요약(엔딩 화면용) ----------
  function summary(s) {
    const noQ = s.reviews.filter((r) => r.kind !== 'initial' && r.gradeNoQ < r.grade).length;
    const originBias = ORIGINS[s.origin].bias;
    const hiddenEvents = s.reviews.filter((r) => r.kind !== 'initial');
    const worst = s.reviews.reduce((a, r) => Math.max(a, r.grade), 0);
    return {
      noQCount: noQ,
      reviewCount: hiddenEvents.length,
      originBias,
      worstGrade: worst,
      qFinal: quota(s),
      civic: round1(civic(s)),
    };
  }

  const G = root.Game = {
    C, GRADES, ORIGINS, ROLES, STAT_LABEL, STAT_KEYS,
    clamp, rand, fmtDate, monthOf, yearOf, ageOf, since, quota,
    hooks, state: null,
    registerEvents, start, resume, update, choose, autoChoose, dismiss,
    reclassify, setFlag, addLog, save, hasSave, clearSave, finish, summary,
    resolveHearing, civic, computeScore, seenEndings, markEnding,
    scoreParts, lockInfo, byId: () => byId,
    get S() { return S; },
  };
  Object.keys(GRADES).forEach((k) => { GRADES[k].short = `${k}등급`; });
})(typeof window !== 'undefined' ? window : globalThis);
