import "./race.css";

const API_TIMEOUT_MS = 5000;
const ADMIN_POLL_MS = 15000;
const RACE_STATUS_POLL_MS = 2000;
const RIDER_NAME_STORAGE_KEY = "moto-drag/rider-name";

const app = document.querySelector("#app");

const template = `
  <div class="race-shell" data-mode="idle" data-ref="shell">
    <header class="race-hero" data-section="hero">
      <div class="eyebrow">Moto-Drag</div>
      <h1>
        Режим гонки
      </h1>
      <p>
        Введите имя, подкатите к стартовой полосе и держите телефон рядом — модуль сам запустит таймер, когда пересечёте луч.
      </p>
      <div class="track-overview">
        <div class="track-meta">
          <span data-ref="trackName">Трасса — —</span>
          <span data-ref="lapGoal">Кругов: —</span>
        </div>
        <div class="status-pill" data-ref="linkStatus" data-state="offline">Нет связи с модулем</div>
      </div>
      <div class="quick-links" data-section="nav">
        <button type="button" class="link-btn" data-action="goto-admin">Настройки модуля</button>
        <button type="button" class="link-btn" data-action="goto-leaderboard">Лидерборд</button>
      </div>
    </header>

    <section class="card rider-card" data-section="rider">
      <h2>Имя пилота</h2>
      <p>Сохранится на устройстве и появится в логах, когда модуль начнёт принимать данные о заезде.</p>
      <div class="name-input-group">
        <label for="riderName">Имя / позывной</label>
        <input
          id="riderName"
          maxlength="32"
          placeholder="Например: Арсений"
          autocomplete="off"
          inputmode="text"
        />
      </div>
      <div class="controls">
        <button class="btn btn-primary" type="button" data-action="ready">Занять трек</button>
      </div>
    </section>

    <section class="card timer-card" data-section="timer">
      <h2>Лайв-таймер</h2>
      <div class="timer-face">
        <div class="timer-display" data-ref="timerValue">00:00.000</div>
      </div>
      <div class="lap-status">
        <span>Цель: <strong data-ref="lapGoalLabel">—</strong></span>
        <span data-ref="timerStateLabel">Ожидание сигнала</span>
      </div>
      <p class="hint" data-ref="statusMessage">Займи трек только когда стоишь у старта.</p>
    </section>

    <section class="card last-ride" data-section="history">
      <h3>Круги текущего заезда</h3>
      <p>Как только модуль пришлёт времена, они появятся ниже — держите телефон рядом с треком.</p>
      <ul class="laps-list" data-ref="lapsList"></ul>
    </section>

    <footer class="compact-footer" data-section="footer">
      <button class="btn btn-outline btn-reset" type="button" data-action="reset" disabled>Сброс</button>
    </footer>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>
`;

app.innerHTML = template;

const refs = {
  shell: app.querySelector('[data-ref="shell"]'),
  trackName: app.querySelector('[data-ref="trackName"]'),
  lapGoal: app.querySelector('[data-ref="lapGoal"]'),
  lapGoalLabel: app.querySelector('[data-ref="lapGoalLabel"]'),
  timerValue: app.querySelector('[data-ref="timerValue"]'),
  timerStateLabel: app.querySelector('[data-ref="timerStateLabel"]'),
  statusMessage: app.querySelector('[data-ref="statusMessage"]'),
  linkStatus: app.querySelector('[data-ref="linkStatus"]'),
  lapsList: app.querySelector('[data-ref="lapsList"]'),
  nameInput: app.querySelector("#riderName"),
  readyBtn: app.querySelector('[data-action="ready"]'),
  resetBtn: app.querySelector('[data-action="reset"]'),
  adminLink: app.querySelector('[data-action="goto-admin"]'),
  leaderboardLink: app.querySelector('[data-action="goto-leaderboard"]'),
  toast: app.querySelector(".toast"),
};

const state = {
  admin: {
    trackName: "—",
    lapGoal: null,
  },
  riderName: loadStoredName(),
  ready: false,
  timerDisplayMs: 0,
  online: false,
  currentRun: {
    laps: [],
  },
  trackLock: {
    locked: false,
    riderName: null,
    lockedAt: null,
    startedAt: null,
    laps: [],
    currentTimerMs: 0,
    snapshotAt: Date.now(),
  },
};

refs.nameInput.value = state.riderName;
refs.nameInput.addEventListener("input", handleNameInput);
refs.readyBtn.addEventListener("click", handleReady);
refs.resetBtn.addEventListener("click", handleReset);
refs.adminLink?.addEventListener("click", () =>
  handleNavigate("/", "Возвращаемся к настройкам…")
);
refs.leaderboardLink?.addEventListener("click", () =>
  handleNavigate("/leaderboard.html", "Открываем лидерборд…")
);
window.addEventListener("online", () => setLinkStatus(true));
window.addEventListener("offline", () => setLinkStatus(false));

bootstrap();

function bootstrap() {
  renderAdminSummary();
  setTimerDisplay(0);
  renderCurrentRun();
  refreshAdminState();
  setInterval(refreshAdminState, ADMIN_POLL_MS);
  refreshRaceStatus();
  setInterval(refreshRaceStatus, RACE_STATUS_POLL_MS);
  startTimerLoop();
}

function handleNameInput(event) {
  const value = event.target.value.slice(0, 32);
  event.target.value = value;
  state.riderName = value.trim();
  try {
    localStorage.setItem(RIDER_NAME_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

async function handleReady() {
  if (state.trackLock.locked) {
    showToast("Трек уже занят — дождись окончания", "error");
    return;
  }
  const riderName = refs.nameInput.value.trim();
  if (!riderName) {
    showToast("Сначала укажи имя пилота", "error");
    refs.nameInput.focus();
    return;
  }
  state.riderName = riderName;
  refs.readyBtn.disabled = true;
  showToast("Бронируем трек…");
  try {
    const response = await postJson("/api/race/lock", { riderName });
    showToast("Трек забронирован — ждём стартовый луч");
    applyRaceStatus(response?.state);
  } catch (error) {
    if (error?.status === 409) {
      showToast("Трек уже занят — наблюдаем", "error");
      if (error.payload) {
        applyRaceStatus(error.payload);
      }
    } else {
      console.warn("[Race] lock failed", error);
      showToast("Не удалось занять трек", "error");
    }
  } finally {
    updateLockUi();
  }
}

async function handleReset() {
  if (!state.trackLock.locked) {
    showToast("Трек уже свободен");
    return;
  }
  if (!isTrackOwnedByMe()) {
    showToast("Только активный пилот может сбросить заезд", "error");
    return;
  }
  refs.resetBtn.disabled = true;
  showToast("Останавливаем заезд…");
  try {
    const response = await postJson("/api/race/reset", {});
    showToast("Трек освобождён");
    applyRaceStatus(response?.state);
  } catch (error) {
    console.warn("[Race] reset failed", error);
    showToast("Не удалось сбросить заезд", "error");
  } finally {
    updateLockUi();
  }
}

function handleNavigate(path, toastMessage) {
  showToast(toastMessage ?? "Открываем страницу…");
  window.location.assign(path);
}

async function refreshAdminState() {
  const data = await fetchJson("/api/admin/state");
  if (!data) return;

  state.admin.trackName = data.trackName || "—";
  state.admin.lapGoal = Number.isFinite(data.lapGoal) ? data.lapGoal : null;
  renderAdminSummary();
}

async function refreshRaceStatus() {
  const data = await fetchJson("/api/race/status");
  if (!data) return;
  applyRaceStatus(data);
}

function renderAdminSummary() {
  refs.trackName.textContent = `Трасса: ${state.admin.trackName}`;
  if (state.admin.lapGoal) {
    refs.lapGoal.textContent = `Кругов: ${state.admin.lapGoal}`;
    refs.lapGoalLabel.textContent = `${state.admin.lapGoal}`;
  } else {
    refs.lapGoal.textContent = "Кругов: —";
    refs.lapGoalLabel.textContent = "—";
  }
}

function applyRaceStatus(payload = {}) {
  const snapshotAt = Date.now();
  state.trackLock = {
    locked: Boolean(payload.locked),
    riderName: payload.riderName || null,
    lockedAt: toNullableNumber(payload.lockedAt),
    startedAt: toNullableNumber(payload.startedAt),
    laps: Array.isArray(payload.laps) ? payload.laps : [],
    currentTimerMs: Number.isFinite(payload.currentTimerMs)
      ? payload.currentTimerMs
      : 0,
    snapshotAt,
  };
  state.currentRun.laps = state.trackLock.laps;
  state.ready = isTrackOwnedByMe() && state.trackLock.locked;
  updateLayoutMode();
  updateLockUi();
  renderCurrentRun();
}

function updateLayoutMode() {
  if (!refs.shell) return;
  refs.shell.setAttribute("data-mode", state.ready ? "compact" : "idle");
}

function updateLockUi() {
  const isLocked = state.trackLock.locked;
  const isOwner = isTrackOwnedByMe();
  const occupant = state.trackLock.riderName || "Без имени";

  if (refs.readyBtn) {
    refs.readyBtn.textContent = isLocked
      ? isOwner
        ? "Трек занят вами"
        : "Трек занят"
      : "Занять трек";
    refs.readyBtn.disabled = isLocked;
  }

  if (isLocked) {
    refs.timerStateLabel.textContent = isOwner
      ? "Сенсор ждёт старт"
      : `Трек занят: ${occupant}`;
    refs.statusMessage.textContent = isOwner
      ? "Переедь стартовую линию — модуль сам запустит таймер."
      : "Дождись окончания текущего заезда — кнопка станет активной автоматически.";
    if (refs.resetBtn) {
      refs.resetBtn.disabled = !isOwner;
    }
  } else {
    refs.timerStateLabel.textContent = "Ожидание сигнала";
    refs.statusMessage.textContent =
      "Займи трек только когда стоишь у старта.";
    if (refs.resetBtn) {
      refs.resetBtn.disabled = true;
    }
  }
}

function isTrackOwnedByMe() {
  if (!state.trackLock.locked) {
    return false;
  }
  return (
    normalizeName(state.trackLock.riderName) === normalizeName(state.riderName)
  );
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function renderCurrentRun() {
  const laps = state.currentRun.laps || [];
  if (!laps.length) {
    const occupantMessage = state.trackLock.locked
      ? `Заезд пилота ${state.trackLock.riderName || "без имени"} в процессе`
      : "Кругов ещё нет";
    refs.lapsList.innerHTML = `<li><span>${occupantMessage}</span><strong>—</strong></li>`;
    return;
  }

  refs.lapsList.innerHTML = "";
  laps.forEach((lapTime, index) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `Круг ${index + 1}`;
    const value = document.createElement("strong");
    value.textContent = formatSeconds(lapTime);
    item.append(label, value);
    refs.lapsList.appendChild(item);
  });
}

function setTimerDisplay(ms) {
  state.timerDisplayMs = ms;
  refs.timerValue.textContent = formatDuration(ms);
}

function startTimerLoop() {
  const tick = () => {
    setTimerDisplay(computeTimerDisplay());
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

function computeTimerDisplay() {
  if (!state.trackLock.locked) {
    return 0;
  }
  const base = Number(state.trackLock.currentTimerMs) || 0;
  const capturedAt = state.trackLock.snapshotAt || Date.now();
  const delta = Math.max(0, Date.now() - capturedAt);
  return base + delta;
}

function setLinkStatus(isOnline) {
  state.online = isOnline;
  refs.linkStatus.dataset.state = isOnline ? "online" : "offline";
  refs.linkStatus.textContent = isOnline
    ? "Связь с модулем"
    : "Нет связи с модулем";
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    const payload = await response.json();
    setLinkStatus(true);
    return payload;
  } catch (error) {
    setLinkStatus(false);
    if (error?.name !== "AbortError") {
      console.warn(`[Race] fetch failed for ${path}`, error);
    }
    return null;
  } finally {
    clearTimeout(timerId);
  }
}

async function postJson(path, body) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timerId);
  }
}

async function safeJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return {};
}

function toNullableNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function loadStoredName() {
  try {
    const value = localStorage.getItem(RIDER_NAME_STORAGE_KEY);
    if (value) {
      return value;
    }
  } catch {
    /* ignore */
  }
  return "";
}

function formatDuration(ms) {
  const total = Math.floor(ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}.${String(millis).padStart(3, "0")}`;
}

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) {
    return "—";
  }
  const wholeMillis = Math.round(seconds * 1000);
  return formatDuration(wholeMillis);
}

let toastTimeout;
function showToast(message, tone = "info") {
  if (!refs.toast) return;
  refs.toast.textContent = message;
  refs.toast.dataset.tone = tone;
  refs.toast.dataset.visible = "true";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    refs.toast.dataset.visible = "false";
  }, 2000);
}
