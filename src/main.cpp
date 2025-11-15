#include <Arduino.h>

#include "app/LegacyFirmware.h"
#include "led/Blinker.h"
#include "platform/SerialUtils.h"

void setup()
{
  Serial.begin(115200);
  platform::waitForSerial();

  led::initBlinker();
  Serial.println("\n[BOOT] ESP32-C3 blink demo ready");
  Serial.println("[BOOT] Legacy firmware is available via app::legacySetup()/legacyLoop()");
}

void loop()
{
  led::tickBlinker(millis());
}
