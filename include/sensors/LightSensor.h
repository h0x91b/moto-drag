#pragma once

#include <Arduino.h>

namespace sensors
{
void initLightSensor();
void tickLightSensor(unsigned long now);
bool isBeamBroken();
uint16_t getLastRawValue();

struct LightCalibrationStats
{
  uint16_t minValue;
  uint16_t maxValue;
  uint16_t averageValue;
  uint16_t noiseLevel;
  uint16_t sampleCount;
};

bool captureLightCalibration(LightCalibrationStats &stats, uint32_t durationMs = 4000);
} // namespace sensors
