#include "firmware.h"

#include <ArduinoJson.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <time.h>

#include "arduino_secrets.h"

const char GTS_ROOT_R4[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
)EOF";

namespace {

const char* wifiStatusName(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      return "idle";
    case WL_NO_SSID_AVAIL:
      return "no SSID available";
    case WL_SCAN_COMPLETED:
      return "scan completed";
    case WL_CONNECTED:
      return "connected";
    case WL_CONNECT_FAILED:
      return "connection failed";
    case WL_CONNECTION_LOST:
      return "connection lost";
    case WL_WRONG_PASSWORD:
      return "wrong password";
    case WL_DISCONNECTED:
      return "disconnected";
    default:
      return "unknown";
  }
}

bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  if (FirmwareConfig::SERIAL_LOGGING) Serial.println("WiFi: connecting");
  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startedAt < FirmwareConfig::WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
  }

  if (WiFi.status() != WL_CONNECTED) {
    const wl_status_t status = WiFi.status();
    const int networkCount = WiFi.scanNetworks(false, true);
    bool targetVisible = false;
    int32_t targetRssi = 0;
    int32_t targetChannel = 0;
    for (int index = 0; index < networkCount; index++) {
      if (WiFi.SSID(index) == WIFI_SSID &&
          (!targetVisible || WiFi.RSSI(index) > targetRssi)) {
        targetVisible = true;
        targetRssi = WiFi.RSSI(index);
        targetChannel = WiFi.channel(index);
      }
    }

    String detail = "WiFi connection failed after " +
                    String(millis() - startedAt) + " ms: " +
                    wifiStatusName(status) + " (status " + String(status) +
                    ")";
    if (targetVisible) {
      detail += "; target visible at " + String(targetRssi) +
                " dBm on channel " + String(targetChannel);
    } else if (networkCount >= 0) {
      detail += "; target not visible among " + String(networkCount) +
                " scanned networks";
    } else {
      detail += "; diagnostic scan failed with code " + String(networkCount);
    }
    WiFi.scanDelete();

    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.println(detail);
    }
    storageLogError(detail);
    return false;
  }

  WiFi.setSleepMode(WIFI_LIGHT_SLEEP, 10);
  if (FirmwareConfig::SERIAL_LOGGING) {
    Serial.printf("WiFi: connected | RSSI: %d dBm | IP: %s\n", WiFi.RSSI(),
                  WiFi.localIP().toString().c_str());
  }
  return true;
}

bool syncClock(uint64_t elapsedAtStart, uint64_t& anchorElapsed,
               String& anchorUtc) {
  const uint32_t startedAt = millis();
  configTime(0, 0, "pool.ntp.org", "time.cloudflare.com", "time.google.com");
  time_t now = time(nullptr);
  while (now < 1700000000 && millis() - startedAt < 30000) {
    delay(200);
    now = time(nullptr);
  }
  if (now < 1700000000) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.println("Clock: NTP sync failed");
    }
    storageLogError("NTP clock sync failed at WiFi RSSI " +
                    String(WiFi.RSSI()) + " dBm");
    return false;
  }

  struct tm utc;
  gmtime_r(&now, &utc);
  char text[21];
  strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%SZ", &utc);
  anchorUtc = text;
  anchorElapsed = elapsedAtStart + millis() - startedAt;
  return true;
}

String buildBody(const UploadBatch& batch, uint32_t dropped,
                 const String& currentBootId, uint64_t anchorElapsed,
                 const String& anchorUtc) {
  JsonDocument document;
  document["schemaVersion"] = FirmwareConfig::SCHEMA_VERSION;
  document["stationId"] = FirmwareConfig::STATION_ID;
  document["uploadId"] = batch.uploadId;
  document["bootId"] = batch.bootId;
  document["firmwareVersion"] = FirmwareConfig::VERSION;
  document["droppedSamples"] = dropped;

  if (batch.bootId == currentBootId && anchorUtc.length()) {
    JsonObject anchor = document["timeAnchor"].to<JsonObject>();
    anchor["utc"] = anchorUtc;
    anchor["elapsedSinceBootMs"] = anchorElapsed;
  } else {
    document["timeAnchor"] = nullptr;
  }

  JsonArray samples = document["samples"].to<JsonArray>();
  for (uint8_t index = 0; index < batch.count; index++) {
    JsonDocument storedSample;
    if (deserializeJson(storedSample, batch.lines[index])) return "";
    storedSample.remove("bootId");
    samples.add(storedSample.as<JsonObject>());
  }

  String body;
  serializeJson(document, body);
  return body;
}

bool sendBatch(const UploadBatch& batch, const String& body,
               StationConfig& config, FirmwareUpdateInfo& firmwareUpdate) {
  BearSSL::X509List certificate(GTS_ROOT_R4);
  BearSSL::WiFiClientSecure client;
  client.setTrustAnchors(&certificate);

  HTTPClient http;
  if (!http.begin(client, FirmwareConfig::UPLOAD_URL)) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.println("Upload: could not start HTTPS request");
    }
    storageLogError("Could not start HTTPS upload request");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " DEVICE_API_TOKEN);
  const int status = http.POST(body);
  const String responseBody = http.getString();
  http.end();
  if (status < 200 || status >= 300) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.printf("Upload: HTTP %d | %s\n", status, responseBody.c_str());
    }
    const String detail =
        status < 0 ? HTTPClient::errorToString(status)
                   : responseBody.substring(0, 160);
    storageLogError("Upload returned HTTP " + String(status) + ": " + detail +
                    "; WiFi " + wifiStatusName(WiFi.status()) + " (status " +
                    String(WiFi.status()) + "), RSSI " + String(WiFi.RSSI()) +
                    " dBm");
    return false;
  }

  JsonDocument response;
  if (deserializeJson(response, responseBody) ||
      response["schemaVersion"] != FirmwareConfig::SCHEMA_VERSION ||
      response["uploadId"] != batch.uploadId || response["stored"] != true) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.println("Upload: invalid server response");
    }
    storageLogError("Upload returned an invalid server response");
    return false;
  }

  const uint32_t sampleSeconds = response["config"]["sampleIntervalSeconds"] | 0;
  const uint32_t uploadSeconds = response["config"]["uploadIntervalSeconds"] | 0;
  if (sampleSeconds >= 5 && sampleSeconds <= 86400) {
    config.sampleSeconds = sampleSeconds;
  }
  if (uploadSeconds >= 15 && uploadSeconds <= 86400) {
    config.uploadSeconds = uploadSeconds;
  }

  JsonVariant update = response["firmwareUpdate"];
  if (!update.isNull()) {
    const String version = update["version"] | "";
    const String url = update["url"] | "";
    const String sha256 = update["sha256"] | "";
    if (version.length() && version != FirmwareConfig::VERSION &&
        url.startsWith("https://") && sha256.length() == 64) {
      firmwareUpdate.available = true;
      firmwareUpdate.version = version;
      firmwareUpdate.url = url;
      firmwareUpdate.sha256 = sha256;
    }
  }
  return true;
}

}  // namespace

bool reportDeviceHealth(const String& sampleJson, bool sdOk) {
  if (!connectWifi()) return false;

  uint64_t anchorElapsed = 0;
  String anchorUtc;
  if (!syncClock(0, anchorElapsed, anchorUtc)) return false;

  JsonDocument sample;
  if (deserializeJson(sample, sampleJson)) return false;

  JsonDocument health;
  health["schemaVersion"] = FirmwareConfig::SCHEMA_VERSION;
  health["stationId"] = FirmwareConfig::STATION_ID;
  health["bootId"] = sample["bootId"];
  health["firmwareVersion"] = FirmwareConfig::VERSION;
  health["sdOk"] = sdOk;
  health["wifiRssi"] = WiFi.RSSI();
  health["elapsedSinceBootMs"] = sample["elapsedSinceBootMs"];
  health["temperatureC"] = sample["temperatureC"];
  health["humidityPct"] = sample["humidityPct"];
  health["barometricPressure"] = sample["barometricPressure"];
  health["lightLux"] = sample["lightLux"];
  health["soundRmsAdc"] = sample["soundRmsAdc"];
  health["batteryAdcRaw"] = sample["batteryAdcRaw"];
  health["batteryVoltageV"] = sample["batteryVoltageV"];

  JsonArray issues = health["issues"].to<JsonArray>();
  for (JsonVariant issue : sample["qualityFlags"].as<JsonArray>()) {
    issues.add(issue);
  }
  if (!sdOk) issues.add("sd_failed");

  String body;
  serializeJson(health, body);

  BearSSL::X509List certificate(GTS_ROOT_R4);
  BearSSL::WiFiClientSecure client;
  client.setTrustAnchors(&certificate);

  HTTPClient http;
  if (!http.begin(client, FirmwareConfig::DEVICE_HEALTH_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " DEVICE_API_TOKEN);
  const int status = http.POST(body);
  const String responseBody = http.getString();
  http.end();

  if (status < 200 || status >= 300) {
    if (sdOk) {
      storageLogError("Device health returned HTTP " + String(status));
    }
    return false;
  }

  JsonDocument response;
  const bool valid =
      !deserializeJson(response, responseBody) &&
      response["schemaVersion"] == FirmwareConfig::SCHEMA_VERSION &&
      response["bootId"] == sample["bootId"] && response["stored"] == true;
  if (!valid && sdOk) storageLogError("Device health response was invalid");
  return valid;
}

void disconnectWifi() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

bool uploadPendingSamples(uint64_t elapsedMs, const String& currentBootId,
                          StationConfig& config) {
  if (!storagePendingCount()) return false;
  if (!connectWifi()) {
    disconnectWifi();
    return false;
  }

  uint64_t anchorElapsed = 0;
  String anchorUtc;
  syncClock(elapsedMs, anchorElapsed, anchorUtc);

  bool uploadedAnything = false;
  FirmwareUpdateInfo firmwareUpdate;
  for (uint8_t upload = 0;
       upload < FirmwareConfig::MAX_UPLOADS_PER_WINDOW && storagePendingCount();
       upload++) {
    UploadBatch batch;
    if (!storageReadOldest(batch)) {
      if (FirmwareConfig::SERIAL_LOGGING) {
        Serial.println("Upload: could not read SD queue");
      }
      break;
    }
    const String body = buildBody(batch, storageDroppedCount(), currentBootId,
                                  anchorElapsed, anchorUtc);
    if (!body.length() || body.length() > FirmwareConfig::MAX_UPLOAD_BYTES) {
      storageLogError("Could not build a valid upload body");
      break;
    }

    const bool stored = sendBatch(batch, body, config, firmwareUpdate);
    if (!stored) break;
    if (!storageAcknowledge(batch)) {
      storageLogError("Upload succeeded but SD queue update failed");
      break;
    }
    uploadedAnything = true;
  }

  if (firmwareUpdate.available) installFirmwareUpdate(firmwareUpdate);

  disconnectWifi();

  return uploadedAnything;
}
