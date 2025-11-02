# Repository Guidelines

All contributors share a single PlatformIO environment for the ESP32-C3 DevKitM-1. The goal is to keep firmware changes predictable, reviewable, and ready for quick iteration on hardware.

## Project Structure & Module Organization

- `platformio.ini` holds the single `esp32c3` environment; keep board- or serial-port tweaks confined to this file.
- `src/main.cpp` contains the Arduino `setup()`/`loop()` entrypoint. Place feature-specific helpers above `loop()` and preface new modules with brief comments describing their hardware touchpoints.
- Add reusable components under `lib/<module-name>/` and shared headers in `include/`. Keep assets such as calibration data in `data/` so they can be uploaded with the SPIFFS tooling.

## Build, Flash & Monitor Commands

- `pio run` compiles the firmware and should stay warning-free.
- `pio run -t upload` builds and flashes to the connected DevKitM-1; set `upload_port` in `platformio.ini` if auto-detection fails.
- `pio device monitor --baud 115200` opens the serial console; use `Ctrl+]` to exit.

## Coding Style & Naming Conventions

- Follow the existing two-space indentation and brace-on-same-line style shown in `src/main.cpp`.
- Prefer descriptive `camelCase` for functions and variables; reserve all-caps for constants like `LED_PIN`.
- Guard hardware-specific logic behind helper functions (`toggleIndicatorLed()`) to simplify mocking in tests.
- Run `pio run --target clangformat` if you add a `.clang-format`; otherwise keep manual formatting consistent.

## Testing Guidelines

- Place unit tests under `test/<feature>/` using PlatformIO’s Unity harness; name files `test_<behavior>.cpp`.
- Run `pio test` before opening a pull request. Aim to cover edge cases that could cause flashing or timing regressions.
- For features requiring hardware verification, document the manual test steps in the PR description.

## Commit & Pull Request Guidelines

- Write commit titles in the imperative mood (`Add blink timing guard`) with <= 72 characters, followed by concise body details when needed.
- Reference GitHub issues with `Fixes #123` in the final commit or PR description.
- Open PRs with a change summary, test evidence (`pio test`, serial logs), and screenshots of relevant serial output when timing or diagnostics change.
- Ask for review before merging and wait for at least one approval plus a green CI check (once CI is configured).
