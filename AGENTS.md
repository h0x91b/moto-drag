# Repository Guidelines

This repo hosts firmware for the moto-drag lap timer built on the ESP32-C3 DevKitM-1. Iterate in small steps so track tests stay predictable.

## Project Context

- Device runs as an open Wi-Fi AP (`moto-drag`) on the bike, exposing a SPA for riders right after a gymkhana run.
- `/api/last.json` returns an array of `[timestamp, [lap1, lap2, …]]`; future revisions will swap the static payload for sensor-driven data and persistent history.
- Current focus: reliable lap capture with a responsive UI; next milestones add calibration, cloud sync, and OTA updates.

## Architecture Overview

- `src/main.cpp` bootstraps SPIFFS, the HTTP server, and the blink loop; extend it with helper functions instead of crowding `loop()`.
- Static assets reside under `assets/` and are flashed with `pio run -t uploadfs`; treat it as the SPA root.

## Project Structure & Module Organization

- `platformio.ini` defines the lone `esp32c3` environment plus serial speeds; add new environments only when testing alternate boards.
- Place shared headers in `include/` and reusable modules under `lib/`; document wiring assumptions near each entrypoint.
- Store calibration blobs or seed datasets alongside the SPA in `assets/` so they ride with filesystem flashes.

## Build, Flash & Monitor Commands

- `pio run` compiles firmware; warnings must be resolved before merge.
- `pio run -t upload` builds and flashes the DevKitM-1; set `upload_port` if auto-detect fails.
- `pio device monitor --baud 115200` tails serial logs; open it before resetting the board to capture boot notes.

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
