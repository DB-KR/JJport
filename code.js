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

// 6. 📰 키워드 로테이션 방식의 실시간 뉴스 (버튼 먹통 방지 안전 로직 적용)
async function renderBriefing() {
  const briefingContainer = document.getElementById("briefing-content");
  const briefingLoading = document.getElementById("briefing-loading");
  const briefingDate = document.getElementById("briefing-date");
  const refreshBtn = document.getElementById("refresh-briefing");

  // 1. UI 상태 변경 (버튼의 disabled는 비활성화하여 언제든 재클릭 가능하게 유지)
  if (briefingLoading) {
    briefingLoading.style.display = "block";
    briefingLoading.textContent = "최신 증시 이슈를 새로 탐색하는 중...";
  }
  if (briefingContainer) briefingContainer.hidden = true;
  if (briefingDate) briefingDate.textContent = "갱신 중...";

  // 2. 새로고침할 때마다 키워드를 무작위로 교체
  const keywords = [
    "주요 증시 헤드라인",
    "국내 증시 주식 시황",
    "미국 증시 나스닥",
    "금리 환율 코스피",
    "반도체 AI 주식 이슈",
    "글로벌 증시 다우지수"
  ];
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

  let items = [];
  const cacheBuster = `&_t=${Date.now()}`;

  try {
    // [1차 시도] rss2json API
    const targetRss = encodeURIComponent(`https://news.google.com/rss/search?q=${encodeURIComponent(randomKeyword)}&hl=ko&gl=KR&ceid=KR:ko`);
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${targetRss}${cacheBuster}`;

    const res = await fetch(apiUrl);
    const data = await res.json();

    if (data.status === "ok" && data.items && data.items.length > 0) {
      items = data.items.slice(0, 4).map(item => {
        const fullTitle = item.title || "주요 증시 뉴스";
        const parts = fullTitle.split(" - ");
        return {
          title: parts[0],
          source: parts.length > 1 ? parts[parts.length - 1] : (item.author || "주요뉴스"),
          link: item.link,
          time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""
        };
      });
    }
  } catch (e) {
    console.warn("1차 RSS API 실패, 백업 로직 시도 중...", e);
  }

  // [2차 시도] corsproxy.io 우회
  if (items.length === 0) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(randomKeyword)}&hl=ko&gl=KR&ceid=KR:ko`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}${cacheBuster}`;
      
      const res = await fetch(proxyUrl);
      const xmlText = await res.text();
      const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
      const xmlItems = Array.from(xmlDoc.querySelectorAll("item")).slice(0, 4);

      items = xmlItems.map(item => {
        const fullTitle = item.querySelector("title")?.textContent || "주요 증시 뉴스";
        const parts = fullTitle.split(" - ");
        const pubDate = item.querySelector("pubDate")?.textContent;
        return {
          title: parts[0],
          source: parts.length > 1 ? parts[parts.length - 1] : "주요뉴스",
          link: item.querySelector("link")?.textContent || "#",
          time: pubDate ? new Date(pubDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""
        };
      });
    } catch (e) {
      console.error("2차 백업 프록시 실패:", e);
    }
  }

  // 3. 화면 바인딩
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
        <span style="font-size: 0.8rem; color: #978cff; font-weight: 700; display: block; margin-bottom: 8px;">🤖 AI 증시 브리핑 (${randomKeyword.replace(" 헤드라인", "").replace(" 시황", "")})</span>
        <p class="briefing-summary">
          실시간 <b>'${randomKeyword}'</b> 관련 핵심 이슈를 점검 중입니다. 
          주요 헤드라인 지표와 시장 흐름을 바탕으로 포트폴리오 리스크를 관리해 보세요.
        </p>
      </div>
    `;

    if (briefingContainer) {
      briefingContainer.innerHTML = newsHtml + aiSummaryHtml;
      briefingContainer.hidden = false;
    }
    if (briefingLoading) briefingLoading.style.display = "none";
    
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (briefingDate) briefingDate.textContent = `최신 정보 (${nowStr})`;
  } else {
    if (briefingLoading) {
      briefingLoading.style.display = "block";
      briefingLoading.textContent = "⚠️ 뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
    if (briefingDate) briefingDate.textContent = "불러오기 실패";
  }
}

// 4. 새로고침 버튼에 클릭 이벤트 등록 (중복 등록 방지)
document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refresh-briefing");
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "true";
    refreshBtn.addEventListener("click", () => {
      renderBriefing();
    });
  }
});

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
