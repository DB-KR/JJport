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

// 6. 📰 실시간 뉴스 로딩 (소요 시간 측정 & 원형 스피너 적용)
async function renderBriefing() {
  const briefingContainer = document.getElementById("briefing-content");
  const briefingLoading = document.getElementById("briefing-loading");
  const briefingDate = document.getElementById("briefing-date");

  // ⏱️ 1. 시작 시간 기록
  const startTime = performance.now();

  // 2. UI 초기화 (원형 로딩 스피너 및 텍스트 적용)
  if (briefingLoading) {
    briefingLoading.style.display = "flex";
    briefingLoading.style.alignItems = "center";
    briefingLoading.style.justifyContent = "center";
    briefingLoading.style.gap = "10px";
    briefingLoading.innerHTML = `
      <div style="
        width: 18px; 
        height: 18px; 
        border: 3px solid rgba(151, 140, 255, 0.2); 
        border-top: 3px solid #978cff; 
        border-radius: 50%; 
        animation: spin 0.8s linear infinite;"></div>
      <span>최신 증시 이슈를 불러오는 중...</span>
    `;
  }

  // 회전 애니메이션 CSS를 동적으로 등록 (HTML/CSS 수정 불필요)
  if (!document.getElementById("spinner-style")) {
    const style = document.createElement("style");
    style.id = "spinner-style";
    style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  if (briefingContainer) briefingContainer.hidden = true;
  if (briefingDate) briefingDate.textContent = "갱신 중...";

  // 버튼 누를 때마다 검색 키워드 전환
  const keywords = [
    "주요 증시 헤드라인",
    "국내 증시 주식",
    "미국 증시 나스닥",
    "금리 환율 코스피",
    "반도체 AI 주식",
    "글로벌 증시"
  ];
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  const targetRss = `https://news.google.com/rss/search?q=${encodeURIComponent(randomKeyword)}&hl=ko&gl=KR&ceid=KR:ko`;

  let items = [];

  // [시도 1] AllOrigins 서비스 (1순위)
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetRss)}&_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.contents) {
        const xmlDoc = new DOMParser().parseFromString(data.contents, "text/xml");
        const rawItems = Array.from(xmlDoc.querySelectorAll("item")).slice(0, 4);

        items = rawItems.map(item => {
          const fullTitle = item.querySelector("title")?.textContent || "주요 증시 뉴스";
          const parts = fullTitle.split(" - ");
          const pubDate = item.querySelector("pubDate")?.textContent;
          return {
            title: parts[0],
            source: parts.length > 1 ? parts[parts.length - 1] : "증시뉴스",
            link: item.querySelector("link")?.textContent || "#",
            time: pubDate ? new Date(pubDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""
          };
        });
      }
    }
  } catch (e) {
    console.warn("1차 프록시 시도 실패, 2차 시도 전환...", e);
  }

  // [시도 2] rss2json 서비스 (2순위)
  if (items.length === 0) {
    try {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(targetRss)}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.status === "ok" && data.items && data.items.length > 0) {
        items = data.items.slice(0, 4).map(item => {
          const parts = (item.title || "").split(" - ");
          return {
            title: parts[0],
            source: parts.length > 1 ? parts[parts.length - 1] : (item.author || "주요뉴스"),
            link: item.link,
            time: item.pubDate ? new Date(pubDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""
          };
        });
      }
    } catch (e) {
      console.warn("2차 RSS API 실패", e);
    }
  }

  // ⏱️ 3. 소요 시간 계산
  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2); // 초 단위 (소수점 2자리)

  // 4. UI 바인딩 및 출력
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
        <span style="font-size: 0.8rem; color: #978cff; font-weight: 700; display: block; margin-bottom: 8px;">🤖 AI 증시 브리핑 (${randomKeyword.replace(" 헤드라인", "")})</span>
        <p class="briefing-summary">
          실시간 <b>'${randomKeyword}'</b> 주제의 핵심 헤드라인을 점검 중입니다. 
          시장의 최근 동향에 맞춰 자산 포트폴리오의 비중을 점검해 보세요.
        </p>
      </div>
    `;

    if (briefingContainer) {
      briefingContainer.innerHTML = newsHtml + aiSummaryHtml;
      briefingContainer.hidden = false;
    }
    if (briefingLoading) briefingLoading.style.display = "none";
    
    // 소요 시간 표기 (예: 최신 정보 (12:30:15 / 0.45초))
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (briefingDate) briefingDate.textContent = `${nowStr} (${duration}초 소요)`;
  } else {
    // 비상 모드
    if (briefingContainer) {
      briefingContainer.innerHTML = `
        <ul class="briefing-list">
          <li>
            <a href="https://finance.naver.com/" target="_blank">연준 금리 향방 주목… 증시 자금 유입 모니터링</a>
            <div style="margin-top:6px;"><span class="briefing-source">증시요약</span></div>
          </li>
          <li>
            <a href="https://finance.naver.com/" target="_blank">주요 기술주 실적 발표에 따른 시장 변동성 확대</a>
            <div style="margin-top:6px;"><span class="briefing-source">시장동향</span></div>
          </li>
        </ul>
        <div class="briefing-top">
          <span style="font-size: 0.8rem; color: #978cff; font-weight: 700; display: block; margin-bottom: 8px;">🤖 AI 증시 브리핑</span>
          <p class="briefing-summary">현재 실시간 네트워크 응답 지연으로 최신 요약 브리핑을 표시 중입니다.</p>
        </div>
      `;
      briefingContainer.hidden = false;
    }
    if (briefingLoading) briefingLoading.style.display = "none";
    if (briefingDate) briefingDate.textContent = `요약 정보 (${duration}초)`;
  }
}

// 5. 버튼 클릭 이벤트
document.addEventListener("DOMContentLoaded", () => {
  renderBriefing();

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
