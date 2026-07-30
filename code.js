// =========================================================
// 🚀 Supabase 연동 대시보드 엔진 (code.js)
// =========================================================

// 🔑 1단계에서 복사한 본인의 Supabase 정보로 채워주세요!
const SUPABASE_URL = "sb_publishable_7XG0ffJKHveUv7v2cn2IOg_XKJw6NfV";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmhiaXlwaGpsZXFreWJqdmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzAxNjYsImV4cCI6MjEwMDk0NjE2Nn0.cM5cjvX-7x8sNukff3TFDGF8VbB37CuGngloahi5tmY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(function initDashboardApp() {
  let transactions = [];
  let currentUser = null;
  let liveUsdKrwRate = 1400;

  let allocationChartInstance = null;
  let divChartInstance = null;
  let spChartInstance = null;

  const categoryColors = {
    "국내주식": "#6366f1", "해외주식": "#10b981", "ETF": "#f59e0b",
    "부동산": "#eab308", "채권": "#3b82f6", "가상자산": "#ec4899",
    "현금": "#64748b", "대출": "#ef4444"
  };

  const getEl = (id) => document.getElementById(id);
  const parseVal = (id) => parseFloat(getEl(id)?.value.replace(/,/g, "")) || 0;
  const formatKrw = (val) => "₩" + Math.round(val).toLocaleString("ko-KR");

  // ---------------------------------------------------------
  // 🔐 인증 (로그인/로그아웃 및 사용자 관리)
  // ---------------------------------------------------------
  async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;
    updateAuthUI();

    if (currentUser) {
      await fetchTransactionsFromDB();
    } else {
      transactions = [];
      renderAll();
    }
  }

  function updateAuthUI() {
    const emailEl = getEl("user-email");
    const loginBtn = getEl("login-btn");
    const logoutBtn = getEl("logout-btn");

    if (currentUser) {
      if (emailEl) emailEl.textContent = currentUser.email;
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
      if (emailEl) emailEl.textContent = "로그인이 필요합니다.";
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  getEl("login-btn")?.addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
  });

  getEl("logout-btn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    currentUser = null;
    transactions = [];
    updateAuthUI();
    renderAll();
  });

  // ---------------------------------------------------------
  // 🗄️ Supabase DB CRUD 로직
  // ---------------------------------------------------------
  async function fetchTransactionsFromDB() {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("DB 불러오기 실패:", error.message);
      return;
    }

    // DB 카멜케이스 변환
    transactions = data.map(t => ({
      id: t.id,
      date: t.date,
      category: t.category,
      type: t.type,
      name: t.name,
      currency: t.currency,
      quantity: Number(t.quantity),
      price: Number(t.price),
      currentPrice: Number(t.current_price),
      dividendRate: Number(t.dividend_rate),
      loanAmount: Number(t.loan_amount),
      interestRate: Number(t.interest_rate),
      loanTermMonths: Number(t.loan_term_months)
    }));

    renderAll();
  }

  // ---------------------------------------------------------
  // 📊 순자산 & 30대 상위 % 게이지 계산
  // ---------------------------------------------------------
  function calculate30sPercentile(netWorth) {
    if (netWorth <= 0) return 99.9;
    const benchmarks = [
      [2000000000, 0.1], [1310000000, 1.0], [760000000, 5.0],
      [540000000, 10.0], [380000000, 20.0], [260000000, 30.0],
      [150000000, 50.0], [60000000, 70.0], [10000000, 90.0]
    ];
    if (netWorth >= benchmarks[0][0]) return 0.1;
    if (netWorth <= benchmarks[benchmarks.length - 1][0]) return 90.0;

    for (let i = 0; i < benchmarks.length - 1; i++) {
      const [highVal, highPct] = benchmarks[i];
      const [lowVal, lowPct] = benchmarks[i + 1];
      if (netWorth <= highVal && netWorth >= lowVal) {
        const ratio = (netWorth - lowVal) / (highVal - lowVal);
        return Math.max(0.1, Math.min(99.9, lowPct - ratio * (lowPct - highPct)));
      }
    }
    return 50.0;
  }

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
      if (percentile <= 5) rankCaptionEl.textContent = "30대 최상위권 순자산입니다! 🎉";
      else if (percentile <= 20) rankCaptionEl.textContent = "30대 평균을 훌쩍 넘어서는 자산입니다 🚀";
      else if (percentile <= 50) rankCaptionEl.textContent = "30대 상위 절반에 속해 있습니다 👍";
      else rankCaptionEl.textContent = "차근차근 자산을 늘려가는 중입니다 💪";
    }
  }

  // ---------------------------------------------------------
  // 📝 모달 & 데이터 저장/수정/삭제
  // ---------------------------------------------------------
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
    if (!currentUser) {
      alert("로그인이 필요한 서비스입니다.");
      return;
    }
    form?.reset();
    getEl("edit-tx-id").value = "";
    toggleFields(categorySelect.value.includes("대출"));
    if (getEl("tx-date")) getEl("tx-date").value = new Date().toISOString().substring(0, 10);
    modal?.showModal();
  });

  getEl("close-tx-modal")?.addEventListener("click", () => modal?.close());
  getEl("cancel-tx-modal")?.addEventListener("click", () => modal?.close());
  categorySelect?.addEventListener("change", (e) => toggleFields(e.target.value.includes("대출")));

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const formData = new FormData(form);
      const editId = getEl("edit-tx-id").value;
      const category = formData.get("category");
      const isLoan = category.includes("대출") || category === "대출";

      const dbPayload = {
        user_id: currentUser.id,
        date: formData.get("date"),
        category: isLoan ? "대출" : category,
        name: formData.get("name").trim(),
        currency: formData.get("currency"),
        type: isLoan ? "LOAN" : formData.get("type"),
        quantity: isLoan ? 1 : parseFloat(formData.get("quantity")) || 0,
        price: isLoan ? parseFloat(formData.get("loanAmount")) || 0 : parseFloat(formData.get("price")) || 0,
        current_price: isLoan ? parseFloat(formData.get("loanAmount")) || 0 : parseFloat(formData.get("currentPrice")) || 0,
        dividend_rate: isLoan ? 0 : parseFloat(formData.get("dividendRate")) || 0,
        loan_amount: isLoan ? parseFloat(formData.get("loanAmount")) || 0 : 0,
        interest_rate: isLoan ? parseFloat(formData.get("interestRate")) || 0 : 0,
        loan_term_months: isLoan ? parseInt(formData.get("loanTermMonths"), 10) || 12 : 12
      };

      if (editId) {
        await supabase.from("transactions").update(dbPayload).eq("id", editId);
      } else {
        await supabase.from("transactions").insert([dbPayload]);
      }

      await fetchTransactionsFromDB();
      form.reset();
      modal.close();
    };
  }

  window.deleteTransaction = async function(id) {
    if (confirm("정말 이 자산/거래 기록을 삭제하시겠습니까?")) {
      await supabase.from("transactions").delete().eq("id", id);
      await fetchTransactionsFromDB();
    }
  };

  window.editTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    getEl("edit-tx-id").value = tx.id;
    getEl("tx-date").value = tx.date;
    getEl("tx-category").value = tx.category === "대출" ? "대출" : tx.category;
    getEl("tx-name").value = tx.name;
    getEl("tx-currency").value = tx.currency;

    const isLoan = tx.category === "대출";
    toggleFields(isLoan);

    if (isLoan) {
      getEl("tx-loan-amount").value = tx.loanAmount || 0;
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

  // ---------------------------------------------------------
  // ⚙️ 포트폴리오 연산 & 렌더링
  // ---------------------------------------------------------
  function calculateLoanStatus(startDateStr, principal, annualRatePercent, totalMonths) {
    if (!principal || principal <= 0) return { currentBalance: 0, monthlyPayment: 0, passedMonths: 0 };
    const startDate = new Date(startDateStr);
    const now = new Date();
    let passedMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    if (now.getDate() < startDate.getDate()) passedMonths -= 1;
    passedMonths = Math.max(0, Math.min(passedMonths, totalMonths));

    const monthlyRate = (annualRatePercent / 100) / 12;
    let monthlyPayment = monthlyRate > 0
      ? principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
      : principal / totalMonths;

    let currentBalance = principal;
    for (let i = 0; i < passedMonths; i++) {
      currentBalance -= (monthlyPayment - (currentBalance * monthlyRate));
    }
    return { currentBalance: Math.max(0, currentBalance), monthlyPayment, passedMonths };
  }

  function processPortfolio() {
    const holdingsMap = {};
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(tx => {
      if (tx.category === "대출") {
        const loanStatus = calculateLoanStatus(tx.date, tx.loanAmount, tx.interestRate, tx.loanTermMonths);
        holdingsMap[`loan_${tx.id}`] = {
          id: tx.id, name: tx.name, category: "대출", currency: tx.currency,
          qty: 1, avgPrice: tx.loanAmount, currentPrice: loanStatus.currentBalance,
          loanInfo: { initialPrincipal: tx.loanAmount, monthlyPayment: loanStatus.monthlyPayment, passedMonths: loanStatus.passedMonths, totalMonths: tx.loanTermMonths }
        };
        return;
      }

      const itemKey = tx.category === "부동산" ? `${tx.name}_${tx.id}` : tx.name;
      if (!holdingsMap[itemKey]) {
        holdingsMap[itemKey] = { id: tx.id, name: tx.name, category: tx.category, currency: tx.currency, qty: 0, avgPrice: 0, currentPrice: tx.currentPrice, dividendRate: tx.dividendRate || 0 };
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

  function renderAll() {
    const holdingsMap = processPortfolio();
    const activeHoldings = Object.values(holdingsMap).filter(h => h.qty > 0 && h.currentPrice >= 0);

    let totalAssetKrw = 0, totalDebtKrw = 0, totalCostKrw = 0, investedValueKrw = 0, cashValueKrw = 0;

    activeHoldings.forEach(h => {
      const isUsd = h.currency === "USD";
      const valKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;
      const costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;

      if (h.category === "대출") totalDebtKrw += valKrw;
      else {
        totalAssetKrw += valKrw; totalCostKrw += costKrw;
        if (h.category === "현금") cashValueKrw += valKrw;
        else investedValueKrw += valKrw;
      }
    });

    const netWorthKrw = totalAssetKrw - totalDebtKrw;
    if (getEl("net-worth")) getEl("net-worth").textContent = formatKrw(netWorthKrw);
    if (getEl("invested-value")) getEl("invested-value").textContent = formatKrw(investedValueKrw);
    if (getEl("cash-value")) getEl("cash-value").textContent = formatKrw(cashValueKrw);

    updateRankMeter(netWorthKrw, activeHoldings.length > 0);

    // 테이블 렌더링
    const holdingsBody = getEl("holdings-body");
    if (holdingsBody) {
      holdingsBody.innerHTML = activeHoldings.map(h => {
        const isLoan = h.category === "대출";
        const isUsd = h.currency === "USD";
        const totalKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;

        if (isLoan) {
          const info = h.loanInfo;
          return `
            <tr style="background: rgba(239, 68, 68, 0.05);">
              <td><b>${h.name}</b></td>
              <td><small style="color:#ef4444;">대출</small></td>
              <td>${info.passedMonths}/${info.totalMonths}회차</td>
              <td>${formatKrw(info.initialPrincipal)}</td>
              <td><b style="color:#ef4444;">${formatKrw(h.currentPrice)}</b></td>
              <td><b>-${formatKrw(totalKrw)}</b></td>
              <td>월 상환: <b style="color:#ef4444;">${formatKrw(info.monthlyPayment)}</b></td>
              <td>
                <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer;">수정</button>
                <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
              </td>
            </tr>`;
        }

        const costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;
        const profitKrw = totalKrw - costKrw;
        const profitRate = costKrw > 0 ? (profitKrw / costKrw) * 100 : 0;

        return `
          <tr>
            <td><b>${h.name}</b></td>
            <td><small>${h.category}</small></td>
            <td>${h.qty.toLocaleString("ko-KR")}</td>
            <td>${isUsd ? '$' : '₩'}${h.avgPrice.toLocaleString("ko-KR")}</td>
            <td>${isUsd ? '$' : '₩'}${h.currentPrice.toLocaleString("ko-KR")}</td>
            <td><b>${formatKrw(totalKrw)}</b></td>
            <td style="color:${profitKrw >= 0 ? '#10b981' : '#ef4444'}"><b>${profitRate.toFixed(2)}%</b></td>
            <td>
              <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer;">수정</button>
              <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
            </td>
          </tr>`;
      }).join("");
    }
  }

  // 초기화
  window.addEventListener("load", async () => {
    await checkUserSession();
  });
})();
