// =========================================================
// 📰 GitHub Pages 맞춤형 3단계 완전 우회 실시간 뉴스 모듈
// =========================================================

async function renderBriefing() {
  const briefingContainer = document.getElementById("briefing-content");
  const briefingLoading = document.getElementById("briefing-loading");
  const briefingDate = document.getElementById("briefing-date");
  const refreshBtn = document.getElementById("refresh-briefing");

  // ⏱️ 1. 시작 시간 측정
  const startTime = performance.now();

  // 회전 애니메이션 등록
  if (!document.getElementById("spinner-style")) {
    const style = document.createElement("style");
    style.id = "spinner-style";
    style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  // 2. 버튼 상태 및 스피너 UI 적용
  let originalBtnText = "새로고침";
  if (refreshBtn) {
    originalBtnText = refreshBtn.getAttribute("data-original-text") || "새로고침";
    if (!refreshBtn.getAttribute("data-original-text")) {
      refreshBtn.setAttribute("data-original-text", originalBtnText);
    }
    
    refreshBtn.style.display = "inline-flex";
    refreshBtn.style.alignItems = "center";
    refreshBtn.style.gap = "6px";
    refreshBtn.innerHTML = `
      <div style="
        width: 12px; 
        height: 12px; 
        border: 2px solid rgba(255, 255, 255, 0.3); 
        border-top: 2px solid #ffffff; 
        border-radius: 50%; 
        animation: spin 0.8s linear infinite;"></div>
      <span>갱신 중...</span>
    `;
    refreshBtn.disabled = true;
  }

  if (briefingLoading) {
    briefingLoading.style.display = "block";
    briefingLoading.textContent = "최신 증시 이슈를 탐색 중입니다...";
  }
  if (briefingContainer) briefingContainer.hidden = true;
  if (briefingDate) briefingDate.textContent = "갱신 중...";

  // 키워드 무작위 교체
  const categoryList = [
    { name: "주요 증시", query: "증시" },
    { name: "국내 주식", query: "코스피 주식" },
    { name: "미국 증시", query: "나스닥" },
    { name: "금리/환율", query: "금리 환율" },
    { name: "반도체/AI", query: "반도체 AI" }
  ];
  const selectedCat = categoryList[Math.floor(Math.random() * categoryList.length)];
  const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(selectedCat.query)}&hl=ko&gl=KR&ceid=KR:ko`;

  let items = [];

  // [시도 1] RSS2JSON API (가장 안정적, URL 인코딩 버그 수정)
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleRssUrl)}&api_key=&_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok" && data.items && data.items.length > 0) {
        items = data.items.slice(0, 4).map(item => {
          const parts = (item.title || "주요 증시 뉴스").split(" - ");
          return {
            title: parts[0],
            source: parts.length > 1 ? parts[parts.length - 1] : (item.author || "증시뉴스"),
            link: item.link || "#",
            time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""
          };
        });
      }
    }
  } catch (e) {
    console.warn("1차 RSS2JSON 실패, 백업 프록시 시도...", e);
  }

  // [시도 2] AllOrigins 프록시
  if (items.length === 0) {
    try {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(googleRssUrl)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.contents) {
          const xmlDoc = new DOMParser().parseFromString(data.contents, "text/xml");
          const rawItems = Array.from(xmlDoc.querySelectorAll("item")).slice(0, 4);

          items = rawItems.map(item => {
            const parts = (item.querySelector("title")?.textContent || "").split(" - ");
            const pubDateStr = item.querySelector("pubDate")?.textContent;
            return {
              title: parts[0],
              source: parts.length > 1 ? parts[parts.length - 1] : "실시간뉴스",
              link: item.querySelector("link")?.textContent || "#",
              time: pubDateStr ? new Date(pubDateStr).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""
            };
          });
        }
      }
    } catch (e) {
      console.warn("2차 AllOrigins 실패", e);
    }
  }

  // ⏱️ 3. 소요 시간 계산
  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // 4. 버튼 원복
  if (refreshBtn) {
    refreshBtn.innerHTML = originalBtnText;
    refreshBtn.disabled = false;
  }

  // 5. 화면 바인딩
  if (items.length > 0) {
    let newsHtml = `<ul class="briefing-list">`;
    items.forEach(item => {
      newsHtml += `
        <li>
          <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
          <div style="margin-top: 6px; display: flex; gap: 8px; align-items: center;">
            <span class="briefing-source">${item.source}</span>
            <small style="color: #64748b; font-size: 0.75rem;">${item.time}</small>
          </div>
        </li>
      `;
    });
    newsHtml += `</ul>`;

    let aiSummaryHtml = `
      <div class="briefing-top">
        <span style="font-size: 0.8rem; color: #978cff; font-weight: 700; display: block; margin-bottom: 8px;">🤖 AI 증시 브리핑 (${selectedCat.name})</span>
        <p class="briefing-summary">
          실시간 <b>'${selectedCat.name}'</b> 관련 주요 헤드라인입니다. 
          최근 증시 동향을 확인하고 자산 비중을 점검하세요.
        </p>
      </div>
    `;

    if (briefingContainer) {
      briefingContainer.innerHTML = newsHtml + aiSummaryHtml;
      briefingContainer.hidden = false;
    }
    if (briefingLoading) briefingLoading.style.display = "none";
    
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (briefingDate) briefingDate.textContent = `${nowStr} (${duration}초 소요)`;
  } else {
    if (briefingLoading) {
      briefingLoading.style.display = "block";
      briefingLoading.textContent = "⚠️ 실시간 서버 응답이 지연 중입니다. 1~2초 후 다시 눌러주세요.";
    }
    if (briefingDate) briefingDate.textContent = `갱신 지연 (${duration}초)`;
  }
}

// 이벤트 바인딩
document.addEventListener("DOMContentLoaded", () => {
  renderBriefing();

  const refreshBtn = document.getElementById("refresh-briefing");
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "true";
    refreshBtn.addEventListener("click", () => {
      renderBriefing();
    });
  }
});

// =========================================================
// 📈 투자 시뮬레이터 (배당 & S&P 500) 완벽 연동 로직
// =========================================================

// 1. 모든 문자열에서 콤마(,) 제거 후 안전하게 숫자로 변환하는 함수
function parseNumber(val) {
  if (!val) return 0;
  // 콤마 제거 및 공백 제거
  const cleanVal = String(val).replace(/,/g, "").trim();
  const num = parseFloat(cleanVal);
  return isNaN(num) ? 0 : num;
}

// 2. 숫자를 한국 원화 형식(₩1,234,567)으로 포맷팅
function formatKRW(num) {
  return "₩" + Math.round(num).toLocaleString("ko-KR");
}

// ---------------------------------------------------------
// 💰 [좌측] 배당 시뮬레이터 계산
// ---------------------------------------------------------
function calculateDividendSim() {
  const inputs = document.querySelectorAll('.simulator-box, div'); // 영역 탐색
  
  // HTML input 요소 수집 (placeholder 또는 입력된 순서 기준 범용 매핑)
  const allInputs = Array.from(document.querySelectorAll('input'));
  
  // 배당 시뮬레이터 쪽 input들
  const initAssetInput = allInputs[0]; // 초기 투자금
  const monthlyAddInput = allInputs[1]; // 월 추가 투자
  const yieldRateInput = allInputs[2]; // 연 배당수익률
  const periodInput = allInputs[3];    // 투자 기간
  const reinvestCheckbox = document.querySelector('input[type="checkbox"]'); // 배당 재투자 여부

  if (!initAssetInput || !monthlyAddInput || !yieldRateInput || !periodInput) return;

  const initAsset = parseNumber(initAssetInput.value);
  const monthlyAdd = parseNumber(monthlyAddInput.value);
  const yieldRate = parseNumber(yieldRateInput.value) / 100; // % -> 소수점
  const years = parseNumber(periodInput.value);
  const isReinvest = reinvestCheckbox ? reinvestCheckbox.checked : true;

  let totalAsset = initAsset;
  let totalDividendAccumulated = 0;

  const monthlyYield = yieldRate / 12; // 월 배당률

  // 월별 복리/단리 계산
  for (let m = 1; m <= years * 12; m++) {
    // 월 배당금 발생
    const currentMonthlyDiv = totalAsset * monthlyYield;
    totalDividendAccumulated += currentMonthlyDiv;

    // 배당 재투자 여부에 따라 자산 증가
    if (isReinvest) {
      totalAsset += currentMonthlyDiv;
    }

    // 월 추가 적립금 투입
    totalAsset += monthlyAdd;
  }

  // 결과 출력 영역 찾기 (₩0이라고 적힌 요소들)
  const divResults = Array.from(document.querySelectorAll('div, span, p')).filter(el => 
    el.textContent.includes('₩') || el.id?.includes('result') || el.className?.includes('asset')
  );

  // 화면 바인딩 (배당 시뮬레이터 예상 자산 & 누적 배당금)
  const divBox = initAssetInput.closest('div[class*="box"]') || initAssetInput.parentElement.parentElement;
  if (divBox) {
    const outputs = divBox.querySelectorAll('h3, h4, .value, div[style*="font"], p');
    // textContent에 ₩가 있는 엘리먼트 순서대로 업데이트
    const targets = Array.from(divBox.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent.includes('₩'));
    if (targets.length >= 2) {
      targets[0].textContent = formatKRW(totalAsset);
      targets[1].textContent = formatKRW(totalDividendAccumulated);
    }
  }
}

// ---------------------------------------------------------
// 🇺🇸 [우측] S&P 500 시뮬레이터 계산
// ---------------------------------------------------------
function calculateSp500Sim() {
  const allInputs = Array.from(document.querySelectorAll('input'));
  
  // S&P 500 쪽 input들 (index 4 ~ 8)
  const initAssetUsdInput = allInputs[4];  // 초기 투자금 (USD)
  const monthlyAddUsdInput = allInputs[5]; // 월 추가 투자 (USD)
  const exchangeRateInput = allInputs[6];  // 적용 환율 (원/USD)
  const returnRateInput = allInputs[7];   // 연 수익률 가정 (%)
  const periodInput = allInputs[8];       // 투자 기간 (년)

  if (!initAssetUsdInput || !monthlyAddUsdInput || !exchangeRateInput || !returnRateInput || !periodInput) return;

  const initAssetUsd = parseNumber(initAssetUsdInput.value);
  const monthlyAddUsd = parseNumber(monthlyAddUsdInput.value);
  const exchangeRate = parseNumber(exchangeRateInput.value);
  const annualReturn = parseNumber(returnRateInput.value) / 100;
  const years = parseNumber(periodInput.value);

  const monthlyReturn = annualReturn / 12; // 월 수익률

  let totalAssetUsd = initAssetUsd;
  let totalDepositedUsd = initAssetUsd + (monthlyAddUsd * years * 12);

  // 월별 적립식 복리 계산
  for (let m = 1; m <= years * 12; m++) {
    totalAssetUsd = totalAssetUsd * (1 + monthlyReturn) + monthlyAddUsd;
  }

  // 원화 환산
  const totalAssetKrw = totalAssetUsd * exchangeRate;
  const totalDepositedKrw = totalDepositedUsd * exchangeRate;

  // 화면 바인딩 (S&P 500 예상 자산 & 총 납입금)
  const spBox = initAssetUsdInput.closest('div[class*="box"]') || initAssetUsdInput.parentElement.parentElement;
  if (spBox) {
    const targets = Array.from(spBox.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent.includes('₩'));
    if (targets.length >= 2) {
      targets[0].textContent = formatKRW(totalAssetKrw);
      targets[1].textContent = formatKRW(totalDepositedKrw);
    }
  }
}

// =========================================================
// 📈 투자 시뮬레이터 (배당 & S&P 500) 직관적 자동 바인딩 로직
// =========================================================

function runInvestmentSimulators() {
  // 모든 input 요소를 순서대로 수집
  const inputs = Array.from(document.querySelectorAll('.simulator-container input, #simulator input, input'));
  
  // 숫자로 변환하는 안심 함수
  const toNum = (val) => {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, "").trim();
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  // 숫자를 원화 텍스트로 변환
  const toKRW = (num) => "₩" + Math.round(num).toLocaleString("ko-KR");

  // ---------------------------------------------------------
  // 1. 배당 시뮬레이터 계산
  // ---------------------------------------------------------
  // 순서대로: 초기투자금(원), 월추가투자(원), 연배당수익률(%), 투자기간(년)
  const divInit = toNum(inputs[0]?.value);
  const divMonthly = toNum(inputs[1]?.value);
  const divYield = toNum(inputs[2]?.value) / 100;
  const divYears = toNum(inputs[3]?.value);
  
  // 배당 재투자 체크박스
  const checkbox = document.querySelector('input[type="checkbox"]');
  const isReinvest = checkbox ? checkbox.checked : true;

  let divTotalAsset = divInit;
  let divTotalAccumulated = 0;
  const monthlyYield = divYield / 12;

  for (let m = 1; m <= divYears * 12; m++) {
    const currentDiv = divTotalAsset * monthlyYield;
    divTotalAccumulated += currentDiv;
    if (isReinvest) {
      divTotalAsset += currentDiv;
    }
    divTotalAsset += divMonthly;
  }

  // ---------------------------------------------------------
  // 2. S&P 500 시뮬레이터 계산
  // ---------------------------------------------------------
  // 순서대로: 초기투자금(USD), 월추가투자(USD), 환율, 연수익률(%), 투자기간(년)
  const spInitUsd = toNum(inputs[4]?.value);
  const spMonthlyUsd = toNum(inputs[5]?.value);
  const spFx = toNum(inputs[6]?.value);
  const spReturn = toNum(inputs[7]?.value) / 100;
  const spYears = toNum(inputs[8]?.value);

  const monthlyReturn = spReturn / 12;
  let spTotalAssetUsd = spInitUsd;
  let spTotalDepositedUsd = spInitUsd + (spMonthlyUsd * spYears * 12);

  for (let m = 1; m <= spYears * 12; m++) {
    spTotalAssetUsd = spTotalAssetUsd * (1 + monthlyReturn) + spMonthlyUsd;
  }

  const spTotalAssetKrw = spTotalAssetUsd * spFx;
  const spTotalDepositedKrw = spTotalDepositedUsd * spFx;

// =========================================================
// 📈 HTML 맞춤형 시뮬레이터 연동 로직
// =========================================================

// 숫자에 포함된 콤마(,) 제거 후 float 변환
function parseSimNum(val) {
  if (!val) return 0;
  const clean = String(val).replace(/,/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// 원화(₩) 포맷팅
function formatSimKRW(num) {
  return "₩" + Math.round(num).toLocaleString("ko-KR");
}

// 1. 배당 시뮬레이터 계산
function updateDividendSim() {
  const reinvest = document.getElementById("dividend-reinvest")?.checked ?? true;
  const initAsset = parseSimNum(document.getElementById("dividend-initial")?.value);
  const monthlyAdd = parseSimNum(document.getElementById("dividend-monthly")?.value);
  const yieldRate = parseSimNum(document.getElementById("dividend-yield")?.value) / 100;
  const years = parseSimNum(document.getElementById("dividend-years")?.value);

  const totalOut = document.getElementById("dividend-total");
  const incomeOut = document.getElementById("dividend-income");

  let totalAsset = initAsset;
  let accumulatedDividend = 0;
  const monthlyYield = yieldRate / 12;

  for (let m = 1; m <= years * 12; m++) {
    const currentDiv = totalAsset * monthlyYield;
    accumulatedDividend += currentDiv;

    if (reinvest) {
      totalAsset += currentDiv;
    }
    totalAsset += monthlyAdd;
  }

  if (totalOut) totalOut.textContent = formatSimKRW(totalAsset);
  if (incomeOut) incomeOut.textContent = formatSimKRW(accumulatedDividend);
}

// 2. S&P 500 시뮬레이터 계산
function updateSp500Sim() {
  const initUsd = parseSimNum(document.getElementById("sp-initial")?.value);
  const monthlyUsd = parseSimNum(document.getElementById("sp-monthly")?.value);
  const exchangeRate = parseSimNum(document.getElementById("sp-exchange-rate")?.value);
  const annualReturn = parseSimNum(document.getElementById("sp-return")?.value) / 100;
  const years = parseSimNum(document.getElementById("sp-years")?.value);

  const totalOut = document.getElementById("sp-total");
  const contribOut = document.getElementById("sp-contribution");

  const monthlyReturn = annualReturn / 12;
  let totalAssetUsd = initUsd;
  let totalDepositedUsd = initUsd + (monthlyUsd * years * 12);

  for (let m = 1; m <= years * 12; m++) {
    totalAssetUsd = totalAssetUsd * (1 + monthlyReturn) + monthlyUsd;
  }

  const totalAssetKrw = totalAssetUsd * exchangeRate;
  const totalDepositedKrw = totalDepositedUsd * exchangeRate;

  if (totalOut) totalOut.textContent = formatSimKRW(totalAssetKrw);
  if (contribOut) contribOut.textContent = formatSimKRW(totalDepositedKrw);
}

// 3. 전체 시뮬레이터 통합 실행
function runSimulators() {
  updateDividendSim();
  updateSp500Sim();
}

// DOM 로드 완료 후 실시간 이벤트 바인딩
document.addEventListener("DOMContentLoaded", () => {
  // 처음 열릴 때 1회 계산
  runSimulators();

  // 시뮬레이터 영역 내부의 입력값이 바뀌면 즉시 실시간 재계산
  const simSection = document.getElementById("simulators");
  if (simSection) {
    simSection.addEventListener("input", runSimulators);
    simSection.addEventListener("change", runSimulators);
  }
});

// =========================================================
// 🚀 강제 실행 연동 로직
// =========================================================
(function initSimulators() {
  function parseSimNum(val) {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, "").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  function formatSimKRW(num) {
    return "₩" + Math.round(num).toLocaleString("ko-KR");
  }

  function runSim() {
    // 1. 배당 시뮬레이터
    const reinvest = document.getElementById("dividend-reinvest")?.checked ?? true;
    const divInit = parseSimNum(document.getElementById("dividend-initial")?.value);
    const divMonthly = parseSimNum(document.getElementById("dividend-monthly")?.value);
    const divYield = parseSimNum(document.getElementById("dividend-yield")?.value) / 100;
    const divYears = parseSimNum(document.getElementById("dividend-years")?.value);

    let divTotal = divInit;
    let divIncome = 0;
    const mYield = divYield / 12;

    for (let m = 1; m <= divYears * 12; m++) {
      const curDiv = divTotal * mYield;
      divIncome += curDiv;
      if (reinvest) divTotal += curDiv;
      divTotal += divMonthly;
    }

    const divTotalEl = document.getElementById("dividend-total");
    const divIncomeEl = document.getElementById("dividend-income");
    if (divTotalEl) divTotalEl.textContent = formatSimKRW(divTotal);
    if (divIncomeEl) divIncomeEl.textContent = formatSimKRW(divIncome);

    // 2. S&P 500 시뮬레이터
    const spInit = parseSimNum(document.getElementById("sp-initial")?.value);
    const spMonthly = parseSimNum(document.getElementById("sp-monthly")?.value);
    const spFx = parseSimNum(document.getElementById("sp-exchange-rate")?.value);
    const spReturn = parseSimNum(document.getElementById("sp-return")?.value) / 100;
    const spYears = parseSimNum(document.getElementById("sp-years")?.value);

    let spTotalUsd = spInit;
    let spContribUsd = spInit + (spMonthly * spYears * 12);
    const mReturn = spReturn / 12;

    for (let m = 1; m <= spYears * 12; m++) {
      spTotalUsd = spTotalUsd * (1 + mReturn) + spMonthly;
    }

    const spTotalEl = document.getElementById("sp-total");
    const spContribEl = document.getElementById("sp-contribution");
    if (spTotalEl) spTotalEl.textContent = formatSimKRW(spTotalUsd * spFx);
    if (spContribEl) spContribEl.textContent = formatSimKRW(spContribUsd * spFx);
  }

  // 화면 로드 즉시 1회 연산
  setTimeout(runSim, 100);
  window.addEventListener("load", runSim);

  // 실시간 입력 감지
  document.addEventListener("input", runSim);
  document.addEventListener("change", runSim);
})();
