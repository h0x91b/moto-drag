# Repository Guidelines

> ⚠️ **Discipline check:** Every time work starts or finishes, review this file and `TODO.md`. Keep both updated so the hardware and SPA workflows never drift from reality.

This repo hosts firmware for the moto-drag lap timer now running on the ESP32-C3 DevKit (USB CDC/`/dev/cu.usbmodem*`). Iterate in small steps so track tests stay predictable, keep ESP32-WROOM-32 notes for the HUB75 panel, and build SPA assets out of the `web/` workspace with strict mobile-first layouts (phones and paddock tablets are the only clients in the field).

## Project Context

- Device runs as an open Wi-Fi AP (`moto-drag`) on the bike, exposing a SPA for riders right after a gymkhana run.
- `/api/last.json` returns an array of `[timestamp, [lap1, lap2, …]]`; future revisions will swap the static payload for sensor-driven data and persistent history.
- Current focus: reliable lap capture with a responsive UI; next milestones add calibration, cloud sync, and OTA updates.

## Architecture Overview

- `src/main.cpp` bootstraps SPIFFS, the HTTP server, and the blink loop; extend it with helper functions instead of crowding `loop()`. Mind the ESP32-C3 pinout (GPIO8 is the onboard LED, ADCs start at GPIO0/1); keep older WROOM wiring comments in each module if they still apply.
- `web/` holds the Vite workspace for SPA pages (pure JS + CSS). `data/` only stores built artifacts copied from `web/dist`; commit the built payloads so flashing works even without Node locally.
- Static assets reside under `data/` and are flashed with `pio run -t uploadfs`; treat it as the SPA root.
- Ride snapshots live in typed structs backed by `std::vector` containers (capped at 10 laps each, 100 rides total) and serialize through ArduinoJson; follow that pattern when expanding the API surface.

### Module Layout

- Keep headers under `include/<feature>/FeatureName.h` and implementations under `src/<feature>/FeatureName.cpp`.
- Current feature folders: `led/` (status LED routines), `sensors/` (photo/light inputs), `storage/` (ride history), `net/` (Wi-Fi + HTTP), `display/` (HUB75 panel), `app/` (legacy firmware entry points), and `platform/` (serial/bootstrap helpers).
- Each module owns its GPIO definitions to avoid accidental cross-coupling. Document pin choices at the top of every module file.
- New features follow the same pattern: create `include/<feature>/FeatureName.h` first, declare `init*()`/`tick*()` pairs, then implement them under `src/<feature>/FeatureName.cpp`. Wire them into `setup()`/`loop()` from `src/main.cpp`.

## Project Structure & Module Organization

- `platformio.ini` defines the lone `esp32c3` environment (monitor/upload on `/dev/cu.usbmodem*`); add new environments only when testing alternate boards. `web/package.json` drives the SPA tooling (`npm run dev`, `npm run sync`).
- Place shared headers in `include/` and reusable modules under `lib/`; document wiring assumptions near each entrypoint.
- Store calibration blobs or seed datasets alongside the SPA in `data/` so they ride with filesystem flashes.

## Build, Flash & Monitor Commands

- `pio run` compiles firmware; warnings must be resolved before merge.
- `pio run -t upload` builds and flashes the ESP32-C3 DevKit; set `upload_port` if auto-detect fails (default `/dev/cu.usbmodem*`).
- `pio device monitor --baud 115200` tails serial logs; open it before resetting the board to capture boot notes.
- SPA loop:
  - `cd web && npm run dev:api` to boot the local Express dev API (`web/dev-server/server.mjs`). Set `MOTO_DEV_API_PORT` to override the default `5174`.
  - `npm run dev` for UI development, or `npm run dev:full` to launch the API dev server and Vite together (requires `npm-run-all`).
  - `npm run sync` builds + copies `web/dist` into the repo `data/` folder so `pio run -t uploadfs` can flash the assets.
  - Keep runtime logic dependency-free (vanilla JS + CSS) so it works without internet connections once hosted on the bike.
  - Layouts must read clearly at 360–414 px widths, with touch targets ≥44 px and safe-area padding for notches.

## SPA Pages

### Mobile-first requirements

- All views must boot instantly on device APs with no WAN access, using only bundled fonts/assets.
- Primary controls should sit near the top and/or within reach of thumbs (consider sticky quick actions).
- Respect `env(safe-area-inset-*)` for notched displays, allow system dark-mode contrast, and keep animations subtle for shaky pit-lane scenarios.
- Test interactions in portrait first; landscape/tablet tweaks come second.

- **First-run admin wizard** (`web/src/main.js`): capture track name & lap goal, trigger sensor calibration, and push the phone clock to the module. Loads the current config from `/api/admin/state`, POSTs to `/api/admin/setup`, `/api/sensors/calibrate`, `/api/time/sync`, and exposes quick-thumb action buttons for mobile users.
- **Live laps** (legacy static page from `data/index.html`) consumes `/api/last.json`; port it into the Vite workspace as a dedicated view before layering admin-only tools there.
- Upcoming: calibration re-run page, race readiness form (`moto.local`), rider history (“My Rides”), and leaderboards (“Топы”). Follow the Vite workflow, serve every page offline-first, and keep sensors/admin tooling under `/admin/*`.

## Coding Style & Naming Conventions

- Use two-space indentation and K&R braces, mirroring the current sketch.
- Prefer descriptive `camelCase` identifiers; reserve SCREAMING_CASE for globals that map to pins or configuration constants.
- Wrap multi-step hardware access in helpers (`readLapSensors()`) so UI code can focus on formatting.

## Testing Guidelines

- Organize PlatformIO Unity tests under `test/<feature>/` with files named `test_<behavior>.cpp`.
- Run `pio test` before every PR; capture sensor edge cases and race conditions that affect lap timing.
- Record any manual verification (track tests, scope captures) in the PR description for future regression checks.

## Commit & Pull Request Guidelines

- Commit titles stay imperative (`Add lap buffer parser`) and under 72 characters; expand details in the body when needed.
- Reference issues with `Fixes #ID` and list the commands or monitors you ran.
- PRs need a short change summary, UI/serial evidence, and at least one reviewer approval before merge.

## ТЗ и статус

- ТЗ по пользовательским историям: `docs/user_stories_ru.md`.
- Живой список задач и больших блокеров хранится в `TODO.md`; обновляй его вместе с итоговыми заметками в этом документе.
