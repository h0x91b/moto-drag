#include "storage/Rides.h"

#include <algorithm>
#include <utility>

namespace storage
{
namespace
{
std::vector<RideRecord> rideHistory;
} // namespace

void appendRide(uint32_t timestamp, const std::vector<float> &lapTimes)
{
  RideRecord record;
  record.timestamp = timestamp;
  size_t lapCount = std::min(lapTimes.size(), MAX_LAPS_PER_RIDE);
  record.laps.reserve(lapCount);
  for (size_t i = 0; i < lapCount; ++i)
  {
    record.laps.push_back(lapTimes[i]);
  }

  rideHistory.push_back(std::move(record));
  if (rideHistory.size() > MAX_RIDES)
  {
    rideHistory.erase(rideHistory.begin());
  }
}

void seedRideHistory()
{
  rideHistory.clear();
  appendRide(1234567u, {13.768f, 14.751f, 13.801f});
  appendRide(1234580u, {15.501f, 14.809f, 14.601f});
}

const std::vector<RideRecord> &getRideHistory()
{
  return rideHistory;
}
} // namespace storage
