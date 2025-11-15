#include "sensors/LightSensor.h"

#include <Arduino.h>

#include "storage/AdminState.h"

namespace sensors
{
  namespace
  {
    constexpr gpio_num_t kPhotoresistorPin = GPIO_NUM_0;
    constexpr uint32_t kSampleIntervalUs = 1000;
    constexpr unsigned long kCalibrationSampleDelayMs = 5;
    constexpr uint16_t kFallbackBreakThreshold = 1500;
    constexpr uint16_t kFallbackReleaseThreshold = 1800;

    uint32_t lastSampleUs = 0;
    uint16_t lastRawValue = 0;
    bool lastBeamBroken = false;
  } // namespace

  void initLightSensor()
  {
    pinMode(static_cast<uint8_t>(kPhotoresistorPin), INPUT);
    Serial.printf("[SENSOR] Photoresistor on GPIO%d ready\n", static_cast<int>(kPhotoresistorPin));
  }

  void tickLightSensor(unsigned long now)
  {
    uint32_t nowUs = micros();
    if (nowUs - lastSampleUs < kSampleIntervalUs)
    {
      return;
    }
    lastSampleUs = nowUs;

    int raw = analogRead(static_cast<uint8_t>(kPhotoresistorPin));
    if (raw < 0)
    {
      raw = 0;
    }
    if (raw > 4095)
    {
      raw = 4095;
    }

    lastRawValue = static_cast<uint16_t>(raw);

    const auto &state = storage::getAdminState();
    bool calibrated = state.ambientLevel > 0 && state.triggerDelta > 0 && state.ambientLevel >= state.triggerDelta;
    uint16_t breakThreshold = calibrated ? static_cast<uint16_t>(state.ambientLevel - state.triggerDelta)
                                         : kFallbackBreakThreshold;
    uint16_t releaseThreshold = calibrated
                                    ? static_cast<uint16_t>(breakThreshold + (state.triggerDelta / 2))
                                    : kFallbackReleaseThreshold;
    if (releaseThreshold <= breakThreshold)
    {
      releaseThreshold = static_cast<uint16_t>(breakThreshold + 1);
    }
    if (calibrated && releaseThreshold > state.ambientLevel)
    {
      releaseThreshold = state.ambientLevel;
    }

    bool beamBroken = lastBeamBroken;
    if (!lastBeamBroken)
    {
      if (raw <= breakThreshold)
      {
        beamBroken = true;
      }
    }
    else
    {
      if (raw >= releaseThreshold)
      {
        beamBroken = false;
      }
    }

    if (beamBroken != lastBeamBroken)
    {
      lastBeamBroken = beamBroken;
      if (beamBroken)
      {
        Serial.printf("[SENSOR] BEAM break raw=%d break=%u release=%u noise=%u\n",
                      raw,
                      breakThreshold,
                      releaseThreshold,
                      state.ambientNoise);
      }
      else
      {
        Serial.printf("[SENSOR] BEAM restored raw=%d threshold=%u\n",
                      raw,
                      releaseThreshold);
      }
    }
  }

  bool captureLightCalibration(LightCalibrationStats &stats, uint32_t durationMs)
  {
    const uint32_t startedAt = millis();
    uint16_t minValue = 0x0FFF;
    uint16_t maxValue = 0;
    uint32_t sum = 0;
    uint32_t samples = 0;

    while (millis() - startedAt < durationMs)
    {
      int raw = analogRead(static_cast<uint8_t>(kPhotoresistorPin));
      if (raw < 0)
      {
        raw = 0;
      }
      if (raw > 4095)
      {
        raw = 4095;
      }
      uint16_t value = static_cast<uint16_t>(raw);
      if (value < minValue)
      {
        minValue = value;
      }
      if (value > maxValue)
      {
        maxValue = value;
      }
      sum += value;
      ++samples;
      delay(kCalibrationSampleDelayMs);
      yield();
    }

    if (samples == 0)
    {
      return false;
    }

    stats.minValue = minValue;
    stats.maxValue = maxValue;
    stats.averageValue = static_cast<uint16_t>(sum / samples);
    stats.noiseLevel = static_cast<uint16_t>(maxValue - minValue);
    stats.sampleCount = static_cast<uint16_t>(samples > 0xFFFF ? 0xFFFF : samples);
    Serial.printf("[SENSOR] Calibration stats: samples=%u avg=%u min=%u max=%u noise=%u\n",
                  static_cast<unsigned int>(samples),
                  stats.averageValue,
                  stats.minValue,
                  stats.maxValue,
                  stats.noiseLevel);
    return true;
  }
} // namespace sensors
