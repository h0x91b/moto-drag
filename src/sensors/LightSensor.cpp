#include "sensors/LightSensor.h"

#include <Arduino.h>

namespace sensors
{
namespace
{
constexpr gpio_num_t kPhotoresistorPin = GPIO_NUM_0;
constexpr unsigned long kLogIntervalMs = 500;

unsigned long lastSampleAt = 0;
} // namespace

void initLightSensor()
{
  pinMode(static_cast<uint8_t>(kPhotoresistorPin), INPUT);
  Serial.printf("[SENSOR] Photoresistor on GPIO%d ready\n", static_cast<int>(kPhotoresistorPin));
}

void tickLightSensor(unsigned long now)
{
  if (now - lastSampleAt < kLogIntervalMs)
  {
    return;
  }

  int raw = analogRead(static_cast<uint8_t>(kPhotoresistorPin));
  if (Serial)
  {
    Serial.printf("[SENSOR] photoresistor=%d\n", raw);
  }
  lastSampleAt = now;
}
} // namespace sensors
