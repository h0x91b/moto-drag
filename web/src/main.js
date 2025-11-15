import "./style.css";

const API_TIMEOUT_MS = 5000;
const DEV_BOARD_BOOT_KEY = "moto-drag/dev-board-boot-at";

const app = document.querySelector("#app");

const template = `
  <div class="shell">
    <header class="hero">
      <div class="eyebrow">Мастер первой настройки</div>
      <h1>Добро пожаловать, админ Moto-Drag</h1>
      <p>Назови трассу, задай план кругов, затем откалибруй датчики и синхронизируй часы перед заездами.</p>
      <div class="status-pill" data-ref="connection">Связь с модулем установлена</div>
    </header>

    <section class="grid">
      <article class="card">
        <h2>Профиль трассы</h2>
        <p>Эти значения хранятся на модуле и запускают SPA сразу после прошивки.</p>
        <form data-form="profile">
          <label>
            Название трассы
            <input
              required
              name="trackName"
              autocomplete="off"
              maxlength="30"
              placeholder="Например: Тверской спринт"
            />
          </label>
          <label>
            План кругов
            <input
              required
              name="lapGoal"
              type="number"
              min="1"
              max="20"
              inputmode="numeric"
              placeholder="3"
            />
            <span class="hint">Используй 1–20 кругов: пилот всегда сможет остановиться раньше.</span>
          </label>

          <button class="btn btn-primary" type="submit">
            Сохранить на модуле
          </button>
          <div class="inline-status" data-state="idle" data-ref="profileStatus">Ждём ввода…</div>
        </form>
      </article>

      <article class="card">
        <h2>Калибровка датчиков</h2>
        <p>Запускай прямо на байке: модуль измерит оба луча и сохранит пороги освещённости.</p>
        <div class="actions">
          <button class="btn btn-outline" type="button" data-action="calibrate">
            Начать калибровку
          </button>
          <div class="inline-status" data-state="idle" data-ref="calibrationStatus">
            Ещё не запускалась
          </div>
          <div class="meta" data-ref="calibrationMeta"></div>
        </div>
      </article>

      <article class="card">
        <h2>Синхронизация часов</h2>
        <p>Отправь текущее время телефона, чтобы отметки кругов совпадали с реальностью даже без Wi‑Fi.</p>
        <div class="actions">
          <button class="btn btn-outline" type="button" data-action="sync-clock">
            Отправить текущее время
          </button>
          <div class="inline-status" data-state="idle" data-ref="clockStatus">
            Ждём синхронизацию
          </div>
          <div class="meta" data-ref="clockMeta"></div>
        </div>
      </article>
    </section>

    <section class="progress">
      <h3>Чек-лист запуска</h3>
      <ul class="progress-list">
        <li class="progress-item" data-progress="profile">
          <div class="progress-indicator"></div>
          Профиль трассы сохранён
        </li>
        <li class="progress-item" data-progress="calibration">
          <div class="progress-indicator"></div>
          Калибровка датчиков завершена
        </li>
        <li class="progress-item" data-progress="clock">
          <div class="progress-indicator"></div>
          Часы синхронизированы с телефона
        </li>
      </ul>
    </section>

    <footer class="footer-cta">
      <button class="btn btn-primary btn-next" type="button" data-ref="nextStep" disabled>
        Перейти к настройке пилотов
      </button>
      <p class="hint footer-hint">Выполни все шаги выше, чтобы перейти дальше.</p>
    </footer>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>
`;

app.innerHTML = template;

const devBoardBootAt = (() => {
  try {
    const stored = localStorage.getItem(DEV_BOARD_BOOT_KEY);
    if (stored && Number.isFinite(Number(stored))) {
      return Number(stored);
    }
    const now = Date.now();
    localStorage.setItem(DEV_BOARD_BOOT_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
})();

const refs = {
  profileForm: app.querySelector('[data-form="profile"]'),
  profileStatus: app.querySelector('[data-ref="profileStatus"]'),
  calibrationStatus: app.querySelector('[data-ref="calibrationStatus"]'),
  calibrationMeta: app.querySelector('[data-ref="calibrationMeta"]'),
  clockStatus: app.querySelector('[data-ref="clockStatus"]'),
  clockMeta: app.querySelector('[data-ref="clockMeta"]'),
  connectionPill: app.querySelector('[data-ref="connection"]'),
  toast: app.querySelector(".toast"),
  nextStep: app.querySelector('[data-ref="nextStep"]'),
};

const progressRefs = {
  profile: app.querySelector('[data-progress="profile"]'),
  calibration: app.querySelector('[data-progress="calibration"]'),
  clock: app.querySelector('[data-progress="clock"]'),
};

const state = {
  profile: { trackName: "", lapGoal: "", updatedAt: null },
  calibration: { completedAt: null },
  clock: { syncedAt: null, syncedMillis: null, hostCapturedAt: null },
};

bootstrap();

refs.profileForm.addEventListener("submit", handleProfileSubmit);
refs.profileForm.addEventListener("input", handleProfileDraft);
bindActionButtons("calibrate", handleCalibration);
bindActionButtons("sync-clock", handleClockSync);
refs.nextStep?.addEventListener("click", handleNextStep);

window.addEventListener("online", updateConnectionIndicator);
window.addEventListener("offline", updateConnectionIndicator);
setInterval(() => {
  renderClockMeta();
}, 1000);

async function bootstrap() {
  setInlineStatus(refs.profileStatus, "Загружаем из модуля…", "idle");
  await refreshStateFromServer();
  hydrateProfile();
  hydrateMeta();
  refreshProgress();
  updateConnectionIndicator();
  handleClockSync(true);
}

function handleProfileSubmit(event) {
  event.preventDefault();
  const formData = new FormData(refs.profileForm);
  const trackName = String(formData.get("trackName") || "").trim();
  const lapGoal = Number(formData.get("lapGoal"));

  if (!trackName) {
    return setInlineStatus(
      refs.profileStatus,
      "Нужно указать название трассы",
      "error"
    );
  }
  if (!Number.isFinite(lapGoal) || lapGoal < 1 || lapGoal > 20) {
    return setInlineStatus(
      refs.profileStatus,
      "Количество кругов должно быть от 1 до 20",
      "error"
    );
  }

  const payload = { trackName, lapGoal, updatedAt: Date.now() };
  setInlineStatus(refs.profileStatus, "Сохраняем…", "idle");
  refs.profileForm.querySelector('button[type="submit"]').disabled = true;

  sendCommand("/api/admin/setup", payload)
    .then((result) => {
      if (!result.ok) throw result.error;
      state.profile = {
        trackName,
        lapGoal,
        updatedAt: payload.updatedAt,
      };
      setInlineStatus(refs.profileStatus, "Профиль сохранён на модуле", "success");
      showToast("Профиль трассы сохранён");
      refreshProgress();
    })
    .catch((error) => {
      console.warn(error);
      setInlineStatus(refs.profileStatus, "Не удалось сохранить профиль", "error");
      showToast("Сохранение не удалось — попробуй ещё раз, когда модуль будет онлайн", "error");
    })
    .finally(() => {
      refs.profileForm.querySelector('button[type="submit"]').disabled = false;
    });
}

function handleProfileDraft(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const { name, value } = target;
  if (name !== "trackName" && name !== "lapGoal") {
    return;
  }
  state.profile = {
    ...state.profile,
    [name]: value,
  };
  if (!state.profile.updatedAt) {
    setInlineStatus(
      refs.profileStatus,
      "Черновик пока не сохранён на модуле",
      "idle"
    );
  }
}

function handleCalibration() {
  setInlineStatus(refs.calibrationStatus, "Калибруем…", "idle");
  sendCommand("/api/sensors/calibrate", { startedAt: Date.now() })
    .then((result) => {
      if (!result.ok) throw result.error;
      state.calibration = { completedAt: Date.now() };
      setInlineStatus(refs.calibrationStatus, "Калибровка сохранена", "success");
      hydrateMeta();
      refreshProgress();
      showToast("Калибровка датчиков обновлена");
    })
    .catch((error) => {
      console.warn(error);
      setInlineStatus(refs.calibrationStatus, "Калибровка не удалась", "error");
      showToast("Не удалось связаться с датчиками", "error");
    });
}

function handleClockSync(fromAuto = false) {
  const now = new Date();
  const boardMillis = sampleBoardMillis();
  const payload = {
    epochMs: now.getTime(),
    millis: boardMillis,
    iso8601: now.toISOString(),
    tzOffsetMinutes: now.getTimezoneOffset() * -1,
  };
  setInlineStatus(
    refs.clockStatus,
    fromAuto ? "Автосинхронизация…" : "Отправляем время…",
    "idle"
  );
  sendCommand("/api/time/sync", payload)
    .then((result) => {
      if (!result.ok) throw result.error;
      const response = result.data || {};
      state.clock = {
        syncedAt: response.syncedAt ?? payload.epochMs,
        syncedMillis: response.syncedMillis ?? boardMillis,
        hostCapturedAt: response.hostCapturedAt ?? Date.now(),
        moduleTimeMs: response.moduleTimeMs ?? null,
        moduleMillis: response.moduleMillis ?? null,
      };
      setInlineStatus(
        refs.clockStatus,
        fromAuto ? "Часы синхронизированы автоматически" : "Часы обновлены",
        "success"
      );
      hydrateMeta();
      refreshProgress();
      showToast(fromAuto ? "Часы синхронизированы автоматически" : "Часы синхронизированы");
    })
    .catch((error) => {
      console.warn(error);
      setInlineStatus(refs.clockStatus, "Синхронизировать время не удалось", "error");
      showToast("Синхронизировать время не удалось", "error");
    });
}

function hydrateProfile() {
  refs.profileForm.trackName.value = state.profile.trackName || "";
  refs.profileForm.lapGoal.value =
    state.profile.lapGoal !== undefined && state.profile.lapGoal !== null
      ? state.profile.lapGoal
      : "";
  if (state.profile.updatedAt) {
    const formatted = formatTimestamp(state.profile.updatedAt);
    setInlineStatus(refs.profileStatus, `Последнее сохранение ${formatted}`, "success");
  } else if (state.profile.trackName || state.profile.lapGoal) {
    setInlineStatus(
      refs.profileStatus,
      "Черновик пока не сохранён на модуле",
      "idle"
    );
  }
}

function hydrateMeta() {
  refs.calibrationMeta.textContent = state.calibration.completedAt
    ? `Последний запуск ${formatTimestamp(state.calibration.completedAt)}`
    : "Данных калибровки пока нет.";

  renderClockMeta();
}

async function refreshStateFromServer() {
  try {
    const data = await fetchJson("/api/admin/state");
    state.profile = {
      trackName: data.trackName ?? "",
      lapGoal: data.lapGoal ?? "",
      updatedAt: data.updatedAt ?? null,
    };
    state.calibration = { completedAt: data.calibrationAt ?? null };
    state.clock = {
      syncedAt: data.clockSyncedAt ?? null,
      syncedMillis: data.clockSyncedMillis ?? null,
      hostCapturedAt: data.clockSyncedHostAt ?? null,
      moduleTimeMs: data.moduleTimeMs ?? null,
      moduleMillis: data.moduleMillis ?? null,
    };
  } catch (error) {
    console.warn(error);
    setInlineStatus(refs.profileStatus, "Не удалось загрузить состояние модуля", "error");
  }
}

function refreshProgress() {
  const lapGoalValue = Number(state.profile.lapGoal);
  const profileDone = Boolean(
    state.profile.updatedAt && state.profile.trackName && lapGoalValue >= 1
  );
  const calibrationDone = Boolean(state.calibration.completedAt);
  const clockDone = Boolean(state.clock.syncedAt);
  toggleProgress(progressRefs.profile, profileDone);
  toggleProgress(progressRefs.calibration, calibrationDone);
  toggleProgress(progressRefs.clock, clockDone);
  updateNextStep(profileDone && calibrationDone && clockDone);
}

function toggleProgress(element, done) {
  element.setAttribute("data-state", done ? "done" : "pending");
}

function setInlineStatus(target, message, stateName) {
  target.dataset.state = stateName;
  target.textContent = message;
}

function bindActionButtons(action, handler) {
  const buttons = app.querySelectorAll(`[data-action="${action}"]`);
  buttons.forEach((button) => button.addEventListener("click", handler));
}

function updateConnectionIndicator() {
  if (!refs.connectionPill) {
    return;
  }
  const online = navigator.onLine;
  refs.connectionPill.dataset.state = online ? "online" : "offline";
  refs.connectionPill.textContent = online
    ? "Телефон подключён к точке модуля"
    : "Оффлайн-режим (это нормально)";
}

function showToast(message, tone = "success") {
  refs.toast.textContent = message;
  refs.toast.dataset.tone = tone;
  refs.toast.dataset.visible = "true";
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    refs.toast.dataset.visible = "false";
  }, 3200);
}

function updateNextStep(unlocked) {
  if (!refs.nextStep) {
    return;
  }
  refs.nextStep.disabled = !unlocked;
  refs.nextStep.dataset.state = unlocked ? "ready" : "locked";
  const hint = refs.nextStep.nextElementSibling;
  if (hint && hint.classList.contains("footer-hint")) {
    hint.textContent = unlocked
      ? "Отлично! Переходим к странице пилотов."
      : "Выполни все шаги выше, чтобы перейти дальше.";
  }
}

function handleNextStep() {
  if (refs.nextStep?.disabled) {
    return;
  }
  showToast("Открываем страницу гонки…");
  window.location.assign("/race.html");
}

function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    const day = date.toLocaleDateString("ru-RU", {
      month: "short",
      day: "numeric",
    });
    const time = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return `${day} в ${time}`;
  } catch {
    return new Date(timestamp).toLocaleString("ru-RU");
  }
}

async function sendCommand(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return { ok: true, data: await safeJson(response) };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(response) {
  return response.headers.get("content-type")?.includes("application/json")
    ? response.json()
    : Promise.resolve({});
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sampleBoardMillis() {
  return Math.max(0, Date.now() - devBoardBootAt);
}

function renderClockMeta() {
  if (!refs.clockMeta) {
    return;
  }
  if (!state.clock.syncedAt) {
    refs.clockMeta.textContent = "Часы ещё ни разу не синхронизировались.";
    return;
  }
  const snapshot = getModuleClockSnapshot();
  const clockNow = formatClockTime(snapshot?.epochMs ?? state.clock.syncedAt);
  const hintParts = [`Синхронизировано ${formatTimestamp(state.clock.syncedAt)}`];
  if (typeof snapshot?.millis === "number") {
    hintParts.push(`${Math.round(snapshot.millis)} мс`);
  }
  refs.clockMeta.innerHTML = `
    <div class="clock-readout">${clockNow}</div>
    <div class="clock-hint">${hintParts.join(" • ")}</div>
  `;
}

function getModuleClockSnapshot() {
  if (!state.clock.syncedAt) {
    return null;
  }
  const anchorHost =
    typeof state.clock.hostCapturedAt === "number"
      ? state.clock.hostCapturedAt
      : Date.now();
  const elapsed = Math.max(0, Date.now() - anchorHost);
  const epochMs = state.clock.syncedAt + elapsed;
  const millis =
    typeof state.clock.syncedMillis === "number"
      ? state.clock.syncedMillis + elapsed
      : null;
  return { epochMs, millis };
}

function formatClockTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--:--";
  }
}
