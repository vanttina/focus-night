function getJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// —— UI 需要的：记住上次选择的时长 ——
function getLastDurationMin() {
  const v = Number(localStorage.getItem("focus_lastDurationMin") ?? 25);
  if (!Number.isFinite(v) || v < 1) return 25;
  return Math.round(v);
}
function setLastDurationMin(m) {
  localStorage.setItem("focus_lastDurationMin", String(Math.round(m)));
}

// —— session 标准化（兼容旧数据）——
function normalizeSession(session) {
  if (!session) return session;
  if (!session.status) session.status = "running";
  if (typeof session.pausedTotalMs !== "number") session.pausedTotalMs = 0;
  if (typeof session.pausedAt === "undefined") session.pausedAt = null;
  return session;
}

// ========== 新增：方向标签（category） ==========
const CATEGORY_KEY = "focus_currentCategory";

function getCurrentCategory() {
  return localStorage.getItem(CATEGORY_KEY) || "";
}
function setCurrentCategory(cat) {
  localStorage.setItem(CATEGORY_KEY, cat || "");
}

// ========== 开始专注：写 currentSession，然后跳 Focus ==========
function startFocus(durationMin) {
  const m = Math.max(1, Math.min(180, Number(durationMin)));
  setLastDurationMin(m);

  const session = normalizeSession({
    durationMin: m,
    startAt: Date.now(),
    status: "running",
    pausedTotalMs: 0,
    pausedAt: null,
    category: getCurrentCategory() || "", // ✅ 把方向写进 session
  });

  setJSON("focus_currentSession", session);
  location.href = "focus.html";
}

// ========== 完成：累计到今日 minutes，然后清掉 session（不跳转）==========
function finishSession(session) {
  session = normalizeSession(session);

  const totals = getJSON("focus_todayTotals", {});
  const key = todayKey();
  const prev = Number(totals[key] ?? 0);
  totals[key] = prev + Number(session.durationMin);
  setJSON("focus_todayTotals", totals);

  localStorage.removeItem("focus_currentSession");
  // ❌ 不在这里跳转（为了让“结束后弹窗记录”插得进来）
}

// ========== 新增：历史记录 ==========
const HISTORY_KEY = "focus_history";
function appendHistory(session, noteText) {
  const history = getJSON(HISTORY_KEY, []);
  const cat = session.category || getCurrentCategory() || "未选择";

  history.unshift({
    startAt: session.startAt,
    durationMin: session.durationMin,
    category: cat || "未选择",
    note: (noteText || "").trim(),
  });

  setJSON(HISTORY_KEY, history);
}

// ========== 新增：结束后“总结弹窗”控制 ==========
function openReviewModal(options = {}) {
  const session = normalizeSession(getJSON("focus_currentSession", null));
  if (!session) {
    location.href = "today.html";
    return;
  }

  const backdrop = document.getElementById("reviewBackdrop");
  const modal = document.getElementById("reviewModal");
  const noteEl = document.getElementById("reviewNote");
  const saveBtn = document.getElementById("saveReviewBtn");
  const skipBtn = document.getElementById("skipReviewBtn");
  const catEl = document.getElementById("reviewCategory");
  const durEl = document.getElementById("reviewDuration");

  if (!backdrop || !modal || !noteEl || !saveBtn || !skipBtn || !catEl || !durEl) {
    // 如果 focus.html 还没加 modal，就直接回 today，避免卡死
    finishSession(session);
    location.href = "today.html";
    return;
  }

  // 显示信息
  const cat = session.category || getCurrentCategory() || "未选择";
  catEl.textContent = `方向：${cat || "未选择"}`;
  durEl.textContent = `时长：${session.durationMin} 分钟`;
  noteEl.value = "";

  // 打开
  backdrop.classList.remove("hidden");
  modal.classList.remove("hidden");
  setTimeout(() => noteEl.focus(), 0);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.classList.add("hidden");
    modal.classList.add("hidden");
    saveBtn.removeEventListener("click", onSave);
    skipBtn.removeEventListener("click", onSkip);
    backdrop.removeEventListener("click", onSkip);
    document.removeEventListener("keydown", onEsc);
  }

  function finalize(noteText) {
    // 先写历史
    appendHistory(session, noteText);
    // 再结算今日累计并清 session
    finishSession(session);
    // 最后跳转
    location.href = "today.html";
  }

  function onSave() {
    finalize(noteEl.value);
    close();
  }

  function onSkip() {
    // ✅ 跳过也会存一条 note="" 的记录（便于你回看那天做过几段专注）
    finalize("");
    close();
  }

  function onEsc(e) {
    if (e.key === "Escape") onSkip();
  }

  saveBtn.addEventListener("click", onSave);
  skipBtn.addEventListener("click", onSkip);
  backdrop.addEventListener("click", onSkip);
  document.addEventListener("keydown", onEsc);
}

// 让其他脚本能调用（倒计时到 0 时用）
window.openReviewModal = openReviewModal;

// ========== 新增：Today 页面初始化方向选择 ==========
(function initTodayCategoryUI() {
  const row = document.getElementById("categoryRow");
  const txt = document.getElementById("currentCategoryText");
  if (!row || !txt) return;

  let current = getCurrentCategory();

  function render() {
    txt.textContent = current || "未选择";
    row.querySelectorAll(".chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === current);
    });
  }

  row.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    current = btn.dataset.cat || "";
    setCurrentCategory(current);
    render();
  });

  render();
})();
(function renderRecentSessions() {
  const box = document.getElementById("recentBox");
  const listEl = document.getElementById("recentList");
  const emptyEl = document.getElementById("recentEmpty");
  if (!box || !listEl || !emptyEl) return; // 不在 today 页面就跳过

  const history = getJSON("focus_history", []);
  const top3 = Array.isArray(history) ? history.slice(0, 3) : [];

  const pad = (n) => String(n).padStart(2, "0");
  function fmtHM(ms) {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  if (top3.length === 0) {
    emptyEl.classList.remove("hidden");
    listEl.innerHTML = "";
    return;
  }

  emptyEl.classList.add("hidden");
  listEl.innerHTML = top3.map((it) => {
    const time = it.startAt ? fmtHM(it.startAt) : "";
    const cat = it.category || "未选择";
    const mins = Number(it.durationMin) || 0;
    const note = (it.note || "").trim();

    const noteText = note ? note : "（未填写）";
    return `<li class="recent-item">
      <div class="recent-meta">${esc(time)} · ${esc(cat)} · ${esc(mins)} 分钟</div>
      <div class="recent-note">${esc(noteText)}</div>
    </li>`;
  }).join("");
})();
