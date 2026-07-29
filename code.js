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
// 📈 투자 시뮬레이터 + 독립 차트(Chart.js) + 실시간 환율 연동
// =========================================================

(function initSplitSimulators() {
  let divChartInstance = null;
  let spChartInstance = null;

  function parseSimNum(val) {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, "").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  function formatSimKRW(num) {
    return "₩" + Math.round(num).toLocaleString("ko-KR");
  }

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

  // 💱 실시간 환율 연동
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
          runSim();
        }
      }
    } catch (e) {
      console.warn("실시간 환율 로딩 실패, 기본 입력값 유지:", e);
    }
  }

  // 📊 개별 차트 생성/업데이트 공통 함수 (Chart.js 미로드 시 오류 방지 처리)
  function renderSingleChart(chartId, instanceRef, labels, data, labelName, colorHex, bgRgba) {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js 라이브러리가 아직 로드되지 않았습니다.");
      return null;
    }

    const canvas = document.getElementById(chartId);
    if (!canvas) return instanceRef;

    if (instanceRef) {
      instanceRef.destroy();
    }

    const ctx = canvas.getContext("2d");
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: labelName,
          data: data,
          borderColor: colorHex,
          backgroundColor: bgRgba,
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ₩${Math.round(context.raw).toLocaleString("ko-KR")}`
            }
          }
        },
        scales: {
          x: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#94a3b8", font: { size: 10 } } },
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "#94a3b8",
              font: { size: 10 },
              callback: (val) => "₩" + (val / 10000).toLocaleString("ko-KR") + "만"
            }
          }
        }
      }
    });
  }

  // 📈 메인 계산 및 각 차트 개별 렌더링
  function runSim() {
    // 1. 배당 시뮬레이터 연산
    const reinvest = document.getElementById("dividend-reinvest")?.checked ?? true;
    const divInit = parseSimNum(document.getElementById("dividend-initial")?.value);
    const divMonthly = parseSimNum(document.getElementById("dividend-monthly")?.value);
    const divYield = parseSimNum(document.getElementById("dividend-yield")?.value) / 100;
    const divYears = parseSimNum(document.getElementById("dividend-years")?.value) || 1;

    let divTotal = divInit;
    let divIncome = 0;
    const mYield = divYield / 12;
    const divYearlyData = [divInit];

    for (let m = 1; m <= divYears * 12; m++) {
      const curDiv = divTotal * mYield;
      divIncome += curDiv;
      if (reinvest) divTotal += curDiv;
      divTotal += divMonthly;

      if (m % 12 === 0) divYearlyData.push(divTotal);
    }

    const divTotalEl = document.getElementById("dividend-total");
    const divIncomeEl = document.getElementById("dividend-income");
    if (divTotalEl) divTotalEl.textContent = formatSimKRW(divTotal);
    if (divIncomeEl) divIncomeEl.textContent = formatSimKRW(divIncome);

    const divLabels = Array.from({ length: divYears + 1 }, (_, i) => `${i}년`);
    divChartInstance = renderSingleChart(
      "divCanvas",
      divChartInstance,
      divLabels,
      divYearlyData,
      "배당 예상 자산",
      "#818cf8",
      "rgba(129, 140, 248, 0.15)"
    );

    // 2. S&P 500 시뮬레이터 연산
    const spInit = parseSimNum(document.getElementById("sp-initial")?.value);
    const spMonthly = parseSimNum(document.getElementById("sp-monthly")?.value);
    const spFx = parseSimNum(document.getElementById("sp-exchange-rate")?.value) || 1350;
    const spReturn = parseSimNum(document.getElementById("sp-return")?.value) / 100;
    const spYears = parseSimNum(document.getElementById("sp-years")?.value) || 1;

    let spTotalUsd = spInit;
    let spContribUsd = spInit + (spMonthly * spYears * 12);
    const mReturn = spReturn / 12;
    const spYearlyData = [spInit * spFx];

    for (let m = 1; m <= spYears * 12; m++) {
      spTotalUsd = spTotalUsd * (1 + mReturn) + spMonthly;
      if (m % 12 === 0) spYearlyData.push(spTotalUsd * spFx);
    }

    const spTotalEl = document.getElementById("sp-total");
    const spContribEl = document.getElementById("sp-contribution");
    if (spTotalEl) spTotalEl.textContent = formatSimKRW(spTotalUsd * spFx);
    if (spContribEl) spContribEl.textContent = formatSimKRW(spContribUsd * spFx);

    const spLabels = Array.from({ length: spYears + 1 }, (_, i) => `${i}년`);
    spChartInstance = renderSingleChart(
      "spCanvas",
      spChartInstance,
      spLabels,
      spYearlyData,
      "S&P 500 예상 자산",
      "#34d399",
      "rgba(52, 211, 153, 0.15)"
    );
  }

  function applyInitialFormatting() {
    const simSection = document.getElementById("simulators");
    if (simSection) {
      const inputs = simSection.querySelectorAll("input");
      inputs.forEach(input => formatInputWithCommas(input));
    }
  }

  // 초기 실행 (페이지 로드가 모두 완전히 끝난 후 안전하게 실행)
  window.addEventListener("load", () => {
    applyInitialFormatting();
    fetchLiveExchangeRate();
    runSim();
  });

  // 실시간 입력 감지
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

// =========================================================
// 🚀 [1, 2, 4 통합] 환율연동, 자산배분 도넛차트, 리밸런싱 계산기
// =========================================================

(function initAdvancedPortfolioFeatures() {
  let liveUsdKrwRate = 1400; // 기본 고정 환율 (API 로딩 전 백업)
  let allocationChartInstance = null;

  // 자산 분류별 테마 색상 정의
  const categoryColors = {
    "국내주식": "#6366f1",
    "해외주식": "#10b981",
    "ETF": "#f59e0b",
    "채권": "#3b82f6",
    "가상자산": "#ec4899",
    "현금": "#64748b"
  };

  // 1️⃣ 실시간 환율 수신
  async function updateExchangeRate() {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.KRW) {
          liveUsdKrwRate = data.rates.KRW;
        }
      }
    } catch (e) {
      console.warn("환율 수신 실패, 기본 환율 적용 중", e);
    }
  }

  // Helper: DOM에서 자산 테이블 데이터 읽어오기 (원화 변환 포함)
  function getHoldingsData() {
    const rows = document.querySelectorAll("#holdings-body tr");
    const holdings = [];

    rows.forEach(row => {
      const name = row.cells[0]?.textContent?.trim() || "";
      const category = row.dataset.category || "국내주식"; 
      const isUsd = row.dataset.currency === "USD" || category === "해외주식";
      
      const qty = parseFloat(row.dataset.quantity) || 0;
      const curPriceRaw = parseFloat(row.dataset.currentPrice) || 0;

      // 달러 가격인 경우 원화로 실시간 계산
      const curPriceKrw = isUsd ? curPriceRaw * liveUsdKrwRate : curPriceRaw;
      const totalValueKrw = qty * curPriceKrw;

      if (totalValueKrw > 0) {
        holdings.push({
          name,
          category,
          isUsd,
          totalValueKrw
        });
      }
    });

    return holdings;
  }

  // 2️⃣ 자산 배분 도넛 차트 시각화
  function renderAllocationChart(holdings) {
    const canvas = document.getElementById("allocationCanvas");
    const legendEl = document.getElementById("legend");
    const countEl = document.getElementById("asset-count");

    if (countEl) countEl.textContent = holdings.length;
    if (!canvas || typeof Chart === "undefined") return;

    // 카테고리별 합산
    const catTotals = {};
    let grandTotal = 0;

    holdings.forEach(h => {
      catTotals[h.category] = (catTotals[h.category] || 0) + h.totalValueKrw;
      grandTotal += h.totalValueKrw;
    });

    const labels = Object.keys(catTotals);
    const dataValues = Object.values(catTotals);
    const backgroundColors = labels.map(label => categoryColors[label] || "#94a3b8");

    // 범례(Legend) HTML 업데이트
    if (legendEl) {
      if (labels.length === 0) {
        legendEl.innerHTML = `<li style="color: #64748b;">등록된 자산이 없습니다.</li>`;
      } else {
        legendEl.innerHTML = labels.map((cat, idx) => {
          const ratio = grandTotal > 0 ? ((dataValues[idx] / grandTotal) * 100).toFixed(1) : 0;
          return `
            <li style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <i style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${backgroundColors[idx]};"></i>
                ${cat}
              </span>
              <strong style="color: #f8fafc;">${ratio}%</strong>
            </li>
          `;
        }).join("");
      }
    }

    // 도넛 차트 그려주기
    if (allocationChartInstance) {
      allocationChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    allocationChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ₩${Math.round(ctx.raw).toLocaleString("ko-KR")}`
            }
          }
        }
      }
    });
  }

  // 4️⃣ 포트폴리오 리밸런싱 계산기
  function renderRebalancingCalculator(holdings) {
    const inputsContainer = document.getElementById("rebalance-inputs");
    const totalRatioEl = document.getElementById("rebalance-total-ratio");
    const neededSumEl = document.getElementById("rebalance-needed-sum");
    const actionsListEl = document.getElementById("rebalance-actions-list");

    if (!inputsContainer) return;

    // 카테고리 목록 추출
    const categories = Object.keys(categoryColors);

    // 최초 1회만 입력 폼 바인딩
    if (!inputsContainer.dataset.initialized) {
      inputsContainer.dataset.initialized = "true";
      const defaultRatios = { "국내주식": 30, "해외주식": 40, "ETF": 10, "채권": 10, "현금": 10 };

      inputsContainer.innerHTML = categories.map(cat => `
        <label style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #94a3b8;">
          ${cat} 목표비중 (%)
          <input type="number" class="rebalance-target-input" data-category="${cat}" min="0" max="100" value="${defaultRatios[cat] || 0}" 
                 style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 6px 10px; color: #fff;" />
        </label>
      `).join("");

      inputsContainer.addEventListener("input", () => calculateRebalance(holdings));
    }

    calculateRebalance(holdings);

    function calculateRebalance(holdingsData) {
      // 1. 카테고리별 현재 총 가치 계산
      const catCurrentTotal = {};
      let totalPortfolioValue = 0;

      holdingsData.forEach(h => {
        catCurrentTotal[h.category] = (catCurrentTotal[h.category] || 0) + h.totalValueKrw;
        totalPortfolioValue += h.totalValueKrw;
      });

      // 2. 목표 비중 입력값 가져오기
      const targetInputs = document.querySelectorAll(".rebalance-target-input");
      let totalTargetRatio = 0;
      const targetRatios = {};

      targetInputs.forEach(input => {
        const cat = input.dataset.category;
        const val = parseFloat(input.value) || 0;
        targetRatios[cat] = val;
        totalTargetRatio += val;
      });

      if (totalRatioEl) {
        totalRatioEl.textContent = `${totalTargetRatio.toFixed(1)}%`;
        totalRatioEl.style.color = Math.abs(totalTargetRatio - 100) < 0.1 ? "#10b981" : "#ef4444";
      }

      if (totalPortfolioValue === 0) {
        if (actionsListEl) actionsListEl.innerHTML = `<p style="color: #64748b; margin: 0;">자산을 먼저 추가해 주세요.</p>`;
        if (neededSumEl) neededSumEl.textContent = "₩0";
        return;
      }

      // 3. 리밸런싱 가이드 계산
      let totalBuyNeeded = 0;
      const actionItems = [];

      categories.forEach(cat => {
        const currentVal = catCurrentTotal[cat] || 0;
        const targetRatio = targetRatios[cat] || 0;
        const targetVal = totalPortfolioValue * (targetRatio / 100);
        const diff = targetVal - currentVal;

        if (Math.abs(diff) > 1000) { // 1,000원 이상 차이 날 때만 표시
          if (diff > 0) {
            totalBuyNeeded += diff;
            actionItems.push(`<li><b>${cat}</b>: <span style="color: #10b981;">₩${Math.round(diff).toLocaleString("ko-KR")} 매수</span> 필요</li>`);
          } else {
            actionItems.push(`<li><b>${cat}</b>: <span style="color: #ef4444;">₩${Math.round(Math.abs(diff)).toLocaleString("ko-KR")} 매도</span> 필요</li>`);
          }
        }
      });

      if (neededSumEl) neededSumEl.textContent = "₩" + Math.round(totalBuyNeeded).toLocaleString("ko-KR");
      
      if (actionsListEl) {
        if (actionItems.length === 0) {
          actionsListEl.innerHTML = `<p style="color: #10b981; margin: 0;">🎉 현재 설정한 목표 비중에 완벽히 맞춰져 있습니다!</p>`;
        } else {
          actionsListEl.innerHTML = `<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; color: #cbd5e1;">${actionItems.join("")}</ul>`;
        }
      }
    }
  }

  // 메인 연동 통합 실행기
  function refreshAdvancedDashboard() {
    const holdings = getHoldingsData();
    renderAllocationChart(holdings);
    renderRebalancingCalculator(holdings);
  }

  // 초기화 및 이벤트 리스너 등록
  window.addEventListener("load", async () => {
    await updateExchangeRate();
    refreshAdvancedDashboard();

    // 보유 자산 변경 감지 (테이블 갱신 시 자동 리프레시)
    const tableBody = document.getElementById("holdings-body");
    if (tableBody) {
      const observer = new MutationObserver(() => refreshAdvancedDashboard());
      observer.observe(tableBody, { childList: true, subtree: true });
    }
  });
})();
