#pragma once

#include <Arduino.h>

namespace platform
{
void waitForSerial(uint32_t timeoutMs = 3000, uint32_t settleDelayMs = 200);
} // namespace platform
