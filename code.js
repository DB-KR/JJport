// =========================================================
// 📈 투자 시뮬레이터 + 독립 차트(Chart.js) + 실시간 환율 연동
// =========================================================

(function initSplitSimulators() {
  let divChartInstance = null; // 배당 차트 인스턴스
  let spChartInstance = null;  // S&P 500 차트 인스턴스

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

  // 📊 개별 차트 생성/업데이트 공통 함수
  function renderSingleChart(chartId, instanceRef, labels, data, labelName, colorHex, bgRgba) {
    const canvas = document.getElementById(chartId);
    if (!canvas || typeof Chart === "undefined") return instanceRef;

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
    // -----------------------------------------------------
    // 1. [좌측] 배당 시뮬레이터 연산 및 차트
    // -----------------------------------------------------
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

    // 배당 차트 렌더링
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

    // -----------------------------------------------------
    // 2. [우측] S&P 500 시뮬레이터 연산 및 차트
    // -----------------------------------------------------
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

    // S&P 500 차트 렌더링
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

  // 초기 실행
  setTimeout(() => {
    applyInitialFormatting();
    fetchLiveExchangeRate();
    runSim();
  }, 100);

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
