// =========================================================
// 🚀 대시보드 통합 관리 & 예/적금 만기 수령액 연산 엔진 (code.js)
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
    "예금": "#06b6d4",
    "적금": "#0284c7",
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

  // 2️⃣ 모달 제어 및 동적 필드 전환 (일반자산/대출/예적금)
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
      document.getElementById("modal-title").textContent = "자산 / 대출 / 예적금 기록하기";
      document.getElementById("save-btn").textContent = "기록 저장";
      toggleCategoryFields(categorySelect.value);
      if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
      modal.showModal();
    };
  }

  if (closeBtn) closeBtn.onclick = () => modal.close();
  if (cancelBtn) cancelBtn.onclick = () => modal.close();

  function toggleCategoryFields(category) {
    const isLoan = category === "대출";
    const isSavings = category === "예금" || category === "적금";

    const assetFields = document.querySelectorAll(".asset-field");
    const loanFields = document.querySelectorAll(".loan-field");
    const savingsFields = document.querySelectorAll(".savings-field");
    const typeLabel = document.getElementById("type-label");

    assetFields.forEach(f => f.style.display = (!isLoan && !isSavings) ? "flex" : "none");
    loanFields.forEach(f => f.style.display = isLoan ? "flex" : "none");
    savingsFields.forEach(f => f.style.display = isSavings ? "flex" : "none");
    if (typeLabel) typeLabel.style.display = isLoan ? "none" : "flex";
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      toggleCategoryFields(e.target.value);
    });
  }

  // 예/적금 만기일 및 만기 수령액 계산 함수
  function calculateSavingsDetails(startDateStr, category, amount, annualRate, months, taxTypeRate) {
    const startDate = new Date(startDateStr);
    const maturityDate = new Date(startDateStr);
    maturityDate.setMonth(maturityDate.getMonth() + months);

    const maturityDateStr = maturityDate.toISOString().substring(0, 10);
    const rate = annualRate / 100;
    let grossInterest = 0;
    let totalPrincipal = 0;

    if (category === "예금") {
      totalPrincipal = amount;
      grossInterest = totalPrincipal * rate * (months / 12);
    } else if (category === "적금") {
      totalPrincipal = amount * months;
      grossInterest = amount * (months * (months + 1) / 2) * (rate / 12);
    }

    const taxAmount = grossInterest * (taxTypeRate / 100);
    const netInterest = grossInterest - taxAmount;
    const totalPayout = totalPrincipal + netInterest;

    return {
      totalPrincipal,
      grossInterest,
      netInterest,
      taxAmount,
      totalPayout,
      maturityDateStr,
      maturityDateObj: maturityDate
    };
  }

  // 3️⃣ 저장 (신규 등록 및 수정 분기)
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const editId = document.getElementById("edit-tx-id").value;
      const category = formData.get("category");
      const isLoan = category === "대출";
      const isSavings = category === "예금" || category === "적금";

      let txData = {
        id: editId ? parseInt(editId) : Date.now(),
        date: formData.get("date"),
        category: category,
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
      } else if (isSavings) {
        txData.type = formData.get("type");
        txData.depositAmount = parseFloat(formData.get("depositAmount")) || 0;
        txData.savingsRate = parseFloat(formData.get("savingsRate")) || 0;
        txData.savingsMonths = parseInt(formData.get("savingsMonths")) || 12;
        txData.taxType = parseFloat(formData.get("taxType")) || 15.4;

        const calc = calculateSavingsDetails(
          txData.date, txData.category, txData.depositAmount, 
          txData.savingsRate, txData.savingsMonths, txData.taxType
        );

        txData.quantity = txData.savingsMonths;
        txData.price = txData.depositAmount;
        txData.currentPrice = calc.totalPayout; // 만기 수령액
        txData.maturityDate = calc.maturityDateStr;
        txData.netInterest = calc.netInterest;
        txData.totalPrincipal = calc.totalPrincipal;
      } else {
        txData.type = formData.get("type");
        txData.quantity = parseFloat(formData.get("quantity")) || 0;
        txData.price = parseFloat(formData.get("price")) || 0;
        txData.currentPrice = parseFloat(formData.get("currentPrice")) || 0;
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

  // 삭제
  window.deleteTransaction = function(id) {
    if (confirm("정말 이 자산/거래 기록을 삭제하시겠습니까?")) {
      transactions = transactions.filter(t => t.id !== id);
      saveAndRender();
    }
  };

  // 수정 모달 호출
  window.editTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById("edit-tx-id").value = tx.id;
    document.getElementById("modal-eyebrow").textContent = "EDIT RECORD";
    document.getElementById("modal-title").textContent = "자산 / 대출 / 예적금 수정하기";
    document.getElementById("save-btn").textContent = "수정 완료";

    document.getElementById("tx-date").value = tx.date;
    document.getElementById("tx-category").value = tx.category;
    document.getElementById("tx-name").value = tx.name;
    document.getElementById("tx-currency").value = tx.currency;

    toggleCategoryFields(tx.category);

    if (tx.category === "대출") {
      document.getElementById("tx-loan-amount").value = tx.loanAmount || tx.price || 0;
      document.getElementById("tx-loan-rate").value = tx.interestRate || 0;
      document.getElementById("tx-loan-term").value = tx.loanTermMonths || 12;
    } else if (tx.category === "예금" || tx.category === "적금") {
      document.getElementById("tx-type").value = tx.type || "BUY";
      document.getElementById("tx-deposit-amount").value = tx.depositAmount || 0;
      document.getElementById("tx-savings-rate").value = tx.savingsRate || 0;
      document.getElementById("tx-savings-months").value = tx.savingsMonths || 12;
      document.getElementById("tx-tax-type").value = tx.taxType || "15.4";
    } else {
      document.getElementById("tx-type").value = tx.type || "BUY";
      document.getElementById("tx-qty").value = tx.quantity || 1;
      document.getElementById("tx-price").value = tx.price || 0;
      document.getElementById("tx-curr-price").value = tx.currentPrice || 0;
    }

    modal.showModal();
  };

  function saveAndRender() {
    localStorage.setItem("portfolio_txs", JSON.stringify(transactions));
    renderAll();
  }

  // 4️⃣ 대출 원리금 균등상환 계산
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

  // 5️⃣ 포트폴리오 정산 연산 Engine (만기 예/적금 자동 현금 전환 기능 포함)
  function processPortfolio() {
    const holdingsMap = {};
    const realizedPnl = { month: { krw: 0, usd: 0 }, quarter: { krw: 0, usd: 0 }, year: { krw: 0, usd: 0 } };

    const now = new Date();
    // 오늘 날짜의 00:00:00 (시간 단위 비교 오차 방지)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);

    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
      const isUsd = tx.currency === "USD";

      // 대출 처리
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

      // 예금/적금 처리 (★ 만기 체크 로직 적용)
      if (tx.category === "예금" || tx.category === "적금") {
        const calc = calculateSavingsDetails(tx.date, tx.category, tx.depositAmount, tx.savingsRate, tx.savingsMonths, tx.taxType);
        
        // 만기일 자정 기준 비교
        const maturityDate = new Date(calc.maturityDateObj.getFullYear(), calc.maturityDateObj.getMonth(), calc.maturityDateObj.getDate());
        
        // 만기일이 오늘 포함 지났다면 보유 현금으로 이동
        if (today >= maturityDate) {
          const cashKey = tx.currency === "USD" ? "현금_USD" : "현금_KRW";
          if (!holdingsMap[cashKey]) {
            holdingsMap[cashKey] = {
              id: "auto_cash_" + tx.currency,
              name: "보유현금",
              category: "현금",
              currency: tx.currency,
              qty: 1,
              avgPrice: 0,
              currentPrice: 0
            };
          }
          // 만기 수령액(원금 + 세후이자)을 현금으로 더함
          holdingsMap[cashKey].currentPrice += calc.totalPayout;
          holdingsMap[cashKey].avgPrice += calc.totalPayout;
        } else {
          // 아직 만기가 되지 않은 예/적금만 보유 자산에 유지
          holdingsMap[`savings_${tx.id}`] = {
            id: tx.id,
            name: tx.name,
            category: tx.category,
            currency: tx.currency,
            qty: tx.savingsMonths,
            avgPrice: tx.category === "예금" ? tx.depositAmount : tx.depositAmount * tx.savingsMonths,
            currentPrice: calc.totalPayout, // 만기수령액
            savingsInfo: {
              depositAmount: tx.depositAmount,
              rate: tx.savingsRate,
              months: tx.savingsMonths,
              maturityDate: calc.maturityDateStr,
              netInterest: calc.netInterest,
              totalPrincipal: calc.totalPrincipal,
              totalPayout: calc.totalPayout
            }
          };
        }
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

  // 6️⃣ 메인 요약 대시보드
  function updateHeroOverview(activeHoldings) {
    let totalAssetKrw = 0;
    let totalDebtKrw = 0;
    let totalCostKrw = 0;
    let investedValueKrw = 0;
    let cashValueKrw = 0;

    activeHoldings.forEach(h => {
      const isUsd = h.currency === "USD";
      const isSavings = h.category === "예금" || h.category === "적금";

      let valKrw = 0;
      let costKrw = 0;

      if (isSavings) {
        valKrw = h.savingsInfo.totalPrincipal; // 순자산 산출 시에는 납입 원금 기준
        costKrw = h.savingsInfo.totalPrincipal;
      } else {
        valKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
        costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;
      }

      if (h.category === "대출") {
        totalDebtKrw += valKrw;
      } else {
        totalAssetKrw += valKrw;
        totalCostKrw += costKrw;

        if (h.category === "현금" || isSavings) {
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
      detailEl.textContent = `투자 자산 수익률: ${rate.toFixed(2)}%`;
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

  // 7️⃣ 자산 배분 차트
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
      const isSavings = h.category === "예금" || h.category === "적금";
      const valKrw = isSavings 
        ? h.savingsInfo.totalPrincipal 
        : (isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice);

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

  // 8️⃣ 전체 UI 렌더링
  function renderAll() {
    const { holdingsMap } = processPortfolio();
    const activeHoldings = Object.values(holdingsMap);

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
          const isSavings = t.category === "예금" || t.category === "적금";
          const symbol = t.currency === "USD" ? "$" : "₩";

          let qtyText = t.quantity;
          let priceText = t.price;
          let totalText = t.quantity * t.price;

          if (isLoan) {
            qtyText = "1 (대출)";
            priceText = t.loanAmount;
            totalText = t.loanAmount;
          } else if (isSavings) {
            qtyText = `${t.savingsMonths}개월`;
            priceText = t.depositAmount;
            totalText = t.category === "예금" ? t.depositAmount : t.depositAmount * t.savingsMonths;
          }

          return `
            <tr>
              <td>${t.date}</td>
              <td><span style="color:${isLoan ? '#ef4444' : '#10b981'}; font-weight:bold;">${isLoan ? '대출실행' : (isSavings ? '신규가입' : t.type)}</span></td>
              <td><b>${t.name}</b></td>
              <td>${t.currency}</td>
              <td>${typeof qtyText === 'number' ? qtyText.toLocaleString("ko-KR") : qtyText}</td>
              <td>${symbol}${priceText.toLocaleString("ko-KR")}</td>
              <td>${symbol}${totalText.toLocaleString("ko-KR")}</td>
              <td>
                <button onclick="editTransaction(${t.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:8px;">수정</button>
                <button onclick="deleteTransaction(${t.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
              </td>
            </tr>
          `;
        }).join("");
      }
    }

    // 보유 자산 / 예적금 / 대출 테이블
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
          const isSavings = h.category === "예금" || h.category === "적금";
          const isUsd = h.currency === "USD";

          // 대출인 경우
          if (isLoan) {
            const info = h.loanInfo;
            return `
              <tr style="background: rgba(239, 68, 68, 0.05);">
                <td><b>${h.name}</b></td>
                <td><small style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 6px; border-radius:4px;">대출(부채)</small></td>
                <td>${info.passedMonths}/${info.totalMonths}회차</td>
                <td>₩${Math.round(info.initialPrincipal).toLocaleString("ko-KR")}</td>
                <td><b style="color:#ef4444;">₩${Math.round(h.currentPrice).toLocaleString("ko-KR")}</b> <small>(잔액)</small></td>
                <td><b>-₩${Math.round(h.currentPrice).toLocaleString("ko-KR")}</b></td>
                <td style="color:#cbd5e1;">월 상환액: <b style="color:#ef4444;">₩${Math.round(info.monthlyPayment).toLocaleString("ko-KR")}</b></td>
                <td>
                  <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:6px;">수정</button>
                  <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
                </td>
              </tr>
            `;
          }

          // 예금 / 적금인 경우 (만기 전)
          if (isSavings) {
            const info = h.savingsInfo;
            return `
              <tr style="background: rgba(6, 182, 212, 0.05);">
                <td><b>${h.name}</b></td>
                <td><small style="background:rgba(6, 182, 212, 0.2); color:#06b6d4; padding:2px 6px; border-radius:4px;">${h.category} (${info.rate}%)</small></td>
                <td>만기: <b>${info.maturityDate}</b></td>
                <td>₩${Math.round(info.totalPrincipal).toLocaleString("ko-KR")}</td>
                <td>₩${Math.round(info.depositAmount).toLocaleString("ko-KR")} <small>(${h.category === '예금' ? '예치금' : '월적립'})</small></td>
                <td><b style="color:#06b6d4;">₩${Math.round(info.totalPayout).toLocaleString("ko-KR")}</b></td>
                <td style="color:#10b981;">+₩${Math.round(info.netInterest).toLocaleString("ko-KR")} <small>(세후이자)</small></td>
                <td>
                  <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:6px;">수정</button>
                  <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
                </td>
              </tr>
            `;
          }

          // 주식 및 기타 일반 자산 / 현금(만기 해지 환급금 포함)인 경우
          const totalKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
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
              <td><b>₩${Math.round(totalKrw).toLocaleString("ko-KR")}</b></td>
              <td style="color:${colorKrw}"><b>${profitRateKrw.toFixed(2)}%</b><br/><small>₩${Math.round(profitKrw).toLocaleString("ko-KR")}</small></td>
              <td>
                ${typeof h.id === 'number' ? `
                  <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:6px;">수정</button>
                  <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
                ` : '-'}
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
  });
})();
