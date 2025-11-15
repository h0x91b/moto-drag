#pragma once

#include <Arduino.h>

namespace sensors
{
void initLightSensor();
void tickLightSensor(unsigned long now);
} // namespace sensors
