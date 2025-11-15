#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

namespace storage
{
constexpr size_t MAX_RIDES = 100;
constexpr size_t MAX_LAPS_PER_RIDE = 10;

struct RideRecord
{
  uint32_t timestamp;
  std::vector<float> laps;
};

void appendRide(uint32_t timestamp, const std::vector<float> &lapTimes);
void seedRideHistory();
const std::vector<RideRecord> &getRideHistory();
} // namespace storage
