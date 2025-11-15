#include "storage/AdminState.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>

namespace storage
{
  namespace
  {
    constexpr const char *kAdminStatePath = "/admin_state.msgpack";
    constexpr size_t kPersistDocSize = 512;

    AdminState adminState;
    bool fsReady = false;

    void resetDefaults()
    {
      adminState.trackName = "Unknown track";
      adminState.lapGoal = 3;
      adminState.updatedAt = 0;
      adminState.calibrationAt = 0;
      adminState.ambientLevel = 0;
      adminState.ambientMin = 0;
      adminState.ambientMax = 0;
      adminState.ambientNoise = 0;
      adminState.triggerDelta = 0;
      adminState.clockSyncedAt = 0;
      adminState.clockSyncedMillis = 0;
      adminState.clockSyncedHostAt = 0;
    }

    bool ensureFilesystem()
    {
      if (fsReady)
      {
        return true;
      }
      fsReady = SPIFFS.begin(true);
      if (!fsReady)
      {
        Serial.println("[AdminState] Failed to mount SPIFFS");
      }
      else
      {
        Serial.println("[AdminState] SPIFFS mounted for admin state");
      }
      return fsReady;
    }

    void persistAdminStateInternal()
    {
      if (!ensureFilesystem())
      {
        return;
      }

      File file = SPIFFS.open(kAdminStatePath, "w");
      if (!file)
      {
        Serial.println("[AdminState] Failed to open state file for writing");
        return;
      }

      StaticJsonDocument<kPersistDocSize> doc;
      doc["trackName"] = adminState.trackName.c_str();
      doc["lapGoal"] = adminState.lapGoal;
      doc["updatedAt"] = adminState.updatedAt;
      doc["calibrationAt"] = adminState.calibrationAt;
      doc["ambientLevel"] = adminState.ambientLevel;
      doc["ambientMin"] = adminState.ambientMin;
      doc["ambientMax"] = adminState.ambientMax;
      doc["ambientNoise"] = adminState.ambientNoise;
      doc["triggerDelta"] = adminState.triggerDelta;
      size_t bytes = serializeMsgPack(doc, file);
      file.flush();
      file.close();
      if (bytes == 0)
      {
        Serial.println("[AdminState] Failed to serialize admin state");
        return;
      }
      Serial.printf("[AdminState] Persisted profile (%u bytes): track='%s', lapGoal=%u\n",
                    static_cast<unsigned int>(bytes),
                    adminState.trackName.c_str(),
                    adminState.lapGoal);
    }

    void loadAdminState()
    {
      if (!ensureFilesystem())
      {
        return;
      }

      File file = SPIFFS.open(kAdminStatePath, FILE_READ);
      if (!file)
      {
        Serial.println("[AdminState] No persisted profile found");
        return;
      }

      StaticJsonDocument<kPersistDocSize> doc;
      DeserializationError err = deserializeMsgPack(doc, file);
      file.close();
      if (err)
      {
        Serial.print("[AdminState] Failed to parse persisted state: ");
        Serial.println(err.c_str());
        return;
      }

      String rawJson;
      serializeJson(doc, rawJson);
      Serial.print("[AdminState] Raw persisted profile: ");
      Serial.println(rawJson);

      const char *track = doc["trackName"] | (const char *)nullptr;
      if (track && *track)
      {
        adminState.trackName = track;
      }
      else
      {
        Serial.println("[AdminState] Persisted profile missing trackName, keeping default");
      }
      uint8_t lapGoal = doc["lapGoal"] | adminState.lapGoal;
      if (lapGoal >= 1 && lapGoal <= 20)
      {
        adminState.lapGoal = lapGoal;
      }
      adminState.updatedAt = doc["updatedAt"] | adminState.updatedAt;
      adminState.calibrationAt = doc["calibrationAt"] | adminState.calibrationAt;
      adminState.ambientLevel = doc["ambientLevel"] | adminState.ambientLevel;
      adminState.ambientMin = doc["ambientMin"] | adminState.ambientMin;
      adminState.ambientMax = doc["ambientMax"] | adminState.ambientMax;
      adminState.ambientNoise = doc["ambientNoise"] | adminState.ambientNoise;
      adminState.triggerDelta = doc["triggerDelta"] | adminState.triggerDelta;
      adminState.clockSyncedAt = 0;
      adminState.clockSyncedMillis = 0;
      adminState.clockSyncedHostAt = 0;
      Serial.printf("[AdminState] Loaded profile: track='%s', lapGoal=%u, updatedAt=%llu, calibrationAt=%llu\n",
                    adminState.trackName.c_str(),
                    adminState.lapGoal,
                    static_cast<unsigned long long>(adminState.updatedAt),
                    static_cast<unsigned long long>(adminState.calibrationAt));
    }
  } // namespace

  void initAdminState()
  {
    resetDefaults();
    loadAdminState();
  }

  const AdminState &getAdminState()
  {
    return adminState;
  }

  void updateTrackProfile(const std::string &trackName, uint8_t lapGoal, uint64_t updatedAt)
  {
    adminState.trackName = trackName;
    adminState.lapGoal = lapGoal;
    adminState.updatedAt = updatedAt;
    Serial.printf("[AdminState] Updating profile: track='%s', lapGoal=%u, updatedAt=%llu\n",
                  adminState.trackName.c_str(),
                  adminState.lapGoal,
                  static_cast<unsigned long long>(adminState.updatedAt));
    persistAdminStateInternal();
  }

  void markCalibration(uint64_t completedAt, const CalibrationSnapshot &snapshot)
  {
    adminState.calibrationAt = completedAt;
    adminState.ambientLevel = snapshot.ambientLevel;
    adminState.ambientMin = snapshot.ambientMin;
    adminState.ambientMax = snapshot.ambientMax;
    adminState.ambientNoise = snapshot.ambientNoise;
    adminState.triggerDelta = snapshot.triggerDelta;
    Serial.printf("[AdminState] Calibration timestamp stored: %llu\n",
                  static_cast<unsigned long long>(adminState.calibrationAt));
    Serial.printf("[AdminState] Ambient=%u min=%u max=%u noise=%u delta=%u\n",
                  adminState.ambientLevel,
                  adminState.ambientMin,
                  adminState.ambientMax,
                  adminState.ambientNoise,
                  adminState.triggerDelta);
    persistAdminStateInternal();
  }

  void applyClockSync(uint64_t epochMs, uint64_t moduleMillis, uint64_t hostCapturedAt)
  {
    adminState.clockSyncedAt = epochMs;
    adminState.clockSyncedMillis = moduleMillis;
    adminState.clockSyncedHostAt = hostCapturedAt;
  }

  uint64_t computeModuleTimeMs(uint32_t nowMillis)
  {
    if (adminState.clockSyncedAt == 0)
    {
      return 0;
    }

    uint32_t anchor = static_cast<uint32_t>(adminState.clockSyncedMillis & 0xFFFFFFFFu);
    uint32_t delta = nowMillis - anchor;
    return adminState.clockSyncedAt + static_cast<uint64_t>(delta);
  }

  uint64_t computeModuleMillis(uint32_t nowMillis)
  {
    if (adminState.clockSyncedAt == 0)
    {
      return 0;
    }

    uint32_t anchor = static_cast<uint32_t>(adminState.clockSyncedMillis & 0xFFFFFFFFu);
    uint32_t delta = nowMillis - anchor;
    return adminState.clockSyncedMillis + static_cast<uint64_t>(delta);
  }

  void saveAdminState()
  {
    persistAdminStateInternal();
  }
} // namespace storage
