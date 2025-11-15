#include "app/RaceController.h"

#include <Arduino.h>
#include <algorithm>
#include <cmath>

#include "sensors/LightSensor.h"
#include "storage/AdminState.h"
#include "storage/Rides.h"

namespace app
{
  namespace
  {
    constexpr uint32_t kLockHoldTimeoutMs = 90000;
    constexpr uint32_t kRaceTimeoutMs = 600000;
    constexpr uint32_t kMinLapIntervalMs = 500;

    RaceStatus raceStatus;
    RaceResult lastResult;
    bool lastBeamBroken = false;
    uint32_t lastActivityMillis = 0;

    uint64_t computeModuleTime(uint32_t referenceMillis)
    {
      return storage::computeModuleTimeMs(referenceMillis);
    }

    float roundLapSeconds(uint32_t lapDurationMs)
    {
      float seconds = static_cast<float>(lapDurationMs) / 1000.0f;
      return std::round(seconds * 1000.0f) / 1000.0f;
    }

    void clearTrackLockState()
    {
      raceStatus.locked = false;
      raceStatus.running = false;
      raceStatus.readyForStart = false;
      raceStatus.lapArmed = false;
      raceStatus.riderName.clear();
      raceStatus.laps.clear();
      raceStatus.lockedAt = 0;
      raceStatus.startedAt = 0;
      raceStatus.lastLapAt = 0;
      raceStatus.lockedAtMillis = 0;
      raceStatus.startedAtMillis = 0;
      raceStatus.lastLapMillis = 0;
      lastActivityMillis = 0;
    }

    void appendRideSnapshot()
    {
      if (raceStatus.laps.empty())
      {
        return;
      }

      uint64_t rideTimestampMs = raceStatus.startedAt != 0 ? raceStatus.startedAt : raceStatus.lastLapAt;
      if (rideTimestampMs == 0)
      {
        rideTimestampMs = computeModuleTime(raceStatus.startedAtMillis);
      }
      uint32_t rideTimestamp = rideTimestampMs > 0 ? static_cast<uint32_t>(rideTimestampMs / 1000ULL)
                                                   : raceStatus.startedAtMillis / 1000UL;
      storage::appendRide(rideTimestamp, raceStatus.laps);
    }

    void persistResultSnapshot(uint32_t nowMillis, uint64_t finishTimeMs)
    {
      if (!raceStatus.running && raceStatus.laps.empty())
      {
        return;
      }

      lastResult.hasResult = true;
      lastResult.riderName = raceStatus.riderName;
      lastResult.laps = raceStatus.laps;
      if (raceStatus.running && raceStatus.startedAtMillis != 0)
      {
        lastResult.totalMs = static_cast<uint64_t>(nowMillis - raceStatus.startedAtMillis);
      }
      else if (raceStatus.startedAtMillis != 0 && raceStatus.lastLapMillis != 0)
      {
        lastResult.totalMs = static_cast<uint64_t>(raceStatus.lastLapMillis - raceStatus.startedAtMillis);
      }
      else
      {
        lastResult.totalMs = 0;
      }
      lastResult.finishedAt = finishTimeMs;
      appendRideSnapshot();
    }

    void unlockTrack(uint32_t nowMillis)
    {
      uint64_t finishTime = computeModuleTime(nowMillis);
      persistResultSnapshot(nowMillis, finishTime);
      clearTrackLockState();
    }

    uint64_t computeTimestampOrUptime(uint32_t nowMillis)
    {
      uint64_t moduleTime = computeModuleTime(nowMillis);
      if (moduleTime == 0)
      {
        moduleTime = static_cast<uint64_t>(nowMillis);
      }
      return moduleTime;
    }

    void startRace(uint32_t nowMillis)
    {
      raceStatus.running = true;
      raceStatus.readyForStart = false;
      raceStatus.lapArmed = false;
      raceStatus.startedAtMillis = nowMillis;
      raceStatus.startedAt = computeTimestampOrUptime(nowMillis);
      raceStatus.lastLapMillis = nowMillis;
      raceStatus.lastLapAt = raceStatus.startedAt;
      lastActivityMillis = nowMillis;
      Serial.printf("[Race] Start for '%s'\n", raceStatus.riderName.c_str());
    }

    void recordLap(uint32_t nowMillis)
    {
      if (!raceStatus.running || raceStatus.startedAtMillis == 0)
      {
        return;
      }

      uint32_t reference = raceStatus.lastLapMillis != 0 ? raceStatus.lastLapMillis : raceStatus.startedAtMillis;
      uint32_t lapDuration = nowMillis - reference;
      if (lapDuration < kMinLapIntervalMs)
      {
        return;
      }

      float lapSeconds = roundLapSeconds(lapDuration);
      raceStatus.laps.push_back(lapSeconds);
      raceStatus.lastLapMillis = nowMillis;
      raceStatus.lastLapAt = computeTimestampOrUptime(nowMillis);
      raceStatus.lapArmed = false;
      lastActivityMillis = nowMillis;
      Serial.printf("[Race] Lap %u for '%s': %.3f s\n",
                    static_cast<unsigned int>(raceStatus.laps.size()),
                    raceStatus.riderName.c_str(),
                    lapSeconds);

      const auto &admin = storage::getAdminState();
      if (admin.lapGoal >= 1 && raceStatus.laps.size() >= admin.lapGoal)
      {
        Serial.println("[Race] Lap goal reached, finishing");
        unlockTrack(nowMillis);
      }
    }

    void handleBeamChange(bool wasBroken, bool nowBroken, uint32_t nowMillis)
    {
      if (!raceStatus.locked)
      {
        return;
      }

      if (!raceStatus.running)
      {
        if (!nowBroken)
        {
          if (!raceStatus.readyForStart)
          {
            raceStatus.readyForStart = true;
            Serial.println("[Race] Beam clear, ready for start");
          }
          return;
        }

        if (!wasBroken && nowBroken && raceStatus.readyForStart)
        {
          startRace(nowMillis);
        }
        return;
      }

      if (wasBroken && !nowBroken)
      {
        raceStatus.lapArmed = true;
        return;
      }

      if (!wasBroken && nowBroken && raceStatus.lapArmed)
      {
        recordLap(nowMillis);
      }
    }

    void handleTimeouts(uint32_t nowMillis)
    {
      if (!raceStatus.locked)
      {
        return;
      }

      if (!lastActivityMillis)
      {
        lastActivityMillis = nowMillis;
      }

      if (!raceStatus.running)
      {
        if (nowMillis - raceStatus.lockedAtMillis >= kLockHoldTimeoutMs)
        {
          Serial.println("[Race] Lock timeout, releasing track");
          clearTrackLockState();
        }
        return;
      }

      if (nowMillis - raceStatus.startedAtMillis >= kRaceTimeoutMs)
      {
        Serial.println("[Race] Race timeout, finishing");
        unlockTrack(nowMillis);
      }
    }
  } // namespace

  void initRaceController()
  {
    clearTrackLockState();
    lastResult = RaceResult{};
    lastBeamBroken = sensors::isBeamBroken();
    lastActivityMillis = millis();
    Serial.println("[Race] Controller initialized");
  }

  void tickRaceController(uint32_t nowMillis)
  {
    bool beamBroken = sensors::isBeamBroken();
    if (beamBroken != lastBeamBroken)
    {
      handleBeamChange(lastBeamBroken, beamBroken, nowMillis);
      lastBeamBroken = beamBroken;
    }

    handleTimeouts(nowMillis);
  }

  bool lockTrack(const std::string &riderName, uint32_t nowMillis)
  {
    if (raceStatus.locked)
    {
      return false;
    }

    raceStatus.locked = true;
    raceStatus.running = false;
    raceStatus.readyForStart = !sensors::isBeamBroken();
    raceStatus.lapArmed = false;
    raceStatus.riderName = riderName;
    raceStatus.laps.clear();
    raceStatus.lockedAtMillis = nowMillis;
    raceStatus.lockedAt = computeTimestampOrUptime(nowMillis);
    raceStatus.startedAt = 0;
    raceStatus.startedAtMillis = 0;
    raceStatus.lastLapAt = 0;
    raceStatus.lastLapMillis = 0;
    lastActivityMillis = nowMillis;

    Serial.printf("[Race] Track locked for '%s'\n", raceStatus.riderName.c_str());
    return true;
  }

  bool resetTrack(uint32_t nowMillis)
  {
    if (!raceStatus.locked)
    {
      return false;
    }

    Serial.println("[Race] Manual reset requested");
    unlockTrack(nowMillis);
    return true;
  }

  bool isTrackLocked()
  {
    return raceStatus.locked;
  }

  bool isRaceRunning()
  {
    return raceStatus.running;
  }

  const RaceStatus &getRaceStatus()
  {
    return raceStatus;
  }

  const RaceResult &getLastResult()
  {
    return lastResult;
  }

  uint32_t getCurrentTimerMs(uint32_t nowMillis)
  {
    if (!raceStatus.locked || raceStatus.startedAtMillis == 0)
    {
      return 0;
    }

    if (!raceStatus.running)
    {
      return raceStatus.lastLapMillis > raceStatus.startedAtMillis
                 ? raceStatus.lastLapMillis - raceStatus.startedAtMillis
                 : 0;
    }

    return nowMillis - raceStatus.startedAtMillis;
  }
} // namespace app
