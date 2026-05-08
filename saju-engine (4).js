/**
 * 사주풀이 엔진 (saju-engine.js)
 * 생년월일시 입력 → 사주원국 자동 분석
 *
 * [만세력 엔진 업그레이드]
 * - 연주: 갑자(4년) 기준 간지 계산
 * - 월주: 절기 테이블 기반 입절일 보정 (연도별 정밀 데이터 포함)
 * - 일주: 율리우스일수(Julian Day) 기반 정확한 갑자일 산출
 * - 시주: 일간별 5호둔법 기반 시간 계산
 * - 십성: 오행 상생상극 + 음양 비교 (위치별 가중치 포함)
 * - 천을귀인 여부 탐지
 */

const SajuEngine = (() => {

  // ─── 기본 데이터 ────────────────────────────────────────────────

  // 천간 (한글 / 한자)
  const CHEONGAN    = ['갑','을','병','정','무','기','경','신','임','계'];
  const CHEONGAN_HJ = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];

  // 지지 (한글 / 한자)
  const JIJI    = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
  const JIJI_HJ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

  // 천간 오행 인덱스 (0목 1화 2토 3금 4수)
  const STEM_OHENG_IDX = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];

  // 지지 오행 인덱스
  const BRANCH_OHENG_IDX = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

  // 오행 이름 (인덱스 → 한글)
  const OHENG_NAMES = ['목', '화', '토', '금', '수'];

  // 천간/지지 → 오행·음양 매핑 (기존 호환용)
  const CHEONGAN_OHENG = {};
  const CHEONGAN_UMNYANG = {};
  CHEONGAN.forEach((g, i) => {
    CHEONGAN_OHENG[g]   = OHENG_NAMES[STEM_OHENG_IDX[i]];
    CHEONGAN_UMNYANG[g] = i % 2 === 0 ? '양' : '음';
  });

  const JIJI_OHENG = {};
  const JIJI_UMNYANG = {};
  JIJI.forEach((j, i) => {
    JIJI_OHENG[j]   = OHENG_NAMES[BRANCH_OHENG_IDX[i]];
    JIJI_UMNYANG[j] = i % 2 === 0 ? '양' : '음';
  });

  // 지지별 대표 천간 인덱스 (십성 음양 계산용)
  const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

  // ─── 만세력 핵심 테이블 ─────────────────────────────────────────

  /**
   * 절기(입절) 일자 테이블
   * key: 연도(없으면 default 사용), value: 각 월(1~12월) 입절일
   * 해당 일 이후면 그 달 월지, 이전이면 전월 월지 적용
   */
  const JIEQI = {
    default: [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7],
    1980: [6, 5, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7],
    1985: [6, 4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 8],
    1990: [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7],
    1993: [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7],
    2000: [6, 5, 6, 5, 5, 6, 7, 8, 8, 8, 7, 7],
    2010: [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7],
    2020: [6, 4, 5, 5, 6, 6, 7, 8, 8, 8, 7, 7],
    2024: [6, 10, 10, 9, 8, 6, 7, 4, 8, 8, 7, 7],
  };

  function getJieqi(year) {
    return JIEQI[year] || JIEQI.default;
  }

  // 입절 이후 월지 인덱스: 1월→인(2), 2월→묘(3) ... 12월→축(1)
  const MB_AFTER  = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
  // 입절 이전 월지 인덱스: 1월→축(1), 2월→인(2) ...
  const MB_BEFORE = [10, 11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  // 월간 5호둔법 기준 (연간 인덱스 % 5 → 인월 천간 인덱스)
  // 갑기→병인(2), 을경→무인(4), 병신→경인(6=0mod10 맞게), 정임→임인(8), 무계→갑인(0)
  const BASE_STEM_H = [2, 4, 6, 8, 0];

  // ─── 율리우스일수 계산 ──────────────────────────────────────────

  /**
   * 주어진 날짜의 율리우스일수(Julian Day Number) 반환 (그레고리력)
   */
  function julianDay(y, m, d) {
    if (m <= 2) { y--; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524;
  }

  // ─── 만세력 계산 ────────────────────────────────────────────────

  /**
   * 연주(年柱) 계산 — 갑자년 = 서기 4년 기준
   */
  function getYeonju(year) {
    const stemIdx   = ((year - 4) % 10 + 10) % 10;
    const branchIdx = ((year - 4) % 12 + 12) % 12;
    return {
      stemIdx, branchIdx,
      gan:   CHEONGAN[stemIdx],
      ji:    JIJI[branchIdx],
      ganHJ: CHEONGAN_HJ[stemIdx],
      jiHJ:  JIJI_HJ[branchIdx],
      label: CHEONGAN[stemIdx] + JIJI[branchIdx],
    };
  }

  /**
   * 월주(月柱) 계산 — 절기 기반 입절일 보정
   */
  function getWolju(year, month, day) {
    const jq  = getJieqi(year);
    const cut = jq[month - 1];
    const mb  = day >= cut ? MB_AFTER[month - 1] : MB_BEFORE[month - 1];

    const yStemIdx = ((year - 4) % 10 + 10) % 10;
    const order    = (mb - 2 + 12) % 12;   // 인월(지지인덱스 2)부터의 순서
    const mStemIdx = (BASE_STEM_H[yStemIdx % 5] + order) % 10;

    return {
      stemIdx: mStemIdx, branchIdx: mb,
      gan:   CHEONGAN[mStemIdx],
      ji:    JIJI[mb],
      ganHJ: CHEONGAN_HJ[mStemIdx],
      jiHJ:  JIJI_HJ[mb],
      label: CHEONGAN[mStemIdx] + JIJI[mb],
    };
  }

  /**
   * 일주(日柱) 계산 — 율리우스일수 기반
   * JD + 9 mod 10 = 천간, JD + 1 mod 12 = 지지
   */
  function getIlju(year, month, day) {
    const jd        = julianDay(year, month, day);
    const stemIdx   = ((jd + 9) % 10 + 10) % 10;
    const branchIdx = ((jd + 1) % 12 + 12) % 12;
    return {
      stemIdx, branchIdx,
      gan:   CHEONGAN[stemIdx],
      ji:    JIJI[branchIdx],
      ganHJ: CHEONGAN_HJ[stemIdx],
      jiHJ:  JIJI_HJ[branchIdx],
      label: CHEONGAN[stemIdx] + JIJI[branchIdx],
    };
  }

  /**
   * 시주(時柱) 계산 — 일간 5호둔법
   * @param {number} hour        시각 (0~23, 음수면 시주 없음)
   * @param {number} dayStemIdx  일간 천간 인덱스
   */
  function getSiju(hour, dayStemIdx) {
    if (hour < 0) return null;
    const branchIdx = hour === 23 ? 0 : Math.floor((hour + 1) / 2);
    const BASE_H    = [0, 2, 4, 6, 8];
    const stemIdx   = (BASE_H[dayStemIdx % 5] + branchIdx) % 10;
    return {
      stemIdx, branchIdx,
      gan:   CHEONGAN[stemIdx],
      ji:    JIJI[branchIdx],
      ganHJ: CHEONGAN_HJ[stemIdx],
      jiHJ:  JIJI_HJ[branchIdx],
      label: CHEONGAN[stemIdx] + JIJI[branchIdx],
    };
  }

  // ─── 천을귀인 ───────────────────────────────────────────────────

  const CHEONEUL_MAP = {
    0: [1, 7], 1: [0, 8], 2: [11, 9], 3: [11, 9], 4: [1, 7],
    5: [0, 8], 6: [2, 6], 7: [2, 6],  8: [3, 5],  9: [3, 5],
  };

  function hasCheoneul(dayStemIdx, pillars) {
    const targets = CHEONEUL_MAP[dayStemIdx] || [];
    return pillars.some(p => targets.includes(p.branchIdx));
  }

  // ─── 십성(十星) 계산 ────────────────────────────────────────────

  /**
   * 천간 십성
   */
  function getStemSipseong(dayStemIdx, targetStemIdx) {
    const rel  = (STEM_OHENG_IDX[targetStemIdx] - STEM_OHENG_IDX[dayStemIdx] + 5) % 5;
    const same = (dayStemIdx % 2) === (targetStemIdx % 2);
    const TABLE = ['비견/겁재','식신/상관','편재/정재','편관/정관','편인/정인'];
    if (rel === 0) return same ? '비견' : '겁재';
    if (rel === 1) return same ? '식신' : '상관';
    if (rel === 2) return same ? '편재' : '정재';
    if (rel === 3) return same ? '편관' : '정관';
    if (rel === 4) return same ? '편인' : '정인';
    return '?';
  }

  /**
   * 지지 십성 (지지 대표 천간의 음양 기준)
   */
  function getBranchSipseong(dayStemIdx, branchIdx) {
    const rel  = (BRANCH_OHENG_IDX[branchIdx] - STEM_OHENG_IDX[dayStemIdx] + 5) % 5;
    const same = (dayStemIdx % 2) === (BRANCH_MAIN_STEM[branchIdx] % 2);
    if (rel === 0) return same ? '비견' : '겁재';
    if (rel === 1) return same ? '식신' : '상관';
    if (rel === 2) return same ? '편재' : '정재';
    if (rel === 3) return same ? '편관' : '정관';
    if (rel === 4) return same ? '편인' : '정인';
    return '?';
  }

  // 위치별 가중치
  const POSITION_WEIGHT = {
    year_stem: 35,   year_branch: 20,
    month_stem: 35,  month_branch: 40,  // 월지 최우선
    day_branch: 35,                     // 일간은 본인이므로 제외
    hour_stem: 35,   hour_branch: 20,
  };

  /**
   * 사주 전체 십성 분석
   * @returns {{ count, score, detail }} 십성별 집계 결과
   */
  function calcSipseongAll(dayStemIdx, yeonju, wolju, ilju, siju) {
    const STARS = ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'];
    const count  = Object.fromEntries(STARS.map(s => [s, 0]));
    const score  = Object.fromEntries(STARS.map(s => [s, 0]));
    const detail = Object.fromEntries(STARS.map(s => [s, []]));

    function add(star, pos, weight) {
      count[star]++;
      score[star] = Math.min(score[star] + weight, 100);
      detail[star].push({ pos, weight });
    }

    // 연주
    add(getStemSipseong(dayStemIdx, yeonju.stemIdx),     '년주 천간', POSITION_WEIGHT.year_stem);
    add(getBranchSipseong(dayStemIdx, yeonju.branchIdx), '년주 지지', POSITION_WEIGHT.year_branch);
    // 월주
    add(getStemSipseong(dayStemIdx, wolju.stemIdx),      '월주 천간', POSITION_WEIGHT.month_stem);
    add(getBranchSipseong(dayStemIdx, wolju.branchIdx),  '월지(핵심)', POSITION_WEIGHT.month_branch);
    // 일지 (일간 제외)
    add(getBranchSipseong(dayStemIdx, ilju.branchIdx),   '일지',       POSITION_WEIGHT.day_branch);
    // 시주
    if (siju) {
      add(getStemSipseong(dayStemIdx, siju.stemIdx),     '시주 천간', POSITION_WEIGHT.hour_stem);
      add(getBranchSipseong(dayStemIdx, siju.branchIdx), '시주 지지', POSITION_WEIGHT.hour_branch);
    }

    return { count, score, detail };
  }

  // ─── 오행 분포 ──────────────────────────────────────────────────

  function getOhengDistribution(pillars) {
    const dist = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    pillars.forEach(p => {
      dist[OHENG_NAMES[STEM_OHENG_IDX[p.stemIdx]]]++;
      dist[OHENG_NAMES[BRANCH_OHENG_IDX[p.branchIdx]]]++;
    });
    return dist;
  }

  function getOhengBalance(dist) {
    const vals   = Object.values(dist);
    const max    = Math.max(...vals);
    const min    = Math.min(...vals);
    const strong = Object.keys(dist).filter(k => dist[k] === max && dist[k] >= 3);
    const weak   = Object.keys(dist).filter(k => dist[k] === min && dist[k] === 0);
    return { strong, weak, max, min };
  }

  // ─── 격국 판단 ──────────────────────────────────────────────────

  function getGeokguk(wolju, dayStemIdx) {
    const ilOhIdx    = STEM_OHENG_IDX[dayStemIdx];
    const wolJiOhIdx = BRANCH_OHENG_IDX[wolju.branchIdx];

    // 건록/양인: 월지 오행 = 일간 오행
    if (wolJiOhIdx === ilOhIdx) {
      return wolju.branchIdx % 2 === 0 ? '건록격' : '양인격';
    }

    const rel  = (wolJiOhIdx - ilOhIdx + 5) % 5;
    const same = (dayStemIdx % 2) === (BRANCH_MAIN_STEM[wolju.branchIdx] % 2);
    const ssArr = [
      same ? '비견' : '겁재',
      same ? '식신' : '상관',
      same ? '편재' : '정재',
      same ? '편관' : '정관',
      same ? '편인' : '정인',
    ];
    const ss = ssArr[rel];

    const geokMap = {
      식신:'식신격', 상관:'상관격', 편재:'편재격', 정재:'정재격',
      편관:'편관격', 정관:'정관격', 편인:'편인격', 정인:'정인격',
    };
    return geokMap[ss] || '정관격';
  }

  // ─── 정적 데이터 ────────────────────────────────────────────────

  const ILGAN_DESC = {
    갑: { name:'갑목(甲木)', symbol:'큰 나무',   personality:'리더십이 강하고 진취적입니다. 곧고 올바른 성품으로 주변을 이끌지만, 고집이 세고 융통성이 부족할 수 있습니다.',     strength:'추진력, 리더십, 정의감',    weakness:'고집, 독단적 성향' },
    을: { name:'을목(乙木)', symbol:'화초·덩굴', personality:'유연하고 적응력이 뛰어납니다. 사교적이며 주변 환경을 잘 활용하지만, 우유부단하고 의존적인 면이 있습니다.',          strength:'유연성, 사교성, 친화력',    weakness:'우유부단, 의존성' },
    병: { name:'병화(丙火)', symbol:'태양',       personality:'밝고 화끈한 성격으로 어디서나 주목받습니다. 열정적이고 솔직하나, 충동적이고 감정 기복이 있을 수 있습니다.',          strength:'열정, 솔직함, 카리스마',    weakness:'충동성, 감정 기복' },
    정: { name:'정화(丁火)', symbol:'촛불·화로', personality:'섬세하고 직관력이 뛰어납니다. 따뜻한 마음으로 타인을 돕지만, 감수성이 예민하고 집착하는 경향이 있습니다.',          strength:'직관력, 섬세함, 헌신',      weakness:'예민함, 집착' },
    무: { name:'무토(戊土)', symbol:'높은 산·대지', personality:'묵직하고 신뢰감이 넘칩니다. 포용력이 크고 현실적이나, 행동이 느리고 변화에 둔감할 수 있습니다.',               strength:'신뢰감, 포용력, 안정감',    weakness:'고집, 변화 적응 느림' },
    기: { name:'기토(己土)', symbol:'밭토·정원', personality:'세심하고 현실적입니다. 실용적이고 꼼꼼하나, 소심하고 의심이 많은 편입니다.',                                        strength:'꼼꼼함, 실용성, 성실함',    weakness:'소심함, 의심' },
    경: { name:'경금(庚金)', symbol:'원석·도끼', personality:'결단력이 강하고 의리가 있습니다. 의지가 굳고 솔직하나, 거칠고 타협을 잘 못합니다.',                                  strength:'결단력, 의리, 추진력',      weakness:'거침, 타협 부족' },
    신: { name:'신금(辛金)', symbol:'보석·칼날', personality:'예리하고 미적 감각이 뛰어납니다. 완벽주의 성향으로 자존심이 강하나, 차갑고 고집스러울 수 있습니다.',                 strength:'예리함, 완벽주의, 미적 감각', weakness:'냉정함, 자존심 강함' },
    임: { name:'임수(壬水)', symbol:'바다·큰 강', personality:'지혜롭고 포용력이 큽니다. 다재다능하고 유연하나, 우유부단하고 감성적으로 흔들릴 수 있습니다.',                     strength:'지혜, 포용력, 다재다능',    weakness:'우유부단, 감성적 흔들림' },
    계: { name:'계수(癸水)', symbol:'빗물·이슬', personality:'섬세하고 직관력이 탁월합니다. 감수성이 풍부하고 창의적이나, 내성적이고 우울감에 빠지기 쉽습니다.',                   strength:'직관력, 창의성, 감수성',    weakness:'내성적, 우울 경향' },
  };

  const OHENG_CHAR = {
    목: { color:'#4a7c59', label:'木(목)', emoji:'🌳', keyword:'성장·추진', desc:'기획력과 추진력이 뛰어나며, 성장과 발전을 추구합니다.' },
    화: { color:'#c0392b', label:'火(화)', emoji:'🔥', keyword:'열정·표현', desc:'열정과 표현력이 강하며, 사교적이고 활동적입니다.' },
    토: { color:'#d4a017', label:'土(토)', emoji:'⛰️', keyword:'중재·포용', desc:'안정적이고 포용력이 있으며, 조율 능력이 뛰어납니다.' },
    금: { color:'#7f8c8d', label:'金(금)', emoji:'⚙️', keyword:'결단·의리', desc:'결단력과 의리가 강하며, 분석적이고 꼼꼼합니다.' },
    수: { color:'#2c3e50', label:'水(수)', emoji:'💧', keyword:'지혜·유연', desc:'지혜롭고 유연하며, 창의적이고 직관력이 뛰어납니다.' },
  };

  const SIPSEONG = {
    비견: { name:'비견(比肩)', category:'비겁', desc:'주체성·독립심·경쟁',   detail:'나와 오행이 같고 음양도 같습니다. 주체성이 강하고 독립적이며 동료·형제와의 인연이 깊습니다.' },
    겁재: { name:'겁재(劫財)', category:'비겁', desc:'경쟁심·투쟁심',        detail:'나와 오행이 같고 음양이 다릅니다. 경쟁심과 추진력이 강하지만 재물 변동이 있을 수 있습니다.' },
    식신: { name:'식신(食神)', category:'식상', desc:'재능·낙천·활동',       detail:'내가 생(生)하는 오행으로 음양이 같습니다. 낙천적이고 재능 표출이 자연스러우며 삶의 여유를 즐깁니다.' },
    상관: { name:'상관(傷官)', category:'식상', desc:'표현력·예술성·비판',   detail:'내가 생(生)하는 오행으로 음양이 다릅니다. 재기발랄하고 표현력이 뛰어나며 예술적 감성이 풍부합니다.' },
    편재: { name:'편재(偏財)', category:'재성', desc:'큰 재물·활동 무대',    detail:'내가 극(克)하는 오행으로 음양이 같습니다. 큰 재물과 넓은 활동 무대를 추구하며 융통성이 뛰어납니다.' },
    정재: { name:'정재(正財)', category:'재성', desc:'안정·성실·관리',       detail:'내가 극(克)하는 오행으로 음양이 다릅니다. 안정적인 재물과 성실함을 상징하며 꼼꼼하게 관리합니다.' },
    편관: { name:'편관(偏官)', category:'관성', desc:'카리스마·책임·시련',   detail:'나를 극(克)하는 오행으로 음양이 같습니다. 강한 카리스마와 책임감, 시련 극복 능력을 상징합니다.' },
    정관: { name:'정관(正官)', category:'관성', desc:'원칙·규범·합리성',     detail:'나를 극(克)하는 오행으로 음양이 다릅니다. 바른 원칙과 합리성을 중시하며 조직·공직과 인연이 깊습니다.' },
    편인: { name:'편인(偏印)', category:'인성', desc:'전문성·몰입·독창',     detail:'나를 생(生)하는 오행으로 음양이 같습니다. 특정 분야에 깊이 몰입하는 전문성과 독창적 사고가 특징입니다.' },
    정인: { name:'정인(正印)', category:'인성', desc:'학문·수용·신용',       detail:'나를 생(生)하는 오행으로 음양이 다릅니다. 학문을 사랑하고 신용을 중시하며 어머니의 사랑처럼 따뜻합니다.' },
  };

  const GEOKGUK = {
    식신격: { name:'식신격(食神格)', desc:'재능과 활동력이 넘치는 삶',       detail:'표현력과 기술이 발달하여 자신만의 재능으로 성공을 이루는 사주입니다. 낙천적이고 여유로운 삶을 지향합니다.' },
    상관격: { name:'상관격(傷官格)', desc:'재능 발휘와 변화·혁신의 삶',      detail:'뛰어난 표현력과 창의력으로 기존 틀을 깨는 혁신을 이루는 사주입니다. 예술·언론·기술 분야에서 빛납니다.' },
    정재격: { name:'정재격(正財格)', desc:'안정적 재물과 성실의 삶',          detail:'꼼꼼하고 성실하게 안정적인 재물을 쌓아가는 사주입니다. 계획적이고 현실적인 성향이 강합니다.' },
    편재격: { name:'편재격(偏財格)', desc:'큰 재물과 넓은 활동의 삶',         detail:'대범하고 활동적으로 큰 재물을 다루는 사주입니다. 사업·투자·유통 분야와 인연이 깊습니다.' },
    정관격: { name:'정관격(正官格)', desc:'원칙·조직·공직의 삶',              detail:'바른 규범과 합리성으로 조직과 사회에서 인정받는 사주입니다. 공직·법조·교육 분야에서 활약합니다.' },
    편관격: { name:'편관격(偏官格)', desc:'권력·책임·시련 극복의 삶',         detail:'강한 카리스마와 책임감으로 시련을 극복하며 권력을 쥐는 사주입니다. 군·경·의료 분야에서 빛납니다.' },
    정인격: { name:'정인격(正印格)', desc:'학문·문서·수용의 삶',              detail:'배움을 사랑하고 지식을 쌓아 사회에 기여하는 사주입니다. 교육·연구·출판 분야와 인연이 깊습니다.' },
    편인격: { name:'편인격(偏印格)', desc:'전문 기술·독창적 사유의 삶',       detail:'특정 분야에 깊이 파고드는 전문성과 독창적 사고로 자신만의 세계를 구축하는 사주입니다.' },
    건록격: { name:'건록격(建祿格)', desc:'자수성가·독립의 삶',               detail:'스스로의 힘으로 일어서는 강한 자립심과 독립심을 가진 사주입니다. 사업가 기질이 강합니다.' },
    양인격: { name:'양인격(羊刃格)', desc:'강인한 의지·승부사의 삶',          detail:'강렬한 집중력과 승부 기질을 가진 사주입니다. 전문직·스포츠·군사 분야에서 두각을 나타냅니다.' },
  };

  // ─── 운세 해석 텍스트 생성 ──────────────────────────────────────

  function generateReading(result) {
    const { ilju, geokguk, dist, balance } = result;
    const ilganInfo = ILGAN_DESC[ilju.gan];
    const geokInfo  = GEOKGUK[geokguk] || GEOKGUK['정관격'];
    const lines = [];

    lines.push({
      title: '🌟 타고난 성품',
      content: `${ilganInfo.name}(${ilganInfo.symbol}) 일간으로 태어나셨습니다. ${ilganInfo.personality} 강점은 <strong>${ilganInfo.strength}</strong>이며, 주의할 점은 <strong>${ilganInfo.weakness}</strong> 성향입니다.`,
    });
    lines.push({
      title: '⛩️ 삶의 틀 (格局)',
      content: `<strong>${geokInfo.name}</strong> — ${geokInfo.desc}<br>${geokInfo.detail}`,
    });

    let balanceText = '';
    if (balance.strong.length > 0) {
      balanceText += `<strong>${balance.strong.map(o => OHENG_CHAR[o].label).join(', ')}</strong> 기운이 매우 강합니다. `;
    }
    if (balance.weak.length > 0) {
      const wo = balance.weak[0];
      balanceText += `<strong>${balance.weak.map(o => OHENG_CHAR[o].label).join(', ')}</strong> 기운이 부족합니다. `;
      const 補 = { 목:'초록색 계열 자연과 친하기', 화:'따뜻한 환경, 적극적 사교 활동', 토:'안정적인 루틴과 규칙적인 생활', 금:'꼼꼼한 계획·결단력 훈련', 수:'독서·명상·여행으로 지혜 쌓기' };
      balanceText += `부족한 기운을 채우려면 <em>${補[wo] || '균형 잡힌 생활'}</em>을 추천합니다.`;
    }
    if (!balanceText) balanceText = '오행이 고루 분포되어 균형 잡힌 사주입니다. 큰 기복 없이 안정적인 삶이 예상됩니다.';
    lines.push({ title: '⚖️ 오행 균형', content: balanceText });

    const jobMap = {
      식신격:'요식업·교육·예술·서비스업', 상관격:'예술·언론·IT·자유직·기획',
      정재격:'금융·회계·행정·부동산',     편재격:'사업·무역·금융·유통',
      정관격:'공무원·법조·교육·대기업',   편관격:'군·경찰·의료·스포츠·정치',
      정인격:'교수·연구·출판·문화',        편인격:'의약·심리·기술·예술',
      건록격:'사업·자영업·프리랜서',       양인격:'전문직·스포츠·군사·경쟁직',
    };
    lines.push({
      title: '💼 적합한 직업군',
      content: `${geokguk} 기준으로 <strong>${jobMap[geokguk] || '다양한 분야'}</strong>에서 역량을 발휘할 수 있습니다.`,
    });

    const rel = {
      갑:'직선적이고 솔직한 관계를 선호합니다.', 을:'부드럽고 조화로운 관계를 중시합니다.',
      병:'활발하고 넓은 인간관계를 자랑합니다.', 정:'소수의 깊은 관계를 추구합니다.',
      무:'믿음직스러운 관계를 형성합니다.',       기:'실용적이고 현실적인 관계를 맺습니다.',
      경:'의리 있고 직설적인 관계를 즐깁니다.',   신:'까다롭지만 진실한 관계를 원합니다.',
      임:'다양한 사람들을 포용하는 관계입니다.',   계:'감성적이고 깊이 있는 관계를 추구합니다.',
    };
    lines.push({ title: '💬 대인관계 스타일', content: rel[ilju.gan] });

    return lines;
  }

  // ─── 메인 분석 함수 ─────────────────────────────────────────────

  /**
   * 사주 전체 분석
   * @param {number} year   양력 연도
   * @param {number} month  양력 월 (1~12)
   * @param {number} day    양력 일
   * @param {number} hour   시각 (0~23, -1이면 시주 없음)
   * @returns {object} 분석 결과 전체
   */
  function analyze(year, month, day, hour) {
    const yeonju = getYeonju(year);
    const wolju  = getWolju(year, month, day);
    const ilju   = getIlju(year, month, day);
    const siju   = getSiju(hour, ilju.stemIdx);

    const dayStemIdx = ilju.stemIdx;
    const pillars    = siju ? [yeonju, wolju, ilju, siju] : [yeonju, wolju, ilju];

    const sipseong = calcSipseongAll(dayStemIdx, yeonju, wolju, ilju, siju);
    const dist     = getOhengDistribution(pillars);
    const balance  = getOhengBalance(dist);
    const geokguk  = getGeokguk(wolju, dayStemIdx);
    const cheoneul = hasCheoneul(dayStemIdx, pillars);

    const ilgan = {
      gan:     ilju.gan,
      oheng:   CHEONGAN_OHENG[ilju.gan],
      umnyang: CHEONGAN_UMNYANG[ilju.gan],
      stemIdx: dayStemIdx,
    };

    const result = {
      yeonju, wolju, ilju, siju,
      pillars,
      ilgan,
      sipseong,   // { count, score, detail }
      dist,
      balance,
      geokguk,
      cheoneul,
    };
    result.reading = generateReading(result);
    return result;
  }

  // ─── 공개 API ───────────────────────────────────────────────────

  return {
    analyze,
    // 개별 계산 함수
    getYeonju,
    getWolju,
    getIlju,
    getSiju,
    getStemSipseong,
    getBranchSipseong,
    hasCheoneul,
    getGeokguk,
    getOhengDistribution,
    getOhengBalance,
    // 정적 데이터
    CHEONGAN, CHEONGAN_HJ,
    JIJI, JIJI_HJ,
    CHEONGAN_OHENG, CHEONGAN_UMNYANG,
    JIJI_OHENG, JIJI_UMNYANG,
    OHENG_CHAR, SIPSEONG, ILGAN_DESC, GEOKGUK,
    JIEQI,
  };
})();

// CommonJS / ESM 호환
if (typeof module !== 'undefined') module.exports = SajuEngine;
