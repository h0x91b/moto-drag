#include "app/LegacyFirmware.h"

#include <Arduino.h>

#include "app/RaceController.h"
#include "display/MatrixPanel.h"
#include "led/Blinker.h"
#include "net/WebServerModule.h"
#include "platform/SerialUtils.h"
#include "sensors/LightSensor.h"
#include "storage/AdminState.h"
#include "storage/Rides.h"

namespace app
{
  void legacySetup()
  {
    Serial.begin(115200);
    platform::waitForSerial();
    Serial.println("\n[BOOT] ESP32-WROOM-32 ready with Wi-Fi access point");

    led::initBlinker();
    sensors::initLightSensor();
    storage::initAdminState();
    storage::seedRideHistory();
    initRaceController();
    net::initNetwork();
    // display::initMatrixPanel();

    Serial.println("[BOOT] Legacy firmware initialized (call legacyLoop() to run it)");
  }

  void legacyLoop()
  {
    unsigned long now = millis();
    led::tickBlinker(now);
    sensors::tickLightSensor(now);
    tickRaceController(now);
    // display::tickMatrixPanel(now);
    net::tickNetwork();
  }
} // namespace app
