// =========================================================
// 🚀 대시보드 통합 관리 & 원리금 자동 차감 엔진 (code.js)
// =========================================================

(function initDashboardApp() {
  let transactions = JSON.parse(localStorage.getItem("portfolio_txs") || "[]");
  let liveUsdKrwRate = 1400; // 기본 환율
  let allocationChartInstance = null;

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
      console.warn("환율 수신 지연, 기본 환율(1,400원) 적용 중");
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
  if (openBtn) openBtn.onclick = () => modal.showModal();
  if (closeBtn) closeBtn.onclick = () => modal.close();
  if (cancelBtn) cancelBtn.onclick = () => modal.close();

  // 대출 선택 시 입력 폼 변경 처리
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      const isLoan = e.target.value === "대출";
      const assetFields = document.querySelectorAll(".asset-field");
      const loanFields = document.querySelectorAll(".loan-field");
      const typeLabel = document.getElementById("type-label");

      assetFields.forEach(f => f.style.display = isLoan ? "none" : "flex");
      loanFields.forEach(f => f.style.display = isLoan ? "flex" : "none");
      if (typeLabel) typeLabel.style.display = isLoan ? "none" : "flex";
    });
  }

  // 거래/대출 등록 저장
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const category = formData.get("category");
      const isLoan = category === "대출";

      let newTx = {
        id: Date.now(),
        date: formData.get("date"),
        category: category,
        name: formData.get("name").trim(),
        currency: formData.get("currency")
      };

      if (isLoan) {
        newTx.type = "LOAN";
        newTx.loanAmount = parseFloat(formData.get("loanAmount")) || 0;
        newTx.interestRate = parseFloat(formData.get("interestRate")) || 0;
        newTx.loanTermMonths = parseInt(formData.get("loanTermMonths")) || 12;
        newTx.quantity = 1;
        newTx.price = newTx.loanAmount;
        newTx.currentPrice = newTx.loanAmount;
      } else {
        newTx.type = formData.get("type");
        newTx.quantity = parseFloat(formData.get("quantity")) || 0;
        newTx.price = parseFloat(formData.get("price")) || 0;
        newTx.currentPrice = parseFloat(formData.get("currentPrice")) || 0;
      }

      transactions.push(newTx);
      saveAndRender();
      form.reset();
      if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
      modal.close();
    };
  }

  // 삭제
  window.deleteTransaction = function(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveAndRender();
  };

  function saveAndRender() {
    localStorage.setItem("portfolio_txs", JSON.stringify(transactions));
    renderAll();
  }

  // 3️⃣ 💡 원리금 균등상환 잔액 계산 수식 함수
  function calculateLoanStatus(startDateStr, principal, annualRatePercent, totalMonths) {
    if (!principal || principal <= 0) return { currentBalance: 0, monthlyPayment: 0, passedMonths: 0 };

    const startDate = new Date(startDateStr);
    const now = new Date();

    // 경과된 개월 수 계산
    let passedMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    if (now.getDate() < startDate.getDate()) passedMonths -= 1; // 일자 미달 시 1개월 차감
    passedMonths = Math.max(0, Math.min(passedMonths, totalMonths));

    const monthlyRate = (annualRatePercent / 100) / 12;
    
    // 월 원리금 상환액 계산 (PMT 공식)
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    } else {
      monthlyPayment = principal / totalMonths;
    }

    // 경과 개월 수에 따른 남은 원금 잔액 산출
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
        // 원리금 자동 계산 반영
        const loanStatus = calculateLoanStatus(tx.date, tx.loanAmount, tx.interestRate, tx.loanTermMonths);
        
        holdingsMap[`loan_${tx.id}`] = {
          id: tx.id,
          name: tx.name,
          category: "대출",
          currency: tx.currency,
          qty: 1,
          avgPrice: tx.loanAmount,
          currentPrice: loanStatus.currentBalance, // 경과에 따라 감소된 대출 잔액
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

      // 일반 자산 / 부동산
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
          currentPrice: tx.currentPrice
        };
      }

      const item = holdingsMap[itemKey];
      item.currentPrice = tx.currentPrice;

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

  // 5️⃣ 메인 요약 대시보드
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
        totalDebtKrw += valKrw; // 현재 상환 후 남은 대출 잔액 반영
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

  // 6️⃣ 자산 배분 도넛 차트
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

  // 7️⃣ 통합 렌더링
  function renderAll() {
    const { holdingsMap, realizedPnl } = processPortfolio();
    const activeHoldings = Object.values(holdingsMap).filter(h => h.qty > 0 && h.currentPrice > 0);

    updateHeroOverview(activeHoldings);
    renderAllocationChart(activeHoldings);

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
              <td><button onclick="deleteTransaction(${t.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button></td>
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
                <td colspan="2" style="color:#cbd5e1;">월 상환액: <b style="color:#ef4444;">₩${Math.round(info.monthlyPayment).toLocaleString("ko-KR")}</b> <small>(${info.rate}%)</small></td>
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
              <td style="color:${colorKrw}"><b>${profitRateKrw.toFixed(2)}%</b></td>
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
  });
})();
