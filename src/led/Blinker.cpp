#include "led/Blinker.h"

#include <Arduino.h>

namespace led
{
namespace
{
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

constexpr gpio_num_t kLedPin = static_cast<gpio_num_t>(LED_BUILTIN);
constexpr unsigned long kBlinkIntervalMs = 500;

bool ledState = false;
unsigned long lastToggleAt = 0;
} // namespace

void initBlinker()
{
  pinMode(static_cast<uint8_t>(kLedPin), OUTPUT);
  digitalWrite(static_cast<uint8_t>(kLedPin), LOW);
  Serial.printf("[BLINK] Built-in LED configured on GPIO%d\n", static_cast<int>(kLedPin));
}

void tickBlinker(unsigned long now)
{
  if (now - lastToggleAt < kBlinkIntervalMs)
  {
    return;
  }

  ledState = !ledState;
  digitalWrite(static_cast<uint8_t>(kLedPin), ledState ? HIGH : LOW);
  lastToggleAt = now;

  if (Serial)
  {
    Serial.printf("[BLINK] GPIO%d -> %s\n", static_cast<int>(kLedPin), ledState ? "ON" : "OFF");
  }
}

gpio_num_t blinkPin()
{
  return kLedPin;
}
} // namespace led
