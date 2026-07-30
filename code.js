// =========================================================
// 🚀 대시보드 통합 관리 & 보유자산 수정/삭제 엔진 (code.js)
// =========================================================

(function initDashboardApp() {
  let transactions = JSON.parse(localStorage.getItem("portfolio_txs") || "[]");
  let liveUsdKrwRate = 1400; // 기본 환율
  let allocationChartInstance = null;
  let divChartInstance = null;
  let spChartInstance = null;

  // 자산 분류별 테마 색상
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

  // 1️⃣ 실시간 환율 정보
  async function fetchLiveRate() {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.KRW) liveUsdKrwRate = data.rates.KRW;
      }
    } catch (e) {
      console.warn("환율 수신 지연, 기본 환율 적용 중");
    }
  }

  // 2️⃣ 모달 제어 및 대출 필드 동적 전환
  const modal = document.getElementById("tx-modal");
  const openBtn = document.getElementById("open-tx-modal");
  const closeBtn = document.getElementById("close-tx-modal");
  const cancelBtn = document.getElementById("cancel-tx-modal");
  const form = document.getElementById("tx-form");
  const dateInput = document.getElementById("tx-date");
  const categorySelect = document.getElementById("tx-category");

  if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
  
  if (openBtn) {
    openBtn.onclick = () => {
      form.reset();
      document.getElementById("edit-tx-id").value = "";
      document.getElementById("modal-eyebrow").textContent = "NEW RECORD";
      document.getElementById("modal-title").textContent = "자산 / 대출 기록하기";
      document.getElementById("save-btn").textContent = "기록 저장";
      toggleFields(categorySelect.value.includes("대출"));
      if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
      modal.showModal();
    };
  }

  if (closeBtn) closeBtn.onclick = () => modal.close();
  if (cancelBtn) cancelBtn.onclick = () => modal.close();

  function toggleFields(isLoan) {
    const assetFields = document.querySelectorAll(".asset-field");
    const loanFields = document.querySelectorAll(".loan-field");
    const typeLabel = document.getElementById("type-label");

    assetFields.forEach(f => f.style.display = isLoan ? "none" : "flex");
    loanFields.forEach(f => f.style.display = isLoan ? "flex" : "none");
    if (typeLabel) typeLabel.style.display = isLoan ? "none" : "flex";
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      toggleFields(e.target.value.includes("대출"));
    });
  }

  // 저장 (신규 등록 및 수정 분기)
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const editId = document.getElementById("edit-tx-id").value;
      const category = formData.get("category");
      const isLoan = category.includes("대출") || category === "대출";

      let txData = {
        id: editId ? parseInt(editId) : Date.now(),
        date: formData.get("date"),
        category: isLoan ? "대출" : category,
        name: formData.get("name").trim(),
        currency: formData.get("currency")
      };

      if (isLoan) {
        txData.type = "LOAN";
        txData.loanAmount = parseFloat(formData.get("loanAmount")) || 0;
        txData.interestRate = parseFloat(formData.get("interestRate")) || 0;
        txData.loanTermMonths = parseInt(formData.get("loanTermMonths")) || 12;
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

  // 거래/자산 삭제
  window.deleteTransaction = function(id) {
    if (confirm("정말 이 자산/거래 기록을 삭제하시겠습니까?")) {
      transactions = transactions.filter(t => t.id !== id);
      saveAndRender();
    }
  };

  // 보유 자산 수정 모달 호출
  window.editTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById("edit-tx-id").value = tx.id;
    document.getElementById("modal-eyebrow").textContent = "EDIT RECORD";
    document.getElementById("modal-title").textContent = "자산 / 대출 수정하기";
    document.getElementById("save-btn").textContent = "수정 완료";

    document.getElementById("tx-date").value = tx.date;
    document.getElementById("tx-category").value = tx.category === "대출" ? "대출" : tx.category;
    document.getElementById("tx-name").value = tx.name;
    document.getElementById("tx-currency").value = tx.currency;

    const isLoan = tx.category === "대출";
    toggleFields(isLoan);

    if (isLoan) {
      document.getElementById("tx-loan-amount").value = tx.loanAmount || tx.price || 0;
      document.getElementById("tx-loan-rate").value = tx.interestRate || 0;
      document.getElementById("tx-loan-term").value = tx.loanTermMonths || 12;
    } else {
      document.getElementById("tx-type").value = tx.type || "BUY";
      document.getElementById("tx-qty").value = tx.quantity || 1;
      document.getElementById("tx-price").value = tx.price || 0;
      document.getElementById("tx-curr-price").value = tx.currentPrice || 0;
      document.getElementById("tx-div-rate").value = tx.dividendRate || 0;
    }

    modal.showModal();
  };

  function saveAndRender() {
    localStorage.setItem("portfolio_txs", JSON.stringify(transactions));
    renderAll();
  }

  // 3️⃣ 원리금 균등상환 계산
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
      monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    } else {
      monthlyPayment = principal / totalMonths;
    }

    let currentBalance = principal;
    for (let i = 0; i < passedMonths; i++) {
      const interestForMonth = currentBalance * monthlyRate;
      const principalRepaid = monthlyPayment - interestForMonth;
      currentBalance -= principalRepaid;
    }

    return {
      currentBalance: Math.max(0, currentBalance),
      monthlyPayment: monthlyPayment,
      passedMonths: passedMonths
    };
  }

  // 4️⃣ 포트폴리오 정산 연산 Engine
  function processPortfolio() {
    const holdingsMap = {};
    const realizedPnl = { month: { krw: 0, usd: 0 }, quarter: { krw: 0, usd: 0 }, year: { krw: 0, usd: 0 } };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);

    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
      const isUsd = tx.currency === "USD";

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

      const isUniqueAsset = tx.category === "부동산";
      const itemKey = isUniqueAsset ? `${tx.name}_${tx.id}` : tx.name;

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
        const sellQty = Math.min(tx.quantity, item.qty);
        const pnlPerUnit = tx.price - item.avgPrice;
        const profit = pnlPerUnit * sellQty;

        const txDate = new Date(tx.date);
        const profitUsd = isUsd ? profit : profit / liveUsdKrwRate;
        const profitKrw = isUsd ? profit * liveUsdKrwRate : profit;

        if (txDate.getFullYear() === currentYear) {
          realizedPnl.year.usd += profitUsd;
          realizedPnl.year.krw += profitKrw;
          if (Math.floor(txDate.getMonth() / 3) === currentQuarter) {
            realizedPnl.quarter.usd += profitUsd;
            realizedPnl.quarter.krw += profitKrw;
          }
          if (txDate.getMonth() === currentMonth) {
            realizedPnl.month.usd += profitUsd;
            realizedPnl.month.krw += profitKrw;
          }
        }
        item.qty -= sellQty;
      }
    });

    return { holdingsMap, realizedPnl };
  }

  // 5️⃣ 패시브 인컴(배당/이자) 연산
  function calculatePassiveIncome(activeHoldings) {
    let annualIncomeKrw = 0;
    let totalInvestedValueKrw = 0;

    activeHoldings.forEach(h => {
      if (h.category === "대출") return;

      const isUsd = h.currency === "USD";
      const valKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
      
      if (h.category !== "현금") {
        totalInvestedValueKrw += valKrw;
      }

      if (h.dividendRate && h.dividendRate > 0) {
        annualIncomeKrw += valKrw * (h.dividendRate / 100);
      }
    });

    const monthlyIncomeKrw = annualIncomeKrw / 12;
    const portfolioYield = totalInvestedValueKrw > 0 ? (annualIncomeKrw / totalInvestedValueKrw) * 100 : 0;

    const monthlyEl = document.getElementById("monthly-income-text");
    const annualEl = document.getElementById("annual-income-detail");
    const yieldEl = document.getElementById("portfolio-yield-text");

    if (monthlyEl) monthlyEl.textContent = "₩" + Math.round(monthlyIncomeKrw).toLocaleString("ko-KR");
    if (annualEl) annualEl.textContent = `연간 총 ₩${Math.round(annualIncomeKrw).toLocaleString("ko-KR")} 예상`;
    if (yieldEl) yieldEl.textContent = `${portfolioYield.toFixed(2)}%`;
  }

  // 6️⃣ 시뮬레이터 로직 (배당 & S&P500)
  function parseVal(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return parseFloat(el.value.replace(/,/g, "")) || 0;
  }

  function initSimulators() {
    const formatInputs = ["dividend-initial", "dividend-monthly", "sp-initial", "sp-monthly", "sp-exchange-rate", "target-amount"];
    formatInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", (e) => {
          let val = e.target.value.replace(/[^0-9]/g, "");
          if (val) e.target.value = parseInt(val, 10).toLocaleString("ko-KR");
          else e.target.value = "";
          updateSimulators();
        });
      }
    });

    const otherInputs = ["dividend-yield", "dividend-years", "dividend-reinvest", "sp-return", "sp-years"];
    otherInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", updateSimulators);
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
    const reinvest = document.getElementById("dividend-reinvest")?.checked ?? true;

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

    const totalEl = document.getElementById("dividend-total");
    const incomeEl = document.getElementById("dividend-income");
    if (totalEl) totalEl.textContent = "₩" + Math.round(total).toLocaleString("ko-KR");
    if (incomeEl) incomeEl.textContent = "₩" + Math.round(totalCumDiv).toLocaleString("ko-KR");

    renderSimChart("divCanvas", divChartInstance, labels, totalData, "#55dfb2", (inst) => divChartInstance = inst);
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

    const totalEl = document.getElementById("sp-total");
    const contribEl = document.getElementById("sp-contribution");
    if (totalEl) totalEl.textContent = "₩" + Math.round(totalUsd * fx).toLocaleString("ko-KR");
    if (contribEl) contribEl.textContent = "₩" + Math.round(totalContribUsd * fx).toLocaleString("ko-KR");

    renderSimChart("spCanvas", spChartInstance, labels, totalData, "#818cf8", (inst) => spChartInstance = inst);
  }

  function renderSimChart(canvasId, instance, labels, data, color, setInst) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    if (instance) instance.destroy();

    const ctx = canvas.getContext("2d");
    const newInst = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "예상 자산",
          data: data,
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

        if (h.category === "현금") {
          cashValueKrw += valKrw;
        } else {
          investedValueKrw += valKrw;
        }
      }
    });

    const netWorthKrw = totalAssetKrw - totalDebtKrw;
    const totalUnrealizedProfitKrw = (totalAssetKrw - totalCostKrw);

    const netWorthEl = document.getElementById("net-worth");
    const investedEl = document.getElementById("invested-value");
    const cashEl = document.getElementById("cash-value");

    if (netWorthEl) netWorthEl.textContent = "₩" + Math.round(netWorthKrw).toLocaleString("ko-KR");
    if (investedEl) investedEl.textContent = "₩" + Math.round(investedValueKrw).toLocaleString("ko-KR");
    if (cashEl) cashEl.textContent = "₩" + Math.round(cashValueKrw).toLocaleString("ko-KR");

    const profitEl = document.getElementById("monthly-profit");
    const detailEl = document.getElementById("monthly-detail");
    if (profitEl) {
      const sign = totalUnrealizedProfitKrw >= 0 ? "+" : "";
      profitEl.textContent = `${sign}₩${Math.round(totalUnrealizedProfitKrw).toLocaleString("ko-KR")}`;
      profitEl.style.color = totalUnrealizedProfitKrw >= 0 ? "#10b981" : "#ef4444";
    }
    if (detailEl) {
      const rate = totalCostKrw > 0 ? (totalUnrealizedProfitKrw / totalCostKrw) * 100 : 0;
      detailEl.textContent = `총 수익률: ${rate.toFixed(2)}%`;
    }

    const targetInput = document.getElementById("target-amount");
    const percentText = document.getElementById("goal-percent-text");
    const remainingText = document.getElementById("goal-remaining-text");
    const barFill = document.getElementById("goal-bar-fill");

    if (targetInput) {
      const rawTarget = parseFloat(targetInput.value.replace(/,/g, "")) || 0;
      if (rawTarget > 0) {
        const progress = Math.min(Math.max((netWorthKrw / rawTarget) * 100, 0), 100);
        const remaining = Math.max(rawTarget - netWorthKrw, 0);

        if (percentText) percentText.textContent = `${progress.toFixed(1)}%`;
        if (remainingText) remainingText.textContent = `목표까지 ₩${Math.round(remaining).toLocaleString("ko-KR")} 남음`;
        if (barFill) barFill.style.width = `${progress}%`;
      }
    }
  }

  // 8️⃣ 자산 배분 도넛 차트
  function renderAllocationChart(activeHoldings) {
    const canvas = document.getElementById("allocationCanvas");
    const legendEl = document.getElementById("legend");
    const countEl = document.getElementById("asset-count");

    const validHoldings = activeHoldings.filter(h => h.category !== "대출");
    if (countEl) countEl.textContent = validHoldings.length;
    if (!canvas || typeof Chart === "undefined") return;

    const catTotals = {};
    let grandTotal = 0;

    validHoldings.forEach(h => {
      const isUsd = h.currency === "USD";
      const valKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
      catTotals[h.category] = (catTotals[h.category] || 0) + valKrw;
      grandTotal += valKrw;
    });

    const labels = Object.keys(catTotals);
    const dataValues = Object.values(catTotals);
    const backgroundColors = labels.map(l => categoryColors[l] || "#94a3b8");

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

    if (allocationChartInstance) allocationChartInstance.destroy();

    const ctx = canvas.getContext("2d");
    allocationChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{ data: dataValues, backgroundColor: backgroundColors, borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ₩${Math.round(ctx.raw).toLocaleString("ko-KR")}` }
          }
        }
      }
    });
  }

  // 9️⃣ 전체 렌더링
  function renderAll() {
    const { holdingsMap, realizedPnl } = processPortfolio();
    const activeHoldings = Object.values(holdingsMap).filter(h => h.qty > 0 && h.currentPrice >= 0);

    updateHeroOverview(activeHoldings);
    renderAllocationChart(activeHoldings);
    calculatePassiveIncome(activeHoldings);

    // 내역 테이블
    const txBody = document.getElementById("tx-history-body");
    if (txBody) {
      if (transactions.length === 0) {
        txBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:20px;">기록된 거래 내역이 없습니다.</td></tr>`;
      } else {
        txBody.innerHTML = [...transactions].reverse().map(t => {
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
    }

    // 보유 자산 / 대출 잔액 테이블
    const holdingsBody = document.getElementById("holdings-body");
    const emptyState = document.getElementById("empty-state");

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
          const costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;

          if (isLoan) {
            const info = h.loanInfo;
            return `
              <tr style="background: rgba(239, 68, 68, 0.05);">
                <td><b>${h.name}</b></td>
                <td><small style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 6px; border-radius:4px;">대출(부채)</small></td>
                <td>${info.passedMonths}/${info.totalMonths}회차</td>
                <td>₩${Math.round(info.initialPrincipal).toLocaleString("ko-KR")}</td>
                <td><b style="color:#ef4444;">₩${Math.round(h.currentPrice).toLocaleString("ko-KR")}</b> <small>(잔액)</small></td>
                <td><b>-₩${Math.round(totalKrw).toLocaleString("ko-KR")}</b></td>
                <td style="color:#cbd5e1;">월 상환액: <b style="color:#ef4444;">₩${Math.round(info.monthlyPayment).toLocaleString("ko-KR")}</b></td>
                <td>
                  <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:6px;">수정</button>
                  <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
                </td>
              </tr>
            `;
          }

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
              <td><b>₩${Math.round(totalKrw).toLocaleString("ko-KR")}</b></td>
              <td style="color:${colorKrw}"><b>${profitRateKrw.toFixed(2)}%</b><br/><small>₩${Math.round(profitKrw).toLocaleString("ko-KR")}</small></td>
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
