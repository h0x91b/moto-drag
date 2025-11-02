#include <Arduino.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>
#include <WebServer.h>
#include <WiFi.h>
#include <algorithm>
#include <vector>

const int LED_PIN = 8; // Onboard LED for ESP32-C3 DevKitM-1 lives on GPIO8
const unsigned long BLINK_INTERVAL_MS = 500;

const char *AP_SSID = "moto-drag";
const uint16_t HTTP_PORT = 80;

constexpr size_t MAX_RIDES = 100;
constexpr size_t MAX_LAPS_PER_RIDE = 10;
constexpr size_t JSON_CAPACITY = JSON_ARRAY_SIZE(MAX_RIDES) +
                                 MAX_RIDES * (JSON_ARRAY_SIZE(2) + JSON_ARRAY_SIZE(MAX_LAPS_PER_RIDE));
constexpr size_t JSON_BUFFER_SIZE = JSON_CAPACITY + 512;

WebServer webServer(HTTP_PORT);

bool ledState = false;
unsigned long lastBlinkAt = 0;

struct RideRecord
{
  uint32_t timestamp;
  std::vector<float> laps;
};

static std::vector<RideRecord> rideHistory;

void appendRide(uint32_t timestamp, const std::vector<float> &lapTimes)
{
  RideRecord record;
  record.timestamp = timestamp;
  size_t lapCount = std::min(lapTimes.size(), MAX_LAPS_PER_RIDE);
  record.laps.reserve(lapCount);
  for (size_t i = 0; i < lapCount; ++i)
  {
    record.laps.push_back(lapTimes[i]);
  }

  rideHistory.push_back(std::move(record));
  if (rideHistory.size() > MAX_RIDES)
  {
    rideHistory.erase(rideHistory.begin());
  }
}

void seedRideHistory()
{
  rideHistory.clear();
  appendRide(1234567u, {13.768f, 14.751f, 13.801f});
  appendRide(1234580u, {15.501f, 14.809f, 14.601f});
}

void waitForSerial()
{
  unsigned long start = millis();
  while (!Serial && millis() - start < 3000)
  {
    delay(10);
  }
  delay(200); // Allow the host OS to finish binding the port
}

void dumpFilesystem()
{
  Serial.println("[FS] listing /");
  File root = SPIFFS.open("/");
  if (!root)
  {
    Serial.println("[FS] failed to open root");
    return;
  }
  if (!root.isDirectory())
  {
    Serial.println("[FS] root is not a directory");
    root.close();
    return;
  }

  bool anyEntries = false;
  File entry = root.openNextFile();
  while (entry)
  {
    anyEntries = true;
    Serial.printf("[FS] %s (%u bytes)\n", entry.name(), (unsigned int)entry.size());
    entry = root.openNextFile();
  }
  if (!anyEntries)
  {
    Serial.println("[FS] (empty)");
  }
  root.close();
}

String getContentType(const String &path)
{
  if (path.endsWith(".html"))
    return "text/html";
  if (path.endsWith(".css"))
    return "text/css";
  if (path.endsWith(".js"))
    return "application/javascript";
  if (path.endsWith(".json"))
    return "application/json";
  if (path.endsWith(".ico"))
    return "image/x-icon";
  return "text/plain";
}

bool handleFileRead(String path)
{
  Serial.print("[HTTP] lookup ");
  Serial.println(path);

  if (path.endsWith("/"))
  {
    path += "index.html";
  }

  if (!SPIFFS.exists(path))
  {
    Serial.print("[HTTP] miss ");
    Serial.println(path);
    return false;
  }

  File file = SPIFFS.open(path, "r");
  if (!file)
  {
    Serial.print("[HTTP] open failed ");
    Serial.println(path);
    return false;
  }

  Serial.print("[HTTP] serve ");
  Serial.println(path);
  webServer.streamFile(file, getContentType(path));
  file.close();
  return true;
}

void handleRoot()
{
  Serial.println("[HTTP] GET /");
  if (!handleFileRead("/index.html"))
  {
    webServer.send(500, "text/plain", "index.html missing");
  }
}

void handleLastRides()
{
  Serial.println("[HTTP] GET /api/last.json");
  DynamicJsonDocument doc(JSON_BUFFER_SIZE);
  JsonArray root = doc.to<JsonArray>();

  for (const auto &ride : rideHistory)
  {
    JsonArray rideArr = root.createNestedArray();
    rideArr.add(ride.timestamp);
    JsonArray lapsArr = rideArr.createNestedArray();
    for (float lap : ride.laps)
    {
      lapsArr.add(lap);
    }
  }

  String payload;
  payload.reserve(JSON_BUFFER_SIZE / 2);
  serializeJson(doc, payload);
  webServer.send(200, "application/json", payload);
}

void handleNotFound()
{
  Serial.print("[HTTP] 404 ");
  Serial.println(webServer.uri());
  if (handleFileRead(webServer.uri()))
  {
    return;
  }
  webServer.send(404, "text/plain", "Not found");
}

void startAccessPoint()
{
  WiFi.mode(WIFI_AP);
  if (WiFi.softAP(AP_SSID))
  {
    Serial.print("[AP] started: ");
    Serial.println(AP_SSID);
    Serial.print("[AP] IP: ");
    Serial.println(WiFi.softAPIP());
  }
  else
  {
    Serial.println("[AP] failed to start");
  }
}

void handleBlink(unsigned long now)
{
  if (now - lastBlinkAt < BLINK_INTERVAL_MS)
  {
    return;
  }

  ledState = !ledState;
  digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  lastBlinkAt = now;
}

void setup()
{
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  waitForSerial();
  Serial.println("\n[BOOT] ESP32-C3 ready with Wi-Fi access point");

  if (!SPIFFS.begin(true))
  {
    Serial.println("[FS] mount failed");
  }
  else
  {
    Serial.println("[FS] mounted");
    dumpFilesystem();
  }

  seedRideHistory();

  startAccessPoint();

  webServer.on("/", HTTP_GET, handleRoot);
  webServer.on("/api/last.json", HTTP_GET, handleLastRides);
  webServer.onNotFound(handleNotFound);
  webServer.begin();
  Serial.println("[HTTP] server listening on port 80");
}

void loop()
{
  unsigned long now = millis();
  handleBlink(now);
  webServer.handleClient();
}
