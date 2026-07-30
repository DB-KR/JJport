// =========================================================
// 🚀 대시보드 통합 관리 & 엔진 (code.js)
// =========================================================

(function initDashboardApp() {
  let transactions = JSON.parse(localStorage.getItem("portfolio_txs") || "[]");
  let liveUsdKrwRate = 1400;
  let allocationChartInstance = null;
  let divChartInstance = null;
  let spChartInstance = null;

  const categoryColors = {
    "국내주식": "#6366f1",
    "해외주식": "#10b981",
    "ETF": "#f59e0b",
    "부동산": "#eab308",
    "채권": "#3b82f6",
    "가상자산": "#ec4899",
    "현금": "#64748b",
    "대출": "#ef4444"
  };

  const getEl = (id) => document.getElementById(id);
  const parseVal = (id) => parseFloat(getEl(id)?.value.replace(/,/g, "")) || 0;
  const formatKrw = (val) => "₩" + Math.round(val).toLocaleString("ko-KR");

  // 1️⃣ 30대 순자산 추정 상위 % 연산 로직 (가계금융복지조사 기준)
  function calculate30sPercentile(netWorth) {
    if (netWorth <= 0) return 99.9;

    const benchmarks = [
      [2000000000, 0.1],
      [1310000000, 1.0],
      [760000000, 5.0],
      [540000000, 10.0],
      [380000000, 20.0],
      [260000000, 30.0],
      [150000000, 50.0],
      [60000000, 70.0],
      [10000000, 90.0]
    ];

    if (netWorth >= benchmarks[0][0]) return 0.1;
    if (netWorth <= benchmarks[benchmarks.length - 1][0]) return 90.0;

    for (let i = 0; i < benchmarks.length - 1; i++) {
      const [highVal, highPct] = benchmarks[i];
      const [lowVal, lowPct] = benchmarks[i + 1];

      if (netWorth <= highVal && netWorth >= lowVal) {
        const ratio = (netWorth - lowVal) / (highVal - lowVal);
        const pct = lowPct - ratio * (lowPct - highPct);
        return Math.max(0.1, Math.min(99.9, pct));
      }
    }
    return 50.0;
  }

  // 2️⃣ rank-panel UI (상위 %, 게이지 바, 캡션) 업데이트
  function updateRankMeter(netWorth, hasAssets) {
    const rankPercentEl = getEl("rank-percent");
    const rankBarEl = getEl("rank-bar");
    const rankCaptionEl = getEl("rank-caption");

    if (!hasAssets || netWorth <= 0) {
      if (rankPercentEl) rankPercentEl.textContent = "—";
      if (rankBarEl) rankBarEl.style.width = "0%";
      if (rankCaptionEl) rankCaptionEl.textContent = "자산을 추가하면 비교해 드려요";
      return;
    }

    const percentile = calculate30sPercentile(netWorth);
    
    // 상위 % 텍스트 출력
    if (rankPercentEl) rankPercentEl.textContent = `${percentile.toFixed(1)}%`;
    
    // 게이지 바 채우기 (상위 1% = 99% 꽉 차게 계산)
    const barWidth = Math.max(2, Math.min(100, 100 - percentile));
    if (rankBarEl) rankBarEl.style.width = `${barWidth}%`;

    // 캡션 안내 문구 변경
    if (rankCaptionEl) {
      if (percentile <= 5) {
        rankCaptionEl.textContent = "30대 최상위권 순자산입니다! 🎉";
      } else if (percentile <= 20) {
        rankCaptionEl.textContent = "30대 평균을 훌쩍 넘어서는 자산입니다 🚀";
      } else if (percentile <= 50) {
        rankCaptionEl.textContent = "30대 상위 절반에 속해 있습니다 👍";
      } else {
        rankCaptionEl.textContent = "차근차근 자산을 늘려가는 중입니다 💪";
      }
    }
  }

  // 3️⃣ 실시간 환율 정보
  async function fetchLiveRate() {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.KRW) liveUsdKrwRate = data.rates.KRW;
      }
    } catch {
      console.warn("환율 수신 지연, 기본 환율 적용 중");
    }
  }

  // 4️⃣ 모달 제어 및 대출 필드 동적 전환
  const modal = getEl("tx-modal");
  const form = getEl("tx-form");
  const categorySelect = getEl("tx-category");

  if (getEl("tx-date")) getEl("tx-date").value = new Date().toISOString().substring(0, 10);

  function toggleFields(isLoan) {
    document.querySelectorAll(".asset-field").forEach(f => f.style.display = isLoan ? "none" : "flex");
    document.querySelectorAll(".loan-field").forEach(f => f.style.display = isLoan ? "flex" : "none");
    if (getEl("type-label")) getEl("type-label").style.display = isLoan ? "none" : "flex";
  }

  getEl("open-tx-modal")?.addEventListener("click", () => {
    form?.reset();
    getEl("edit-tx-id").value = "";
    getEl("modal-eyebrow").textContent = "NEW RECORD";
    getEl("modal-title").textContent = "자산 / 대출 기록하기";
    getEl("save-btn").textContent = "기록 저장";
    toggleFields(categorySelect.value.includes("대출"));
    if (getEl("tx-date")) getEl("tx-date").value = new Date().toISOString().substring(0, 10);
    modal?.showModal();
  });

  getEl("close-tx-modal")?.addEventListener("click", () => modal?.close());
  getEl("cancel-tx-modal")?.addEventListener("click", () => modal?.close());
  categorySelect?.addEventListener("change", (e) => toggleFields(e.target.value.includes("대출")));

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const editId = getEl("edit-tx-id").value;
      const category = formData.get("category");
      const isLoan = category.includes("대출") || category === "대출";

      const txData = {
        id: editId ? parseInt(editId, 10) : Date.now(),
        date: formData.get("date"),
        category: isLoan ? "대출" : category,
        name: formData.get("name").trim(),
        currency: formData.get("currency")
      };

      if (isLoan) {
        txData.type = "LOAN";
        txData.loanAmount = parseFloat(formData.get("loanAmount")) || 0;
        txData.interestRate = parseFloat(formData.get("interestRate")) || 0;
        txData.loanTermMonths = parseInt(formData.get("loanTermMonths"), 10) || 12;
        txData.quantity = 1;
        txData.price = txData.loanAmount;
        txData.currentPrice = txData.loanAmount;
      } else {
        txData.type = formData.get("type");
        txData.quantity = parseFloat(formData.get("quantity")) || 0;
        txData.price = parseFloat(formData.get("price")) || 0;
        txData.currentPrice = parseFloat(formData.get("currentPrice")) || 0;
        txData.dividendRate = parseFloat(formData.get("dividendRate")) || 0;
      }

      if (editId) {
        const idx = transactions.findIndex(t => t.id === txData.id);
        if (idx !== -1) transactions[idx] = txData;
      } else {
        transactions.push(txData);
      }

      saveAndRender();
      form.reset();
      modal.close();
    };
  }

  window.deleteTransaction = function(id) {
    if (confirm("정말 이 자산/거래 기록을 삭제하시겠습니까?")) {
      transactions = transactions.filter(t => t.id !== id);
      saveAndRender();
    }
  };

  window.editTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    getEl("edit-tx-id").value = tx.id;
    getEl("modal-eyebrow").textContent = "EDIT RECORD";
    getEl("modal-title").textContent = "자산 / 대출 수정하기";
    getEl("save-btn").textContent = "수정 완료";

    getEl("tx-date").value = tx.date;
    getEl("tx-category").value = tx.category === "대출" ? "대출" : tx.category;
    getEl("tx-name").value = tx.name;
    getEl("tx-currency").value = tx.currency;

    const isLoan = tx.category === "대출";
    toggleFields(isLoan);

    if (isLoan) {
      getEl("tx-loan-amount").value = tx.loanAmount || tx.price || 0;
      getEl("tx-loan-rate").value = tx.interestRate || 0;
      getEl("tx-loan-term").value = tx.loanTermMonths || 12;
    } else {
      getEl("tx-type").value = tx.type || "BUY";
      getEl("tx-qty").value = tx.quantity || 1;
      getEl("tx-price").value = tx.price || 0;
      getEl("tx-curr-price").value = tx.currentPrice || 0;
      getEl("tx-div-rate").value = tx.dividendRate || 0;
    }

    modal.showModal();
  };

  function saveAndRender() {
    localStorage.setItem("portfolio_txs", JSON.stringify(transactions));
    renderAll();
  }

  // 5️⃣ 원리금 균등상환 계산
  function calculateLoanStatus(startDateStr, principal, annualRatePercent, totalMonths) {
    if (!principal || principal <= 0) return { currentBalance: 0, monthlyPayment: 0, passedMonths: 0 };

    const startDate = new Date(startDateStr);
    const now = new Date();
    let passedMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    if (now.getDate() < startDate.getDate()) passedMonths -= 1;
    passedMonths = Math.max(0, Math.min(passedMonths, totalMonths));

    const monthlyRate = (annualRatePercent / 100) / 12;
    let monthlyPayment = 0;

    if (monthlyRate > 0) {
      const factor = Math.pow(1 + monthlyRate, totalMonths);
      monthlyPayment = principal * (monthlyRate * factor) / (factor - 1);
    } else {
      monthlyPayment = principal / totalMonths;
    }

    let currentBalance = principal;
    for (let i = 0; i < passedMonths; i++) {
      currentBalance -= (monthlyPayment - (currentBalance * monthlyRate));
    }

    return {
      currentBalance: Math.max(0, currentBalance),
      monthlyPayment,
      passedMonths
    };
  }

  // 6️⃣ 포트폴리오 정산 엔진
  function processPortfolio() {
    const holdingsMap = {};
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
      if (tx.category === "대출") {
        const loanStatus = calculateLoanStatus(tx.date, tx.loanAmount, tx.interestRate, tx.loanTermMonths);
        holdingsMap[`loan_${tx.id}`] = {
          id: tx.id,
          name: tx.name,
          category: "대출",
          currency: tx.currency,
          qty: 1,
          avgPrice: tx.loanAmount,
          currentPrice: loanStatus.currentBalance,
          loanInfo: {
            initialPrincipal: tx.loanAmount,
            monthlyPayment: loanStatus.monthlyPayment,
            passedMonths: loanStatus.passedMonths,
            totalMonths: tx.loanTermMonths,
            rate: tx.interestRate
          }
        };
        return;
      }

      const itemKey = tx.category === "부동산" ? `${tx.name}_${tx.id}` : tx.name;
      if (!holdingsMap[itemKey]) {
        holdingsMap[itemKey] = {
          id: tx.id,
          name: tx.name,
          category: tx.category,
          currency: tx.currency,
          qty: 0,
          avgPrice: 0,
          currentPrice: tx.currentPrice,
          dividendRate: tx.dividendRate || 0
        };
      }

      const item = holdingsMap[itemKey];
      item.currentPrice = tx.currentPrice;
      if (tx.dividendRate !== undefined) item.dividendRate = tx.dividendRate;

      if (tx.type === "BUY") {
        const totalCost = (item.qty * item.avgPrice) + (tx.quantity * tx.price);
        item.qty += tx.quantity;
        item.avgPrice = item.qty > 0 ? totalCost / item.qty : 0;
      } else if (tx.type === "SELL") {
        item.qty -= Math.min(tx.quantity, item.qty);
      }
    });

    return holdingsMap;
  }

  // 7️⃣ 메인 요약 대시보드
  function updateHeroOverview(activeHoldings) {
    let totalAssetKrw = 0;
    let totalDebtKrw = 0;
    let totalCostKrw = 0;
    let investedValueKrw = 0;
    let cashValueKrw = 0;

    activeHoldings.forEach(h => {
      const isUsd = h.currency === "USD";
      const valKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
      const costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;

      if (h.category === "대출") {
        totalDebtKrw += valKrw;
      } else {
        totalAssetKrw += valKrw;
        totalCostKrw += costKrw;
        if (h.category === "현금") cashValueKrw += valKrw;
        else investedValueKrw += valKrw;
      }
    });

    const netWorthKrw = totalAssetKrw - totalDebtKrw;
    const totalUnrealizedProfitKrw = totalAssetKrw - totalCostKrw;

    if (getEl("net-worth")) getEl("net-worth").textContent = formatKrw(netWorthKrw);
    if (getEl("invested-value")) getEl("invested-value").textContent = formatKrw(investedValueKrw);
    if (getEl("cash-value")) getEl("cash-value").textContent = formatKrw(cashValueKrw);

    // 🎯 rank-panel UI 연동 갱신
    updateRankMeter(netWorthKrw, activeHoldings.length > 0);

    const profitEl = getEl("monthly-profit");
    if (profitEl) {
      const sign = totalUnrealizedProfitKrw >= 0 ? "+" : "";
      profitEl.textContent = `${sign}${formatKrw(totalUnrealizedProfitKrw)}`;
      profitEl.style.color = totalUnrealizedProfitKrw >= 0 ? "#10b981" : "#ef4444";
    }

    if (getEl("monthly-detail")) {
      const rate = totalCostKrw > 0 ? (totalUnrealizedProfitKrw / totalCostKrw) * 100 : 0;
      getEl("monthly-detail").textContent = `총 수익률: ${rate.toFixed(2)}%`;
    }

    const rawTarget = parseVal("target-amount");
    if (rawTarget > 0) {
      const progress = Math.min(Math.max((netWorthKrw / rawTarget) * 100, 0), 100);
      const remaining = Math.max(rawTarget - netWorthKrw, 0);

      if (getEl("goal-percent-text")) getEl("goal-percent-text").textContent = `${progress.toFixed(1)}%`;
      if (getEl("goal-remaining-text")) getEl("goal-remaining-text").textContent = `목표까지 ${formatKrw(remaining)} 남음`;
      if (getEl("goal-bar-fill")) getEl("goal-bar-fill").style.width = `${progress}%`;
    }
  }

  // 8️⃣ 패시브 인컴 연산
  function calculatePassiveIncome(activeHoldings) {
    let annualIncomeKrw = 0;
    let totalInvestedValueKrw = 0;

    activeHoldings.forEach(h => {
      if (h.category === "대출") return;

      const valKrw = h.currency === "USD" ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
      if (h.category !== "현금") totalInvestedValueKrw += valKrw;
      if (h.dividendRate > 0) annualIncomeKrw += valKrw * (h.dividendRate / 100);
    });

    const monthlyIncomeKrw = annualIncomeKrw / 12;
    const portfolioYield = totalInvestedValueKrw > 0 ? (annualIncomeKrw / totalInvestedValueKrw) * 100 : 0;

    if (getEl("monthly-income-text")) getEl("monthly-income-text").textContent = formatKrw(monthlyIncomeKrw);
    if (getEl("annual-income-detail")) getEl("annual-income-detail").textContent = `연간 총 ${formatKrw(annualIncomeKrw)} 예상`;
    if (getEl("portfolio-yield-text")) getEl("portfolio-yield-text").textContent = `${portfolioYield.toFixed(2)}%`;
  }

  // 9️⃣ 시뮬레이터 로직
  function initSimulators() {
    ["dividend-initial", "dividend-monthly", "sp-initial", "sp-monthly", "sp-exchange-rate", "target-amount"].forEach(id => {
      getEl(id)?.addEventListener("input", (e) => {
        const val = e.target.value.replace(/[^0-9]/g, "");
        e.target.value = val ? parseInt(val, 10).toLocaleString("ko-KR") : "";
        updateSimulators();
      });
    });

    ["dividend-yield", "dividend-years", "dividend-reinvest", "sp-return", "sp-years"].forEach(id => {
      getEl(id)?.addEventListener("input", updateSimulators);
    });

    updateSimulators();
  }

  function updateSimulators() {
    updateDividendSim();
    updateSpSim();
  }

  function updateDividendSim() {
    const init = parseVal("dividend-initial");
    const monthly = parseVal("dividend-monthly");
    const rate = parseVal("dividend-yield") / 100;
    const years = parseVal("dividend-years");
    const reinvest = getEl("dividend-reinvest")?.checked ?? true;

    let total = init;
    let totalCumDiv = 0;
    const labels = ["0년"];
    const totalData = [init];

    for (let y = 1; y <= years; y++) {
      let annualDiv = 0;
      for (let m = 1; m <= 12; m++) {
        total += monthly;
        const mDiv = total * (rate / 12);
        annualDiv += mDiv;
        if (reinvest) total += mDiv;
      }
      totalCumDiv += annualDiv;
      labels.push(`${y}년`);
      totalData.push(Math.round(total));
    }

    if (getEl("dividend-total")) getEl("dividend-total").textContent = formatKrw(total);
    if (getEl("dividend-income")) getEl("dividend-income").textContent = formatKrw(totalCumDiv);

    renderSimChart("divCanvas", divChartInstance, labels, totalData, "#55dfb2", inst => divChartInstance = inst);
  }

  function updateSpSim() {
    const initUsd = parseVal("sp-initial");
    const monthlyUsd = parseVal("sp-monthly");
    const fx = parseVal("sp-exchange-rate") || 1400;
    const rate = parseVal("sp-return") / 100;
    const years = parseVal("sp-years");

    let totalUsd = initUsd;
    let totalContribUsd = initUsd;
    const labels = ["0년"];
    const totalData = [Math.round(initUsd * fx)];

    for (let y = 1; y <= years; y++) {
      for (let m = 1; m <= 12; m++) {
        totalUsd += monthlyUsd;
        totalContribUsd += monthlyUsd;
        totalUsd *= (1 + rate / 12);
      }
      labels.push(`${y}년`);
      totalData.push(Math.round(totalUsd * fx));
    }

    if (getEl("sp-total")) getEl("sp-total").textContent = formatKrw(totalUsd * fx);
    if (getEl("sp-contribution")) getEl("sp-contribution").textContent = formatKrw(totalContribUsd * fx);

    renderSimChart("spCanvas", spChartInstance, labels, totalData, "#818cf8", inst => spChartInstance = inst);
  }

  function renderSimChart(canvasId, instance, labels, data, color, setInst) {
    const canvas = getEl(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    if (instance) instance.destroy();

    const newInst = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "예상 자산",
          data,
          borderColor: color,
          backgroundColor: color + "22",
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#64748b" } },
          y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#64748b" } }
        }
      }
    });

    setInst(newInst);
  }

  // 🔟 자산 배분 도넛 차트
  function renderAllocationChart(activeHoldings) {
    const canvas = getEl("allocationCanvas");
    const legendEl = getEl("legend");
    const countEl = getEl("asset-count");

    const validHoldings = activeHoldings.filter(h => h.category !== "대출");
    if (countEl) countEl.textContent = validHoldings.length;
    if (!canvas || typeof Chart === "undefined") return;

    const catTotals = {};
    let grandTotal = 0;

    validHoldings.forEach(h => {
      const valKrw = h.currency === "USD" ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
      catTotals[h.category] = (catTotals[h.category] || 0) + valKrw;
      grandTotal += valKrw;
    });

    const labels = Object.keys(catTotals);
    const dataValues = Object.values(catTotals);
    const backgroundColors = labels.map(l => categoryColors[l] || "#94a3b8");

    if (legendEl) {
      legendEl.innerHTML = labels.length === 0
        ? `<li style="color: #64748b;">등록된 자산이 없습니다.</li>`
        : labels.map((cat, idx) => {
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

    if (allocationChartInstance) allocationChartInstance.destroy();

    allocationChartInstance = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data: dataValues, backgroundColor: backgroundColors, borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${formatKrw(ctx.raw)}` } }
        }
      }
    });
  }

  // 1️⃣1️⃣ 전체 렌더링
  function renderAll() {
    const holdingsMap = processPortfolio();
    const activeHoldings = Object.values(holdingsMap).filter(h => h.qty > 0 && h.currentPrice >= 0);

    updateHeroOverview(activeHoldings);
    renderAllocationChart(activeHoldings);
    calculatePassiveIncome(activeHoldings);

    // 내역 테이블
    const txBody = getEl("tx-history-body");
    if (txBody) {
      txBody.innerHTML = transactions.length === 0
        ? `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:20px;">기록된 거래 내역이 없습니다.</td></tr>`
        : [...transactions].reverse().map(t => {
            const isLoan = t.category === "대출";
            const symbol = t.currency === "USD" ? "$" : "₩";
            return `
              <tr>
                <td>${t.date}</td>
                <td><span style="color:${isLoan ? '#ef4444' : (t.type === 'BUY' ? '#10b981' : '#ef4444')}; font-weight:bold;">${isLoan ? '대출실행' : (t.type === 'BUY' ? '매수' : '매도')}</span></td>
                <td><b>${t.name}</b></td>
                <td>${t.currency}</td>
                <td>${isLoan ? '1 (대출)' : t.quantity.toLocaleString("ko-KR")}</td>
                <td>${symbol}${(isLoan ? t.loanAmount : t.price).toLocaleString("ko-KR")}</td>
                <td>${symbol}${(isLoan ? t.loanAmount : t.quantity * t.price).toLocaleString("ko-KR")}</td>
                <td>
                  <button onclick="editTransaction(${t.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:8px;">수정</button>
                  <button onclick="deleteTransaction(${t.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
                </td>
              </tr>
            `;
          }).join("");
    }

    // 보유 자산 / 대출 잔액 테이블
    const holdingsBody = getEl("holdings-body");
    const emptyState = getEl("empty-state");

    if (holdingsBody) {
      if (activeHoldings.length === 0) {
        holdingsBody.innerHTML = "";
        if (emptyState) emptyState.style.display = "block";
      } else {
        if (emptyState) emptyState.style.display = "none";
        holdingsBody.innerHTML = activeHoldings.map(h => {
          const isLoan = h.category === "대출";
          const isUsd = h.currency === "USD";
          const totalKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;

          if (isLoan) {
            const info = h.loanInfo;
            return `
              <tr style="background: rgba(239, 68, 68, 0.05);">
                <td><b>${h.name}</b></td>
                <td><small style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 6px; border-radius:4px;">대출(부채)</small></td>
                <td>${info.passedMonths}/${info.totalMonths}회차</td>
                <td>${formatKrw(info.initialPrincipal)}</td>
                <td><b style="color:#ef4444;">${formatKrw(h.currentPrice)}</b> <small>(잔액)</small></td>
                <td><b>-${formatKrw(totalKrw)}</b></td>
                <td style="color:#cbd5e1;">월 상환액: <b style="color:#ef4444;">${formatKrw(info.monthlyPayment)}</b></td>
                <td>
                  <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:6px;">수정</button>
                  <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
                </td>
              </tr>
            `;
          }

          const costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;
          const profitKrw = totalKrw - costKrw;
          const profitRateKrw = costKrw > 0 ? (profitKrw / costKrw) * 100 : 0;
          const colorKrw = profitKrw >= 0 ? "#10b981" : "#ef4444";

          return `
            <tr>
              <td><b>${h.name}</b></td>
              <td><small style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${h.category}</small></td>
              <td>${h.qty.toLocaleString("ko-KR")}</td>
              <td>${isUsd ? '$' : '₩'}${h.avgPrice.toLocaleString("ko-KR")}</td>
              <td>${isUsd ? '$' : '₩'}${h.currentPrice.toLocaleString("ko-KR")}</td>
              <td><b>${formatKrw(totalKrw)}</b></td>
              <td style="color:${colorKrw}"><b>${profitRateKrw.toFixed(2)}%</b><br/><small>${formatKrw(profitKrw)}</small></td>
              <td>
                <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:6px;">수정</button>
                <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
              </td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  // 초기화
  window.addEventListener("load", async () => {
    await fetchLiveRate();
    renderAll();
    initSimulators();
  });
})();
