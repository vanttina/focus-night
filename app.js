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

// —— 开始专注：只写 currentSession，然后跳 Focus ——
function startFocus(durationMin) {
  const m = Math.max(1, Math.min(180, Number(durationMin)));
  setLastDurationMin(m);

  const session = normalizeSession({
    durationMin: m,
    startAt: Date.now(),
    status: "running",
    pausedTotalMs: 0,
    pausedAt: null,
  });

  setJSON("focus_currentSession", session);
  location.href = "focus.html";
}

// —— 完成：累计到今日 minutes，然后清掉 session ——
function finishSession(session) {
  session = normalizeSession(session);

  const totals = getJSON("focus_todayTotals", {});
  const key = todayKey();
  const prev = Number(totals[key] ?? 0);
  totals[key] = prev + Number(session.durationMin);
  setJSON("focus_todayTotals", totals);

  localStorage.removeItem("focus_currentSession");
  location.href = "today.html";
}
