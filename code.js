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

// 6. 📰 실시간 뉴스 브리핑 로직 (구글 뉴스 RSS 실시간 연동)
async function renderBriefing() {
  const briefingContainer = document.getElementById("briefing-content");
  if (!briefingContainer) return;

  // 로딩 표시
  briefingContainer.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: #94a3b8;">
      🔄 최신 금융/증시 뉴스를 불러오는 중입니다...
    </div>
  `;

  try {
    // 실시간 한국 주식/증시 뉴스 RSS (CORS 우회 우회 프록시 사용)
    const rssUrl = encodeURIComponent("https://news.google.com/rss/search?q=주식+증시+금리+경제&hl=ko&gl=KR&ceid=KR:ko");
    const response = await fetch(`https://api.allorigins.win/get?url=${rssUrl}`);
    const data = await response.json();

    if (!data.contents) throw new Error("데이터를 가져오지 못했습니다.");

    // XML 파싱
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.contents, "text/xml");
    const items = Array.from(xmlDoc.querySelectorAll("item")).slice(0, 4); // 최신 뉴스 4개 가져오기

    if (items.length === 0) throw new Error("뉴스 항목이 없습니다.");

    // 뉴스 카드 생성
    let newsHtml = `<ul class="briefing-list">`;
    items.forEach((item) => {
      const title = item.querySelector("title")?.textContent || "제목 없음";
      const link = item.querySelector("link")?.textContent || "#";
      const pubDateStr = item.querySelector("pubDate")?.textContent || "";
      const source = item.querySelector("source")?.textContent || "실시간 뉴스";
      
      // 구글 뉴스의 경우 "제목 - 언론사명" 형식인 경우가 많아 분리
      const titleParts = title.split(" - ");
      const displayTitle = titleParts[0];
      const displaySource = titleParts.length > 1 ? titleParts[titleParts.length - 1] : source;

      newsHtml += `
        <li>
          <a href="${link}" target="_blank" rel="noopener noreferrer">${displayTitle}</a>
          <div style="margin-top: 6px; display: flex; gap: 8px; align-items: center;">
            <span class="briefing-source">${displaySource}</span>
            <small style="color: #64748b; font-size: 0.75rem;">${pubDateStr ? new Date(pubDateStr).toLocaleTimeString("ko-KR", {hour: '2-digit', minute:'2-digit'}) : ''}</small>
          </div>
        </li>
      `;
    });
    newsHtml += `</ul>`;

    // 우측 AI 분석 카드는 유지
    let aiSummaryHtml = `
      <div class="briefing-top">
        <p class="briefing-summary">
          실시간 증시 뉴스를 기반으로 시장 변동성을 모니터링하고 있습니다. 
          주요 금리 발표 및 기업 실적 이슈에 맞춰 포트폴리오 비중을 정기적으로 점검하세요.
        </p>
      </div>
    `;

    briefingContainer.innerHTML = newsHtml + aiSummaryHtml;

  } catch (err) {
    console.error("실시간 뉴스 로딩 실패, 백업 데이터 사용:", err);
    // API 장애 시 표시할 백업 데이터
    briefingContainer.innerHTML = `
      <ul class="briefing-list">
        <li>
          <a href="#" onclick="return false;">실시간 뉴스를 가져오는데 실패했습니다.</a>
          <p>네트워크 상태를 확인하거나 잠시 후 다시 새로고침해 주세요.</p>
          <span class="briefing-source">안내</span>
        </li>
      </ul>
      <div class="briefing-top">
        <p class="briefing-summary">네트워크 연결 상태를 확인해 주세요.</p>
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
