/**
 * 사주풀이 엔진 (saju-engine.js)
 * 생년월일시 입력 → 사주원국 자동 분석
 */

const SajuEngine = (() => {

  // ─── 기본 데이터 ───────────────────────────────────────────────

  const CHEONGAN = ['갑','을','병','정','무','기','경','신','임','계'];
  const JIJI     = ['자','축','인','묘','진','사','오','미','신','유','술','해'];

  const CHEONGAN_OHENG = {
    갑:'목',을:'목',병:'화',정:'화',무:'토',기:'토',경:'금',신:'금',임:'수',계:'수'
  };
  const CHEONGAN_UMNYANG = {
    갑:'양',을:'음',병:'양',정:'음',무:'양',기:'음',경:'양',신:'음',임:'양',계:'음'
  };
  const JIJI_OHENG = {
    자:'수',축:'토',인:'목',묘:'목',진:'토',사:'화',오:'화',미:'토',신:'금',유:'금',술:'토',해:'수'
  };
  const JIJI_UMNYANG = {
    자:'양',축:'음',인:'양',묘:'음',진:'양',사:'음',오:'양',미:'음',신:'양',유:'음',술:'양',해:'음'
  };

  // 일간별 특성 설명
  const ILGAN_DESC = {
    갑: { name:'갑목(甲木)', symbol:'큰 나무', personality:'리더십이 강하고 진취적입니다. 곧고 올바른 성품으로 주변을 이끌지만, 고집이 세고 융통성이 부족할 수 있습니다.', strength:'추진력, 리더십, 정의감', weakness:'고집, 독단적 성향' },
    을: { name:'을목(乙木)', symbol:'화초·덩굴', personality:'유연하고 적응력이 뛰어납니다. 사교적이며 주변 환경을 잘 활용하지만, 우유부단하고 의존적인 면이 있습니다.', strength:'유연성, 사교성, 친화력', weakness:'우유부단, 의존성' },
    병: { name:'병화(丙火)', symbol:'태양', personality:'밝고 화끈한 성격으로 어디서나 주목받습니다. 열정적이고 솔직하나, 충동적이고 감정 기복이 있을 수 있습니다.', strength:'열정, 솔직함, 카리스마', weakness:'충동성, 감정 기복' },
    정: { name:'정화(丁火)', symbol:'촛불·화로', personality:'섬세하고 직관력이 뛰어납니다. 따뜻한 마음으로 타인을 돕지만, 감수성이 예민하고 집착하는 경향이 있습니다.', strength:'직관력, 섬세함, 헌신', weakness:'예민함, 집착' },
    무: { name:'무토(戊土)', symbol:'높은 산·대지', personality:'묵직하고 신뢰감이 넘칩니다. 포용력이 크고 현실적이나, 행동이 느리고 변화에 둔감할 수 있습니다.', strength:'신뢰감, 포용력, 안정감', weakness:'고집, 변화 적응 느림' },
    기: { name:'기토(己土)', symbol:'밭토·정원', personality:'세심하고 현실적입니다. 실용적이고 꼼꼼하나, 소심하고 의심이 많은 편입니다.', strength:'꼼꼼함, 실용성, 성실함', weakness:'소심함, 의심' },
    경: { name:'경금(庚金)', symbol:'원석·도끼', personality:'결단력이 강하고 의리가 있습니다. 의지가 굳고 솔직하나, 거칠고 타협을 잘 못합니다.', strength:'결단력, 의리, 추진력', weakness:'거침, 타협 부족' },
    신: { name:'신금(辛金)', symbol:'보석·칼날', personality:'예리하고 미적 감각이 뛰어납니다. 완벽주의 성향으로 자존심이 강하나, 차갑고 고집스러울 수 있습니다.', strength:'예리함, 완벽주의, 미적 감각', weakness:'냉정함, 자존심 강함' },
    임: { name:'임수(壬水)', symbol:'바다·큰 강', personality:'지혜롭고 포용력이 큽니다. 다재다능하고 유연하나, 우유부단하고 감성적으로 흔들릴 수 있습니다.', strength:'지혜, 포용력, 다재다능', weakness:'우유부단, 감성적 흔들림' },
    계: { name:'계수(癸水)', symbol:'빗물·이슬', personality:'섬세하고 직관력이 탁월합니다. 감수성이 풍부하고 창의적이나, 내성적이고 우울감에 빠지기 쉽습니다.', strength:'직관력, 창의성, 감수성', weakness:'내성적, 우울 경향' }
  };

  // 오행별 특징
  const OHENG_CHAR = {
    목: { color:'#4a7c59', label:'木(목)', emoji:'🌳', keyword:'성장·추진', desc:'기획력과 추진력이 뛰어나며, 성장과 발전을 추구합니다.' },
    화: { color:'#c0392b', label:'火(화)', emoji:'🔥', keyword:'열정·표현', desc:'열정과 표현력이 강하며, 사교적이고 활동적입니다.' },
    토: { color:'#d4a017', label:'土(토)', emoji:'⛰️', keyword:'중재·포용', desc:'안정적이고 포용력이 있으며, 조율 능력이 뛰어납니다.' },
    금: { color:'#7f8c8d', label:'金(금)', emoji:'⚙️', keyword:'결단·의리', desc:'결단력과 의리가 강하며, 분석적이고 꼼꼼합니다.' },
    수: { color:'#2c3e50', label:'水(수)', emoji:'💧', keyword:'지혜·유연', desc:'지혜롭고 유연하며, 창의적이고 직관력이 뛰어납니다.' }
  };

  // 십성 정보
  const SIPSEONG = {
    비견: { name:'비견(比肩)', category:'비겁', desc:'주체성·독립심·경쟁', detail:'나와 오행이 같고 음양도 같습니다. 주체성이 강하고 독립적이며 동료·형제와의 인연이 깊습니다.' },
    겁재: { name:'겁재(劫財)', category:'비겁', desc:'경쟁심·투쟁심', detail:'나와 오행이 같고 음양이 다릅니다. 경쟁심과 추진력이 강하지만 재물 변동이 있을 수 있습니다.' },
    식신: { name:'식신(食神)', category:'식상', desc:'재능·낙천·활동', detail:'내가 생(生)하는 오행으로 음양이 같습니다. 낙천적이고 재능 표출이 자연스러우며 삶의 여유를 즐깁니다.' },
    상관: { name:'상관(傷官)', category:'식상', desc:'표현력·예술성·비판', detail:'내가 생(生)하는 오행으로 음양이 다릅니다. 재기발랄하고 표현력이 뛰어나며 예술적 감성이 풍부합니다.' },
    편재: { name:'편재(偏財)', category:'재성', desc:'큰 재물·활동 무대', detail:'내가 극(克)하는 오행으로 음양이 같습니다. 큰 재물과 넓은 활동 무대를 추구하며 융통성이 뛰어납니다.' },
    정재: { name:'정재(正財)', category:'재성', desc:'안정·성실·관리', detail:'내가 극(克)하는 오행으로 음양이 다릅니다. 안정적인 재물과 성실함을 상징하며 꼼꼼하게 관리합니다.' },
    편관: { name:'편관(偏官)', category:'관성', desc:'카리스마·책임·시련', detail:'나를 극(克)하는 오행으로 음양이 같습니다. 강한 카리스마와 책임감, 시련 극복 능력을 상징합니다.' },
    정관: { name:'정관(正官)', category:'관성', desc:'원칙·규범·합리성', detail:'나를 극(克)하는 오행으로 음양이 다릅니다. 바른 원칙과 합리성을 중시하며 조직·공직과 인연이 깊습니다.' },
    편인: { name:'편인(偏印)', category:'인성', desc:'전문성·몰입·독창', detail:'나를 생(生)하는 오행으로 음양이 같습니다. 특정 분야에 깊이 몰입하는 전문성과 독창적 사고가 특징입니다.' },
    정인: { name:'정인(正印)', category:'인성', desc:'학문·수용·신용', detail:'나를 생(生)하는 오행으로 음양이 다릅니다. 학문을 사랑하고 신용을 중시하며 어머니의 사랑처럼 따뜻합니다.' }
  };

  // 격국 정보
  const GEOKGUK = {
    식신격: { name:'식신격(食神格)', desc:'재능과 활동력이 넘치는 삶', detail:'표현력과 기술이 발달하여 자신만의 재능으로 성공을 이루는 사주입니다. 낙천적이고 여유로운 삶을 지향합니다.' },
    상관격: { name:'상관격(傷官格)', desc:'재능 발휘와 변화·혁신의 삶', detail:'뛰어난 표현력과 창의력으로 기존 틀을 깨는 혁신을 이루는 사주입니다. 예술·언론·기술 분야에서 빛납니다.' },
    정재격: { name:'정재격(正財格)', desc:'안정적 재물과 성실의 삶', detail:'꼼꼼하고 성실하게 안정적인 재물을 쌓아가는 사주입니다. 계획적이고 현실적인 성향이 강합니다.' },
    편재격: { name:'편재격(偏財格)', desc:'큰 재물과 넓은 활동의 삶', detail:'대범하고 활동적으로 큰 재물을 다루는 사주입니다. 사업·투자·유통 분야와 인연이 깊습니다.' },
    정관격: { name:'정관격(正官格)', desc:'원칙·조직·공직의 삶', detail:'바른 규범과 합리성으로 조직과 사회에서 인정받는 사주입니다. 공직·법조·교육 분야에서 활약합니다.' },
    편관격: { name:'편관격(偏官格)', desc:'권력·책임·시련 극복의 삶', detail:'강한 카리스마와 책임감으로 시련을 극복하며 권력을 쥐는 사주입니다. 군·경·의료 분야에서 빛납니다.' },
    정인격: { name:'정인격(正印格)', desc:'학문·문서·수용의 삶', detail:'배움을 사랑하고 지식을 쌓아 사회에 기여하는 사주입니다. 교육·연구·출판 분야와 인연이 깊습니다.' },
    편인격: { name:'편인격(偏印格)', desc:'전문 기술·독창적 사유의 삶', detail:'특정 분야에 깊이 파고드는 전문성과 독창적 사고로 자신만의 세계를 구축하는 사주입니다.' },
    건록격: { name:'건록격(建祿格)', desc:'자수성가·독립의 삶', detail:'스스로의 힘으로 일어서는 강한 자립심과 독립심을 가진 사주입니다. 사업가 기질이 강합니다.' },
    양인격: { name:'양인격(羊刃格)', desc:'강인한 의지·승부사의 삶', detail:'강렬한 집중력과 승부 기질을 가진 사주입니다. 전문직·스포츠·군사 분야에서 두각을 나타냅니다.' }
  };

  // ─── 만세력 계산 ───────────────────────────────────────────────

  // 연주(年柱) 계산 - 갑자(1984)기준
  function getYeonju(year) {
    const base = 1984; // 갑자년
    let idx = (year - base) % 60;
    if (idx < 0) idx += 60;
    const gan = CHEONGAN[idx % 10];
    const ji  = JIJI[idx % 12];
    return { gan, ji, label: gan + ji };
  }

  // 월주(月柱) 계산
  // 월지: 인(1월)~축(12월) → 인묘진사오미신유술해자축
  const WOLJI_MAP = ['인','묘','진','사','오','미','신','유','술','해','자','축'];
  // 연간에 따른 월간 기준 (인월 기준)
  const WOLGAN_BASE = { 갑:2, 을:4, 병:6, 정:8, 무:0, 기:2, 경:4, 신:6, 임:8, 계:0 };
  // 갑기년→병인, 을경→무인, 병신→경인, 정임→임인, 무계→갑인

  function getWolju(year, month, day) {
    // 절기로 월 보정 (간략화: 8일 이전이면 전월로)
    let m = month - 1; // 0-based
    // 태어난 달의 지지
    const ji = WOLJI_MAP[m];
    // 연간을 기준으로 월간 계산
    const yeonju = getYeonju(year);
    const yeongan = yeonju.gan;
    const base = WOLGAN_BASE[yeongan]; // 인월(1월)의 천간 인덱스
    const ganIdx = (base + m) % 10;
    const gan = CHEONGAN[ganIdx];
    return { gan, ji, label: gan + ji };
  }

  // 일주(日柱) 계산 - 율리우스일수 기반
  function getIlju(year, month, day) {
    // 갑자일(1900-01-01)을 기준으로 일수 차이 계산
    const base = new Date(1900, 0, 1);
    const target = new Date(year, month - 1, day);
    const diff = Math.floor((target - base) / 86400000);
    // 1900-01-01은 갑자일(0번째)
    let idx = ((diff % 60) + 60) % 60;
    const gan = CHEONGAN[idx % 10];
    const ji  = JIJI[idx % 12];
    return { gan, ji, label: gan + ji };
  }

  // 시주(時柱) 계산
  const SIJI_MAP = [
    {ji:'자', start:23, end:1},  // 23:00~01:00
    {ji:'축', start:1,  end:3},
    {ji:'인', start:3,  end:5},
    {ji:'묘', start:5,  end:7},
    {ji:'진', start:7,  end:9},
    {ji:'사', start:9,  end:11},
    {ji:'오', start:11, end:13},
    {ji:'미', start:13, end:15},
    {ji:'신', start:15, end:17},
    {ji:'유', start:17, end:19},
    {ji:'술', start:19, end:21},
    {ji:'해', start:21, end:23}
  ];
  const SIGAN_BASE = { 갑:0, 을:2, 병:4, 정:6, 무:8, 기:0, 경:2, 신:4, 임:6, 계:8 };

  function getSiJiIndex(hour) {
    if (hour === 23) return 0;
    return Math.floor((hour + 1) / 2);
  }

  function getSiju(hour, ilganName) {
    const jiIdx = getSiJiIndex(hour);
    const ji = JIJI[jiIdx];
    const base = SIGAN_BASE[ilganName];
    const ganIdx = (base + jiIdx) % 10;
    const gan = CHEONGAN[ganIdx];
    return { gan, ji, label: gan + ji };
  }

  // ─── 십성 계산 ─────────────────────────────────────────────────

  // 오행 상생상극
  const SAENG = { 목:'화', 화:'토', 토:'금', 금:'수', 수:'목' }; // A가 B를 生
  const GEUK  = { 목:'토', 화:'금', 토:'수', 금:'목', 수:'화' }; // A가 B를 克

  function getSipseong(ilganOheng, ilganYumyang, targetOheng, targetYumyang) {
    if (targetOheng === ilganOheng) {
      return targetYumyang === ilganYumyang ? '비견' : '겁재';
    }
    if (SAENG[ilganOheng] === targetOheng) {
      return targetYumyang === ilganYumyang ? '식신' : '상관';
    }
    if (GEUK[ilganOheng] === targetOheng) {
      return targetYumyang === ilganYumyang ? '편재' : '정재';
    }
    if (GEUK[targetOheng] === ilganOheng) {
      return targetYumyang === ilganYumyang ? '편관' : '정관';
    }
    if (SAENG[targetOheng] === ilganOheng) {
      return targetYumyang === ilganYumyang ? '편인' : '정인';
    }
    return '?';
  }

  // ─── 격국 판단 ─────────────────────────────────────────────────

  function getGeokguk(wolju, ilgan) {
    const wolJiOheng = JIJI_OHENG[wolju.ji];
    const ilOheng = CHEONGAN_OHENG[ilgan];
    const ilYumyang = CHEONGAN_UMNYANG[ilgan];
    const wolJiYumyang = JIJI_UMNYANG[wolju.ji];

    // 월지 오행을 기준으로 십성 계산
    const ss = getSipseong(ilOheng, ilYumyang, wolJiOheng, wolJiYumyang);

    // 월간이 월지 오행과 같으면 해당 격으로 강화
    const wolGanOheng = CHEONGAN_OHENG[wolju.gan];

    // 건록/양인 판단
    if (wolJiOheng === ilOheng) {
      const wolJiY = JIJI_UMNYANG[wolju.ji];
      if (wolJiY === '양') return '건록격';
      if (wolJiY === '음') return '양인격';
    }

    const geokMap = {
      식신:'식신격', 상관:'상관격',
      편재:'편재격', 정재:'정재격',
      편관:'편관격', 정관:'정관격',
      편인:'편인격', 정인:'정인격'
    };
    return geokMap[ss] || '정관격';
  }

  // ─── 오행 분포 분석 ────────────────────────────────────────────

  function getOhengDistribution(pillars) {
    const dist = { 목:0, 화:0, 토:0, 금:0, 수:0 };
    pillars.forEach(p => {
      dist[CHEONGAN_OHENG[p.gan]]++;
      dist[JIJI_OHENG[p.ji]]++;
    });
    return dist;
  }

  function getOhengBalance(dist) {
    const max = Math.max(...Object.values(dist));
    const min = Math.min(...Object.values(dist));
    const strong = Object.keys(dist).filter(k => dist[k] === max && dist[k] >= 3);
    const weak   = Object.keys(dist).filter(k => dist[k] === min && dist[k] === 0);
    return { strong, weak, max, min };
  }

  // ─── 운세 해석 텍스트 생성 ────────────────────────────────────

  function generateReading(result) {
    const { ilgan, geokguk, dist, balance, pillars } = result;
    const ilganInfo = ILGAN_DESC[ilgan.gan];
    const geokInfo  = GEOKGUK[geokguk] || GEOKGUK['정관격'];

    let lines = [];

    // 1. 일간 핵심 성격
    lines.push({
      title: '🌟 타고난 성품',
      content: `${ilganInfo.name}(${ilganInfo.symbol}) 일간으로 태어나셨습니다. ${ilganInfo.personality} 강점은 <strong>${ilganInfo.strength}</strong>이며, 주의할 점은 <strong>${ilganInfo.weakness}</strong> 성향입니다.`
    });

    // 2. 격국
    lines.push({
      title: '⛩️ 삶의 틀 (格局)',
      content: `<strong>${geokInfo.name}</strong> — ${geokInfo.desc}<br>${geokInfo.detail}`
    });

    // 3. 오행 균형
    let balanceText = '';
    if (balance.strong.length > 0) {
      const strongNames = balance.strong.map(o => OHENG_CHAR[o].label).join(', ');
      balanceText += `<strong>${strongNames}</strong> 기운이 매우 강합니다. `;
    }
    if (balance.weak.length > 0) {
      const weakNames = balance.weak.map(o => OHENG_CHAR[o].label).join(', ');
      balanceText += `<strong>${weakNames}</strong> 기운이 부족합니다. `;
      const weakOheng = balance.weak[0];
      const補 = { 목:'초록색 계열 자연과 친하기', 화:'따뜻한 환경, 적극적 사교 활동', 토:'안정적인 루틴과 규칙적인 생활', 금:'꼼꼼한 계획·결단력 훈련', 수:'독서·명상·여행으로 지혜 쌓기' };
      balanceText += `부족한 기운을 채우려면 <em>${補[weakOheng] || '균형 잡힌 생활'}</em>을 추천합니다.`;
    }
    if (!balanceText) balanceText = '오행이 고루 분포되어 균형 잡힌 사주입니다. 큰 기복 없이 안정적인 삶이 예상됩니다.';

    lines.push({ title:'⚖️ 오행 균형', content: balanceText });

    // 4. 직업 적성
    const jobMap = {
      식신격:'요식업·교육·예술·서비스업',
      상관격:'예술·언론·IT·자유직·기획',
      정재격:'금융·회계·행정·부동산',
      편재격:'사업·무역·금융·유통',
      정관격:'공무원·법조·교육·대기업',
      편관격:'군·경찰·의료·스포츠·정치',
      정인격:'교수·연구·출판·문화',
      편인격:'의약·심리·기술·예술',
      건록격:'사업·자영업·프리랜서',
      양인격:'전문직·스포츠·군사·경쟁직'
    };
    lines.push({
      title: '💼 적합한 직업군',
      content: `${geokguk} 기준으로 <strong>${jobMap[geokguk] || '다양한 분야'}</strong>에서 역량을 발휘할 수 있습니다.`
    });

    // 5. 대인관계
    const rel = {
      갑:'직선적이고 솔직한 관계를 선호합니다.',
      을:'부드럽고 조화로운 관계를 중시합니다.',
      병:'활발하고 넓은 인간관계를 자랑합니다.',
      정:'소수의 깊은 관계를 추구합니다.',
      무:'믿음직스러운 관계를 형성합니다.',
      기:'실용적이고 현실적인 관계를 맺습니다.',
      경:'의리 있고 직설적인 관계를 즐깁니다.',
      신:'까다롭지만 진실한 관계를 원합니다.',
      임:'다양한 사람들을 포용하는 관계입니다.',
      계:'감성적이고 깊이 있는 관계를 추구합니다.'
    };
    lines.push({ title:'💬 대인관계 스타일', content: rel[ilgan.gan] });

    return lines;
  }

  // ─── 메인 분석 함수 ────────────────────────────────────────────

  function analyze(year, month, day, hour) {
    const yeonju = getYeonju(year);
    const wolju  = getWolju(year, month, day);
    const ilju   = getIlju(year, month, day);
    const siju   = getSiju(hour, ilju.gan);

    const pillars = [yeonju, wolju, ilju, siju];
    const ilgan   = { gan: ilju.gan, oheng: CHEONGAN_OHENG[ilju.gan], umnyang: CHEONGAN_UMNYANG[ilju.gan] };

    // 십성 계산 (일간 기준)
    const sipseongList = pillars.map(p => {
      return {
        pillar: p,
        ganSipseong: p.gan === ilju.gan ? '일간(나)' : getSipseong(
          CHEONGAN_OHENG[ilju.gan], CHEONGAN_UMNYANG[ilju.gan],
          CHEONGAN_OHENG[p.gan],   CHEONGAN_UMNYANG[p.gan]
        ),
        jiSipseong: getSipseong(
          CHEONGAN_OHENG[ilju.gan], CHEONGAN_UMNYANG[ilju.gan],
          JIJI_OHENG[p.ji],         JIJI_UMNYANG[p.ji]
        )
      };
    });

    const dist    = getOhengDistribution(pillars);
    const balance = getOhengBalance(dist);
    const geokguk = getGeokguk(wolju, ilju.gan);

    const result = { yeonju, wolju, ilju, siju, pillars, ilgan, sipseongList, dist, balance, geokguk };
    result.reading = generateReading(result);

    return result;
  }

  // ─── 공개 API ─────────────────────────────────────────────────

  return {
    analyze,
    CHEONGAN_OHENG,
    JIJI_OHENG,
    OHENG_CHAR,
    SIPSEONG,
    ILGAN_DESC,
    GEOKGUK
  };
})();

// CommonJS / ESM 호환
if (typeof module !== 'undefined') module.exports = SajuEngine;
