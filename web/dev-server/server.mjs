import express from "express";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const app = express();
const port = process.env.MOTO_DEV_API_PORT || 5174;
const statePath = resolve(process.cwd(), "dev-server", "state.json");

app.use(express.json());

const DEFAULT_TRACK_LOCK = {
  locked: false,
  riderName: null,
  lockedAt: null,
  startedAt: null,
  laps: [],
  lastLapMark: null,
};

const DEFAULT_RESULT = {
  riderName: null,
  laps: [],
  totalMs: 0,
  finishedAt: null,
};

const DEFAULT_STATE = {
  trackName: "Unknown track",
  lapGoal: 3,
  calibrationAt: null,
  clockSyncedAt: null,
  clockSyncedMillis: null,
  clockSyncedHostAt: null,
  rides: [],
  updatedAt: null,
  trackLock: DEFAULT_TRACK_LOCK,
  lastResult: DEFAULT_RESULT,
};

const readState = () => {
  try {
    const raw = readFileSync(statePath, "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
};

const writeState = (nextState) => {
  writeFileSync(statePath, JSON.stringify(nextState, null, 2) + "\n");
};

const state = readState();
state.trackLock = { ...DEFAULT_TRACK_LOCK, ...state.trackLock };
state.lastResult = { ...DEFAULT_RESULT, ...state.lastResult };

const moduleClockNow = () => {
  if (
    typeof state.clockSyncedAt !== "number" ||
    typeof state.clockSyncedHostAt !== "number"
  ) {
    return null;
  }
  const delta = Math.max(0, Date.now() - state.clockSyncedHostAt);
  return state.clockSyncedAt + delta;
};

const moduleMillisNow = () => {
  if (
    typeof state.clockSyncedMillis !== "number" ||
    typeof state.clockSyncedHostAt !== "number"
  ) {
    return null;
  }
  const delta = Math.max(0, Date.now() - state.clockSyncedHostAt);
  return state.clockSyncedMillis + delta;
};

function log(action, payload = {}) {
  console.log(`[dev-api] ${action}`, payload);
}

const computeTimerMs = () => {
  if (!state.trackLock.locked) return 0;
  const reference =
    typeof state.trackLock.startedAt === "number"
      ? state.trackLock.startedAt
      : null;
  if (reference === null) return 0;
  return Math.max(0, Date.now() - reference);
};

const getRaceStatus = () => ({
  ...state.trackLock,
  currentTimerMs: computeTimerMs(),
  lastResult: state.lastResult,
});

app.get("/api/last.json", (_req, res) => {
  log("GET /api/last.json");
  res.json(state.rides ?? []);
});

app.get("/api/admin/state", (_req, res) => {
  log("GET /api/admin/state");
  res.json({
    trackName: state.trackName,
    lapGoal: state.lapGoal,
    updatedAt: state.updatedAt,
    calibrationAt: state.calibrationAt,
    clockSyncedAt: state.clockSyncedAt,
    clockSyncedMillis: state.clockSyncedMillis,
    clockSyncedHostAt: state.clockSyncedHostAt,
    moduleTimeMs: moduleClockNow(),
    moduleMillis: moduleMillisNow(),
  });
});

app.get("/api/race/status", (_req, res) => {
  log("GET /api/race/status");
  res.json(getRaceStatus());
});

app.post("/api/admin/setup", (req, res) => {
  const { trackName, lapGoal } = req.body || {};
  if (!trackName || !Number.isFinite(Number(lapGoal))) {
    log("POST /api/admin/setup -> 400", { body: req.body });
    return res.status(400).json({ error: "Invalid payload" });
  }
  state.trackName = trackName;
  state.lapGoal = Number(lapGoal);
  state.updatedAt = Date.now();
  writeState(state);
  log("POST /api/admin/setup -> 200", { trackName, lapGoal });
  setTimeout(() => {
    res.json({ ok: true, savedAt: state.updatedAt });
  }, 250);
});

app.post("/api/sensors/calibrate", (_req, res) => {
  state.calibrationAt = Date.now();
  writeState(state);
  log("POST /api/sensors/calibrate -> 200", {
    calibrationAt: state.calibrationAt,
  });
  setTimeout(() => {
    res.json({ ok: true, completedAt: state.calibrationAt });
  }, 450);
});

app.post("/api/time/sync", (req, res) => {
  const { epochMs, millis } = req.body || {};
  const now = Date.now();
  const nextEpoch = Number(epochMs);
  const nextMillis = Number(millis);
  state.clockSyncedAt = Number.isFinite(nextEpoch) ? nextEpoch : now;
  state.clockSyncedMillis = Number.isFinite(nextMillis) ? nextMillis : now;
  state.clockSyncedHostAt = now;
  writeState(state);
  log("POST /api/time/sync -> 200", {
    clockSyncedAt: state.clockSyncedAt,
    clockSyncedMillis: state.clockSyncedMillis,
  });
  setTimeout(() => {
    res.json({
      ok: true,
      syncedAt: state.clockSyncedAt,
      syncedMillis: state.clockSyncedMillis,
      hostCapturedAt: state.clockSyncedHostAt,
      moduleTimeMs: moduleClockNow(),
      moduleMillis: moduleMillisNow(),
    });
  }, 300);
});

const simTimers = new Set();

const registerTimer = (timer) => {
  simTimers.add(timer);
  return timer;
};

const clearRaceSimulation = () => {
  for (const timer of simTimers) {
    clearTimeout(timer);
  }
  simTimers.clear();
};

const scheduleRaceSimulation = () => {
  clearRaceSimulation();
  state.lastResult = { ...DEFAULT_RESULT };
  const triggerStart = () => {
    if (!state.trackLock.locked) return;
    const now = Date.now();
    state.trackLock.startedAt = now;
    state.trackLock.lastLapMark = now;
    writeState(state);
    log("[sim] race started", { rider: state.trackLock.riderName });
    scheduleNextLap(1);
  };
  registerTimer(setTimeout(triggerStart, 2000));
};

const scheduleNextLap = (lapIndex) => {
  const lapGoal = Math.max(1, Number(state.lapGoal) || 1);
  if (lapIndex > lapGoal) {
    finishRace();
    return;
  }
  const delay = 5000 + Math.floor(Math.random() * 2000);
  registerTimer(
    setTimeout(() => {
      if (!state.trackLock.locked) return;
      const now = Date.now();
      const lastMark =
        state.trackLock.lastLapMark ??
        state.trackLock.startedAt ??
        state.trackLock.lockedAt ??
        now;
      const lapSeconds = Number(((now - lastMark) / 1000).toFixed(3));
      state.trackLock.laps = [...state.trackLock.laps, lapSeconds];
      state.trackLock.lastLapMark = now;
      writeState(state);
      log("[sim] lap completed", { lapIndex, lapSeconds });
      if (lapIndex >= lapGoal) {
        finishRace();
      } else {
        scheduleNextLap(lapIndex + 1);
      }
    }, delay)
  );
};

const finishRace = () => {
  if (state.trackLock.laps?.length) {
    state.rides = state.rides || [];
    state.rides.push([Date.now(), state.trackLock.laps]);
    if (state.rides.length > 20) {
      state.rides.shift();
    }
  }
  state.lastResult = {
    riderName: state.trackLock.riderName,
    laps: state.trackLock.laps.slice(),
    totalMs: computeTimerMs(),
    finishedAt: Date.now(),
  };
  clearRaceSimulation();
  state.trackLock = { ...DEFAULT_TRACK_LOCK };
  writeState(state);
  log("[sim] race finished");
};

app.post("/api/race/lock", (req, res) => {
  const riderName = String(req.body?.riderName || "").trim();
  if (!riderName) {
    log("POST /api/race/lock -> 400", { body: req.body });
    return res.status(400).json({ error: "Missing riderName" });
  }
  if (state.trackLock.locked) {
    log("POST /api/race/lock -> 409", { riderName });
    return res.status(409).json(getRaceStatus());
  }
  const now = Date.now();
  state.trackLock = {
    locked: true,
    riderName,
    lockedAt: now,
    startedAt: null,
    laps: [],
    lastLapMark: null,
  };
  writeState(state);
  scheduleRaceSimulation();
  log("POST /api/race/lock -> 200", state.trackLock);
  res.json({ ok: true, state: getRaceStatus() });
});

app.post("/api/race/reset", (_req, res) => {
  const snapshot = getRaceStatus();
  clearRaceSimulation();
  state.lastResult = {
    riderName: snapshot.riderName,
    laps: snapshot.laps.slice(),
    totalMs: computeTimerMs(),
    finishedAt: Date.now(),
  };
  state.trackLock = { ...DEFAULT_TRACK_LOCK };
  writeState(state);
  log("POST /api/race/reset -> 200");
  res.json({ ok: true, state: getRaceStatus() });
});

app.listen(port, () => {
  console.log(`[dev-api] listening on http://localhost:${port}`);
});
