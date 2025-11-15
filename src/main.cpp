#include <Arduino.h>

#include "app/LegacyFirmware.h"

void setup()
{
  app::legacySetup();
}

void loop()
{
  app::legacyLoop();
}
