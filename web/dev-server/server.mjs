import express from "express";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const app = express();
const port = process.env.MOTO_DEV_API_PORT || 5174;
const statePath = resolve(process.cwd(), "dev-server", "state.json");

app.use(express.json());

const DEFAULT_STATE = {
  trackName: "Unknown track",
  lapGoal: 3,
  calibrationAt: null,
  clockSyncedAt: null,
  clockSyncedMillis: null,
  clockSyncedHostAt: null,
  rides: [],
  updatedAt: null,
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

app.listen(port, () => {
  console.log(`[dev-api] listening on http://localhost:${port}`);
});
