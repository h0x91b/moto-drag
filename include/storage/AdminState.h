#pragma once

#include <cstdint>
#include <string>

namespace storage
{
  struct AdminState
  {
    std::string trackName;
    uint8_t lapGoal;
    uint64_t updatedAt;
    uint64_t calibrationAt;
    uint16_t ambientLevel;
    uint16_t ambientMin;
    uint16_t ambientMax;
    uint16_t ambientNoise;
    uint16_t triggerDelta;
    uint64_t clockSyncedAt;
    uint64_t clockSyncedMillis;
    uint64_t clockSyncedHostAt;
  };

  struct CalibrationSnapshot
  {
    uint16_t ambientLevel;
    uint16_t ambientMin;
    uint16_t ambientMax;
    uint16_t ambientNoise;
    uint16_t triggerDelta;
  };

  void initAdminState();
  const AdminState &getAdminState();
  void updateTrackProfile(const std::string &trackName, uint8_t lapGoal, uint64_t updatedAt);
  void markCalibration(uint64_t completedAt, const CalibrationSnapshot &snapshot);
  void applyClockSync(uint64_t epochMs, uint64_t moduleMillis, uint64_t hostCapturedAt);
  uint64_t computeModuleTimeMs(uint32_t nowMillis);
  uint64_t computeModuleMillis(uint32_t nowMillis);
  void saveAdminState();
} // namespace storage
