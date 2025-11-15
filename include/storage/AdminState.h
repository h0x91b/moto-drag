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
    uint64_t clockSyncedAt;
    uint64_t clockSyncedMillis;
    uint64_t clockSyncedHostAt;
  };

  void initAdminState();
  const AdminState &getAdminState();
  void updateTrackProfile(const std::string &trackName, uint8_t lapGoal, uint64_t updatedAt);
  void markCalibration(uint64_t completedAt);
  void applyClockSync(uint64_t epochMs, uint64_t moduleMillis, uint64_t hostCapturedAt);
  uint64_t computeModuleTimeMs(uint32_t nowMillis);
  uint64_t computeModuleMillis(uint32_t nowMillis);
  void saveAdminState();
} // namespace storage
