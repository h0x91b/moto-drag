#include <Arduino.h>
#include <WiFi.h>

const int LED_PIN = 8; // For ESP32-C3 DevKitM-1 the onboard LED is GPIO8
const unsigned long BLINK_INTERVAL_MS = 300;

const char *AP_SSID = "moto-drag";
const uint16_t WEB_SERVER_PORT = 80;

WiFiServer webServer(WEB_SERVER_PORT);

bool ledState = false;
unsigned long lastBlinkAt = 0;

void waitForSerial()
{
  unsigned long start = millis();
  while (!Serial && millis() - start < 3000) {
    delay(10);
  }
  delay(200); // Allow the host OS to finish binding the port
}

// Bring up an open access point and start the HTTP server.
void startAccessPoint()
{
  WiFi.mode(WIFI_AP);
  if (WiFi.softAP(AP_SSID)) {
    Serial.print("[AP] started: ");
    Serial.println(AP_SSID);
    Serial.print("[AP] IP: ");
    Serial.println(WiFi.softAPIP());
    webServer.begin();
    Serial.println("[HTTP] server listening on port 80");
  } else {
    Serial.println("[AP] failed to start");
  }
}

void handleBlink(unsigned long now)
{
  if (now - lastBlinkAt < BLINK_INTERVAL_MS) {
    return;
  }

  ledState = !ledState;
  digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  Serial.println(ledState ? "LED ON" : "LED OFF");
  lastBlinkAt = now;
}

void handleClient()
{
  WiFiClient client = webServer.available();
  if (!client) {
    return;
  }

  Serial.println("[HTTP] client connected");
  String currentLine = "";
  unsigned long start = millis();
  while (client.connected() && millis() - start < 1000) {
    if (!client.available()) {
      delay(1);
      continue;
    }

    char c = client.read();
    if (c == '\r') {
      continue;
    }

    if (c == '\n') {
      if (currentLine.length() == 0) {
        break; // Blank line marks the end of the HTTP headers.
      }
      currentLine = "";
    } else {
      currentLine += c;
    }
  }

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: application/json");
  client.println("Connection: close");
  client.println();
  client.print("{\"led\":\"");
  client.print(ledState ? "on" : "off");
  client.println("\"}");

  client.stop();
  Serial.println("[HTTP] client disconnected");
}

void setup()
{
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  waitForSerial();
  Serial.println("\n[BOOT] ESP32-C3 ready with Wi-Fi access point");
  startAccessPoint();
}

void loop()
{
  unsigned long now = millis();
  handleBlink(now);
  handleClient();
}
