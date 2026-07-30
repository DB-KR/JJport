// =========================================================
// 🚀 대시보드 통합 관리 & 엔진 (code.js)
// =========================================================

// ⚠️ Supabase URL과 Anon Key를 본인 설정값으로 넣어주세요!
const SUPABASE_URL = "https://your-supabase-url.supabase.co";
const SUPABASE_ANON_KEY = "your-supabase-anon-key";

// 변수 중복 선언 에러(SyntaxError)를 방지하기 위해 _supabase 변수로 선언
const _supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

(function initDashboardApp() {
  let transactions = JSON.parse(localStorage.getItem("portfolio_txs") || "[]");
  let liveUsdKrwRate = 1400;
  let allocationChartInstance = null;
  let divChartInstance = null;
  let spChartInstance = null;

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

  const getEl = (id) => document.getElementById(id);
  const parseVal = (id) => parseFloat(getEl(id)?.value.replace(/,/g, "")) || 0;
  const formatKrw = (val) => "₩" + Math.round(val).toLocaleString("ko-KR");

  // 🔑 Supabase 로그인 / 로그아웃 처리
  async function initAuth() {
    if (!_supabase) return;

    const loginBtn = getEl("login-btn");
    const logoutBtn = getEl("logout-btn");
    const userEmailEl = getEl("user-email");
    const emailInput = getEl("login-email");
    const passwordInput = getEl("login-password");

    // 세션 변경 감지
    _supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (userEmailEl) userEmailEl.textContent = session.user.email;
        if (loginBtn) loginBtn.style.display = "none";
        if (emailInput) emailInput.style.display = "none";
        if (passwordInput) passwordInput.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
      } else {
        if (userEmailEl) userEmailEl.textContent = "";
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (emailInput) emailInput.style.display = "inline-block";
        if (passwordInput) passwordInput.style.display = "inline-block";
        if (logoutBtn) logoutBtn.style.display = "none";
      }
    });

    // 로그인 버튼 이벤트
    loginBtn?.addEventListener("click", async () => {
      const email = emailInput?.value;
      const password = passwordInput?.value;

      if (!email || !password) {
        alert("이메일과 비밀번호를 입력해 주세요.");
        return;
      }

      const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        alert("로그인 실패: " + error.message);
      } else {
        alert("로그인되었습니다!");
      }
    });

    // 로그아웃 버튼 이벤트
    logoutBtn?.addEventListener("click", async () => {
      await _supabase.auth.signOut();
      alert("로그아웃되었습니다.");
    });
  }

  // 1️⃣ 30대 순자산 추정 상위 % 연산 로직
  function calculate30sPercentile(netWorth) {
    if (netWorth <= 0) return 99.9;

    const benchmarks = [
      [2000000000, 0.1],
      [1310000000, 1.0],
      [760000000, 5.0],
      [540000000, 10.0],
      [380000000, 20.0],
      [260000000, 30.0],
      [150000000, 50.0],
      [60000000, 70.0],
      [10000000, 90.0]
    ];

    if (netWorth >= benchmarks[0][0]) return 0.1;
    if (netWorth <= benchmarks[benchmarks.length - 1][0]) return 90.0;

    for (let i = 0; i < benchmarks.length - 1; i++) {
      const [highVal, highPct] = benchmarks[i];
      const [lowVal, lowPct] = benchmarks[i + 1];

      if (netWorth <= highVal && netWorth >= lowVal) {
        const ratio = (netWorth - lowVal) / (highVal - lowVal);
        const pct = lowPct - ratio * (lowPct - highPct);
        return Math.max(0.1, Math.min(99.9, pct));
      }
    }
    return 50.0;
  }

  // 2️⃣ rank-panel UI 업데이트
  function updateRankMeter(netWorth, hasAssets) {
    const rankPercentEl = getEl("rank-percent");
    const rankBarEl = getEl("rank-bar");
    const rankCaptionEl = getEl("rank-caption");

    if (!hasAssets || netWorth <= 0) {
      if (rankPercentEl) rankPercentEl.textContent = "—";
      if (rankBarEl) rankBarEl.style.width = "0%";
      if (rankCaptionEl) rankCaptionEl.textContent = "자산을 추가하면 비교해 드려요";
      return;
    }

    const percentile = calculate30sPercentile(netWorth);
    if (rankPercentEl) rankPercentEl.textContent = `${percentile.toFixed(1)}%`;
    
    const barWidth = Math.max(2, Math.min(100, 100 - percentile));
    if (rankBarEl) rankBarEl.style.width = `${barWidth}%`;

    if (rankCaptionEl) {
      if (percentile <= 5) {
        rankCaptionEl.textContent = "30대 최상위권 순자산입니다! 🎉";
      } else if (percentile <= 20) {
        rankCaptionEl.textContent = "30대 평균을 훌쩍 넘어서는 자산입니다 🚀";
      } else if (percentile <= 50) {
        rankCaptionEl.textContent = "30대 상위 절반에 속해 있습니다 👍";
      } else {
        rankCaptionEl.textContent = "차근차근 자산을 늘려가는 중입니다 💪";
      }
    }
  }

  // 3️⃣ 실시간 환율 정보
  async function fetchLiveRate() {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.KRW) liveUsdKrwRate = data.rates.KRW;
      }
    } catch {
      console.warn("환율 수신 지연, 기본 환율 적용 중");
    }
  }

  // 4️⃣ 모달 제어 및 대출 필드 동적 전환
  const modal = getEl("tx-modal");
  const form = getEl("tx-form");
  const categorySelect = getEl("tx-category");

  if (getEl("tx-date")) getEl("tx-date").value = new Date().toISOString().substring(0, 10);

  function toggleFields(isLoan) {
    document.querySelectorAll(".asset-field").forEach(f => f.style.display = isLoan ? "none" : "flex");
    document.querySelectorAll(".loan-field").forEach(f => f.style.display = isLoan ? "flex" : "none");
    if (getEl("type-label")) getEl("type-label").style.display = isLoan ? "none" : "flex";
  }

  getEl("open-tx-modal")?.addEventListener("click", () => {
    form?.reset();
    if (getEl("edit-tx-id")) getEl("edit-tx-id").value = "";
    if (getEl("modal-eyebrow")) getEl("modal-eyebrow").textContent = "NEW RECORD";
    if (getEl("modal-title")) getEl("modal-title").textContent = "자산 / 대출 기록하기";
    if (getEl("save-btn")) getEl("save-btn").textContent = "기록 저장";
    toggleFields(categorySelect?.value.includes("대출"));
    if (getEl("tx-date")) getEl("tx-date").value = new Date().toISOString().substring(0, 10);
    modal?.showModal();
  });

  getEl("close-tx-modal")?.addEventListener("click", () => modal?.close());
  getEl("cancel-tx-modal")?.addEventListener("click", () => modal?.close());
  categorySelect?.addEventListener("change", (e) => toggleFields(e.target.value.includes("대출")));

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const editId = getEl("edit-tx-id")?.value;
      const category = formData.get("category");
      const isLoan = category.includes("대출") || category === "대출";

      const txData = {
        id: editId ? parseInt(editId, 10) : Date.now(),
        date: formData.get("date"),
        category: isLoan ? "대출" : category,
        name: formData.get("name").trim(),
        currency: formData.get("currency")
      };

      if (isLoan) {
        txData.type = "LOAN";
        txData.loanAmount = parseFloat(formData.get("loanAmount")) || 0;
        txData.interestRate = parseFloat(formData.get("interestRate")) || 0;
        txData.loanTermMonths = parseInt(formData.get("loanTermMonths"), 10) || 12;
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

  window.deleteTransaction = function(id) {
    if (confirm("정말 이 자산/거래 기록을 삭제하시겠습니까?")) {
      transactions = transactions.filter(t => t.id !== id);
      saveAndRender();
    }
  };

  window.editTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    if (getEl("edit-tx-id")) getEl("edit-tx-id").value = tx.id;
    if (getEl("modal-eyebrow")) getEl("modal-eyebrow").textContent = "EDIT RECORD";
    if (getEl("modal-title")) getEl("modal-title").textContent = "자산 / 대출 수정하기";
    if (getEl("save-btn")) getEl("save-btn").textContent = "수정 완료";

    getEl("tx-date").value = tx.date;
    getEl("tx-category").value = tx.category === "대출" ? "대출" : tx.category;
    getEl("tx-name").value = tx.name;
    getEl("tx-currency").value = tx.currency;

    const isLoan = tx.category === "대출";
    toggleFields(isLoan);

    if (isLoan) {
      getEl("tx-loan-amount").value = tx.loanAmount || tx.price || 0;
      getEl("tx-loan-rate").value = tx.interestRate || 0;
      getEl("tx-loan-term").value = tx.loanTermMonths || 12;
    } else {
      getEl("tx-type").value = tx.type || "BUY";
      getEl("tx-qty").value = tx.quantity || 1;
      getEl("tx-price").value = tx.price || 0;
      getEl("tx-curr-price").value = tx.currentPrice || 0;
      getEl("tx-div-rate").value = tx.dividendRate || 0;
    }

    modal.showModal();
  };

  function saveAndRender() {
    localStorage.setItem("portfolio_txs", JSON.stringify(transactions));
    renderAll();
  }

  // 5️⃣ 원리금 균등상환 계산
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
      const factor = Math.pow(1 + monthlyRate, totalMonths);
      monthlyPayment = principal * (monthlyRate * factor) / (factor - 1);
    } else {
      monthlyPayment = principal / totalMonths;
    }

    let currentBalance = principal;
    for (let i = 0; i < passedMonths; i++) {
      currentBalance -= (monthlyPayment - (currentBalance * monthlyRate));
    }

    return {
      currentBalance: Math.max(0, currentBalance),
      monthlyPayment,
      passedMonths
    };
  }

  // 6️⃣ 포트폴리오 정산 엔진
  function processPortfolio() {
    const holdingsMap = {};
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
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

      const itemKey = tx.category === "부동산" ? `${tx.name}_${tx.id}` : tx.name;
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
        item.qty -= Math.min(tx.quantity, item.qty);
      }
    });

    return holdingsMap;
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
        if (h.category === "현금") cashValueKrw += valKrw;
        else investedValueKrw += valKrw;
      }
    });

    const netWorthKrw = totalAssetKrw - totalDebtKrw;

    if (getEl("net-worth")) getEl("net-worth").textContent = formatKrw(netWorthKrw);
    if (getEl("invested-value")) getEl("invested-value").textContent = formatKrw(investedValueKrw);
    if (getEl("cash-value")) getEl("cash-value").textContent = formatKrw(cashValueKrw);

    updateRankMeter(netWorthKrw, activeHoldings.length > 0);
  }

  // 8️⃣ 전체 렌더링
  function renderAll() {
    const holdingsMap = processPortfolio();
    const activeHoldings = Object.values(holdingsMap).filter(h => h.qty > 0 && h.currentPrice >= 0);

    updateHeroOverview(activeHoldings);

    // 보유 자산 / 대출 잔액 테이블
    const holdingsBody = getEl("holdings-body");

    if (holdingsBody) {
      if (activeHoldings.length === 0) {
        holdingsBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:25px;">등록된 자산/대출이 없습니다. 오른쪽 위 버튼으로 추가해 보세요!</td></tr>`;
      } else {
        holdingsBody.innerHTML = activeHoldings.map(h => {
          const isLoan = h.category === "대출";
          const isUsd = h.currency === "USD";
          const totalKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;

          if (isLoan) {
            const info = h.loanInfo;
            return `
              <tr style="background: rgba(239, 68, 68, 0.05);">
                <td><b>${h.name}</b></td>
                <td><small style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 6px; border-radius:4px;">대출(부채)</small></td>
                <td>${info.passedMonths}/${info.totalMonths}회차</td>
                <td>${formatKrw(info.initialPrincipal)}</td>
                <td><b style="color:#ef4444;">${formatKrw(h.currentPrice)}</b> <small>(잔액)</small></td>
                <td><b>-${formatKrw(totalKrw)}</b></td>
                <td style="color:#cbd5e1;">월 상환액: <b style="color:#ef4444;">${formatKrw(info.monthlyPayment)}</b></td>
                <td>
                  <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right:6px;">수정</button>
                  <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
                </td>
              </tr>
            `;
          }

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
              <td><b>${formatKrw(totalKrw)}</b></td>
              <td style="color:${colorKrw}"><b>${profitRateKrw.toFixed(2)}%</b><br/><small>${formatKrw(profitKrw)}</small></td>
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
    initAuth();
    renderAll();
  });
})();
