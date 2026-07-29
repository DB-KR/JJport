/* ==========================================
   포트폴리오 대시보드 메인 JS (뉴스 & Goal Tracker 통합)
   ========================================== */

// 1. 포맷터 정의
const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });

// 2. 초기 데이터 (기존 로컬스토리지 데이터 우선 유지)
let assets = JSON.parse(localStorage.getItem("my_assets")) || [];

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

  // 자산 배분 UI 업데이트
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

// 6. 📰 실시간 '주요 증시 뉴스' 상위 헤드라인 연동 로직
async function renderBriefing() {
  const briefingContainer = document.getElementById("briefing-content");
  if (!briefingContainer) return;

  // 로딩 UI
  briefingContainer.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 25px; text-align: center; color: #94a3b8; font-size: 0.9rem;">
      ⚡ 오늘의 주요 증시 뉴스를 가져오는 중입니다...
    </div>
  `;

  try {
    // 네이버 금융 주요 증시 헤드라인 RSS 연동
    const targetRss = encodeURIComponent("https://news.google.com/rss/search?q=%EC%A3%BC%EC%9A%94+%EC%A6%9D%EC%8B%9C+%ED%97%A4%EB%93%9C%EB%9D%BC%EC%9D%B8&hl=ko&gl=KR&ceid=KR:ko");
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${targetRss}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== "ok" || !data.items || data.items.length === 0) {
      throw new Error("주요 뉴스를 가져오지 못했습니다.");
    }

    // 무작위 섞기 없이 가장 비중 높은 '주요 뉴스 상위 4개'만 순서대로 추출
    const topNewsList = data.items.slice(0, 4);

    let newsHtml = `<ul class="briefing-list">`;
    topNewsList.forEach((item) => {
      // 제목 및 언론사 정보 정형화
      const fullTitle = item.title || "주요 증시 뉴스";
      const titleParts = fullTitle.split(" - ");
      const displayTitle = titleParts[0];
      const displaySource = titleParts.length > 1 ? titleParts[titleParts.length - 1] : (item.author || "주요뉴스");
      
      // 작성 시각
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      const timeStr = pubDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

      newsHtml += `
        <li>
          <a href="${item.link}" target="_blank" rel="noopener noreferrer">${displayTitle}</a>
          <div style="margin-top: 6px; display: flex; gap: 8px; align-items: center;">
            <span class="briefing-source" style="background: #28304d; color: #8a7cff; font-weight: 600;">${displaySource}</span>
            <small style="color: #64748b; font-size: 0.75rem;">${timeStr}</small>
          </div>
        </li>
      `;
    });
    newsHtml += `</ul>`;

    // 우측 AI 브리핑 카드
    let aiSummaryHtml = `
      <div class="briefing-top">
        <p class="briefing-summary">
          오늘의 핵심 증시 이슈를 종합 점검 중입니다. 
          주요 헤드라인 지표와 시장 흐름을 바탕으로 포트폴리오 리스크를 관리해 보세요.
        </p>
      </div>
    `;

    briefingContainer.innerHTML = newsHtml + aiSummaryHtml;

  } catch (err) {
    console.error("주요 뉴스 로드 실패:", err);
    
    briefingContainer.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: #ef4444; font-size: 0.85rem;">
        ⚠️ 주요 뉴스를 불러오는 도중 오류가 발생했습니다. 잠시 후 새로고침 해주세요.
      </div>
    `;
  }
}

// 7. 자산 삭제
function deleteAsset(id) {
  assets = assets.filter((item) => item.id !== id);
  render();
}

// 8. 자산 추가 모달 제어
function openModal() {
  const modal = document.getElementById("asset-modal");
  if (modal) modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("asset-modal");
  if (modal) modal.style.display = "none";
}

// 9. 숫자 입력 포맷터
function applyFormattedInput(input) {
  let val = input.value.replace(/,/g, "").replace(/[^0-9]/g, "");
  if (val) {
    input.value = Number(val).toLocaleString();
  } else {
    input.value = "";
  }
}

// 10. DOM 로드 후 실행
document.addEventListener("DOMContentLoaded", () => {
  render();
  renderBriefing(); // 뉴스 불러오기 실행

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

  // 금액 입력 필드 연동
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
        render();
      });
    }
  });
});
