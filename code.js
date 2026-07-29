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
// 📈 투자 시뮬레이터 + 차트 시각화(Chart.js) + 실시간 환율 연동
// =========================================================

(function initAdvancedSimulators() {
  let simChartInstance = null; // 차트 인스턴스 전역 관리

  // 콤마 제거 후 숫자 변환
  function parseSimNum(val) {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, "").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  // 원화 포맷팅
  function formatSimKRW(num) {
    return "₩" + Math.round(num).toLocaleString("ko-KR");
  }

  // input 3자리 콤마 포맷팅
  function formatInputWithCommas(inputEl) {
    if (!inputEl) return;
    if (inputEl.type === "number" || inputEl.id.includes("yield") || inputEl.id.includes("return") || inputEl.id.includes("years")) {
      return;
    }
    const originalValue = inputEl.value;
    const rawValue = originalValue.replace(/,/g, "");
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

  // 💱 1. 실시간 환율 가져오기 (open.er-api.com)
  async function fetchLiveExchangeRate() {
    const spExchangeInput = document.getElementById("sp-exchange-rate");
    if (!spExchangeInput) return;

    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && data.rates.KRW) {
          const liveRate = Math.round(data.rates.KRW);
          spExchangeInput.value = liveRate.toLocaleString("ko-KR");
          // 환율 갱신 후 시뮬레이터 및 차트 바로 재계산
          runSim();
        }
      }
    } catch (e) {
      console.warn("실시간 환율 로딩 실패, 기본 입력값 유지:", e);
    }
  }

  // 📊 2. Chart.js 차트 그리기/업데이트 함수
  function updateChart(divDataPoints, spDataPoints, years) {
    const chartContainer = document.querySelector(".sim-chart-wrap");
    if (!chartContainer) return;

    // 차트용 canvas 생성 및 확인
    let canvas = chartContainer.querySelector("canvas");
    if (!canvas) {
      chartContainer.innerHTML = '<canvas id="simCanvas" style="max-height: 280px; width: 100%;"></canvas>';
      canvas = document.getElementById("simCanvas");
    }

    // Chart.js 라이브러리가 로드되었는지 체크
    if (typeof Chart === "undefined") return;

    const labels = Array.from({ length: years + 1 }, (_, i) => `${i}년후`);

    // 기존 차트가 있다면 파괴 후 다시 생성 (메모리 누수 방지)
    if (simChartInstance) {
      simChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    simChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "배당 자산 성장",
            data: divDataPoints,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 2
          },
          {
            label: "S&P 500 자산 성장",
            data: spDataPoints,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#94a3b8", font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ₩${Math.round(context.raw).toLocaleString("ko-KR")}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8" }
          },
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "#94a3b8",
              callback: (val) => "₩" + (val / 10000).toLocaleString("ko-KR") + "만"
            }
          }
        }
      }
    });
  }

  // 📈 3. 메인 시뮬레이터 연산
  function runSim() {
    // -----------------------------------------------------
    // A. 배당 시뮬레이터 연산
    // -----------------------------------------------------
    const reinvest = document.getElementById("dividend-reinvest")?.checked ?? true;
    const divInit = parseSimNum(document.getElementById("dividend-initial")?.value);
    const divMonthly = parseSimNum(document.getElementById("dividend-monthly")?.value);
    const divYield = parseSimNum(document.getElementById("dividend-yield")?.value) / 100;
    const divYears = parseSimNum(document.getElementById("dividend-years")?.value) || 1;

    let divTotal = divInit;
    let divIncome = 0;
    const mYield = divYield / 12;

    const divYearlyData = [divInit]; // 차트용 데이터 배열

    for (let m = 1; m <= divYears * 12; m++) {
      const curDiv = divTotal * mYield;
      divIncome += curDiv;
      if (reinvest) divTotal += curDiv;
      divTotal += divMonthly;

      // 12개월(1년) 단위로 차트 포인트 저장
      if (m % 12 === 0) {
        divYearlyData.push(divTotal);
      }
    }

    const divTotalEl = document.getElementById("dividend-total");
    const divIncomeEl = document.getElementById("dividend-income");
    if (divTotalEl) divTotalEl.textContent = formatSimKRW(divTotal);
    if (divIncomeEl) divIncomeEl.textContent = formatSimKRW(divIncome);

    // -----------------------------------------------------
    // B. S&P 500 시뮬레이터 연산
    // -----------------------------------------------------
    const spInit = parseSimNum(document.getElementById("sp-initial")?.value);
    const spMonthly = parseSimNum(document.getElementById("sp-monthly")?.value);
    const spFx = parseSimNum(document.getElementById("sp-exchange-rate")?.value) || 1350;
    const spReturn = parseSimNum(document.getElementById("sp-return")?.value) / 100;
    const spYears = parseSimNum(document.getElementById("sp-years")?.value) || 1;

    let spTotalUsd = spInit;
    let spContribUsd = spInit + (spMonthly * spYears * 12);
    const mReturn = spReturn / 12;

    const spYearlyData = [spInit * spFx]; // 차트용 데이터 배열 (원화 변환)

    for (let m = 1; m <= spYears * 12; m++) {
      spTotalUsd = spTotalUsd * (1 + mReturn) + spMonthly;

      // 12개월(1년) 단위로 차트 포인트 저장
      if (m % 12 === 0) {
        spYearlyData.push(spTotalUsd * spFx);
      }
    }

    const spTotalEl = document.getElementById("sp-total");
    const spContribEl = document.getElementById("sp-contribution");
    if (spTotalEl) spTotalEl.textContent = formatSimKRW(spTotalUsd * spFx);
    if (spContribEl) spContribEl.textContent = formatSimKRW(spContribUsd * spFx);

    // -----------------------------------------------------
    // C. 차트 실시간 연동
    // -----------------------------------------------------
    const maxYears = Math.max(divYears, spYears);
    updateChart(divYearlyData, spYearlyData, maxYears);
  }

  function applyInitialFormatting() {
    const simSection = document.getElementById("simulators");
    if (simSection) {
      const inputs = simSection.querySelectorAll("input");
      inputs.forEach(input => formatInputWithCommas(input));
    }
  }

  // 초기 로드 실행
  setTimeout(() => {
    applyInitialFormatting();
    fetchLiveExchangeRate(); // 실시간 환율 자동 가져오기
    runSim();
  }, 100);

  // 입력 감지 시 실시간 재계산 & 차트 업데이트
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
