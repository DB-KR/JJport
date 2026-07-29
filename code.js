/* ==========================================
   포트폴리오 대시보드 메인 JS
   ========================================== */

// 1. 포맷터 정의
const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });
const dollar = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// 2. 초기 데이터 (LocalStorage 연동)
let assets = JSON.parse(localStorage.getItem("my_assets")) || [
  { id: 1, name: "삼성전자", category: "stock", qty: 100, buyPrice: 70000, currentPrice: 75000 },
  { id: 2, name: "S&P 500 ETF", category: "stock", qty: 50, buyPrice: 450000, currentPrice: 480000 },
  { id: 3, name: "토스 파킹통장", category: "cash", qty: 1, buyPrice: 10000000, currentPrice: 10000000 }
];

// 데이터 저장
function saveAssets() {
  localStorage.setItem("my_assets", JSON.stringify(assets));
}

// 3. 메인 렌더링 함수
function render() {
  let totalInvested = 0;
  let totalCurrent = 0;
  let cashTotal = 0;
  let stockTotal = 0;

  const tbody = document.getElementById("asset-tbody");
  if (tbody) tbody.innerHTML = "";

  assets.forEach((item) => {
    const buyTotal = item.qty * item.buyPrice;
    const currentVal = item.qty * item.currentPrice;
    const profit = currentVal - buyTotal;
    const profitRate = buyTotal > 0 ? (profit / buyTotal) * 100 : 0;

    totalInvested += buyTotal;
    totalCurrent += currentVal;

    if (item.category === "cash") cashTotal += currentVal;
    else stockTotal += currentVal;

    if (tbody) {
      const tr = document.createElement("tr");
      const profitClass = profit > 0 ? "trend-up" : profit < 0 ? "trend-down" : "neutral";
      
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td><span class="badge ${item.category}">${item.category === "cash" ? "현금" : "주식"}</span></td>
        <td>${item.qty.toLocaleString()}</td>
        <td>${won.format(item.buyPrice)}</td>
        <td>${won.format(item.currentPrice)}</td>
        <td>${won.format(currentVal)}</td>
        <td class="${profitClass}">${profit > 0 ? "+" : ""}${won.format(profit)} (${profitRate.toFixed(2)}%)</td>
        <td><button class="btn-del" onclick="deleteAsset(${item.id})">삭제</button></td>
      `;
      tbody.appendChild(tr);
    }
  });

  const totalProfit = totalCurrent - totalInvested;
  const totalProfitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // 요약 카드 업데이트
  const netWorthElem = document.getElementById("net-worth");
  if (netWorthElem) netWorthElem.textContent = won.format(totalCurrent);

  const investedValueElem = document.getElementById("invested-value");
  if (investedValueElem) investedValueElem.textContent = won.format(totalInvested);

  const cashValueElem = document.getElementById("cash-value");
  if (cashValueElem) cashValueElem.textContent = won.format(cashTotal);

  const monthlyProfitElem = document.getElementById("monthly-profit");
  if (monthlyProfitElem) {
    const profitClass = totalProfit > 0 ? "trend-up" : totalProfit < 0 ? "trend-down" : "";
    monthlyProfitElem.className = profitClass;
    monthlyProfitElem.textContent = `${totalProfit > 0 ? "+" : ""}${won.format(totalProfit)} (${totalProfitRate.toFixed(2)}%)`;
  }

  // 자산 배분 비중 업데이트
  renderAllocation(totalCurrent, stockTotal, cashTotal);

  // 🎯 목표 자산 달성률 업데이트
  renderGoal(totalCurrent);

  saveAssets();
}

// 4. 자산 배분 UI 렌더링
function renderAllocation(total, stock, cash) {
  const countElem = document.getElementById("asset-count");
  if (countElem) countElem.textContent = assets.length;

  const legendElem = document.getElementById("legend");
  if (!legendElem) return;

  const stockPct = total > 0 ? ((stock / total) * 100).toFixed(1) : 0;
  const cashPct = total > 0 ? ((cash / total) * 100).toFixed(1) : 0;

  legendElem.innerHTML = `
    <li><span class="dot stock"></span> 주식: <b>${stockPct}%</b> (${won.format(stock)})</li>
    <li><span class="dot cash"></span> 현금: <b>${cashPct}%</b> (${won.format(cash)})</li>
  `;

  // 도넛 차트 백그라운드 표현 (CSS conic-gradient)
  const donutElem = document.getElementById("donut");
  if (donutElem) {
    donutElem.style.background = `conic-gradient(#8a7cff 0% ${stockPct}%, #55dfb2 ${stockPct}% 100%)`;
  }
}

// 5. 🎯 목표 자산 달성률 계산 및 렌더링
function renderGoal(total) {
  const targetInput = document.getElementById("target-amount");
  if (!targetInput) return;

  const targetVal = Number(targetInput.value.replace(/,/g, "")) || 0;
  const percent = targetVal > 0 ? Math.min(100, (total / targetVal) * 100) : 0;
  const remaining = Math.max(0, targetVal - total);

  const percentElem = document.getElementById("goal-percent-text");
  const remainingElem = document.getElementById("goal-remaining-text");
  const barFill = document.getElementById("goal-bar-fill");

  if (percentElem) percentElem.textContent = `${percent.toFixed(1)}% 달성`;
  if (remainingElem) {
    remainingElem.textContent = remaining > 0 ? `목표까지 ${won.format(remaining)} 남음` : "🎉 목표를 달성했습니다!";
  }
  if (barFill) barFill.style.width = `${percent}%`;
}

// 6. 자산 삭제
function deleteAsset(id) {
  assets = assets.filter((item) => item.id !== id);
  render();
}

// 7. 자산 추가 모달 제어
function openModal() {
  const modal = document.getElementById("asset-modal");
  if (modal) modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("asset-modal");
  if (modal) modal.style.display = "none";
}

// 8. 숫자 입력 시 콤마 자동 적용 포맷터
function applyFormattedInput(input) {
  let val = input.value.replace(/,/g, "").replace(/[^0-9]/g, "");
  if (val) {
    input.value = Number(val).toLocaleString();
  } else {
    input.value = "";
  }
}

// 9. 데이터 내보내기 / 불러오기 백업
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(assets, null, 2));
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`);
  dlAnchorElem.click();
}

// 10. DOM 로드 후 이벤트 바인딩
document.addEventListener("DOMContentLoaded", () => {
  render();

  // 모달 폼 제출
  const form = document.getElementById("asset-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("asset-name").value;
      const category = document.getElementById("asset-category").value;
      const qty = Number(document.getElementById("asset-qty").value.replace(/,/g, "")) || 0;
      const buyPrice = Number(document.getElementById("asset-buy-price").value.replace(/,/g, "")) || 0;
      const currentPrice = Number(document.getElementById("asset-current-price").value.replace(/,/g, "")) || buyPrice;

      if (!name || qty <= 0) {
        alert("올바른 자산 이름과 수량을 입력해 주세요.");
        return;
      }

      assets.push({
        id: Date.now(),
        name,
        category,
        qty,
        buyPrice,
        currentPrice
      });

      form.reset();
      closeModal();
      render();
    });
  }

  // 금액 입력창 천단위 콤마 실시간 바인딩
  const moneyInputIds = [
    "dividend-initial", "dividend-monthly",
    "sp-initial", "sp-monthly", "sp-exchange-rate",
    "target-amount", "asset-qty", "asset-buy-price", "asset-current-price"
  ];

  moneyInputIds.forEach((id) => {
    const elem = document.getElementById(id);
    if (elem) {
      applyFormattedInput(elem);
      elem.addEventListener("input", (e) => {
        applyFormattedInput(e.target);
        render(); // 목표 달성률 및 요약 카드 즉시 재계산
      });
    }
  });
});
