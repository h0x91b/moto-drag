#pragma once

#include <Arduino.h>

namespace led
{
void initBlinker();
void tickBlinker(unsigned long now);
gpio_num_t blinkPin();
} // namespace led
