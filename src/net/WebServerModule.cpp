#include "net/WebServerModule.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>
#include <WebServer.h>
#include <WiFi.h>
#include <ctime>

#include "storage/AdminState.h"
#include "storage/Rides.h"

namespace net
{
  namespace
  {
    constexpr char kApSsid[] = "moto-drag";
    constexpr uint16_t kHttpPort = 80;
    constexpr size_t kJsonBufferSize = 4096;
    constexpr size_t kStateJsonBufferSize = 512;
    constexpr size_t kRequestJsonBufferSize = 512;
    constexpr unsigned long kClockLogIntervalMs = 10000;
    constexpr size_t kClockTimestampBufSize = 32;

    WebServer webServer(kHttpPort);
    bool serverReady = false;
    bool fsMounted = false;
    unsigned long lastClockLogAt = 0;

    template <typename TDoc>
    void sendJsonResponse(uint16_t status, const TDoc &doc)
    {
      String payload;
      serializeJson(doc, payload);
      webServer.send(status, "application/json", payload);
    }

    void sendJsonError(uint16_t status, const char *message)
    {
      StaticJsonDocument<128> doc;
      doc["error"] = message;
      sendJsonResponse(status, doc);
    }

  template <typename TDoc>
  bool parseJsonBody(TDoc &doc, String *rawBody = nullptr)
  {
    if (!webServer.hasArg("plain"))
    {
      sendJsonError(400, "Missing body");
      return false;
      }

    String body = webServer.arg("plain");
    if (rawBody != nullptr)
    {
      *rawBody = body;
    }
    DeserializationError err = deserializeJson(doc, body);
      if (err)
      {
        sendJsonError(400, "Invalid JSON");
        return false;
      }
      return true;
    }

    uint64_t resolveTimestampOrNow(uint64_t candidate, uint32_t nowMillis)
    {
      if (candidate != 0)
      {
        return candidate;
      }

      uint64_t moduleTime = storage::computeModuleTimeMs(nowMillis);
      if (moduleTime != 0)
      {
        return moduleTime;
      }

      return static_cast<uint64_t>(nowMillis);
    }

    bool formatClockTimestamp(uint64_t epochMs, char *buffer, size_t length)
    {
      time_t seconds = static_cast<time_t>(epochMs / 1000ULL);
#if defined(_WIN32)
      struct tm timeinfo;
      if (gmtime_s(&timeinfo, &seconds) != 0)
      {
        return false;
      }
#else
      struct tm timeinfo;
      if (gmtime_r(&seconds, &timeinfo) == nullptr)
      {
        return false;
      }
#endif
      if (strftime(buffer, length, "%Y-%m-%d %H:%M:%S", &timeinfo) == 0)
      {
        return false;
      }
      return true;
    }

    void logModuleClockIfSynced(uint32_t nowMillis)
    {
      unsigned long now = nowMillis;
      if (now - lastClockLogAt < kClockLogIntervalMs)
      {
        return;
      }

      uint64_t moduleTime = storage::computeModuleTimeMs(nowMillis);
      if (moduleTime == 0)
      {
        return;
      }

      lastClockLogAt = now;
      uint64_t moduleMillis = storage::computeModuleMillis(nowMillis);
      char timestamp[kClockTimestampBufSize];
      bool formatted = formatClockTimestamp(moduleTime, timestamp, sizeof(timestamp));
      unsigned long long millisPart = static_cast<unsigned long long>(moduleTime % 1000ULL);
      if (formatted)
      {
        Serial.printf("[Clock] moduleTime=%s.%03llu UTC, moduleMillis=%llu\n",
                      timestamp,
                      millisPart,
                      static_cast<unsigned long long>(moduleMillis));
      }
      else
      {
        Serial.printf("[Clock] moduleTime=%llu ms, moduleMillis=%llu\n",
                      static_cast<unsigned long long>(moduleTime),
                      static_cast<unsigned long long>(moduleMillis));
      }
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

    void handleAdminState()
    {
      Serial.println("[HTTP] GET /api/admin/state");
      const storage::AdminState &state = storage::getAdminState();
      StaticJsonDocument<kStateJsonBufferSize> doc;

      doc["trackName"] = state.trackName.c_str();
      doc["lapGoal"] = state.lapGoal;
      if (state.updatedAt)
        doc["updatedAt"] = state.updatedAt;
      else
        doc["updatedAt"] = nullptr;

      if (state.calibrationAt)
        doc["calibrationAt"] = state.calibrationAt;
      else
        doc["calibrationAt"] = nullptr;

      if (state.clockSyncedAt)
        doc["clockSyncedAt"] = state.clockSyncedAt;
      else
        doc["clockSyncedAt"] = nullptr;

      if (state.clockSyncedMillis)
        doc["clockSyncedMillis"] = state.clockSyncedMillis;
      else
        doc["clockSyncedMillis"] = nullptr;

      if (state.clockSyncedHostAt)
        doc["clockSyncedHostAt"] = state.clockSyncedHostAt;
      else
        doc["clockSyncedHostAt"] = nullptr;

      uint32_t nowMillis = millis();
      uint64_t moduleTimeMs = storage::computeModuleTimeMs(nowMillis);
      uint64_t moduleMillis = storage::computeModuleMillis(nowMillis);
      if (moduleTimeMs)
        doc["moduleTimeMs"] = moduleTimeMs;
      else
        doc["moduleTimeMs"] = nullptr;

      if (moduleMillis)
        doc["moduleMillis"] = moduleMillis;
      else
        doc["moduleMillis"] = nullptr;

      sendJsonResponse(200, doc);
    }

  void handleAdminSetup()
  {
    Serial.println("[HTTP] POST /api/admin/setup");
    StaticJsonDocument<kRequestJsonBufferSize> doc;
    String rawBody;
    if (!parseJsonBody(doc, &rawBody))
    {
      return;
    }
    Serial.print("[HTTP] body /api/admin/setup: ");
    Serial.println(rawBody);

      String trackName = doc["trackName"] | "";
      trackName.trim();
      if (trackName.length() > 30)
      {
        trackName = trackName.substring(0, 30);
      }

      int lapGoal = doc["lapGoal"] | 0;
      if (trackName.isEmpty() || lapGoal < 1 || lapGoal > 20)
      {
      sendJsonError(400, "Invalid payload");
      return;
    }

      uint32_t nowMillis = millis();
      uint64_t updatedAt = resolveTimestampOrNow(doc["updatedAt"] | 0ULL, nowMillis);
      storage::updateTrackProfile(std::string(trackName.c_str()), static_cast<uint8_t>(lapGoal), updatedAt);

      StaticJsonDocument<128> response;
      response["ok"] = true;
      response["savedAt"] = updatedAt;
      sendJsonResponse(200, response);
    }

    void handleSensorsCalibrate()
    {
      Serial.println("[HTTP] POST /api/sensors/calibrate");
      StaticJsonDocument<kRequestJsonBufferSize> doc;
      if (!parseJsonBody(doc))
      {
        return;
      }

      uint32_t nowMillis = millis();
      uint64_t completedAt = resolveTimestampOrNow(doc["startedAt"] | 0ULL, nowMillis);
      storage::markCalibration(completedAt);

      StaticJsonDocument<128> response;
      response["ok"] = true;
      response["completedAt"] = completedAt;
      sendJsonResponse(200, response);
    }

    void handleTimeSync()
    {
      Serial.println("[HTTP] POST /api/time/sync");
      StaticJsonDocument<kRequestJsonBufferSize> doc;
      if (!parseJsonBody(doc))
      {
        return;
      }

      uint32_t nowMillis = millis();
      uint64_t epochMs = doc["epochMs"] | 0ULL;
      epochMs = resolveTimestampOrNow(epochMs, nowMillis);
      uint64_t moduleMillis = static_cast<uint64_t>(nowMillis);
      uint64_t hostCapturedAt = doc["hostCapturedAt"] | 0ULL;
      if (hostCapturedAt == 0)
      {
        hostCapturedAt = epochMs;
      }

      storage::applyClockSync(epochMs, moduleMillis, hostCapturedAt);

      uint32_t afterMillis = millis();
      uint64_t moduleTimeMs = storage::computeModuleTimeMs(afterMillis);
      uint64_t moduleMillisNow = storage::computeModuleMillis(afterMillis);

      StaticJsonDocument<256> response;
      response["ok"] = true;
      response["syncedAt"] = epochMs;
      response["syncedMillis"] = moduleMillis;
      response["hostCapturedAt"] = hostCapturedAt;
      if (moduleTimeMs)
        response["moduleTimeMs"] = moduleTimeMs;
      else
        response["moduleTimeMs"] = nullptr;

      if (moduleMillisNow)
        response["moduleMillis"] = moduleMillisNow;
      else
        response["moduleMillis"] = nullptr;
      sendJsonResponse(200, response);
    }

    void handleLastRides()
    {
      Serial.println("[HTTP] GET /api/last.json");
      StaticJsonDocument<kJsonBufferSize> doc;
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
      webServer.on("/api/admin/state", HTTP_GET, handleAdminState);
      webServer.on("/api/admin/setup", HTTP_POST, handleAdminSetup);
      webServer.on("/api/sensors/calibrate", HTTP_POST, handleSensorsCalibrate);
      webServer.on("/api/time/sync", HTTP_POST, handleTimeSync);
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
      logModuleClockIfSynced(static_cast<uint32_t>(millis()));
    }
  }

  bool isNetworkReady()
  {
    return serverReady;
  }
} // namespace net
