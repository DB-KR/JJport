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

  // [시도 1] RSS2JSON API
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

// 브리핑 이벤트 바인딩
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
// 📈 투자 시뮬레이터 (배당 & S&P 500) 완벽 연동 + 천단위 콤마 자동 서식
// =========================================================

(function initSimulators() {
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

  // input 입력값에 3자리 단위 콤마 적용하는 함수
  function formatInputWithCommas(inputEl) {
    if (!inputEl) return;
    // 연 수익률(%), 투자기간(년) 등 step이 있거나 소수점이 필요한 필드는 콤마 제외
    if (inputEl.type === "number" || inputEl.id.includes("yield") || inputEl.id.includes("return") || inputEl.id.includes("years")) {
      return;
    }

    const originalValue = inputEl.value;
    const rawValue = originalValue.replace(/,/g, "");
    
    // 숫자 이외의 문자 제거
    if (!/^\d*$/.test(rawValue)) {
      inputEl.value = originalValue.replace(/[^\d,]/g, "");
      return;
    }

    if (rawValue) {
      const formatted = Number(rawValue).toLocaleString("ko-KR");
      if (inputEl.value !== formatted) {
        inputEl.value = formatted;
      }
    }
  }

  function runSim() {
    // 1. 배당 시뮬레이터 계산
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

    // 2. S&P 500 시뮬레이터 계산
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

  // 초기 로드 시 기존 기본값에도 콤마 적용
  function applyInitialFormatting() {
    const simSection = document.getElementById("simulators");
    if (simSection) {
      const inputs = simSection.querySelectorAll("input");
      inputs.forEach(input => formatInputWithCommas(input));
    }
  }

  // 화면 로드 즉시 실행
  setTimeout(() => {
    applyInitialFormatting();
    runSim();
  }, 100);

  window.addEventListener("load", () => {
    applyInitialFormatting();
    runSim();
  });

  // 실시간 입력 감지 및 콤마 서식 적용
  document.addEventListener("input", (e) => {
    if (e.target.closest("#simulators")) {
      formatInputWithCommas(e.target);
      runSim();
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.closest("#simulators")) {
      formatInputWithCommas(e.target);
      runSim();
    }
  });
})();
