#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace app
{
  struct RaceStatus
  {
    bool locked = false;
    bool running = false;
    bool readyForStart = false;
    bool lapArmed = false;
    std::string riderName;
    uint64_t lockedAt = 0;
    uint64_t startedAt = 0;
    uint64_t lastLapAt = 0;
    uint32_t lockedAtMillis = 0;
    uint32_t startedAtMillis = 0;
    uint32_t lastLapMillis = 0;
    std::vector<float> laps;
  };

  struct RaceResult
  {
    bool hasResult = false;
    std::string riderName;
    std::vector<float> laps;
    uint64_t totalMs = 0;
    uint64_t finishedAt = 0;
  };

  void initRaceController();
  void tickRaceController(uint32_t nowMillis);

  bool lockTrack(const std::string &riderName, uint32_t nowMillis);
  bool resetTrack(uint32_t nowMillis);

  bool isTrackLocked();
  bool isRaceRunning();

  const RaceStatus &getRaceStatus();
  const RaceResult &getLastResult();

  uint32_t getCurrentTimerMs(uint32_t nowMillis);
} // namespace app
