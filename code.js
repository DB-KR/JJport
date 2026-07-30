// =========================================================
// 🚀 JJPort 부부 자산 관리 엔진 (code.js)
// =========================================================

// 🔑 Supabase 정보 (본인 프로젝트 정보로 변경하세요)
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(function initDashboardApp() {
  let transactions = [];
  let currentUser = null;
  let liveUsdKrwRate = 1400; // 기본 환율

  const getEl = (id) => document.getElementById(id);
  const formatKrw = (val) => "₩" + Math.round(val).toLocaleString("ko-KR");

  // ---------------------------------------------------------
  // 🔐 이메일 / 비밀번호 로그인 관리
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
    const emailSpan = getEl("user-email");
    const emailInput = getEl("login-email");
    const passwordInput = getEl("login-password");
    const loginBtn = getEl("login-btn");
    const logoutBtn = getEl("logout-btn");

    if (currentUser) {
      if (emailSpan) emailSpan.textContent = currentUser.email;
      if (emailInput) emailInput.style.display = "none";
      if (passwordInput) passwordInput.style.display = "none";
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
      if (emailSpan) emailSpan.textContent = "";
      if (emailInput) emailInput.style.display = "inline-block";
      if (passwordInput) passwordInput.style.display = "inline-block";
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  // 로그인 버튼 이벤트
  getEl("login-btn")?.addEventListener("click", async () => {
    const email = getEl("login-email")?.value.trim();
    const password = getEl("login-password")?.value.trim();

    if (!email || !password) {
      alert("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      alert("로그인 실패: 이메일이나 비밀번호가 맞지 않습니다.");
    } else {
      currentUser = data.user;
      updateAuthUI();
      await fetchTransactionsFromDB();
    }
  });

  // 로그아웃 버튼 이벤트
  getEl("logout-btn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    currentUser = null;
    transactions = [];
    updateAuthUI();
    renderAll();
  });

  // ---------------------------------------------------------
  // 🗄️ Supabase DB 불러오기
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
  // 📊 순자산 & 30대 상위 % 게이지 연산
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
      if (rankCaptionEl) rankCaptionEl.textContent = "로그인 후 자산을 추가하면 비교해 드려요";
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
  // 📝 모달 및 C.R.U.D 처리
  // ---------------------------------------------------------
  const modal = getEl("tx-modal");
  const form = getEl("tx-form");
  const categorySelect = getEl("tx-category");

  if (getEl("tx-date")) getEl("tx-date").value = new Date().toISOString().substring(0, 10);

  function toggleFields(isLoan) {
    document.querySelectorAll(".asset-field").forEach(f => f.style.display = isLoan ? "none" : "flex");
    document.querySelectorAll(".loan-field").forEach(f => f.style.display = isLoan ? "flex" : "none");
  }

  getEl("open-tx-modal")?.addEventListener("click", () => {
    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }
    form?.reset();
    getEl("edit-tx-id").value = "";
    toggleFields(categorySelect.value === "대출");
    if (getEl("tx-date")) getEl("tx-date").value = new Date().toISOString().substring(0, 10);
    modal?.showModal();
  });

  getEl("cancel-tx-modal")?.addEventListener("click", () => modal?.close());
  categorySelect?.addEventListener("change", (e) => toggleFields(e.target.value === "대출"));

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const formData = new FormData(form);
      const editId = getEl("edit-tx-id").value;
      const category = formData.get("category");
      const isLoan = category === "대출";

      const dbPayload = {
        user_id: currentUser.id,
        date: formData.get("date"),
        category: category,
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
    if (confirm("정말 이 내역을 삭제하시겠습니까?")) {
      await supabase.from("transactions").delete().eq("id", id);
      await fetchTransactionsFromDB();
    }
  };

  window.editTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    getEl("edit-tx-id").value = tx.id;
    getEl("tx-date").value = tx.date;
    getEl("tx-category").value = tx.category;
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
  // ⚙️ 계산 엔진 및 화면 렌더링
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

    let totalAssetKrw = 0, totalDebtKrw = 0, investedValueKrw = 0, cashValueKrw = 0;

    activeHoldings.forEach(h => {
      const isUsd = h.currency === "USD";
      const valKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;

      if (h.category === "대출") totalDebtKrw += valKrw;
      else {
        totalAssetKrw += valKrw;
        if (h.category === "현금") cashValueKrw += valKrw;
        else investedValueKrw += valKrw;
      }
    });

    const netWorthKrw = totalAssetKrw - totalDebtKrw;
    if (getEl("net-worth")) getEl("net-worth").textContent = formatKrw(netWorthKrw);
    if (getEl("invested-value")) getEl("invested-value").textContent = formatKrw(investedValueKrw);
    if (getEl("cash-value")) getEl("cash-value").textContent = formatKrw(cashValueKrw);

    updateRankMeter(netWorthKrw, activeHoldings.length > 0);

    const holdingsBody = getEl("holdings-body");
    if (holdingsBody) {
      holdingsBody.innerHTML = activeHoldings.map(h => {
        const isLoan = h.category === "대출";
        const isUsd = h.currency === "USD";
        const totalKrw = isUsd ? (h.qty * h.currentPrice) * liveUsdKrwRate : h.qty * h.currentPrice;

        if (isLoan) {
          const info = h.loanInfo;
          return `
            <tr style="background: rgba(239, 68, 68, 0.05); border-bottom: 1px solid #334155;">
              <td style="padding: 10px;"><b>${h.name}</b></td>
              <td style="padding: 10px;"><small style="color:#ef4444;">대출</small></td>
              <td style="padding: 10px;">${info.passedMonths}/${info.totalMonths}회차</td>
              <td style="padding: 10px;">${formatKrw(info.initialPrincipal)}</td>
              <td style="padding: 10px;"><b style="color:#ef4444;">${formatKrw(h.currentPrice)}</b></td>
              <td style="padding: 10px;"><b>-${formatKrw(totalKrw)}</b></td>
              <td style="padding: 10px;">월: <b style="color:#ef4444;">${formatKrw(info.monthlyPayment)}</b></td>
              <td style="padding: 10px;">
                <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right: 5px;">수정</button>
                <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
              </td>
            </tr>`;
        }

        const costKrw = isUsd ? (h.qty * h.avgPrice) * liveUsdKrwRate : h.qty * h.avgPrice;
        const profitKrw = totalKrw - costKrw;
        const profitRate = costKrw > 0 ? (profitKrw / costKrw) * 100 : 0;

        return `
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px;"><b>${h.name}</b></td>
            <td style="padding: 10px;"><small>${h.category}</small></td>
            <td style="padding: 10px;">${h.qty.toLocaleString("ko-KR")}</td>
            <td style="padding: 10px;">${isUsd ? '$' : '₩'}${h.avgPrice.toLocaleString("ko-KR")}</td>
            <td style="padding: 10px;">${isUsd ? '$' : '₩'}${h.currentPrice.toLocaleString("ko-KR")}</td>
            <td style="padding: 10px;"><b>${formatKrw(totalKrw)}</b></td>
            <td style="padding: 10px; color:${profitKrw >= 0 ? '#10b981' : '#ef4444'}"><b>${profitRate.toFixed(2)}%</b></td>
            <td style="padding: 10px;">
              <button onclick="editTransaction(${h.id})" style="background:none; border:none; color:#818cf8; cursor:pointer; margin-right: 5px;">수정</button>
              <button onclick="deleteTransaction(${h.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">삭제</button>
            </td>
          </tr>`;
      }).join("");
    }
  }

  window.addEventListener("load", async () => {
    await checkUserSession();
  });
})();
