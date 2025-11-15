#include "platform/SerialUtils.h"

#include <Arduino.h>

namespace platform
{
void waitForSerial(uint32_t timeoutMs, uint32_t settleDelayMs)
{
  unsigned long start = millis();
  while (!Serial && millis() - start < timeoutMs)
  {
    delay(10);
  }
  delay(settleDelayMs);
}
} // namespace platform
