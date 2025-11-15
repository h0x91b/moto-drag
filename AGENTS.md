# Repository Guidelines

This repo hosts firmware for the moto-drag lap timer built on the ESP32-WROOM-32 DevKitC (aka ESP32 Dev Module). Iterate in small steps so track tests stay predictable.

## Project Context

- Device runs as an open Wi-Fi AP (`moto-drag`) on the bike, exposing a SPA for riders right after a gymkhana run.
- `/api/last.json` returns an array of `[timestamp, [lap1, lap2, …]]`; future revisions will swap the static payload for sensor-driven data and persistent history.
- Current focus: reliable lap capture with a responsive UI; next milestones add calibration, cloud sync, and OTA updates.

## Architecture Overview

- `src/main.cpp` bootstraps SPIFFS, the HTTP server, and the blink loop; extend it with helper functions instead of crowding `loop()`. Mind the ESP32-WROOM-32 pinout (GPIO2 is the onboard LED, ADCs start at GPIO32/33).
- Static assets reside under `data/` and are flashed with `pio run -t uploadfs`; treat it as the SPA root.
- Ride snapshots live in typed structs backed by `std::vector` containers (capped at 10 laps each, 100 rides total) and serialize through ArduinoJson; follow that pattern when expanding the API surface.

## Project Structure & Module Organization

- `platformio.ini` defines the lone `esp32dev` environment plus serial speeds; add new environments only when testing alternate boards.
- Place shared headers in `include/` and reusable modules under `lib/`; document wiring assumptions near each entrypoint.
- Store calibration blobs or seed datasets alongside the SPA in `data/` so they ride with filesystem flashes.

## Build, Flash & Monitor Commands

- `pio run` compiles firmware; warnings must be resolved before merge.
- `pio run -t upload` builds and flashes the ESP32-WROOM-32 DevKitC; set `upload_port` if auto-detect fails.
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

## ТЗ и статус

- ТЗ по пользовательским историям: `docs/user_stories_ru.md`.

### Чеклист

- [x] Описаны актуальные пользовательские истории и критерии (см. `docs/user_stories_ru.md`).
- [ ] Реализовать мастер первой настройки (админ, название трассы, синхронизация времени, калибровка одного/двух лучей).
- [ ] Добавить повторный доступ к калибровке и переключению режима лучей в админ-интерфейсе.
- [ ] Реализовать веб-форму гонки (`moto.local`) с вводом имени, режима, количества кругов и кнопкой «Готов».
- [ ] Настроить обработку лазерных датчиков: старт по первому импульсу, игнорирование заднего колеса, поддержка двух лучей.
- [ ] Обновлять LED-панель: отображать `00:00.000` до старта, обновлять таймер каждые 100 мс, показывать результат бегущей строкой, поддержать кнопку сброса.
- [ ] Хранить заезды в SPIFFS как дневные бинарные журналы (MessagePack/CBOR) с короткими ключами и идентификаторами пилотов/трасс, реализовать справочники, разделы «Мои заезды»/«Топы» и выгрузку архива.
- [ ] Перенести HUB75-панель на ESP32 или ESP32-S3. ESP32-C3 не поддерживает LCD/I2S DMA, поэтому библиотека `ESP32-HUB75-MatrixPanel-I2S-DMA` не компилируется (ошибки `Bus_Parallel16`).
