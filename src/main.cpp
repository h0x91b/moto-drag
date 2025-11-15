#include <Arduino.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>
#include <WebServer.h>
#include <WiFi.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>
#include <algorithm>
#include <vector>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

const int LED_PIN = LED_BUILTIN; // Default LED pin (GPIO2 on ESP32-WROOM-32 DevKitC)
const int PHOTORESISTOR_PIN = 0; // Legacy sensor pin from the ESP32-C3 build, kept for reference
const unsigned long BLINK_INTERVAL_MS = 500;
const unsigned long SENSOR_LOG_INTERVAL_MS = 500;

const char *AP_SSID = "moto-drag";
const uint16_t HTTP_PORT = 80;

constexpr size_t MAX_RIDES = 100;
constexpr size_t MAX_LAPS_PER_RIDE = 10;
constexpr size_t JSON_BUFFER_SIZE = 4096; // Buffer headroom for /api/last.json payload

constexpr uint16_t PANEL_RES_X = 32; // Base constants used by DMA config (see comment in mxconfig below)
constexpr uint16_t PANEL_RES_Y = 64;
constexpr uint8_t NUM_ROWS = 1;
constexpr uint8_t NUM_COLS = 1;

// HUB75 pin map (ESP32-C3 GPIO numbering)
constexpr int8_t R1_PIN = 7;
constexpr int8_t G1_PIN = 5;
constexpr int8_t B1_PIN = 6;
constexpr int8_t R2_PIN = 12;
constexpr int8_t G2_PIN = 13;
constexpr int8_t B2_PIN = 14;
constexpr int8_t A_PIN = 4;
constexpr int8_t B_PIN = 3;
constexpr int8_t C_PIN = 2;
constexpr int8_t D_PIN = 1;
constexpr int8_t E_PIN = -1; // Not used on 1/16 scan panels
constexpr int8_t LAT_PIN = 21;
constexpr int8_t OE_PIN = 15;
constexpr int8_t CLK_PIN = 20;

WebServer webServer(HTTP_PORT);

bool ledState = false;
unsigned long lastBlinkAt = 0;
unsigned long lastSensorSampleAt = 0;

struct RideRecord
{
  uint32_t timestamp;
  std::vector<float> laps;
};

static std::vector<RideRecord> rideHistory;

MatrixPanel_I2S_DMA *matrixPanel = nullptr;
bool matrixReady = false;
constexpr unsigned long MATRIX_MESSAGE_INTERVAL_MS = 1000;
unsigned long lastMatrixMessageAt = 0;
bool matrixInvertState = false;

void initMatrix();
void drawMatrixGreeting(bool inverted);
void updateMatrixGreeting(unsigned long now);
void legacySetup();
void legacyLoop();

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
  JsonDocument doc;
  JsonArray root = doc.to<JsonArray>();

  for (const auto &ride : rideHistory)
  {
    JsonArray rideArr = root.add<JsonArray>();
    rideArr.add(ride.timestamp);
    JsonArray lapsArr = rideArr.add<JsonArray>();
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

void initMatrix()
{
  if (matrixPanel)
  {
    return;
  }

  HUB75_I2S_CFG::i2s_pins pins = {
      R1_PIN, G1_PIN, B1_PIN,
      R2_PIN, G2_PIN, B2_PIN,
      A_PIN, B_PIN, C_PIN, D_PIN, E_PIN,
      LAT_PIN, OE_PIN, CLK_PIN};

  HUB75_I2S_CFG mxconfig(
      PANEL_RES_X * 2, // NO CAMBIES ESTO
      PANEL_RES_Y / 2, // NO CAMBIES ESTO
      NUM_ROWS * NUM_COLS,
      pins);

  mxconfig.double_buff = false;
  mxconfig.clkphase = true;

  matrixPanel = new MatrixPanel_I2S_DMA(mxconfig);
  if (!matrixPanel)
  {
    Serial.println("[LED] matrix allocation failed");
    return;
  }
  if (!matrixPanel->begin())
  {
    Serial.println("[LED] matrix begin() failed");
    delete matrixPanel;
    matrixPanel = nullptr;
    return;
  }

  matrixPanel->setBrightness8(96);
  matrixPanel->setTextWrap(false);
  matrixPanel->setTextSize(1);
  matrixPanel->clearScreen();

  matrixReady = true;
  drawMatrixGreeting(false);
  Serial.println("[LED] HUB75 DMA matrix ready");
}

void drawMatrixGreeting(bool inverted)
{
  if (!matrixReady || !matrixPanel)
  {
    return;
  }

  uint16_t background = inverted ? matrixPanel->color565(12, 0, 48) : matrixPanel->color565(0, 0, 0);
  uint16_t accent = inverted ? matrixPanel->color565(255, 200, 16) : matrixPanel->color565(0, 220, 160);
  uint16_t text = matrixPanel->color565(255, 255, 255);
  uint16_t frame = matrixPanel->color565(32, 32, 32);

  matrixPanel->fillScreen(background);
  matrixPanel->drawRect(0, 0, matrixPanel->width(), matrixPanel->height(), frame);

  matrixPanel->setCursor(4, 6);
  matrixPanel->setTextColor(accent);
  matrixPanel->print("moto-drag");

  matrixPanel->setCursor(10, 18);
  matrixPanel->setTextColor(text);
  matrixPanel->print("HELLO!");
}

void updateMatrixGreeting(unsigned long now)
{
  if (!matrixReady || !matrixPanel)
  {
    return;
  }
  if (now - lastMatrixMessageAt < MATRIX_MESSAGE_INTERVAL_MS)
  {
    return;
  }

  matrixInvertState = !matrixInvertState;
  lastMatrixMessageAt = now;
  drawMatrixGreeting(matrixInvertState);
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

void handleLightSensor(unsigned long now)
{
  if (now - lastSensorSampleAt < SENSOR_LOG_INTERVAL_MS)
  {
    return;
  }

  int raw = analogRead(PHOTORESISTOR_PIN);
  if (Serial)
  {
    Serial.printf("[ADC] photoresistor=%d\n", raw); // Avoid blocking when USB console is detached
  }
  lastSensorSampleAt = now;
}

void setup()
{
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.begin(115200);
  waitForSerial();
  Serial.println("\n[BOOT] ESP32-WROOM-32 blink demo ready");
  Serial.printf("[BOOT] Using built-in LED on GPIO%d\n", LED_PIN);
  Serial.println("[BOOT] Legacy firmware preserved in legacySetup()/legacyLoop()");
}

void loop()
{
  unsigned long now = millis();
  if (now - lastBlinkAt < BLINK_INTERVAL_MS)
  {
    return;
  }

  ledState = !ledState;
  digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  if (Serial)
  {
    Serial.printf("[BLINK] GPIO%d -> %s\n", LED_PIN, ledState ? "ON" : "OFF");
  }
  lastBlinkAt = now;
}

void legacySetup()
{
  pinMode(LED_PIN, OUTPUT);
  pinMode(PHOTORESISTOR_PIN, INPUT);
  Serial.begin(115200);
  waitForSerial();
  Serial.println("\n[BOOT] ESP32-WROOM-32 ready with Wi-Fi access point");

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

  initMatrix();
}

void legacyLoop()
{
  unsigned long now = millis();
  handleBlink(now);
  handleLightSensor(now);
  updateMatrixGreeting(now);
  webServer.handleClient();
}
