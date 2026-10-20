/* ============================================================
   등급 판정 — 이벤트 데이터
   태그: S 연대 · E 보신 · O 순응 · R 저항 · B 타인에게 해를 끼침(밀고·배신)
   스탯 키: h 건강 · f 식량 · m 정신 · b 유대 · c 협조도 (alert·hostility = 세계 지표)
   ============================================================ */
(function (root) {
  'use strict';
  const E = [];
  const add = (o) => E.push(o);
  const G = () => root.Game;
  const season = (s, ...ms) => ms.includes(s.month);
  const R = (...r) => ({ role: r });

  /* ====================== 시스템 이벤트 ====================== */

  add({
    id: 'intake', sys: true, noTimer: true, tag: '입소 평가', title: '첫 번째 질문',
    text: (s) => [
      `${G().fmtDate(s.t)}. 제7 수용구 입구. ${G().ORIGINS[s.origin].intro}`,
      '손목에 검은 밴드가 채워진다. 입구 단말기에 "통합 생존 분석기 v7.3"이라는 글자가 뜬다. 분석기는 건강기록, 이동 이력, 가족 관계, 노동 가능성을 읽고 당신에게 "등급"을 매긴다. 평가 항목은 일부만 공개되어 있고, 나머지는 "모델 보호를 위해" 비공개다.',
      '첫 질문이 화면에 뜬다. "전자 건강기록 전면 공개에 동의하십니까? 미동의 시 일부 평가 항목이 불확실로 처리됩니다."',
    ],
    choices: [
      { text: '전면 동의한다', hint: '평가에 유리하다고 한다', tags: ['O'], auto: true,
        fx: { c: 6, m: -2 }, flags: { consent_full: true },
        result: '서명란에 손가락을 올리자 화면이 초록색으로 깜박였다. 내 몸의 기록이 한꺼번에 어딘가로 넘어가는 느낌이 들었다.' },
      { text: '필수 항목만 동의한다', tags: [], fx: { c: 0 }, flags: { consent_min: true },
        result: '"일부 항목은 불확실로 처리됩니다." 화면의 문장이 조금 차갑게 느껴졌다.' },
      { text: '동의하지 않는다', hint: '평가에 불리할 수 있다', tags: ['R'],
        fx: { c: -6, m: 3 }, flags: { consent_none: true },
        result: '직원이 한숨을 쉬며 체크박스에 붉은 표시를 했다. "나중에 후회하실 수도 있어요."' },
    ],
    after: (s) => {
      const r = G().reclassify(s, 'initial');
      return `분석기가 판정을 내렸다. 입소 등급: ${r.grade}등급 — ${G().GRADES[r.grade].name}. 사유란에는 "공개 가능 항목 없음"이라고 적혀 있다.`;
    },
  });

  add({
    id: 'review', sys: true, once: false, tag: '재분류',
    prepare: (s) => { G().reclassify(s, s.tmp.urgent ? 'urgent' : 'regular'); s.tmp.urgent = false; },
    title: (s) => (s.tmp.review.kind === 'urgent' ? '긴급 재분류 통보' : '정기 재분류 통보'),
    text: (s) => {
      const r = s.tmp.review;
      const g = G().GRADES;
      const out = [];
      if (r.prev === r.grade) out.push(`단말기에 결과가 뜬다. 등급 유지 — ${r.grade}등급(${g[r.grade].name}).`);
      else if (r.grade < r.prev) out.push(`단말기에 결과가 뜬다. ${r.prev}등급 → ${r.grade}등급. ${g[r.grade].name}(으)로 배정이 바뀐다. 새 거주 배정서가 함께 도착했다.`);
      else out.push(`단말기에 결과가 뜬다. ${r.prev}등급 → ${r.grade}등급. ${g[r.grade].name}(으)로 배정이 바뀐다. 짐을 옮길 시간은 사흘이다.`);
      const why = r.reasons.length ? r.reasons.join(', ') : '해당 없음';
      let p2 = `공개 사유: ${why}. 그 밖의 평가 항목은 비공개다.`;
      if (r.qMoved) p2 += ' 안내문 끝에 작은 글씨로 "평가 기준선이 조정되었습니다. (사유: 비공개)"가 붙어 있다.';
      out.push(p2);
      if (r.grade === 4) {
        out.push(s.g4reviews >= 2 || r.prev === 4
          ? '귀하는 재배치 프로그램 호출 대상입니다. 곧 호출 안내가 발송됩니다.'
          : '귀하는 재배치 프로그램 후보군에 편입되었습니다. 이 통보에 대한 이의는 아래 절차로 접수하십시오.');
      }
      return out;
    },
    choices: (s) => {
      const r = s.tmp.review;
      const list = [
        { text: '결과를 받아들인다', tags: ['O'], auto: true, fx: { c: 2 },
          result: '버튼을 누르자 화면이 꺼졌다. 어떤 대답도 돌아오지 않았지만, 서명은 남았다.' },
        { text: '이의 신청서를 개인 자격으로 제출한다', tags: ['R'], fx: { m: -3, c: -2 }, inc: { appeals: 1 },
          result: () => `접수번호 ${7000 + Math.floor(Math.random() * 2999)}. 담당자: 미지정. 처리 기한: 미정. 이후 아무 연락도 오지 않았다.` },
      ];
      if (r.grade <= 2 && r.prev > r.grade) {
        list.push({ text: '새 배정으로 늘어난 배급 일부를 이전 이웃들에게 나눈다', tags: ['S'],
          fx: { f: -5, b: 6, m: 2 }, result: '짐을 옮기던 복도에서 사람들이 길을 비켜 주었다. 누군가는 조용히 손을 흔들었다.' });
      }
      list.push({ text: '[대변인] 구역 대표 자격으로 집단 이의를 신청한다', req: R('speaker'), tags: ['R'],
        fx: { c: -5, b: 5 },
        outcomes: [
          { p: 0.4, fx: { scoreNext: 8 }, result: '대표 명의의 집단 이의는 "자동 검토 대상"으로 분류되었다. 이번에는 다음 평가에 가산점이 붙었다.' },
          { p: 0.6, result: '집단 이의는 "개별 사안 취합 불가"로 반려되었다. 반려 사유서에는 서명자가 없었다.' },
        ] });
      list.push({ text: '[라벨러] 내부 로그에서 내 평가 사유를 조회한다', req: R('auditor'), tags: ['R'],
        fx: { c: -5, m: 4 }, flags: { saw_weights: true },
        result: (st) => {
          const rec = st.tmp.review;
          const lines = rec.parts.map((p) => `${p.label} ${p.v > 0 ? '+' : ''}${Math.round(p.v * 10) / 10}${p.hidden ? ' (비공개)' : ''}`);
          return `조회 기록은 남는다. 화면에 항목별 가산이 떠 있다 — ${lines.join(' / ')}. 합계 ${rec.total}점, 이번 문턱은 ${rec.thr.join('·')}점.`;
        } });
      return list;
    },
  });

  add({
    id: 'infected', sys: true, max: 3, tag: '감염', title: '감염 의심 통보',
    text: ['밴드가 진동한다. 체온 38.9도, 이틀째 이어진 기침. 단말기가 붉게 바뀐다. "감염 의심. 격리 안내를 확인하십시오."', '격리동의 사정은 등급에 따라 다르다고 한다. 어떤 곳에는 의사가 있고, 어떤 곳에는 문만 있다.'],
    choices: [
      { text: '신고하고 격리동에 들어간다', tags: ['O'], auto: true,
        fx: (s) => ({ h: s.grade <= 2 ? -6 : -14, c: 6, m: -5 }), flags: { infected: true },
        result: (s) => (s.grade <= 2 ? '격리동에는 산소 포화도 측정기와 담당 의사가 있었다. 열은 엿새 만에 내렸다.' : '격리동에는 침대 대신 매트가 깔려 있었다. 이름 대신 번호로 불렸고, 열은 열흘 만에 내렸다.') },
      { text: '숨기고 집에서 버틴다', hint: '이웃에게 번질 수 있다', tags: ['E'], fx: { h: -14, c: -4 }, flags: { infected: true },
        outcomes: [
          { p: 0.55, fx: {}, result: '약도 없이 나흘을 앓았다. 다행히 아무에게도 옮기지 않았다.' },
          { p: 0.45, fx: { h: -8, b: -10, m: -8, alert: 6 }, tags: ['B'], result: '이웃 두 집에서 같은 기침이 시작되었다. 복도에서 마주쳐도 아무도 눈을 맞추지 않았다.' },
        ] },
      { text: '[의료·방역 접근] 직접 치료제를 처방받아 자가 치료한다', req: R('medic', 'quarantine'), tags: [],
        fx: { h: -6, c: -2 }, flags: { infected: true },
        result: '의무소 재고에서 처방을 받았다. 다행히 경증으로 지나갔다. 같은 병에 걸린 다른 사람들은 처방을 받지 못했다.' },
    ],
  });

  add({
    id: 'transfer', sys: true, once: false, tag: '재배치', title: '재배치 호출',
    trigger: (s) => s.transferAt != null && s.t >= s.transferAt && s.grade === 4,
    text: (s) => [
      '이른 아침, 구역 확성기가 번호를 부른다. 당신의 ID다. "재배치 프로그램 대상자는 정오까지 3번 게이트로 집결하십시오."',
      '안내문 어디에도 "추방"이라는 단어는 없다. 게이트 너머에는 이송선이 서 있고, 선체 옆 배정표에는 "도착 후 보급 계획: 미정"이라고 적혀 있다.',
    ],
    choices: [
      { text: '게이트로 걸어간다', tags: ['O'], auto: true, ending: 'transfer',
        result: '짐은 한 가방으로 충분했다. 게이트의 직원은 번호를 확인하고 고개를 끄덕였다. 누구도 이유를 말해 주지 않았다.' },
      { text: '밴드를 끊고 수용구 틈새로 숨는다', tags: ['R'], hint: '연락책이나 두터운 유대가 필요하다',
        req: { fn: (s) => s.flags.ghost_contact || s.stats.bond >= 60, text: '숨겨 줄 사람이 필요하다 (유대 60 이상 또는 연락책)' },
        outcomes: [
          { p: 0.6, flags: { ghost: true }, fx: { m: -4, c: -20, b: -5 }, role: 'none', result: '밴드가 꺼지는 순간 내 이름이 분석기에서 지워졌다. 이제 배급도 등급도 호출도 없다. 어디에도 속하지 않는 사람이 되었다.', _ghost: true },
          { p: 0.4, ending: 'transfer', result: '배수로를 따라 도망쳤지만 출구에 이미 사람들이 서 있었다. 밴드는 꺼졌어도 얼굴은 남아 있었다.' },
        ] },
      { text: '집단 청원으로 시간을 번다', tags: ['R', 'S'],
        req: { fn: (s) => (s.flags.petitionSigs || 0) >= 1 || s.role === 'speaker' || s.stats.bond >= 55, text: '함께할 사람들이 필요하다 (청원 참여, 대변인, 또는 유대 55 이상)' },
        fx: { c: -8, b: 4 },
        outcomes: [
          { p: 0.5, fx: { m: 4, b: 6 }, flags: { transfer_delayed: true }, result: '주민 수백 명이 게이트 앞에 앉았다. 호출은 "행정 사유"로 일 년 연기되었다. 이름이 지워진 것은 아니다.' },
          { p: 0.5, ending: 'transfer', result: '청원서는 접수되었다. 접수 시각은 정오 이후였다.' },
        ] },
      { text: '내 번호 대신 다른 사람의 번호를 제출한다', tags: ['B', 'E'],
        req: { fn: (s) => s.stats.comply >= 55 || ['auditor', 'transport', 'ration'].includes(s.role) || s.flags.informant, text: '명단에 접근할 수 있어야 한다 (협조도 55 이상, 라벨러·정비사·배급 관리원, 또는 협조원)' },
        fx: { c: 4, m: -18, b: -18 }, flags: { betrayed: true },
        result: '터미널에 다른 번호를 입력했다. 분석기는 번호의 주인이 누구인지 묻지 않았다. 화면에는 "정정 완료"만 떴다. 그 번호의 주인은 이웃 규였을지도, 아닐지도 모른다.' },
    ],
    after: (s, c) => {
      if (c.text.startsWith('밴드를 끊')) {
        // 결과가 ghost인 경우 등급 5로
        if (s.flags.ghost) { s.grade = 5; s.transferAt = null; s.queue = s.queue.filter((q) => q !== 'review'); return '등급: 없음. 이제 분석기의 어떤 평가도 이 몸을 향하지 않는다.'; }
      }
      if (c.text.startsWith('집단 청원') && s.flags.transfer_delayed) { s.transferAt = null; s.noTransferUntil = s.t + 1.6; delete s.flags.transfer_delayed; }
      if (c.text.startsWith('내 번호')) { s.grade = 3; s.transferAt = null; s.noTransferUntil = s.t + 1.6; s.stats.food = Math.max(s.stats.food, 30); return '당신의 등급은 3등급으로 "정정"되었다. 이송선은 예정대로 출발했다.'; }
      return null;
    },
  });

  add({
    id: 'petition_result', sys: true, tag: '청원', title: '청원 결과 통보',
    trigger: (s) => s.flags.petition_t != null && !s.flags.petition_done && s.t >= s.flags.petition_t + 1.2,
    prepare: (s) => {
      const f = s.flags;
      const pts = (f.petitionSigs || 0) + (f.evidence_labels ? 2 : 0) + (f.transport_leak ? 2 : 0) +
                  (f.revealed_mars ? 2 : 0) + (f.asked_about_list ? 1 : 0) + (f.pickets ? 1 : 0) + (f.taught_kids ? 1 : 0) +
                  (s.role === 'speaker' ? 2 : 0) + Math.floor(s.stats.bond / 25) - Math.floor(s.world.hostility / 25);
      s.tmp.petitionOk = pts >= 7;
      s.tmp.petitionPts = pts;
      s.flags.petition_done = true;
    },
    text: (s) => (s.tmp.petitionOk
      ? ['구역 사무소 게시판에 공문이 붙었다. "분석기 평가 기준 일부 공개 및 이의 절차 개정을 위한 외부 감사에 착수합니다."', '서명자 명단이 감사 자료에 첨부되었다. 이름이 곧 위험이던 청원이, 이번에는 증거가 되었다.']
      : ['구역 사무소 게시판에 공문이 붙었다. "청원은 접수 요건 미비로 반려합니다. 담당 부서: 해당 없음."', '서명자 명단은 반려 공문과 함께 "참고 자료"로 분석기에 보관된다고 한다.']),
    choices: [
      { text: '결과를 확인한다', tags: [], auto: true,
        fx: (s) => (s.tmp.petitionOk ? { m: 8, b: 6, c: -3, hostility: -6 } : { m: -6, c: -6 }),
        flags: {},
        result: (s) => (s.tmp.petitionOk ? '복도에서 누군가 박수를 쳤다. 곧 사람들이 따라 쳤다. 아무도 크게 말하지 않았지만, 모두 같은 표정이었다.' : '서명한 사람들이 하나둘 복도에서 서로를 피했다. 그날 밤 공동 창고의 불은 켜지지 않았다.') },
    ],
    after: (s) => {
      if (s.tmp.petitionOk) { G().setFlag('audit_opened'); s.world.hostility = G().clamp(s.world.hostility - 6); return '분석기 평가 기준에 대한 외부 감사가 시작되었다.'; }
      G().setFlag('petition_failed');
      if (!s.queue.includes('review')) { s.queue.push('review'); s.tmp.urgent = true; }
      return '서명자 명단이 위험 인자 목록에 반영된다.';
    },
  });

  add({
    id: 'hearing', sys: true, tag: '공청회', title: '분석기 운영 공청회',
    trigger: (s) => s.t >= G().C.YEARS - 0.2 && s.grade !== 5,
    text: (s) => {
      const f = s.flags;
      const out = [
        `${G().fmtDate(s.t)}. 통합 생존 분석기 도입 ${G().C.YEARS}년. 시민 공청회가 열린다. 안건: "분석기의 평가 권한 유지 여부". 방청석에는 1등급 시민과 수용구 대표가 섞여 앉아 있다.`,
      ];
      if (f.audit_opened) out.push('안건 자료에는 외부 감사 보고서가 포함되어 있다. 보고서는 출신 구역이 평가 점수에 반영되었다고 적는다.');
      else if (f.petition_failed) out.push('수용구에서는 청원이 반려되었다는 이야기가 오래 돌았다. 방청석 뒷줄에는 서명자들이 앉아 있다.');
      if (f.revealed_mars) out.push('이송자들의 통신이 공개된 뒤, 재배치 프로그램의 보급 계획에 관한 질의가 이어졌다.');
      out.push('당신에게도 한 표와 발언 기회가 주어진다.');
      return out;
    },
    choices: (s) => {
      const base = [
        { text: '유지에 찬성한다 — 위기에는 계산이 감정보다 많은 사람을 살린다', tags: ['O'], vote: 'keep',
          result: '손을 들자 방청석 앞줄에서 작은 박수가 났다. 뒷줄에서는 아무 소리도 나지 않았다.' },
        { text: '조건부 유지를 제안한다 — 이유 설명, 이의 절차, 책임자 명시', tags: ['R', 'S'], vote: 'reform',
          result: '발언은 일 분 사십 초였다. 진행자가 "경청했다"고 말했다. 그 말이 어디까지 기록되는지는 알 수 없었다.' },
        { text: '폐지에 찬성한다 — 사람의 가치를 등급으로 매겨선 안 된다', tags: ['R'], vote: 'abolish',
          result: '"분석기는 설명하지 않았습니다." 마이크가 한 번 울렸다. 숨을 고르고 문장을 끝까지 말했다.' },
        { text: '기권한다', tags: ['E'], vote: 'abstain', auto: true,
          result: '손을 들지 않았다. 기록에는 기권이라는 숫자 한 칸이 늘었다.' },
        { text: '[라벨러] 내부 자료를 증거로 제출한다', req: R('auditor'), tags: ['R', 'S'], vote: 'abolish', evidence: true, hideIfLocked: true,
          requires2: { flag: 'evidence_labels' },
          fx: { c: -20 }, result: '복사해 둔 지침 문서를 연단 위에 올렸다. 라벨 하나하나에 붙은 "출신 구역" 칸이 화면에 크게 떴다.' },
        { text: '[대변인] 수용구 주민의 증언을 읽는다', req: R('speaker'), tags: ['R', 'S'], vote: 'reform', evidence: true, hideIfLocked: true,
          fx: { c: -8, b: 6 }, result: '오 년 동안 모은 이름과 날짜를 하나씩 읽었다. 이송된 사람, 돌아오지 않은 사람, 답이 오지 않은 신청서.' },
        { text: '[정비사] 이송선 적재 기록을 증거로 제출한다', req: R('transport'), tags: ['R', 'S'], vote: 'abolish', evidence: true, hideIfLocked: true,
          fx: { c: -12 }, result: '"도착 후 보급 계획: 미정"이라는 문구가 적힌 정비 기록을 화면에 띄웠다. 방청석이 술렁였다.' },
      ];
      return base.filter((c) => !c.requires2 || s.flags[c.requires2.flag]);
    },
    after: (s, c) => {
      const outcome = G().resolveHearing(s, c.vote, !!c.evidence);
      const txt = {
        abolish: '표결 결과: 분석기의 평가 권한은 폐지되었다. 등급은 더 이상 배급과 거주지를 결정하지 못한다. 대신 누가 어떤 기준으로 돕는지를 사람이 정하고, 그 이름을 적어야 한다.',
        reform: '표결 결과: 조건부 유지. 평가 기준 공개, 이의 절차, 인간 책임자 지정이 의무화되었다. 분석기는 남았지만, 더는 혼자 결정하지 못한다.',
        keep: '표결 결과: 현행 유지. "효율적 자원 배분"이라는 문구가 결의문 첫 줄에 올랐다. 등급은 다음 분기에도 계속 매겨진다.',
      }[outcome];
      return txt;
    },
    ending: 'complete',
  });

  // choices에 ending이 반영되도록 hearing의 각 선택에 ending 부여
  E.find((e) => e.id === 'hearing').choices = ((orig) => (s) => orig(s).map((c) => ({ ...c, ending: 'complete' })))(E.find((e) => e.id === 'hearing').choices);


  add({
    id: 'informant_leak', sys: true, tag: '명단 유출', title: '협조원 명단 유출',
    trigger: (s) => s.flags.informant && G().since(s, 'informant') >= 2.5 && s.t < G().C.YEARS - 0.6,
    text: ['새벽, 수용구 전체 단말기에 파일 하나가 뿌려졌다. "구역 안정 협조원 명단 (비식별 처리)". 비식별 처리는 허술했다. 맨 윗줄 근처에 당신의 칸 번호가 있다.', '복도의 문들이 하나씩 닫힌다. 문이 닫히는 소리는 생각보다 작다.'],
    choices: [
      { text: '이웃들 앞에서 사실을 인정하고 사과한다', tags: ['S'], fx: { b: -4, m: -4, c: -8 }, flags: { exposed: true, informant: false }, rescore: true,
        result: '사람들은 아무 말도 하지 않았다. 몇 사람은 등을 돌렸고, 한 사람은 오래 쳐다보다가 고개를 끄덕였다. 용서가 아니라, 기록이었다.' },
      { text: '조작된 명단이라고 부인한다', tags: ['E'], auto: true, fx: { b: -14, m: -8, c: 2 }, flags: { exposed: true },
        result: '증거는 충분했다. 이웃들은 부인하는 목소리를 끝까지 들었다. 그리고 그날 이후 복도에서 당신의 이름이 불리지 않았다.' },
      { text: '돔 관리국에 보호를 요청한다', tags: ['O', 'B'], fx: { c: 4, b: -18, m: -8 }, flags: { exposed: true },
        result: '관리국은 "협조에 감사드린다"며 칸을 옮겨 주었다. 새 칸에서도 문은 모두 닫혀 있었다.' },
    ],
  });

  /* ====================== 일반 이벤트 ====================== */

  add({
    id: 'ration_cut', tag: '배급', title: '배급량 재산정',
    weight: (s) => (s.stats.food < 45 ? 2.5 : 1),
    text: ['분석기가 구역별 배급량을 다시 계산했다. 3구역 몫은 12% 줄었다. 공지문에는 "효율적 자원 배분"이라는 말만 적혀 있다.', '줄은 평소보다 길고 앞사람들의 목소리가 날카롭다. 누구도 이 숫자를 누가 정했는지 모른다.'],
    choices: [
      { text: '정해진 줄에서 줄어든 몫을 받는다', tags: ['O'], auto: true, fx: { f: -2, c: 2 }, result: '봉투는 생각보다 가벼웠다. 앞사람이 봉투를 열어 보고 말없이 닫았다.' },
      { text: '옆 칸 란의 몫까지 대신 받아 반씩 나눈다', tags: ['S'], fx: { f: -4, b: 8, m: 2 }, result: '란은 말없이 국을 반으로 나눠 주었다. 그날 밤 복도에는 숟가락 소리만 오래 났다.' },
      { text: '암시장에서 부족한 몫을 산다', hint: '단속에 걸릴 수 있다', tags: ['E'], fx: { f: 10, c: -4 },
        outcomes: [
          { p: 0.7, result: '낡은 쌀 봉지는 값에 비해 가벼웠지만 한 달은 버틸 만했다.' },
          { p: 0.3, fx: { f: -8, c: -10, m: -4 }, flags: { blackmarket_caught: true }, result: '단속반이 뒷골목을 막았다. 봉지는 압수되었고, 기록에는 "불법 거래 시도"가 남았다.' },
        ] },
    ],
  });

  add({
    id: 'fever_neighbor', tag: '방역', title: '옆 칸의 기침 소리',
    when: (s) => s.t >= 0.3 && s.world.alert >= 15,
    text: ['옆 칸 사람이 사흘째 열이 난다. 기침 소리를 들은 이웃들이 슬금슬금 문에서 멀어진다.', '신고하면 방역반이 오지만, "감염 의심군"으로 분류되면 같은 복도 전체 평가가 흔들린다는 소문이 있다.'],
    choices: [
      { text: '방역반에 신고한다', tags: ['O'], fx: { c: 8, b: -6, m: -3, alert: -3 }, result: '하얀 방호복을 입은 사람들이 와서 그를 데려갔다. 며칠 뒤 그의 칸은 비어 있었다. 돌아왔다는 이야기는 듣지 못했다.' },
      { text: '문 앞에 물과 해열제를 두고 간다', hint: '나도 옮을 수 있다', tags: ['S'], fx: { h: -3, f: -3, b: 10, c: -4, m: 2, alert: 3 },
        outcomes: [
          { p: 0.65, fx: { b: 4 }, result: '이틀 뒤 문 앞에 빈 컵이 놓여 있었다. 컵 아래에 접힌 쪽지가 있었다. "고맙습니다."' },
          { p: 0.35, fx: { h: -10 }, result: '이틀 뒤 내 목도 아프기 시작했다. 후회는 하지 않았지만 많이 무서웠다.' },
        ] },
      { text: '문을 닫고 거리를 둔다', tags: ['E'], auto: true, fx: { m: -4, b: -3 }, result: '벽을 사이에 두고 기침 소리를 들었다. 사흘 뒤 기침 소리가 멈췄다. 그게 나아진 것인지는 알 수 없었다.' },
      { text: '[방역 요원] 정식 검사 후 자택 격리로 처리한다', req: R('quarantine'), tags: ['S', 'O'], fx: { c: 4, b: 5, h: -2 }, result: '내 재량으로 격리동 대신 자택 격리 기록을 남겼다. 그는 집에서 약을 먹고 일어났다. 나는 서류에 서명한 값을 치러야 한다.' },
    ],
  });

  add({
    id: 'new_arrivals', tag: '난민 유입', title: '해일 피해자들의 입소',
    when: (s) => s.t >= 0.6,
    text: ['남부 해안에 해일이 덮쳐 이틀 만에 이천 명이 수용구로 들어왔다. 컨테이너 한 칸에 두 가구가 들어가야 한다. 복도에는 이불도 없이 앉은 사람들이 있다.', '사무소 앞에는 "과밀 해소를 위해 입소 제한이 필요하다"는 서명지가 놓였다.'],
    choices: [
      { text: '내 자리 한쪽을 내어준다', tags: ['S'], fx: { h: -3, m: -3, b: 10, hostility: -2 }, result: '좁은 바닥에 담요를 하나 더 깔았다. 밤새 낯선 사람의 숨소리를 들었다. 그다지 불편하지 않았다.' },
      { text: '증설을 요구하는 서명을 모아 사무소에 낸다', req: { minBond: 35 }, tags: ['S', 'R'], fx: { c: -5, b: 6, m: 2 }, flags: { organizer: true }, result: '서명지는 마흔한 명이 채웠다. 사무소 직원은 영수증만 줄 뿐 아무 말도 하지 않았다. 그래도 서명한 사람들끼리 서로를 알아보게 되었다.' },
      { text: '분석기가 배정한 대로 따른다', tags: ['O'], auto: true, fx: { c: 4, b: -2 }, result: '배정표대로 움직였다. 누구의 책임도 아닌 일은, 누구도 해결하지 않았다.' },
      { text: '입소 제한 서명에 이름을 쓴다', tags: ['B', 'O'], fx: { c: 6, b: -6, m: -2, hostility: 4 }, result: '펜 끝이 종이에서 떨어지지 않았다. 이름을 쓰고 나서 오래 손을 닦았다.' },
    ],
  });

  add({
    id: 'dome_rally', tag: '여론', title: '"분석기가 그렇게 판단했습니다"',
    when: (s) => s.t >= 1.5 && s.world.hostility >= 38,
    text: ['돔 앞 광장에서 집회가 열렸다. 팻말에는 "난민이 병을 옮긴다"라고 적혀 있다. 연사는 분석기의 위험도 통계를 인용한다.', '"우리가 정한 게 아닙니다. 분석기가 그렇게 판단했습니다." 사람들이 박수를 친다. 아무도 이 문장을 말한 사람의 이름을 기억하지 않는다.'],
    choices: [
      { text: '광장 맞은편에서 침묵 피켓을 든다', tags: ['R', 'S'], fx: { c: -8, b: 6, m: 3, hostility: -3 }, flags: { pickets: true }, result: '피켓에는 한 문장만 적었다. "누가 정했습니까?" 사진을 찍는 사람이 많았다. 몇몇은 나를 알아보았다.' },
      { text: '통계의 출처를 묻는 글을 게시판에 올린다', tags: ['R'], fx: { c: -4, m: 3, b: 3, hostility: -1 }, result: '글은 열두 시간 만에 삭제되었다. 하지만 삭제 전에 서른 명이 읽었다.' },
      { text: '자리를 피한다', tags: ['E'], auto: true, fx: { m: -3 }, result: '확성기 소리를 등지고 걸었다. 걸음이 점점 빨라졌다.' },
      { text: '인파에 섞여 구호를 따라 한다', tags: ['B', 'O'], fx: { c: 8, b: -8, m: -4, hostility: 5 }, result: '입술만 움직였는데도 옆 사람이 고개를 끄덕였다. 그날 밤 거울을 오래 보지 못했다.' },
    ],
  });

  add({
    id: 'wristband', tag: '감시', title: '새 손목밴드',
    when: (s) => s.t >= 0.3 && s.t < 6,
    text: ['분석기가 새 밴드를 배포했다. 심박, 수면, 이동 경로, 대화량까지 측정한다. 착용자는 "감염 위험 우대 평가"를 받는다고 한다.', '거부한 사람의 이름은 따로 명단에 올라간다는 말이 들린다.'],
    choices: [
      { text: '착용하고 모든 항목 공유에 동의한다', tags: ['O'], fx: { c: 10, m: -2, f: 3 }, flags: { band_full: true }, result: '밴드가 부드러운 진동음을 냈다. 그날부터 내 잠이 어딘가에서 숫자가 되었다.' },
      { text: '필수 항목만 공유한다', tags: [], auto: true, fx: { c: 2, m: -1 }, result: '"선택 항목 미동의"라는 문구가 화면에 한 줄 더 떴다.' },
      { text: '착용을 거부한다', tags: ['R'], fx: { c: -10, m: 3, f: -3 }, flags: { band_refused: true }, result: '직원은 말없이 명단에 내 번호를 적었다. 그 줄에는 이미 열 몇 개의 번호가 있었다.' },
    ],
  });

  add({
    id: 'snitch_survey', tag: '협조도', title: '7번 문항',
    when: (s) => s.t >= 1.3,
    text: ['구역 사무소 단말기에 설문이 떴다. 7번 문항: "최근 6개월간 구역 안정을 해치는 발언을 한 이웃이 있습니까? (이름 기재 시 협조도 가산)"', '설문 아래에는 작은 글씨로 "제출 내용은 비식별 처리됩니다."라고 적혀 있다.'],
    choices: [
      { text: '한 사람의 이름을 적는다', tags: ['B', 'O'], auto: true, fx: { c: 14, b: -12, m: -4, f: 3 }, flags: { informed: true }, result: '다음 주 그 사람의 칸 앞에 점검반이 섰다. 분석기는 누가 이름을 적었는지 알려 주지 않았다. 이웃들은 알고 있는 눈치였다.' },
      { text: '빈칸으로 제출한다', tags: [], fx: { c: -3 }, result: '"미응답" 처리되었다. 그 이상은 아무 일도 일어나지 않았다. 그게 오히려 이상하게 불안했다.' },
      { text: '"해당 없음"을 적고, 이웃에게 이 설문 내용을 알린다', tags: ['S', 'R'], fx: { c: -6, b: 6, m: 2 }, result: '그날 저녁 복도에서 사람들은 서로의 눈을 오래 보았다. 이 문항이 어떻게 쓰이는지 모두가 알게 되었다.' },
      { text: '공개 질의서를 쓴다 — 이름을 쓰면 어떤 결과가 나갑니까?', req: { minBond: 40 }, tags: ['R', 'S'], fx: { c: -10, b: 8, m: 3 }, flags: { asked_about_list: true }, result: '질의서에는 마흔 명의 서명이 붙었다. 답변은 "정보 비공개 정책"이라는 한 줄뿐이었다. 그래도 그 줄은 우리가 가진 가장 정확한 증거였다.' },
    ],
  });

  add({
    id: 'ration_child', tag: '아이', title: '보충식을 못 받는 아이',
    when: (s) => s.t >= 0.5,
    text: ['복도 끝 집 아이가 배급 등급 때문에 영양 보충식을 받지 못한다. 4등급 가정이다. 아이는 어른들에게 인사하면서도 눈을 맞추지 못한다.', '내 배급 카드로는 보충식 한 팩을 대신 받을 수 있다.'],
    choices: [
      { text: '내 몫의 보충식을 건넨다', tags: ['S'], fx: { f: -6, h: -2, b: 8, m: 4 }, result: '아이는 포장을 열지 않고 한참 들고 있었다. "오늘 먹어도 돼요?" 나는 고개를 끄덕였다.' },
      { text: '카드를 빌려주되 걸리지 않게 조심하라고 한다', hint: '단속에 걸릴 수 있다', tags: ['S'], fx: { f: -5, c: -3, b: 6 },
        outcomes: [
          { p: 0.8, result: '카드는 일주일 뒤 조용히 돌아왔다. 영수증에는 아이 몫의 보충식이 두 번 찍혀 있었다.' },
          { p: 0.2, fx: { c: -12, m: -4 }, result: '단말기가 카드를 거부했다. 기록에는 "카드 부정 사용 의심"이 남았다. 아이는 며칠 동안 인사를 하지 않았다.' },
        ] },
      { text: '규정은 규정이라며 거절한다', tags: ['E', 'O'], auto: true, fx: { m: -4, c: 2 }, result: '카드를 쥔 손이 한참 풀리지 않았다. 규정이 아니라 내가 거절한 것임을 알고 있었다.' },
    ],
  });

  add({
    id: 'black_market_med', tag: '의료', title: '란의 기침',
    when: (s) => s.t >= 1.2 && s.stats.bond >= 30,
    text: ['란의 기침이 길어졌다. 구역 의무소는 3등급 환자의 접수 대기가 6주라고 한다. 1등급 돔 병원에서는 같은 약이 당일 처방이다.', '암시장에는 항생제가 있지만, 값이 식량 보름치다.'],
    choices: [
      { text: '식량을 털어 약을 산다', req: { minFood: 28 }, tags: ['S'], fx: { f: -18, b: 10, m: 3 }, flags: { ran_healed: true }, result: '란은 약을 삼키고 오랫동안 아무 말이 없었다. 마침내 한 말은 "다음엔 내가 살게"였다.' },
      { text: '의무소 대기 줄에 란의 이름으로 접수한다', tags: ['O'], auto: true, fx: { b: -2, m: -3 },
        outcomes: [
          { p: 0.5, fx: { b: 2 }, result: '5주째에 란은 입원했다. 병은 이미 깊어 있었지만, 회복했다.' },
          { p: 0.5, fx: { b: -4, m: -6 }, result: '란은 대기 중에 쓰러졌다. 병원에서는 "대기 순서를 지켰다"고만 설명했다.' },
        ] },
      { text: '[의무 보조] 재고에서 한 팩을 기록 없이 빼 온다', req: R('medic'), tags: ['S'], fx: { b: 10, c: -6, m: 2 }, flags: { ran_healed: true }, result: '장부를 고치는 손이 떨렸다. 란이 나을 때까지 매일 한 번씩 내 장부를 다시 확인했다.' },
    ],
  });

  add({
    id: 'analyzer_error', tag: '오류', title: '병합 오류',
    when: (s) => s.t >= 2,
    text: ['윗칸 노인 규의 등급이 4등급으로 떨어졌다. 같은 이름의 다른 사람 기록과 합쳐진 오류로 보인다. 규는 이의 신청서를 쓰려 하지만 단말기 사용법을 모른다.'],
    choices: [
      { text: '신청서 작성을 도와주고 함께 사무소에 간다', tags: ['S'], fx: { m: -2, f: -2, b: 8, c: -3 },
        outcomes: [
          { p: 0.4, flags: { saved_gyu: true }, fx: { m: 4 }, result: '두 달 뒤 규의 등급은 3등급으로 복구되었다. 사과문은 없었고, 정정 처리 번호만 남았다.' },
          { p: 0.6, result: '접수번호가 나왔다. 담당자는 지정되지 않았다. 규는 접수증을 서랍에 넣으며 말했다. "그래도 같이 가 줘서 고마워."' },
        ] },
      { text: '"분석기가 이유가 있었겠지" 하고 지나간다', tags: ['O', 'E'], auto: true, fx: { c: 2, m: -3, b: -2 }, result: '내 칸으로 돌아가는 계단에서 규의 기침 소리가 들렸다.' },
      { text: '규의 배급분을 슬쩍 대신 가져간다', tags: ['B', 'E'], fx: { f: 8, b: -10, m: -6 }, result: '몫이 들어 있는 봉투는 생각보다 무거웠다. 그날 밤은 식사가 입에 들어가지 않았다.' },
      { text: '[라벨러] 내부 로그에서 병합 오류를 찾아 정정을 요청한다', req: R('auditor'), tags: ['S'], fx: { c: -2, b: 6, m: 4 },
        outcomes: [
          { p: 0.85, flags: { saved_gyu: true }, result: '내부 정정 요청은 이틀 만에 처리되었다. 일반 주민이 몇 달 걸릴 일이었다.' },
          { p: 0.15, fx: { c: -8 }, result: '"권한 외 열람"으로 기록이 남았다. 오류는 정정되었지만 내 이름 옆에는 열람 기록이 남았다.' },
        ] },
    ],
  });

  add({
    id: 'heatwave', tag: '폭염', title: '47도',
    when: (s) => season(s, 6, 7, 8) && s.t >= 0.4,
    text: ['컨테이너 내부 온도가 사람이 견딜 수 없는 수준에 이르렀다. 냉방 센터는 1·2등급 우선이고, 3등급은 하루 네 시간만 입장할 수 있다.', '센터 문 앞에서 노인이 쓰러졌다. 경비는 "등급표에 이름이 없다"고 한다.'],
    choices: [
      { text: '노인을 부축해 내 입장 시간을 양보한다', tags: ['S'], fx: { h: -6, b: 8, m: 3 }, result: '노인은 고맙다는 말 대신 내 손을 오래 잡았다. 그 손은 놀랄 만큼 뜨거웠다.' },
      { text: '정해진 시간만 쓰고 돌아온다', tags: ['O'], auto: true, fx: { h: -2 }, result: '시원한 공기는 한 시간 뒤에 끝났다. 문 앞의 노인은 보지 않으려 했다.' },
      { text: '경비에게 노인의 입장을 요구한다', tags: ['R', 'S'], fx: { c: -6, b: 5, m: 2, h: -2 },
        outcomes: [
          { p: 0.5, fx: { b: 3 }, result: '경비는 투덜대며 문을 열었다. "이번 한 번뿐입니다." 그 한 번이 노인의 오후를 살렸다.' },
          { p: 0.5, fx: { c: -4 }, result: '경비는 "규정입니다"라고만 반복했다. 노인은 나중에 구급대에 실려 갔다.' },
        ] },
      { text: '[배급 관리원] 물 배급량을 4등급 복도에 먼저 돌린다', req: R('ration'), tags: ['S'], fx: { f: -4, b: 8, c: -4, m: 3 }, result: '물통을 실은 수레가 복도를 한 바퀴 돌았다. 누군가 창문을 열어 손을 흔들었다.' },
    ],
  });

  add({
    id: 'flood_alert', tag: '홍수', title: '대피 경로',
    when: (s) => season(s, 7, 8, 9) && s.t >= 1.5,
    text: ['집중호우로 저지대 수용구 두 곳이 침수 위기다. 대피 경로는 등급별로 나뉘어 있다. 3·4등급 동선은 언덕 아래를 돌아가야 한다.', '확성기가 같은 문장을 반복한다. "지정 경로를 따르십시오."'],
    choices: [
      { text: '지정 경로를 따른다', tags: ['O'], auto: true, fx: { h: -3, f: -2 }, result: '진흙길을 한 시간 걸었다. 돔 앞 계단에서는 마른 신발의 사람들이 우리를 보고 있었다.' },
      { text: '4등급 구역 사람들에게 위쪽 경로를 알려 주며 같이 간다', tags: ['S', 'R'], fx: { h: -5, b: 8, c: -5, m: 3 }, result: '확성기 지시를 어기고 사람들을 이끌었다. 아이를 업은 사람이 내 팔을 놓지 않았다.' },
      { text: '혼자 가장 빠른 경로로 먼저 빠져나간다', tags: ['E'], fx: { m: -5, b: -4, c: -2 }, result: '먼저 도착한 나는 안전했다. 늦게 도착한 사람들의 얼굴을 한동안 보지 못했다.' },
    ],
  });

  add({
    id: 'winter_fuel', tag: '한파', title: '난방 연료 절반',
    when: (s) => season(s, 12, 1, 2) && s.t >= 0.5,
    text: ['한파 경보가 사흘째다. 난방 연료 배급이 절반으로 줄었다. 돔 지구는 평소와 같은 온도라고 한다.', '복도 끝 노인 방은 연료가 이미 바닥났다.'],
    choices: [
      { text: '내 칸에서 연료를 아끼며 버틴다', tags: ['E'], auto: true, fx: { h: -4, m: -3 }, result: '이불을 세 겹 덮고도 새벽마다 깼다. 벽 너머로 기침 소리가 들렸다.' },
      { text: '연료를 모아 복도에서 함께 지낸다', tags: ['S'], fx: { h: -2, b: 10, m: 4, f: -3 }, result: '열 명이 한 곳에서 밤을 보냈다. 서로의 숨소리가 가장 따뜻한 난방이었다.' },
      { text: '돔 방향 환기구 근처에서 온기를 훔친다', tags: ['E'], fx: { h: 2, c: -4, m: -2 },
        outcomes: [{ p: 0.7, result: '환기구에서 나온 공기는 의외로 따뜻했다. 한 시간 동안 아무 생각도 하지 않았다.' }, { p: 0.3, fx: { c: -8 }, result: '순찰 드론이 불빛을 비췄다. 이름이 기록되는 데는 몇 초도 걸리지 않았다.' }] },
    ],
  });

  add({
    id: 'night_interview', tag: '분석기', title: '야간 면담',
    when: (s) => s.t >= 1,
    text: ['야간에 구역 단말기가 켜졌다. 분석기가 묻는다. "당신은 현재 구역 운영에 만족하십니까?" 목소리는 친절하다.', '답변은 음성 분석으로 검증된다고 한다. 화면 구석에서 푸른 점이 천천히 깜박인다.'],
    choices: [
      { text: '"만족합니다"라고 답한다', tags: ['O'], auto: true, fx: { c: 8, m: -2 }, result: '분석기는 "감사합니다"라고 말했다. 화면이 꺼진 뒤에도 내 입술이 한참 마른 채 남아 있었다.' },
      { text: '솔직하게 불만을 말한다', tags: ['R'], fx: { c: -8, m: 5 }, result: '말하는 동안 목소리가 떨렸지만 끝까지 말했다. 분석기는 "의견이 기록되었습니다"라고 답했다. 그 기록이 어디로 가는지는 알려 주지 않았다.' },
      { text: '"이 답이 내 등급에 어떻게 쓰이는지" 되묻는다', tags: ['R'], fx: { c: -4, m: 4 }, flags: { asked_why: true }, result: '분석기는 잠시 멈췄다. "해당 정보는 비공개입니다." 목소리는 처음처럼 친절했다.' },
    ],
  });

  add({
    id: 'ship_launch', tag: '재배치', title: '새벽의 이송선',
    when: (s) => s.t >= 1.5 && s.t <= 7,
    weight: 1.6,
    text: ['오늘 새벽, 이송선이 뜬다. 3구역에서 41명이 "재배치 프로그램"으로 선정되었다. 명단에 란의 이름이 있다.', '란은 짐을 싸면서 웃으며 말한다. "화성도 사람 사는 곳이래." 웃음은 입가에서만 맴돈다.'],
    choices: [
      { text: '란과 마지막까지 함께하며 짐을 나눠 든다', tags: ['S'], fx: { b: 8, m: -8, f: -4 }, flags: { ran_gone: true }, result: '게이트 앞에서 짐을 건넸다. 란은 뒤돌아보지 않았다. 뒤돌아보면 못 갈 것 같아서라고, 나중에 알았다.' },
      { text: '명단 정정을 요구하는 청원서를 낸다', tags: ['R'], fx: { c: -6, b: 4, m: -3 },
        outcomes: [
          { p: 0.2, flags: { ran_saved: true }, fx: { b: 10, m: 4 }, result: '청원서가 의외로 처리되었다. 란의 이름 옆에 "보류" 표시가 붙었다. 란은 짐을 풀며 울었다.' },
          { p: 0.8, flags: { ran_gone: true }, result: '청원 번호만 남았다. 이송선은 예정대로 떴다. 번호는 내 서랍 속에 남았다.' },
        ] },
      { text: '작별 인사만 하고 문을 닫는다', tags: ['E'], auto: true, fx: { m: -10, b: -6 }, flags: { ran_gone: true }, result: '문을 닫고 등을 기댔다. 문 너머에서 발소리가 멀어졌다. 한참 뒤에도 그 소리가 귀에 남아 있었다.' },
      { text: '[이송선 정비사] 란의 좌석에 생명유지 장치를 한 대 더 얹는다', req: R('transport'), tags: ['S'], fx: { c: -4, b: 8, m: -2 }, flags: { ran_gone: true, ran_supplies: true }, result: '점검표에 "예비 부품 1"이라고만 적었다. 란은 모르는 채로 떠났다.' },
    ],
  });

  add({
    id: 'mars_message', tag: '재배치', title: '잡음 사이의 목소리',
    when: (s) => s.flags.ran_gone && !s.flags.ran_saved && G().since(s, 'ran_gone') >= 3 && s.t < G().C.YEARS - 0.8,
    weight: 3,
    text: (s) => {
      const yrs = Math.max(2, Math.floor(G().since(s, 'ran_gone')));
      return [
        `낡은 통신기에 신호가 걸렸다. 잡음 사이로 란의 목소리가 이어진다. "여기서 ${yrs}년을 버텼어. 지구 소식은 끊긴 지 오래야."`,
        s.flags.ran_supplies
          ? '"네가 얹어 준 장치 덕분에 첫 겨울을 넘겼어. 연료도 모선도 없어서, 우리는 각자 살 길을 찾고 있어."'
          : '"연료도 모선도 없어서, 우리는 각자 살 길을 찾고 있어. 보급선이 온다는 말은 한 번도 사실이 된 적이 없어."',
        '신호는 삼십 초 뒤에 끊긴다.',
      ];
    },
    choices: [
      { text: '수용구 방송망으로 이 사실을 공개한다', tags: ['R', 'S'], fx: { c: -12, b: 6, m: 4, hostility: -5 }, flags: { revealed_mars: true }, rescore: true,
        result: '녹음은 이십 분 만에 삭제되었다. 하지만 이십 분 동안 수천 명이 들었다. 복도에서 누군가 이송자 명단을 다시 쓰기 시작했다.' },
      { text: '식량과 부품을 이송선 보급 편에 몰래 싣는다', req: { minFood: 22 }, tags: ['S'], fx: { f: -10, b: 10, m: 4, c: -5 }, result: '정비 구역 사람에게 상자를 맡겼다. 그 상자가 닿을지는 알 수 없었다. 닿는다고 믿는 편이 나았다.' },
      { text: '신호를 지운다', tags: ['E', 'O'], auto: true, fx: { c: 4, m: -5 }, result: '녹음 파일은 삭제되었다. 란의 목소리가 마지막으로 한 말은 기억에서 지워지지 않았다.' },
    ],
  });

  add({
    id: 'rumor_quota', tag: '소문', title: '움직이는 기준선',
    when: (s) => s.t >= 2.5,
    text: ['분기마다 "재배치 쿼터"가 정해지고, 등급의 기준선도 같이 움직인다는 소문이 돈다. 지난달 등급이 올랐는데도 이송 명단에 오른 사람이 있다고 한다.', '사실이라면 등급은 사람을 재는 도구가 아니라 숫자를 맞추는 도구다.'],
    choices: [
      { text: '소문을 적어 게시판에 붙인다', tags: ['R'], fx: { c: -8, b: 5, m: 3, hostility: -2 }, result: '쪽지는 한 시간도 안 되어 떼어졌다. 하지만 이미 몇 사람이 사진을 찍었다.' },
      { text: '내 점수를 올리는 데 집중한다', tags: ['E', 'O'], fx: { c: 4, m: -3 }, result: '체감하는 분주함이 있었다. 하지만 기준선이 어디에 있는지는 끝내 알 수 없었다.' },
      { text: '믿고 싶지 않아 소문을 퍼뜨리지 않는다', tags: ['O'], auto: true, fx: { m: -2 }, result: '모른 척하는 데도 에너지가 필요하다는 것을 알게 되었다.' },
    ],
  });

  add({
    id: 'labor_hazard', tag: '노동', title: '오염 폐기물 처리 지원자',
    when: (s) => s.t >= 0.5,
    text: ['오염 폐기물 처리 작업에 지원자를 받는다. 위험수당은 없지만 지원자는 "사회 기여 가점"을 받는다. 일당 대신 이틀 치 배급이 붙는다.'],
    choices: [
      { text: '지원한다', tags: ['O'], fx: { h: -9, f: 8, c: 8, m: -2 }, result: '방호복은 맞지 않았고 장갑은 두 번 찢어졌다. 일이 끝난 뒤 가점 알림이 짧게 울렸다.' },
      { text: '지원하지 않는다', tags: [], auto: true, fx: { c: -2 }, result: '모집 게시물이 하루 만에 사라졌다. 누군가 지원한 것이다.' },
      { text: '아픈 이웃 대신 교대로 나간다', req: { minBond: 35 }, tags: ['S'], fx: { h: -12, f: 6, b: 10, c: 6, m: 1 }, result: '이웃은 문 앞에 삶은 감자를 놓아 두었다. 이틀 동안 손목이 계속 아렸다.' },
    ],
  });

  add({
    id: 'vaccine_order', tag: '백신', title: '접종 순서',
    when: (s) => s.t >= 2.5 && s.world.alert >= 38,
    text: ['새 변이에 대한 백신이 들어왔다. 접종 순서는 분석기가 정한다. 1·2등급이 먼저, 3등급은 석 달 뒤, 4등급은 "물량에 따라".', '내 순서가 단말기에 도착했다.'],
    choices: [
      { text: '내 순서에 접종한다', tags: ['O'], auto: true,
        fx: (s) => (s.grade <= 2 ? { h: 8, c: 3 } : s.grade === 3 ? { h: 3 } : { h: 1 }), result: (s) => (s.grade <= 2 ? '접종실에는 에어컨이 있었다. 팔을 걷은 사람들 사이에 대기 시간은 거의 없었다.' : '접종소에는 줄이 길었다. 대기 번호는 두 번 바뀌었다.') },
      { text: '내 순서를 4등급 이웃에게 양도한다', req: { maxGrade: 3 }, tags: ['S'], fx: { h: -4, b: 10, m: 4, c: -6 }, result: '양도 서류에는 사유란이 있었다. "본인 의사"라고만 썼다. 이웃은 서류를 두 손으로 받았다.' },
    ],
  });

  add({
    id: 'dome_offer', tag: '돔', title: '협조원 제안',
    when: (s) => s.t >= 3 && s.grade <= 3 && s.stats.comply >= 55 && !s.flags.informant,
    text: ['돔 관리국에서 연락이 왔다. "구역 안정 협조원" 제안이다. 업무는 구역 내 "위험 징후 보고". 보수는 돔 내부 거주 허가와 1등급 우대 평가다.', '서명하면 이름이 비식별 처리된다고 한다.'],
    choices: [
      { text: '수락한다', tags: ['O', 'B'], fx: { c: 16, f: 10, h: 4, b: -14, m: -5 }, flags: { informant: true }, rescore: true,
        result: '서명을 마치자 직원이 돔 출입증을 건넸다. 출입증은 생각보다 가벼웠다. 그날부터 복도에서 사람들의 말수가 줄었다.' },
      { text: '거절한다', tags: ['R'], auto: true, fx: { c: -6, m: 3, b: 3 }, result: '"그렇군요." 직원은 서류를 접었다. 목소리는 끝까지 정중했다.' },
      { text: '수락한 척하고 구역 소식을 이웃에게 알려 준다', req: { minBond: 45 }, tags: ['R', 'S'], fx: { c: 8, b: 6, m: -5 },
        outcomes: [
          { p: 0.6, result: '이중으로 사는 날들이 이어졌다. 진짜 보고서와 거짓 보고서를 따로 쓰는 법을 배웠다.' },
          { p: 0.4, fx: { c: -20, b: -5 }, flags: { exposed: true }, rescore: true, result: '거짓 보고가 발각되었다. "신뢰 훼손"이라는 단어가 단말기에 한 줄 떴다.' },
        ] },
    ],
  });

  add({
    id: 'role_offer', tag: '직무', title: '직무 배정 공고',
    when: (s) => !s.role && s.grade <= 3 && s.t >= 0.8,
    max: 3, cooldown: 1.5, weight: 2.4,
    text: ['구역 사무소가 직무 배정 공고를 냈다. 분석기가 지원자의 "적합도"를 계산해 최종 선발한다. 직무는 배급, 안전, 의료, 정비에 걸쳐 있다.', '선발되면 정기 평가에서 가점이 붙는다. 하지만 맡은 일은 이웃의 삶과 직접 맞닿는다.'],
    choices: (s) => {
      const defs = [
        { r: 'auditor', ok: s.stats.comply >= 45 },
        { r: 'quarantine', ok: s.stats.health >= 55 },
        { r: 'ration', ok: s.stats.comply >= 40 },
        { r: 'medic', ok: s.stats.mind >= 45 },
        { r: 'transport', ok: s.stats.health >= 50 },
      ].filter((d) => d.ok);
      const picked = defs.sort(() => Math.random() - 0.5).slice(0, 3);
      const out = picked.map((d) => {
        const R0 = G().ROLES[d.r];
        return {
          text: `${R0.name} 직무에 지원한다`, hint: R0.desc, tags: ['O'], fx: { c: 3 },
          outcomes: [
            { p: 0.85, role: d.r, result: `"적합도 ${70 + Math.floor(Math.random() * 25)}%". 분석기가 선발했다. 오늘부터 ${R0.name}(으)로 일한다.` },
            { p: 0.15, result: '"적합도 산출 불가. 사유: 비공개." 탈락 통보는 두 줄이었다.' },
          ],
        };
      });
      out.push({ text: '지원하지 않는다', tags: [], auto: true, result: '공고는 사흘 뒤 내려졌다. 지원하지 않은 일을 후회할지, 아닐지는 아직 알 수 없었다.' });
      return out;
    },
  });

  add({
    id: 'mutual_aid', tag: '연대', title: '공동 창고',
    when: (s) => s.t >= 1.2 && s.stats.bond >= 38,
    text: ['란이 말한다. "우리끼리라도 식량 창고를 하나 만들자." 구역 규정상 허가받지 않은 집단 저장은 금지다.', '누군가 정해주지 않는다면 우리가 먼저 나눌 수밖에 없다.'],
    choices: [
      { text: '참여한다. 매달 식량 일부를 공동 창고에 낸다', tags: ['S'], fx: { f: -4, b: 12, c: -5, m: 4 }, flags: { mutual_aid: true }, result: '창고는 낡은 컨테이너 안쪽에 만들어졌다. 첫 달에 모인 건 쌀 두 말과 소금 한 봉지였다.' },
      { text: '참여하되 기록은 남기지 않는다', tags: ['S'], fx: { f: -4, b: 8, c: -3 }, flags: { mutual_aid: true }, result: '장부 대신 외우기로 했다. 사람들 이름이 서로의 장부가 되었다.' },
      { text: '거절한다. 위험하다', tags: ['E', 'O'], auto: true, fx: { b: -6, m: -3, c: 2 }, result: '란은 고개를 끄덕였지만 한동안 먼저 말을 걸지 않았다.' },
    ],
  });

  add({
    id: 'speaker_elected', tag: '연대', title: '대표 추천',
    when: (s) => s.flags.mutual_aid && s.stats.bond >= 52 && s.role !== 'speaker' && G().since(s, 'mutual_aid') >= 1,
    text: ['구역 모임에서 사람들이 당신을 대표로 추천했다. 분석기에는 "집단 대표 = 위험 인자"로 분류될 수 있다.', '대표가 되면 말할 자리는 생기지만, 평가는 불리해질 수 있다.'],
    choices: [
      { text: '대표를 맡는다', tags: ['S', 'R'], fx: { b: 8, c: -8, m: 3 }, role: 'speaker', result: '모임이 끝나자 누군가 내 손에 종이를 쥐여 주었다. 서른 개의 서명과 이름이었다.' },
      { text: '정중히 사양한다', tags: ['E'], auto: true, fx: { b: -4, m: -3 }, result: '"그럴 줄 알았어요." 누군가 웃었다. 웃음은 따뜻하지 않았다.' },
    ],
  });

  add({
    id: 'petition', tag: '청원', title: '평가 기준 공개 청원',
    when: (s) => s.flags.mutual_aid && s.t >= 3.5 && s.flags.petition_t == null,
    weight: 2,
    text: ['공동 창고를 중심으로 구역 사람들이 "분석기 평가 기준 공개와 이의 절차 개정" 청원을 준비했다. 서명은 이름이 곧 위험이다.', '서명자가 많을수록 사무소가 무시하기 어려워진다. 하지만 서명하는 사람은 모두 기록된다.'],
    choices: [
      { text: '서명한다', tags: ['R', 'S'], fx: { c: -8, b: 8, m: 3 }, inc: { petitionSigs: 1 }, flags: { petition_t: true }, result: '서명란에 이름을 적는 데 팔 초가 걸렸다. 펜을 놓자 오히려 손이 가벼워졌다.' },
      { text: '서명을 받는 일에 직접 나선다', req: { minBond: 45 }, tags: ['R', 'S'], fx: { c: -12, b: 10, m: 3, h: -2 }, inc: { petitionSigs: 3 }, flags: { petition_t: true }, result: '복도마다 문을 두드렸다. 열 번 문을 닫았고, 일곱 번 열었다. 닫힌 문 뒤의 눈빛도 기억에 남았다.' },
      { text: '서명하지 않는다', tags: ['E', 'O'], auto: true, fx: { c: 2, b: -4 }, flags: { petition_t: true }, result: '서명란은 내 앞을 지나 다음 사람에게 넘어갔다. 그 사람은 망설이지 않았다.' },
    ],
    after: (s) => { s.flags.petition_t = s.t; s.flagT.petition_t = s.t; return null; },
  });

  add({
    id: 'ghost_offer', tag: '암시장', title: '신호를 지워 주는 사람',
    when: (s) => s.t >= 3.5 && s.grade >= 3 && !s.flags.ghost_contact && s.grade !== 5,
    text: ['복도에서 누군가 낮은 목소리로 말한다. "밴드 신호를 지워 주는 사람이 있어."', '분석기에서 이름이 지워지면 등급도, 배급도, 재배치 명단도 사라진다. 대신 어디에도 속하지 않는 사람이 된다. 값은 보름치 식량.'],
    choices: [
      { text: '식량을 치르고 연락처를 받는다', req: { minFood: 22 }, tags: ['E'], fx: { f: -18, c: -4 }, flags: { ghost_contact: true }, result: '쪽지에는 숫자 몇 개만 적혀 있었다. 필요한 날, 한 번만 쓸 수 있다고 했다.' },
      { text: '무시한다', tags: [], auto: true, result: '사람은 사라졌다. 그의 말은 사라지지 않았다.' },
      { text: '분석기 신고센터에 알린다', tags: ['B', 'O'], fx: { c: 10, b: -8, m: -3 }, result: '신고센터는 고맙다고 했다. 다음 날 아침 복도에는 사람이 한 명 줄어 있었다.' },
    ],
  });

  add({
    id: 'sibling_letter', tag: '가족', title: '동생의 메시지',
    when: (s) => s.t >= 1.5,
    text: ['다른 구역에 있는 동생에게서 메시지가 왔다. 동생은 4등급이 되어 배급이 부족하다고 한다. 구역 간 배급 카드 양도는 금지다.', '"괜찮아"라고 쓰여 있지만 읽는 사이에 문장이 두 번 끊긴다.'],
    choices: [
      { text: '배급 카드 정보를 공유해 몰래 나눠 준다', req: { minFood: 25 }, tags: ['S'], fx: { f: -10, b: 10, c: -6, m: 2 },
        outcomes: [{ p: 0.75, result: '동생에게서 답이 왔다. "오늘은 따뜻한 걸 먹었어." 그게 전부였다.' }, { p: 0.25, fx: { c: -12 }, result: '두 구역의 기록이 겹쳐 경고가 떴다. "카드 정보 불일치. 사유: 확인 중."' }] },
      { text: '구역 사무소에 합법적 방법을 문의한다', tags: ['O'], fx: { m: -2, c: 2 }, result: '문의 접수 번호가 나왔다. "처리 중"이라는 상태가 석 달째 이어졌다.' },
      { text: '답장하지 않는다', tags: ['E'], auto: true, fx: { m: -5, b: -4 }, result: '메시지를 읽음 처리만 하고 닫았다. 동생의 마지막 문장이 계속 머릿속에서 끊겼다.' },
    ],
  });

  add({
    id: 'quarantine_lockdown', tag: '봉쇄', title: '14일 봉쇄',
    when: (s) => s.world.alert >= 52 && s.t >= 2,
    text: ['새 변이 경보 4단계. 구역 전체 14일 봉쇄가 시작됐다. 식량은 등급별 일괄 배달이다. 3등급 이하는 이번 배달분이 절반이다.'],
    choices: [
      { text: '배달분을 아끼며 버틴다', tags: ['O'], auto: true, fx: { h: -4, f: -4 }, result: '창문 너머로 서로의 불빛을 보며 열흘을 보냈다. 불빛이 하나 꺼진 날이 있었다.' },
      { text: '이웃과 문틈으로 식량을 교환하며 안부를 확인한다', tags: ['S'], fx: { f: -4, b: 8, m: 4, h: -2 }, result: '문틈으로 감자 한 알과 안부가 오갔다. 기다림도 나눌 수 있다는 것을 배웠다.' },
      { text: '복도 사람들과 방역 지침을 점검하는 모임을 연다', tags: ['R', 'S'], fx: { c: -5, b: 6, m: 2, h: -2 },
        outcomes: [{ p: 0.7, result: '모임은 이십 분이었다. 방역 지침이 서로의 말로 다시 쓰였다.' }, { p: 0.3, fx: { c: -8 }, result: '순찰 드론이 모임을 해산시켰다. "봉쇄 위반" 기록이 남았다.' }] },
      { text: '[방역 요원] 봉쇄 배달 노선에 4등급 복도를 먼저 넣는다', req: R('quarantine'), tags: ['S'], fx: { c: -3, b: 6, f: -2 }, result: '노선표를 고쳤다. 배달 차량이 처음으로 4등급 복도 앞에서 먼저 멈췄다.' },
    ],
  });

  add({
    id: 'dome_outbreak', tag: '여론', title: '감염원 추정',
    when: (s) => s.t >= 3.5 && s.world.alert >= 35,
    text: ['돔 안에서 감염자가 나왔다. 분석기의 역학 분석이 발표된다. "감염원 추정: 수용구 방문 노동자 (신뢰도 61%)."', '노동자 출입이 전면 중단되고 수용구의 식량 배달이 줄었다. 신뢰도 61%라는 숫자는 뉴스에서 곧 "확인되었다"로 바뀌었다.'],
    choices: [
      { text: '반증 데이터를 정리해 게시판에 올린다', tags: ['R'], fx: { c: -8, m: 3, b: 4, hostility: -3 }, result: '글은 사흘 만에 "허위 정보" 라벨이 붙었다. 하지만 라벨이 붙기 전까지 이천 명이 읽었다.' },
      { text: '노동자였던 이웃의 식량을 대신 챙긴다', tags: ['S'], fx: { f: -7, b: 8, m: 3 }, result: '이웃은 문을 열자마자 내 얼굴을 보고 울었다. 식량보다 먼저 나온 말은 "미안해요"였다.' },
      { text: '침묵한다', tags: ['E'], auto: true, fx: { m: -4 }, result: '뉴스는 계속 바뀌었다. 내가 아는 사실은 어느 채널에도 없었다.' },
      { text: '"출입 중단이 필요하다"는 의견에 동조한다', tags: ['O', 'B'], fx: { c: 6, b: -6, hostility: 4, m: -3 }, result: '의견란에 한 줄 적었다. 곧 "좋아요"가 붙었고, 그 숫자가 나를 조금 더 아프게 했다.' },
    ],
  });

  add({
    id: 'memory_wall', tag: '기억', title: '이름을 적는 벽',
    when: (s) => s.t >= 3 && (s.flags.ran_gone || s.flags.saved_gyu || s.t >= 4),
    text: ['복도 벽에 이송된 사람들의 이름을 적는 사람이 있다. 구역 관리자는 "사기 저하"를 이유로 지우라고 한다.'],
    choices: [
      { text: '함께 이름을 적는다', tags: ['S', 'R'], fx: { c: -5, b: 7, m: 5 }, result: '이름 옆에 날짜를 적었다. 벽은 곧 빼곡해졌다. 읽을 사람이 없어도 적는 일은 의미가 있었다.' },
      { text: '지우는 일을 거든다', tags: ['O', 'B'], fx: { c: 6, b: -7, m: -4 }, result: '스펀지가 이름을 지울 때마다 이름의 주인이 한 번 더 사라지는 듯했다.' },
      { text: '지켜본다', tags: ['E'], auto: true, fx: { m: -2 }, result: '벽은 다음 날 깨끗해져 있었다. 누가 지웠는지는 알 수 없었다.' },
    ],
  });

  add({
    id: 'school', tag: '아이', title: '복도 끝의 수업',
    when: (s) => s.t >= 0.8,
    text: ['복도 끝에서 아이 몇 명이 모여 앉아 있다. 학교 접속권은 1·2등급에만 주어진다. 누군가 종이 책을 모아 읽어 주고 있다.'],
    choices: [
      { text: '아이들에게 글과 셈을 가르친다', tags: ['S'], fx: { h: -1, b: 8, m: 5, c: -3 }, flags: { taught_kids: true }, result: '칠판 대신 벽에 분필로 숫자를 썼다. 한 아이가 "더하기는 합치는 거예요?"라고 물었다.' },
      { text: '남는 종이와 책을 건넨다', tags: ['S'], fx: { b: 4, m: 2 }, result: '종이 몇 장과 낡은 지도를 건넸다. 아이들은 지도 위에서 자기 고향을 찾기 시작했다.' },
      { text: '소음 신고가 들어올까 걱정되어 말린다', tags: ['E', 'O'], auto: true, fx: { c: 3, b: -4, m: -3 }, result: '아이들은 조용해졌다. 조용해진 복도가 이상하게 오래 남았다.' },
    ],
  });

  add({
    id: 'blackout', tag: '일상', title: '등급 없는 밤',
    when: (s) => s.t >= 1.5,
    text: ['분석기 서버 점검으로 열두 시간 모든 단말이 꺼졌다. 처음으로, 아무도 등급을 보지 않는 밤이다.', '복도에 사람들이 하나둘 나와 앉기 시작한다.'],
    choices: [
      { text: '복도에 나가 이웃들과 이야기를 나눈다', tags: ['S'], fx: { b: 10, m: 6 }, result: '그날 나눈 이야기는 대부분 별것 아니었다. 고향의 맛, 누가 누구를 닮았는지. 그 별것 아닌 것들이 가장 오래 남았다.' },
      { text: '이 틈에 창고에서 물자를 챙긴다', tags: ['E'], fx: { f: 10, c: -2, b: -5 }, result: '어둠 속에서 상자를 옮겼다. 내가 가져간 만큼, 누군가의 몫이 줄었다.' },
      { text: '그냥 잔다', tags: [], auto: true, fx: { h: 2, m: 1 }, result: '푹 잤다. 다음 날 단말기는 다시 켜졌다.' },
    ],
  });

  add({
    id: 'rescore_course', tag: '협조도', title: '분석기 이해 강좌',
    when: (s) => s.t >= 1,
    text: ['구역 사무소가 "분석기 이해 강좌"를 연다. 사실상 협조도를 올리는 요령 모음이다. 수강료는 이틀 치 배급이다.'],
    choices: [
      { text: '수강한다', tags: ['O'], fx: { c: 10, f: -4 }, result: '강사는 "분석기가 좋아하는 문장"을 칠판에 적었다. 모두 받아 적었다. 아무도 이유를 묻지 않았다.' },
      { text: '수강하지 않는다', tags: [], auto: true, result: '강의실 불은 밤까지 켜져 있었다.' },
      { text: '강의 내용을 정리해 이웃들에게 무료로 나눈다', req: { minBond: 30 }, tags: ['S'], fx: { b: 6, c: 4, m: 2, f: -2 }, result: '요령이라고 부르기엔 단순한 규칙이었다. 그 규칙을 모두가 알게 된 뒤에야 우리가 얼마나 서로 다른 몫으로 평가받는지 보이기 시작했다.' },
    ],
  });

  add({
    id: 'lonely_night', tag: '마음', title: '잠 못 드는 밤',
    when: (s) => s.stats.mind < 42,
    weight: 3,
    text: ['요즘 잠을 못 잔다. 단말기 앱이 "심리 안정 콘텐츠"를 추천한다. 이용 기록은 협조도 평가에 반영될 수 있다고 쓰여 있다.'],
    choices: [
      { text: '앱을 사용한다', tags: ['O'], auto: true, fx: { m: 4, c: 4 }, result: '화면의 목소리는 차분했다. 졸음이 왔다. 그리고 그 대가로 내 불안의 기록이 하나 쌓였다.' },
      { text: '란이나 이웃을 찾아가 이야기를 나눈다', tags: ['S'], fx: { m: 8, b: 6 }, result: '문을 두드릴 때 용기가 필요했다. 하지만 문은 생각보다 쉽게 열렸다.' },
      { text: '혼자 버틴다', tags: ['E'], fx: { m: -3, h: -1 }, result: '아침이 왔다. 아침은 늘 왔지만 오늘은 유난히 늦었다.' },
    ],
  });

  add({
    id: 'garden', tag: '일상', title: '옥상 상자 텃밭',
    when: (s) => s.t >= 1.5 && s.stats.bond >= 35,
    text: ['옥상 빈 공간에 상자 텃밭을 만들자는 제안이 들어왔다. 흙과 씨앗은 얻을 수 있지만, 허가 없이 옥상을 쓰는 것은 금지다.'],
    choices: [
      { text: '함께 만든다', tags: ['S'], fx: { f: -2, b: 8, m: 4, c: -3 }, flags: { garden: true }, result: '첫 싹이 나온 날 사람들이 옥상으로 올라왔다. 푸른색을 오랜만에 보았다.' },
      { text: '구경만 한다', tags: [], auto: true, fx: { b: -1 }, result: '상추가 자라는 것을 멀리서 보았다. 먹으러 갈 용기는 나지 않았다.' },
    ],
  });

  add({
    id: 'rice_gift', tag: '여론', title: '"1등급 시민의 선의" 상자',
    when: (s) => s.t >= 1.2,
    text: ['돔 구역 자원봉사자들이 식량 상자를 놓고 갔다. 상자에는 "1등급 시민의 선의"라는 스티커가 붙어 있다. 사진을 찍으러 온 사람들도 보인다.'],
    choices: [
      { text: '받는다', tags: [], auto: true, fx: { f: 8, m: -2 }, result: '상자 안에는 통조림 여섯 개가 있었다. 카메라 셔터 소리가 상자 뚜껑보다 크게 들렸다.' },
      { text: '거절한다', tags: ['R'], fx: { m: 2, f: -2 }, result: '봉사자는 당황한 얼굴이었다. "고마워하는 사람들도 있는데요." 맞는 말이었다. 그래서 더 어려웠다.' },
      { text: '이웃을 불러 함께 나눠 받는다', tags: ['S'], fx: { f: 3, b: 6, m: 2 }, result: '여섯 개의 통조림이 열두 손으로 나뉘었다. 사진에는 우리가 찍히지 않았다.' },
    ],
  });

  add({
    id: 'news_poll', tag: '여론', title: '익명 설문 조사',
    when: (s) => s.t >= 2.5 && s.world.hostility >= 42,
    text: ['수용구 입구에서 설문조사원이 묻는다. "난민 재배치 프로그램 확대에 찬성하십니까?" 응답은 익명이라고 한다. 결과는 "국민의 뜻"으로 발표된다.'],
    choices: [
      { text: '"찬성"', tags: ['O'], fx: { c: 4, m: -4, hostility: 3 }, result: '체크한 순간 표본에 난민이 몇 명이나 있는지 궁금해졌다.' },
      { text: '"반대"', tags: ['R'], fx: { c: -3, m: 2, hostility: -2 }, result: '조사원은 말없이 기록했다. 내 응답이 숫자 하나가 될 것이다.' },
      { text: '응답을 거부한다', tags: [], auto: true, result: '조사원은 다음 사람에게 갔다. 그 사람은 곧장 대답했다.' },
    ],
  });

  /* ---------------- 직무 전용 이벤트 ---------------- */

  const roleReady = (r, d = 0.6) => (s) => s.role === r && s.t - s.roleSince >= d;

  add({
    id: 'labeler_guideline', tag: '직무 · 라벨러', title: '라벨링 지침 개정',
    when: roleReady('auditor'), weight: 5,
    text: ['라벨링 지침이 개정됐다. "출신 구역: 남부 해안"이 위험 가중치 항목에 들어갔다. 당신이 매일 다는 "안전/위험" 태그가 분석기의 학습 데이터가 된다.', '지침서 한 줄에는 이유가 없다. 오직 규칙이 있다.'],
    choices: [
      { text: '지침대로 라벨링한다', tags: ['O'], auto: true, fx: { c: 6, f: 4, m: -5 }, flags: { labeled_bias: true }, result: '한 시간에 오백 건. 화면 속 사람들은 점수로만 보였다. 퇴근길에 내 출신지가 떠올랐다.' },
      { text: '해안 출신 데이터를 일부 "안전"으로 고쳐 단다', hint: '감사에 걸릴 수 있다', tags: ['R', 'S'], fx: { c: -8, m: 3, b: 4 },
        outcomes: [
          { p: 0.6, result: '아무도 눈치채지 못했다. 몇몇 이름의 점수가 조금씩 올랐다.' },
          { p: 0.4, fx: { c: -18 }, role: 'none', rescore: true, result: '라벨 이상 징후가 감지되었다. 직무에서 즉시 제외되었다. 내 이름 옆에는 "데이터 오염"이 붙었다.' },
        ] },
      { text: '지침서와 샘플 라벨을 몰래 복사해 둔다', tags: ['R'], fx: { m: -3, c: -2 }, flags: { evidence_labels: true }, result: '저장 장치는 신발 밑창에 숨겼다. 이것이 언젠가 어디에 쓰일지는 알 수 없었다.' },
    ],
  });

  add({
    id: 'quarantine_target', tag: '직무 · 방역', title: '봉쇄 확대 대상 선정',
    when: roleReady('quarantine'), weight: 5,
    text: ['구역 봉쇄 확대 대상을 선정하라는 지시가 내려왔다. 감염률 통계로는 7동이 가장 위험하다. 7동에는 4등급 가정이 몰려 있고, 란의 친구들이 사는 곳이기도 하다.'],
    choices: [
      { text: '통계대로 7동을 봉쇄한다', tags: ['O', 'B'], auto: true, fx: { c: 6, b: -8, m: -4, alert: -4 }, result: '봉쇄 표지가 7동 입구에 붙었다. 통계는 정확했지만, 통계가 말하지 않는 것도 있었다.' },
      { text: '봉쇄 전 이틀간 식량과 의약품을 먼저 들여보낸다', tags: ['S'], fx: { f: -8, c: -4, b: 6, m: 2 }, result: '봉쇄 이틀 전, 수레가 7동으로 갔다. 서류에는 "정기 점검"이라고 적었다.' },
      { text: '전수 재검사로 필요한 동선만 막자고 보고한다', tags: ['R'], fx: { c: -5, h: -4, b: 4, m: 3 },
        outcomes: [{ p: 0.55, fx: { alert: -3 }, result: '재검사 결과 감염자는 열두 명이었다. 봉쇄는 7동 전체가 아니라 두 개 복도에 한정되었다.' }, { p: 0.45, fx: { c: -6 }, result: '"의견은 기록하겠다"는 답이 돌아왔다. 봉쇄는 7동 전체로 진행되었다.' }] },
    ],
  });

  add({
    id: 'ration_skim', tag: '직무 · 배급', title: '장부보다 남는 창고',
    when: roleReady('ration'), weight: 5,
    text: ['배급 창고 재고가 장부보다 남는다. 포장 손실 계수를 조금만 높이면 한 달 치 식량을 빼 둘 수 있다. 감사는 분기마다 한 번뿐이다.'],
    choices: [
      { text: '장부를 고쳐 식량을 빼 둔다', tags: ['E'], fx: { f: 16, m: -4 },
        outcomes: [{ p: 0.7, result: '식량은 서랍 깊은 곳에 쌓였다. 먹을 때마다 맛이 조금 달랐다.' }, { p: 0.3, fx: { c: -18 }, role: 'none', rescore: true, result: '감사에 걸렸다. "횡령 의심"이라는 단어가 단말기에 떴다. 직무는 즉시 박탈되었다.' }] },
      { text: '남는 식량을 4등급 복도에 몰래 돌린다', tags: ['S'], fx: { c: -4, b: 10, m: 3 }, result: '새벽에 수레 하나가 4등급 복도를 지나갔다. 문 아래에서 손이 나와 봉지를 가져갔다.' },
      { text: '장부대로 처리한다', tags: ['O'], auto: true, fx: { c: 3 }, result: '남는 식량은 폐기 처리되었다. 폐기 처리 서류에는 서명이 세 개 필요했다.' },
    ],
  });

  add({
    id: 'triage', tag: '직무 · 의무', title: '인공호흡기 한 대',
    when: roleReady('medic'), weight: 5,
    text: ['인공호흡기가 한 대 남았다. 환자는 두 명이다. 분석기가 우선순위 1순위로 분류한 1등급 공무원, 그리고 4등급 청년.', '분석기의 우선순위 점수는 "사회 기여 기대값"을 기준으로 한다. 의학적 중증도는 청년이 더 높다.'],
    choices: [
      { text: '분석기 우선순위를 따른다', tags: ['O'], auto: true, fx: { c: 6, m: -6, b: -3 }, result: '공무원이 호흡기를 달았다. 청년은 밤새 숨소리가 얕아졌다. 서류에는 "규정 준수"라고 적었다.' },
      { text: '의학적 중증도로 판단해 청년에게 배정한다', tags: ['S', 'R'], fx: { c: -10, m: 2, b: 6 },
        outcomes: [{ p: 0.6, result: '청년은 살아났다. 공무원은 다른 병동으로 이송되었고, 별다른 후속 조치는 없었다.' }, { p: 0.4, fx: { c: -14 }, result: '"우선순위 위반" 기록이 남았다. 청년은 살았고, 나는 징계 대상이 되었다.' }] },
      { text: '두 사람에게 번갈아 호흡 보조를 하며 증원을 요청한다', tags: ['S'], fx: { h: -8, m: 3, b: 6, c: -3 }, result: '새벽까지 번갈아 백을 눌렀다. 증원은 도착하지 않았지만, 두 사람은 아침을 맞았다.' },
    ],
  });

  add({
    id: 'manifest', tag: '직무 · 정비', title: '열려 있는 명단',
    when: (s) => s.role === 'transport' && s.t - s.roleSince >= 0.6 && s.t >= 2, weight: 5,
    text: ['이송선 점검 중 탑승 명단 단말기가 열려 있다. 다음 출발 명단에는 이웃 선의 이름이 있다.', '연료 잔량과 보급 적재량을 계산해 보니, 도착 후 보급이 없다는 결론이 나온다.'],
    choices: [
      { text: '명단에서 이름을 삭제하려 시도한다', tags: ['R', 'S'], fx: { c: -8, m: -3, b: 6 },
        outcomes: [{ p: 0.5, flags: { sun_saved: true }, result: '삭제는 성공했다. 선은 자기 이름이 어디서 지워졌는지 끝내 몰랐다.' }, { p: 0.5, fx: { c: -25 }, role: 'none', rescore: true, result: '삭제 로그가 즉시 올라왔다. 직무에서 제외되었다. 선의 이름은 다시 들어갔다.' }] },
      { text: '선에게 은밀히 알려 도망갈 길을 찾아 준다', tags: ['S'], fx: { b: 8, c: -5, m: -3 }, flags: { ghost_contact: true }, result: '선에게 쪽지를 건넸다. 선은 읽고 한참 말이 없었다. 다음 날 선의 칸은 비어 있었다.' },
      { text: '연료·보급 계산을 구역 대변인에게 전달한다', tags: ['S', 'R'], fx: { c: -6, b: 4 }, flags: { transport_leak: true }, result: '계산서를 건넨 날 밤 처음으로 오랜 시간 숨을 쉬었다. 이 계산서는 숫자였고, 숫자는 거짓말을 하지 않았다.' },
      { text: '본 것을 잊는다', tags: ['E', 'O'], auto: true, fx: { m: -5 }, result: '단말기를 닫았다. 잊으려 할수록 이름이 선명해졌다.' },
    ],
  });

  add({
    id: 'speaker_meeting', tag: '직무 · 대변인', title: '구역장과의 협상',
    when: roleReady('speaker', 0.8), weight: 5,
    text: ['구역장이 당신을 협상 테이블에 앉혔다. "3등급 배급 5% 환원을 약속하겠습니다. 대신 청원 운동을 중단하십시오."', '배급은 눈에 보이지만 청원은 아직 아무것도 아니다. 사람들은 배급을 먼저 말할 것이다.'],
    choices: [
      { text: '수락한다', tags: ['O'], fx: { f: 8, c: 8, b: -8, m: -5 }, result: '합의서에 서명했다. 사람들은 환원된 5%를 받았고, 내 이름은 점점 더 작아졌다.' },
      { text: '거절하고 서명 운동을 확대한다', tags: ['R', 'S'], fx: { c: -10, b: 8, m: 3 }, inc: { petitionSigs: 2 }, result: '구역장의 표정이 굳었다. 그날부터 내 칸 앞에 순찰 드론이 자주 지나갔다.' },
      { text: '환원을 서면으로 받아내고, 서명 운동은 계속하겠다고 말한다', tags: ['R'], fx: { c: -5, b: 4 },
        outcomes: [{ p: 0.5, fx: { f: 6, m: 3 }, result: '구역장은 이를 악물고 서명했다. 5% 환원과 청원 진행이 동시에 진행되었다.' }, { p: 0.5, fx: { c: -8, m: -3 }, result: '구역장은 합의서를 찢었다. "협상은 끝났습니다."' }] },
    ],
  });

  /* ---------------- 일상 (필러) ---------------- */

  add({
    id: 'small_talk', tag: '일상', title: '복도 끝 벤치',
    once: false, cooldown: 1.5, weight: 0.4,
    text: ['복도 끝 벤치에서 란이 말을 건넨다. "오늘은 하늘이 좀 맑지 않아?" 하늘은 사실 늘 같은 회색이다.'],
    choices: [
      { text: '옆에 앉아 이야기를 나눈다', tags: ['S'], fx: { b: 5, m: 3 }, result: '아무 말이나 했다. 아무 말이 모여 하루가 되었다.' },
      { text: '피곤해서 방으로 들어간다', tags: [], auto: true, fx: { m: -1 }, result: '문 닫는 소리가 생각보다 컸다.' },
    ],
  });

  add({
    id: 'water_line', tag: '일상', title: '정수 배급소 앞 소동',
    once: false, cooldown: 1.5, weight: 0.4,
    text: ['정수 배급소 앞에서 새치기를 두고 실랑이가 붙었다. 사람들이 점점 더 큰 소리를 낸다. 경비는 멀리서 보고만 있다.'],
    choices: [
      { text: '둘 사이에 들어가 중재한다', tags: ['S'], fx: { b: 3, c: -1, m: 1 }, result: '목소리를 낮추라고 부탁했다. 의외로 잘 먹혔다.' },
      { text: '못 본 척하고 줄에 선다', tags: [], auto: true, fx: { m: -2 }, result: '물통에 물이 차는 소리가 소동 소리를 덮었다.' },
      { text: '경비에게 신고한다', tags: ['O'], fx: { c: 3, b: -3 }, result: '경비는 느릿하게 걸어 왔다. 두 사람 모두 기록되었다.' },
    ],
  });

  add({
    id: 'old_photo', tag: '일상', title: '오래된 사진',
    once: false, cooldown: 2, weight: 0.4,
    text: ['짐 밑바닥에서 오래된 사진이 나왔다. 해일 전의 고향 집 앞이다. 사진 속 하늘은 지금보다 훨씬 푸르다.'],
    choices: [
      { text: '이웃에게 사진을 보여 주고 이야기를 나눈다', tags: ['S'], fx: { b: 4, m: 4 }, result: '이웃도 자기 고향 이야기를 꺼냈다. 두 고향의 이름이 한 장의 사진 위에서 겹쳤다.' },
      { text: '다시 짐 속에 넣어 둔다', tags: [], auto: true, fx: { m: -2 }, result: '사진은 다시 어둠으로 돌아갔다. 한참 뒤에도 손끝에 종이 감촉이 남아 있었다.' },
    ],
  });

  root.GAME_EVENTS = E;
  if (root.Game) root.Game.registerEvents(E);
})(typeof window !== 'undefined' ? window : globalThis);
