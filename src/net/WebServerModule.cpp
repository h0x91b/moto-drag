#include "net/WebServerModule.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>
#include <WebServer.h>
#include <WiFi.h>

#include "storage/Rides.h"

namespace net
{
namespace
{
constexpr char kApSsid[] = "moto-drag";
constexpr uint16_t kHttpPort = 80;
constexpr size_t kJsonBufferSize = 4096;

WebServer webServer(kHttpPort);
bool serverReady = false;
bool fsMounted = false;

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

  for (const auto &ride : storage::getRideHistory())
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
  payload.reserve(kJsonBufferSize / 2);
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

void mountFilesystem()
{
  if (fsMounted)
  {
    return;
  }

  if (!SPIFFS.begin(true))
  {
    Serial.println("[FS] mount failed");
    return;
  }

  Serial.println("[FS] mounted");
  fsMounted = true;
  dumpFilesystem();
}

void startAccessPoint()
{
  WiFi.mode(WIFI_AP);
  if (WiFi.softAP(kApSsid))
  {
    Serial.printf("[AP] started: %s\n", kApSsid);
    Serial.print("[AP] IP: ");
    Serial.println(WiFi.softAPIP());
  }
  else
  {
    Serial.println("[AP] failed to start");
  }
}

void configureRoutes()
{
  webServer.on("/", HTTP_GET, handleRoot);
  webServer.on("/api/last.json", HTTP_GET, handleLastRides);
  webServer.onNotFound(handleNotFound);
  webServer.begin();
  Serial.println("[HTTP] server listening on port 80");
}
} // namespace

void initNetwork()
{
  mountFilesystem();
  startAccessPoint();
  configureRoutes();
  serverReady = true;
}

void tickNetwork()
{
  if (serverReady)
  {
    webServer.handleClient();
  }
}

bool isNetworkReady()
{
  return serverReady;
}
} // namespace net
