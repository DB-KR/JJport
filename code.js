/**
 * 개인 투자 대시보드 코어 라이브러리 (code.js)
 */
(() => {
  // --- 1. 자산 관리 코어 (Core Portfolio Storage & Rendering) ---
  const STORE = "portfolio-dashboard-v1";
  let holdings = JSON.parse(localStorage.getItem(STORE) || "[]");
  const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
  const format = value => won.format(value || 0);
  const colors = ["#978cff", "#55dfb2", "#ffb86b", "#5bbcff", "#ed8cc5", "#d5cf79"];
  const THIRTY_MEAN_NET_WORTH = 221580000;
  const THIRTY_LOG_STDDEV = 0.95;

  function normalCDF(value) {
    const sign = value < 0 ? -1 : 1;
    const x = Math.abs(value) / Math.sqrt(2);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  function estimatedTopPercent(value) {
    if (value <= 0) return null;
    const mu = Math.log(THIRTY_MEAN_NET_WORTH) - (THIRTY_LOG_STDDEV ** 2) / 2;
    const percentile = normalCDF((Math.log(value) - mu) / THIRTY_LOG_STDDEV);
    return Math.max(0.1, Math.min(99.9, (1 - percentile) * 100));
  }

  function animateValue(element, value, formatter) {
    if (!element) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { element.textContent = formatter(value); return; }
    const start = performance.now(), duration = 650;
    const step = now => {
      const p = Math.min(1, (now - start) / duration);
      element.textContent = formatter(value * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function persist() {
    localStorage.setItem(STORE, JSON.stringify(holdings));
  }

  function renderAllocation(total) {
    const grouped = holdings.reduce((a, h) => { a[h.category] = (a[h.category] || 0) + h.quantity * h.currentPrice; return a; }, {});
    const parts = Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
    let cursor = 0;
    const stops = parts.map(([name,value], i) => {
      const start = cursor, end = cursor + (total ? value/total*360 : 0);
      cursor = end;
      return `${colors[i % colors.length]} ${start}deg ${end}deg`;
    });
    const donut = document.querySelector("#donut");
    if (donut) {
      donut.style.background = stops.length ? `conic-gradient(${stops.join(",")})` : "#383e59";
      donut.classList.remove("chart-animate");
      void donut.offsetWidth;
      donut.classList.add("chart-animate");
    }
    const legend = document.querySelector("#legend");
    if (legend) {
      legend.innerHTML = parts.slice(0,4).map(([name,value],i) => `<li><span><i style="background:${colors[i % colors.length]}"></i>${name}</span><b>${total ? Math.round(value / total * 100) : 0}%</b></li>`).join("") || "<li>자산을 추가해 주세요</li>";
    }
  }

  function render() {
    const body = document.querySelector("#holdings-body");
    const total = holdings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0);
    const invested = holdings.filter(h => h.category !== "현금").reduce((sum, h) => sum + h.quantity * h.currentPrice, 0);
    const cash = total - invested;
    const cost = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0);
    const profit = total - cost;
    const rate = cost ? profit / cost * 100 : 0;

    animateValue(document.querySelector("#net-worth"), total, format);
    animateValue(document.querySelector("#invested-value"), invested, format);
    animateValue(document.querySelector("#cash-value"), cash, format);
    animateValue(document.querySelector("#monthly-profit"), Math.abs(profit), value => `${profit < 0 ? "−" : ""}${format(value)}`);

    const detailElem = document.querySelector("#monthly-detail");
    if (detailElem) detailElem.textContent = holdings.length ? `전체 평가손익 · ${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%` : "거래를 추가해 시작하세요";

    const trend = document.querySelector("#net-trend");
    if (trend) {
      trend.textContent = holdings.length ? `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%` : "—";
      trend.className = `trend ${holdings.length ? (rate >= 0 ? "positive" : "negative") : "neutral"}`;
    }

    const topPercent = estimatedTopPercent(total);
    const rank = document.querySelector("#rank-percent");
    const rankBar = document.querySelector("#rank-bar");
    if (rank) rank.textContent = topPercent === null ? "—" : `${topPercent < 1 ? "< 1" : topPercent.toFixed(1)}%`;
    if (rankBar) rankBar.style.setProperty("--rank-width", `${topPercent === null ? 0 : Math.max(2, 100 - topPercent)}%`);

    const captionElem = document.querySelector("#rank-caption");
    if (captionElem) captionElem.textContent = topPercent === null ? "자산을 추가하면 비교해 드려요" : `입력 자산 ${format(total)} 기준 모델 추정`;

    if (body) {
      body.innerHTML = holdings.map((h, i) => {
        const value = h.quantity * h.currentPrice;
        const itemCost = h.quantity * h.avgPrice;
        const r = itemCost ? (value - itemCost) / itemCost * 100 : 0;
        return `<tr>
          <td><div class="asset-name"><span class="asset-badge">${h.symbol.slice(0,3)}</span><span>${escapeHTML(h.name)}<small class="symbol">${escapeHTML(h.symbol)} · ${h.category}</small></span></div></td>
          <td class="money">${h.quantity.toLocaleString()}</td>
          <td class="money">${format(h.avgPrice)}</td>
          <td class="money">${format(h.currentPrice)}</td>
          <td class="money">${format(value)}</td>
          <td class="money return ${r >= 0 ? "positive" : "negative"}">${r >= 0 ? "+" : ""}${r.toFixed(2)}%</td>
          <td><button class="delete-button" data-index="${i}" aria-label="${escapeHTML(h.name)} 삭제">×</button></td>
        </tr>`;
      }).join("");
    }

    const emptyElem = document.querySelector("#empty-state");
    if (emptyElem) emptyElem.hidden = holdings.length > 0;
    const countElem = document.querySelector("#asset-count");
    if (countElem) countElem.textContent = holdings.length;

    renderAllocation(total);
  }

  // --- 2. 뉴스 브리핑 로직 (GitHub Actions 연동) ---
  function showBriefing(briefing) {
    const loading = document.querySelector("#briefing-loading");
    const content = document.querySelector("#briefing-content");
    const tone = { positive: "긍정적", neutral: "중립", cautious: "주의" }[briefing.marketTone] || "중립";

    const dateElem = document.querySelector("#briefing-date");
    if (dateElem && briefing.generatedAt) {
      dateElem.textContent = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(briefing.generatedAt));
    }

    if (content) {
      content.innerHTML = `<div class="briefing-top">
        <strong class="briefing-tone">${tone}</strong>
        <p class="briefing-summary">${escapeHTML(briefing.summary)}</p>
      </div>
      <ul class="briefing-list">${(briefing.articles || []).map(article => `<li>
        <a href="${escapeHTML(article.url)}" target="_blank" rel="noreferrer">${escapeHTML(article.title)}</a>
        <p>${escapeHTML(article.takeaway)}</p>
        <span class="briefing-source">${escapeHTML(article.source)}</span>
      </li>`).join("")}</ul>`;
    }
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }

  async function loadBriefing() {
    const loading = document.querySelector("#briefing-loading");
    const content = document.querySelector("#briefing-content");
    
    if (loading) {
      loading.hidden = false;
      loading.textContent = "최신 주식 뉴스를 불러오는 중입니다...";
    }
    if (content) content.hidden = true;

    try {
      // 캐시 방지를 위해 타임스탬프(?t=...) 파라미터 추가
      const response = await fetch(`daily-briefing.json?t=${Date.now()}`);
      if (!response.ok) throw new Error("No briefing yet");
      showBriefing(await response.json());
    } catch {
      if (loading) loading.textContent = "아직 준비된 브리핑이 없습니다. (Actions 배포 상태를 확인해 주세요)";
    }
  }

  // --- 3. 투자 시뮬레이터 로직 ---
  const inputValue = id => Math.max(0, Number(document.getElementById(id)?.value) || 0);
  const shortCurrency = value => value >= 100000000 ? `₩${(value / 100000000).toFixed(value >= 1000000000 ? 1 : 2)}억` : won.format(value);

  function drawChart(target, values, label) {
    if (!target) return;
    const width = 520, height = 165, left = 12, right = 8, top = 12, bottom = 25;
    const max = Math.max(...values, 1), usableW = width - left - right, usableH = height - top - bottom;
    const point = (value, index) => [left + usableW * index / Math.max(values.length - 1, 1), top + usableH * (1 - value / max)];
    const coords = values.map(point), line = coords.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `${line} L${coords.at(-1)[0].toFixed(1)},${top + usableH} L${left},${top + usableH} Z`;
    const grid = [0, .5, 1].map(ratio => { const y = top + usableH * (1 - ratio); return `<line class="sim-gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/>`; }).join("");
    const last = coords.at(-1), first = coords[0];
    target.innerHTML = `<svg class="sim-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(label)} 자산 추이"><title>${escapeHTML(label)} 자산 추이</title>${grid}<path class="sim-area" d="${area}"/><path class="sim-line" d="${line}"/><circle class="sim-dot" cx="${first[0]}" cy="${first[1]}" r="3"/><circle class="sim-dot" cx="${last[0]}" cy="${last[1]}" r="3"/><text class="sim-axis" x="${left}" y="${height-6}">시작</text><text class="sim-axis" x="${width-right}" y="${height-6}" text-anchor="end">${values.length - 1}년</text><text class="sim-axis" x="${width-right}" y="${top+9}" text-anchor="end">${shortCurrency(max)}</text></svg>`;
  }

  function renderDividend() {
    const initial = inputValue("dividend-initial"), monthly = inputValue("dividend-monthly"), annualYield = inputValue("dividend-yield") / 100;
    const years = Math.min(50, Math.max(1, Math.round(inputValue("dividend-years"))));
    const reinvest = document.getElementById("dividend-reinvest")?.checked;
    let principal = initial, cash = 0, dividendIncome = 0; const series = [initial];
    for (let year = 1; year <= years; year++) {
      for (let month = 0; month < 12; month++) {
        principal += monthly;
        const dividend = principal * annualYield / 12; dividendIncome += dividend;
        if (reinvest) principal += dividend; else cash += dividend;
      }
      series.push(principal + cash);
    }
    const total = series.at(-1);
    if (document.getElementById("dividend-total")) document.getElementById("dividend-total").textContent = shortCurrency(total);
    if (document.getElementById("dividend-income")) document.getElementById("dividend-income").textContent = shortCurrency(dividendIncome);
    if (document.getElementById("dividend-caption")) {
      document.getElementById("dividend-caption").innerHTML = reinvest ? `배당금을 바로 재투자하는 가정입니다. 총 납입금 <b>${won.format(initial + monthly * years * 12)}</b>` : `배당금은 현금으로 보유하는 가정입니다. 총 납입금 <b>${won.format(initial + monthly * years * 12)}</b>`;
    }
    drawChart(document.getElementById("dividend-chart"), series, "배당 시뮬레이터");
  }

  function renderSp500() {
    const initial = inputValue("sp-initial"), monthly = inputValue("sp-monthly"), exchangeRate = inputValue("sp-exchange-rate") || 1400, annualReturn = Number(document.getElementById("sp-return")?.value || 0) / 100;
    const years = Math.min(50, Math.max(1, Math.round(inputValue("sp-years"))));
    const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
    let balance = initial; const series = [balance];
    for (let year = 1; year <= years; year++) { for (let month = 0; month < 12; month++) balance = (balance + monthly) * (1 + monthlyReturn); series.push(balance); }
    const contributions = initial + monthly * years * 12, gains = balance - contributions;
    if (document.getElementById("sp-total")) document.getElementById("sp-total").textContent = shortCurrency(balance * exchangeRate);
    if (document.getElementById("sp-contribution")) document.getElementById("sp-contribution").textContent = shortCurrency(contributions * exchangeRate);
    if (document.getElementById("sp-caption")) {
      document.getElementById("sp-caption").innerHTML = `적용 환율 <b>${exchangeRate.toLocaleString()}원/USD</b> · 예상 수익 ${gains >= 0 ? "+" : ""}<b>${won.format(gains * exchangeRate)}</b> · $${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    drawChart(document.getElementById("sp-chart"), series.map(value => value * exchangeRate), "S&P 500 시뮬레이터");
  }

  // --- 4. 이벤트 바인딩 및 초기화 (DOMContentLoaded) ---
  document.addEventListener("DOMContentLoaded", () => {
    // 날짜 업데이트
    const asOfElem = document.querySelector("#as-of");
    if (asOfElem) asOfElem.textContent = new Intl.DateTimeFormat("ko-KR", {month:"short",day:"numeric",weekday:"short"}).format(new Date());

    // 모달 제어
    const modal = document.querySelector("#asset-modal");
    const openModalBtn = document.querySelector("#open-modal");
    const emptyAddBtn = document.querySelector("#empty-add");
    const closeModalBtn = document.querySelector("#close-modal");
    const cancelModalBtn = document.querySelector("#cancel-modal");

    const openModal = () => { if (modal) { modal.showModal(); document.querySelector("input[name=name]")?.focus(); } };
    if (openModalBtn) openModalBtn.onclick = openModal;
    if (emptyAddBtn) emptyAddBtn.onclick = openModal;
    if (closeModalBtn) closeModalBtn.onclick = () => modal.close();
    if (cancelModalBtn) cancelModalBtn.onclick = () => modal.close();

    // 자산 추가 폼 제출
    const form = document.querySelector("#asset-form");
    if (form) {
      form.addEventListener("submit", event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        holdings.push({
          name: data.get("name").trim(),
          symbol: data.get("symbol").trim().toUpperCase(),
          category: data.get("category"),
          quantity: Number(data.get("quantity")),
          avgPrice: Number(data.get("avgPrice")),
          currentPrice: Number(data.get("currentPrice"))
        });
        persist();
        render();
        event.currentTarget.reset();
        modal.close();
      });
    }

    // 자산 삭제
    const holdingsBody = document.querySelector("#holdings-body");
    if (holdingsBody) {
      holdingsBody.addEventListener("click", event => {
        const index = event.target.dataset.index;
        if (index !== undefined) {
          holdings.splice(Number(index), 1);
          persist();
          render();
        }
      });
    }

    // 백업 내보내기
    const downloadBtn = document.querySelector("#download-button");
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), holdings }, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.revokeObjectURL ? URL.createObjectURL(file) : "#";
        link.download = "portfolio-backup.json";
        link.click();
      };
    }

    // 현 시점에서 불러오기 버튼 클릭 이벤트 (daily-briefing.json 즉시 재로드)
    const refreshBtn = document.querySelector("#refresh-briefing");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        loadBriefing();
      });
    }

    // 시뮬레이터 이벤트 연결
    ["dividend-initial", "dividend-monthly", "dividend-yield", "dividend-years", "dividend-reinvest"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", renderDividend);
    });
    ["sp-initial", "sp-monthly", "sp-exchange-rate", "sp-return", "sp-years"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", renderSp500);
    });

    // 초기화 렌더링 실행
    render();
    loadBriefing();
    renderDividend();
    renderSp500();
    
    // --- 스크롤 및 메뉴 클릭 시 자동 하이라이트(Active) 스크립트 ---
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll("main > section[id]");

    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const currentId = entry.target.getAttribute("id");
          navLinks.forEach(link => {
            if (link.getAttribute("href") === `#${currentId}`) {
              link.classList.add("active");
            } else {
              link.classList.remove("active");
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
  });
})();
