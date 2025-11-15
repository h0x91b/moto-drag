import "./style.css";

const APP_STORAGE_KEY = "moto-drag-admin";
const CALIBRATION_KEY = "moto-drag-calibration";
const CLOCK_KEY = "moto-drag-clock-sync";
const API_TIMEOUT_MS = 5000;

const app = document.querySelector("#app");

const sessionStore = window.sessionStorage;

const template = `
  <div class="shell">
    <header class="hero">
      <div class="eyebrow">First-run wizard</div>
      <h1>Welcome, Moto-Drag admin</h1>
      <p>Give the track a name, set the lap plan, then calibrate sensors and sync the clock before riders line up.</p>
      <div class="status-pill" data-ref="connection">Board link ready</div>
    </header>

    <section class="grid">
      <article class="card">
        <h2>Track profile</h2>
        <p>These values live on the module and power the SPA right after flashing.</p>
        <form data-form="profile">
          <label>
            Track name
            <input
              required
              name="trackName"
              autocomplete="off"
              maxlength="30"
              placeholder="Tverskaya sprint"
            />
          </label>
          <label>
            Target laps
            <input
              required
              name="lapGoal"
              type="number"
              min="1"
              max="20"
              inputmode="numeric"
              placeholder="3"
            />
            <span class="hint">Use 1-20 laps; riders can still stop earlier.</span>
          </label>

          <button class="btn btn-primary" type="submit">
            Save &amp; continue
          </button>
          <div class="inline-status" data-state="idle" data-ref="profileStatus">Waiting for input…</div>
        </form>
      </article>

      <article class="card">
        <h2>Sensor calibration</h2>
        <p>Run this on the bike: the module samples both beams and stores light thresholds.</p>
        <div class="actions">
          <button class="btn btn-outline" type="button" data-action="calibrate">
            Start calibration
          </button>
          <div class="inline-status" data-state="idle" data-ref="calibrationStatus">
            Not started
          </div>
          <div class="meta" data-ref="calibrationMeta"></div>
        </div>
      </article>

      <article class="card">
        <h2>Clock sync</h2>
        <p>Send the phone’s current time so lap timestamps match reality even without Wi-Fi.</p>
        <div class="actions">
          <button class="btn btn-outline" type="button" data-action="sync-clock">
            Send current time
            <span data-ref="clockPreview"></span>
          </button>
          <div class="inline-status" data-state="idle" data-ref="clockStatus">
            Awaiting sync
          </div>
          <div class="meta" data-ref="clockMeta"></div>
        </div>
      </article>
    </section>

    <section class="progress">
      <h3>Launch checklist</h3>
      <ul class="progress-list">
        <li class="progress-item" data-progress="profile">
          <div class="progress-indicator"></div>
          Track profile saved
        </li>
        <li class="progress-item" data-progress="calibration">
          <div class="progress-indicator"></div>
          Sensor calibration captured
        </li>
        <li class="progress-item" data-progress="clock">
          <div class="progress-indicator"></div>
          Clock synced from phone
        </li>
      </ul>
    </section>

    <footer class="footer-cta">
      <button class="btn btn-primary btn-next" type="button" data-ref="nextStep" disabled>
        Continue to rider setup
      </button>
      <p class="hint footer-hint">Finish all tasks above to unlock the next step.</p>
    </footer>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>
`;

app.innerHTML = template;

const refs = {
  profileForm: app.querySelector('[data-form="profile"]'),
  profileStatus: app.querySelector('[data-ref="profileStatus"]'),
  calibrationStatus: app.querySelector('[data-ref="calibrationStatus"]'),
  calibrationMeta: app.querySelector('[data-ref="calibrationMeta"]'),
  clockStatus: app.querySelector('[data-ref="clockStatus"]'),
  clockMeta: app.querySelector('[data-ref="clockMeta"]'),
  clockPreviewTargets: Array.from(
    app.querySelectorAll('[data-ref="clockPreview"]')
  ),
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
  profile: loadSession(APP_STORAGE_KEY, {
    trackName: "",
    lapGoal: "",
    updatedAt: null,
  }),
  calibration: loadSession(CALIBRATION_KEY, { completedAt: null }),
  clock: loadSession(CLOCK_KEY, { syncedAt: null }),
};

hydrateProfile();
hydrateMeta();
refreshProgress();
updateClockPreview();
updateConnectionIndicator();
handleClockSync(true);

refs.profileForm.addEventListener("submit", handleProfileSubmit);
refs.profileForm.addEventListener("input", handleProfileDraft);
bindActionButtons("calibrate", handleCalibration);
bindActionButtons("sync-clock", handleClockSync);

window.addEventListener("online", updateConnectionIndicator);
window.addEventListener("offline", updateConnectionIndicator);
setInterval(updateClockPreview, 1000);

function handleProfileSubmit(event) {
  event.preventDefault();
  const formData = new FormData(refs.profileForm);
  const trackName = String(formData.get("trackName") || "").trim();
  const lapGoal = Number(formData.get("lapGoal"));

  if (!trackName) {
    return setInlineStatus(
      refs.profileStatus,
      "Track name is required",
      "error"
    );
  }
  if (!Number.isFinite(lapGoal) || lapGoal < 1 || lapGoal > 20) {
    return setInlineStatus(
      refs.profileStatus,
      "Lap goal must be between 1 and 20",
      "error"
    );
  }

  const payload = { trackName, lapGoal, updatedAt: Date.now() };
  setInlineStatus(refs.profileStatus, "Saving…", "idle");
  refs.profileForm.querySelector('button[type="submit"]').disabled = true;

  sendCommand("/api/admin/setup", payload)
    .then((result) => {
      if (!result.ok) throw result.error;
      state.profile = {
        trackName,
        lapGoal: String(lapGoal),
        updatedAt: payload.updatedAt,
      };
      saveSession(APP_STORAGE_KEY, state.profile);
      setInlineStatus(refs.profileStatus, "Profile saved on module", "success");
      showToast("Track profile saved");
      refreshProgress();
    })
    .catch((error) => {
      console.warn(error);
      setInlineStatus(refs.profileStatus, "Failed to save profile", "error");
      showToast("Save failed — retry once the module is online", "error");
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
  saveSession(APP_STORAGE_KEY, state.profile);

  if (!state.profile.updatedAt) {
    setInlineStatus(
      refs.profileStatus,
      "Draft stored locally (not saved on module)",
      "idle"
    );
  }
}

function handleCalibration() {
  setInlineStatus(refs.calibrationStatus, "Calibrating…", "idle");
  sendCommand("/api/sensors/calibrate", { startedAt: Date.now() })
    .then((result) => {
      if (!result.ok) throw result.error;
      state.calibration = { completedAt: Date.now() };
      saveSession(CALIBRATION_KEY, state.calibration);
      setInlineStatus(refs.calibrationStatus, "Calibration stored", "success");
      hydrateMeta();
      refreshProgress();
      showToast("Sensor calibration updated");
    })
    .catch((error) => {
      console.warn(error);
      setInlineStatus(refs.calibrationStatus, "Calibration failed", "error");
      showToast("Could not reach sensors", "error");
    });
}

function handleClockSync(fromAuto = false) {
  const now = new Date();
  const payload = {
    epochMs: now.getTime(),
    iso8601: now.toISOString(),
    tzOffsetMinutes: now.getTimezoneOffset() * -1,
  };
  setInlineStatus(
    refs.clockStatus,
    fromAuto ? "Auto-sync in progress…" : "Sending time…",
    "idle"
  );
  sendCommand("/api/time/sync", payload)
    .then((result) => {
      if (!result.ok) throw result.error;
      state.clock = { syncedAt: Date.now() };
      saveSession(CLOCK_KEY, state.clock);
      setInlineStatus(
        refs.clockStatus,
        fromAuto ? "Clock auto-synced" : "Clock updated",
        "success"
      );
      hydrateMeta();
      refreshProgress();
      showToast(fromAuto ? "Clock auto-synced" : "Clock synchronized");
    })
    .catch((error) => {
      console.warn(error);
      setInlineStatus(refs.clockStatus, "Time sync failed", "error");
      showToast("Time sync failed", "error");
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
    setInlineStatus(refs.profileStatus, `Last saved ${formatted}`, "success");
  } else if (state.profile.trackName || state.profile.lapGoal) {
    setInlineStatus(
      refs.profileStatus,
      "Draft stored locally (not saved on module)",
      "idle"
    );
  }
}

function hydrateMeta() {
  refs.calibrationMeta.textContent = state.calibration.completedAt
    ? `Last run ${formatTimestamp(state.calibration.completedAt)}`
    : "No calibration data yet.";

  refs.clockMeta.textContent = state.clock.syncedAt
    ? `Synced ${formatTimestamp(state.clock.syncedAt)}`
    : "Clock has never been synced.";
}

function refreshProgress() {
  const profileDone = Boolean(state.profile.trackName && state.profile.lapGoal);
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

function updateClockPreview() {
  if (!refs.clockPreviewTargets.length) {
    return;
  }
  const now = new Date();
  const formatted = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  refs.clockPreviewTargets.forEach((node) => {
    node.textContent = `(${formatted})`;
  });
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
    ? "Phone linked to module AP"
    : "Offline mode (expected)";
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
      ? "Great! This will navigate to the rider setup page."
      : "Finish all tasks above to unlock the next step.";
  }
}

function handleNextStep() {
  if (refs.nextStep?.disabled) {
    return;
  }
  showToast("Next page coming soon — stay tuned!");
}

function loadSession(key, fallback) {
  try {
    const raw = sessionStore.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveSession(key, value) {
  try {
    sessionStore.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors; admin can refresh and continue
  }
}

function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    const day = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const time = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${day} at ${time}`;
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

async function sendCommand(path, body) {
  if (isMocked()) {
    await delay(500);
    return { ok: true, mocked: true };
  }

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

function isMocked() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
