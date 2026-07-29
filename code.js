// =========================================================
// 🚀 대시보드 통합 관리 & 거래 엔진 (code.js)
// =========================================================

(function initDashboardApp() {
  let transactions = JSON.parse(localStorage.getItem("portfolio_txs") || "[]");
  let liveUsdKrwRate = 1400; // 기본 환율 백업
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

  // 1️⃣ 실시간 환율 정보 가져오기
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

  // 2️⃣ 모달 제어
  const modal = document.getElementById("tx-modal");
  const openBtn = document.getElementById("open-tx-modal");
  const closeBtn = document.getElementById("close-tx-modal");
  const cancelBtn = document.getElementById("cancel-tx-modal");
  const form = document.getElementById("tx-form");
  const dateInput = document.getElementById("tx-date");

  if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
  if (openBtn) openBtn.onclick = () => modal.showModal();
  if (closeBtn) closeBtn.onclick = () => modal.close();
  if (cancelBtn) cancelBtn.onclick = () => modal.close();

  // 거래 등록
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const newTx = {
        id: Date.now(),
        date: formData.get("date"),
        type: formData.get("type"), // BUY / SELL
        name: formData.get("name").trim(),
        category: formData.get("category"),
        currency: formData.get("currency"),
        quantity: parseFloat(formData.get("quantity")),
        price: parseFloat(formData.get("price")),
        currentPrice: parseFloat(formData.get("currentPrice"))
      };

      transactions.push(newTx);
      saveAndRender();
      form.reset();
      if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
      modal.close();
    };
  }

  // 거래 삭제
  window.deleteTransaction = function(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveAndRender();
  };

  function saveAndRender() {
    localStorage.setItem("portfolio_txs", JSON.stringify(transactions));
    renderAll();
  }

  // 3️⃣ 핵심 정산 및 이동평균법 포트폴리오 연산 Engine
  function processPortfolio() {
    const holdingsMap = {};
    const realizedPnl = { month: { krw: 0, usd: 0 }, quarter: { krw: 0, usd: 0 }, year: { krw: 0, usd: 0 } };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);

    // 거래 날짜 오름차순 정렬 (이동평균 정확도 확보)
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
      const isUsd = tx.currency === "USD";
      if (!holdingsMap[tx.name]) {
        holdingsMap[tx.name] = {
          name: tx.name,
          category: tx.category,
          currency: tx.currency,
          qty: 0,
          avgPrice: 0,
          currentPrice: tx.currentPrice
        };
      }

      const item = holdingsMap[tx.name];
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
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth();
        const txQuarter = Math.floor(txMonth / 3);

        const profitUsd = isUsd ? profit : profit / liveUsdKrwRate;
        const profitKrw = isUsd ? profit * liveUsdKrwRate : profit;

        if (txYear === currentYear) {
          realizedPnl.year.usd += profitUsd;
          realizedPnl.year.krw += profitKrw;
          if (txQuarter === currentQuarter) {
            realizedPnl.quarter.usd += profitUsd;
            realizedPnl.quarter.krw += profitKrw;
          }
          if (txMonth === currentMonth) {
            realizedPnl.month.usd += profitUsd;
            realizedPnl.month.krw += profitKrw;
          }
        }
        item.qty -= sellQty;
      }
    });

    return { holdingsMap, realizedPnl };
  }

  // 4️⃣ 메인 요약 대시보드 (순자산, 달성률, 평가손익) 동기화
  function updateHeroOverview(activeHoldings) {
    let totalAssetKrw = 0;  // 총 자산 (+)
    let totalDebtKrw = 0;   // 총 대출/부채 (-)
    let totalCostKrw = 0;   // 총 매입금액
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

    // 순자산 = 총 자산 - 대출
    const netWorthKrw = totalAssetKrw - totalDebtKrw;
    const totalUnrealizedProfitKrw = (totalAssetKrw - totalCostKrw);

    // A. 순자산 & 자산 구성
    const netWorthEl = document.getElementById("net-worth");
    const investedEl = document.getElementById("invested-value");
    const cashEl = document.getElementById("cash-value");

    if (netWorthEl) netWorthEl.textContent = "₩" + Math.round(netWorthKrw).toLocaleString("ko-KR");
    if (investedEl) investedEl.textContent = "₩" + Math.round(investedValueKrw).toLocaleString("ko-KR");
    if (cashEl) cashEl.textContent = "₩" + Math.round(cashValueKrw).toLocaleString("ko-KR");

    // B. 전체 평가손익
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

    // C. 목표 자산 달성률 Tracker
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

  // 5️⃣ 자산 배분 도넛 차트
  function renderAllocationChart(activeHoldings) {
    const canvas = document.getElementById("allocationCanvas");
    const legendEl = document.getElementById("legend");
    const countEl = document.getElementById("asset-count");

    if (countEl) countEl.textContent = activeHoldings.length;
    if (!canvas || typeof Chart === "undefined") return;

    const catTotals = {};
    let grandTotal = 0;

    activeHoldings.forEach(h => {
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

  // 6️⃣ 전체 화면 통합 렌더링
  function renderAll() {
    const { holdingsMap, realizedPnl } = processPortfolio();
    const activeHoldings = Object.values(holdingsMap).filter(h => h.qty > 0);

    // 1. 상단 개요 카드 실시간 반영 (순자산, 달성률, 평가손익)
    updateHeroOverview(activeHoldings);

    // 2. 도넛 차트 반영
    renderAllocationChart(activeHoldings);

    // 3. 거래 내역 테이블 렌더링
    const txBody = document.getElementById("tx-history-body");
    if (txBody) {
      if (transactions.length === 0) {
        txBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:20px;">기록된 거래 내역이 없습니다.</td></tr>`;
      } else {
        txBody.innerHTML = [...transactions].reverse().map(t => {
          const isBuy = t.type === "BUY";
          const symbol = t.currency === "USD" ? "$" : "₩";
          const total = t.quantity * t.price;
          return `
            <tr>
              <td>${t.date}</td>
              <td><span style="color:${isBuy ? '#10b981' : '#ef4444'}; font-weight:bold;">${isBuy ? '매수' : '매도'}</span></td>
              <td><b>${t.name}</b></td>
              <td>${t.currency}</td>
              <td>${t.quantity.toLocaleString("ko-KR")}</td>
              <td>${symbol}${t.price.toLocaleString("ko-KR")}</td>
              <td>${symbol}${total.toLocaleString("ko-KR")}</td>
              <td><button onclick="deleteTransaction(${t.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button></td>
            </tr>
          `;
        }).join("");
      }
    }

    // 4. 보유 자산 테이블 렌더링
    const holdingsBody = document.getElementById("holdings-body");
    const emptyState = document.getElementById("empty-state");

    if (holdingsBody) {
      if (activeHoldings.length === 0) {
        holdingsBody.innerHTML = "";
        if (emptyState) emptyState.style.display = "block";
      } else {
        if (emptyState) emptyState.style.display = "none";
        holdingsBody.innerHTML = activeHoldings.map(h => {
          const isUsd = h.currency === "USD";
          const totalUsd = isUsd ? h.qty * h.currentPrice : (h.qty * h.currentPrice) / liveUsdKrwRate;
          const totalKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;

          const costUsd = isUsd ? h.qty * h.avgPrice : (h.qty * h.avgPrice) / liveUsdKrwRate;
          const profitUsd = totalUsd - costUsd;
          const profitRateUsd = costUsd > 0 ? (profitUsd / costUsd) * 100 : 0;

          const costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;
          const profitKrw = totalKrw - costKrw;
          const profitRateKrw = costKrw > 0 ? (profitKrw / costKrw) * 100 : 0;

          const colorUsd = profitUsd >= 0 ? "#10b981" : "#ef4444";
          const colorKrw = profitKrw >= 0 ? "#10b981" : "#ef4444";

          return `
            <tr data-category="${h.category}" data-currency="${h.currency}" data-quantity="${h.qty}" data-current-price="${h.currentPrice}">
              <td><b>${h.name}</b></td>
              <td><small style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${h.category}</small></td>
              <td>${h.qty.toLocaleString("ko-KR")}</td>
              <td>${isUsd ? '$' : '₩'}${h.avgPrice.toLocaleString("ko-KR")}</td>
              <td>${isUsd ? '$' : '₩'}${h.currentPrice.toLocaleString("ko-KR")}</td>
              <td><b>₩${Math.round(totalKrw).toLocaleString("ko-KR")}</b> <br/><small style="color:#64748b;">($${totalUsd.toFixed(2)})</small></td>
              <td style="color:${colorKrw}"><b>${profitRateKrw.toFixed(2)}%</b><br/><small>₩${Math.round(profitKrw).toLocaleString("ko-KR")}</small></td>
              <td style="color:${colorUsd}"><b>${profitRateUsd.toFixed(2)}%</b><br/><small>$${profitUsd.toFixed(2)}</small></td>
            </tr>
          `;
        }).join("");
      }
    }

    // 5. 기간별 실현 손익 카드 업데이트
    const fmtPnl = (pnl) => {
      const color = pnl.krw >= 0 ? "#10b981" : "#ef4444";
      const sign = pnl.krw >= 0 ? "+" : "";
      return `<span style="color:${color}">${sign}₩${Math.round(pnl.krw).toLocaleString("ko-KR")} <small style="font-size:0.8rem;">(${sign}$${pnl.usd.toFixed(2)})</small></span>`;
    };

    const monthEl = document.getElementById("pnl-month");
    const quarterEl = document.getElementById("pnl-quarter");
    const yearEl = document.getElementById("pnl-year");

    if (monthEl) monthEl.innerHTML = fmtPnl(realizedPnl.month);
    if (quarterEl) quarterEl.innerHTML = fmtPnl(realizedPnl.quarter);
    if (yearEl) yearEl.innerHTML = fmtPnl(realizedPnl.year);
  }

  // 7️⃣ 초기화 및 목표 금액 입력 이벤트 연동
  window.addEventListener("load", async () => {
    await fetchLiveRate();
    renderAll();

    const targetInput = document.getElementById("target-amount");
    if (targetInput) {
      targetInput.addEventListener("input", () => {
        const { holdingsMap } = processPortfolio();
        updateHeroOverview(Object.values(holdingsMap).filter(h => h.qty > 0));
      });
    }
  });
})();
