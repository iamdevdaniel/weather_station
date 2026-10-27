#pragma once

#include <Arduino.h>

namespace FirmwareConfig {

constexpr char STATION_ID[] = "station-1";
constexpr char VERSION[] = "1.0.14";
constexpr char UPLOAD_URL[] =
    "https://weather-station-api.maydanachi.workers.dev/api/v1/uploads";
constexpr char DEVICE_HEALTH_URL[] =
    "https://weather-station-api.maydanachi.workers.dev/api/v1/device-health";

constexpr uint8_t SCHEMA_VERSION = 1;
constexpr uint8_t SD_CS = D8;
constexpr uint8_t SDA_PIN = D2;
constexpr uint8_t SCL_PIN = D1;
constexpr uint8_t MUX_SELECT = D3;
constexpr uint8_t ANALOG_INPUT = A0;

// First-boot fallbacks. Successful uploads replace these with D1 station config.
constexpr uint32_t DEFAULT_SAMPLE_SECONDS = 300;
constexpr uint32_t DEFAULT_UPLOAD_SECONDS = 1200;
constexpr uint32_t MICROPHONE_SAMPLE_MS = 250;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 12000;
constexpr bool SERIAL_LOGGING = false;
constexpr uint32_t MAX_QUEUED_SAMPLES = 10080;
constexpr uint8_t MAX_SAMPLES_PER_UPLOAD = 10;
constexpr uint8_t MAX_UPLOADS_PER_WINDOW = 8;
constexpr size_t MAX_UPLOAD_BYTES = 8 * 1024;

constexpr float ADC_MAX_VOLTAGE = 3.3F;
constexpr float BATTERY_DIVIDER_RATIO = 4.3F;

}  // namespace FirmwareConfig

struct StationConfig {
  uint32_t sampleSeconds = FirmwareConfig::DEFAULT_SAMPLE_SECONDS;
  uint32_t uploadSeconds = FirmwareConfig::DEFAULT_UPLOAD_SECONDS;
};

struct UploadBatch {
  String lines[FirmwareConfig::MAX_SAMPLES_PER_UPLOAD];
  uint8_t count = 0;
  String bootId;
  String uploadId;
  uint32_t bytesToRemove = 0;
};

struct FirmwareUpdateInfo {
  bool available = false;
  String version;
  String url;
  String sha256;
};

extern const char GTS_ROOT_R4[] PROGMEM;

void sensorsBegin();
uint16_t readBatteryAdcRaw();
String readSampleJson(const String& bootId, uint32_t sequence,
                      uint64_t elapsedMs, uint16_t batteryRaw);

void powerBegin(String& bootId, uint32_t& sequence,
                uint32_t& samplesUntilUpload, StationConfig& config);
bool powerIsDeepSleepWake();
uint64_t powerElapsedMs();
void powerSleep(const String& bootId, uint32_t sequence,
                uint32_t samplesUntilUpload, const StationConfig& config,
                uint32_t sleepSeconds);

bool storageBegin();
bool storageRecordBoot(const String& bootId);
bool storageAppend(const String& sampleJson);
bool storageReadOldest(UploadBatch& batch);
bool storageAcknowledge(const UploadBatch& batch);
uint32_t storagePendingCount();
uint32_t storageDroppedCount();
void storageLogError(const String& message);
void storagePrintErrorLog();

bool uploadPendingSamples(uint64_t elapsedMs, const String& currentBootId,
                          StationConfig& config);
bool reportDeviceHealth(const String& sampleJson, bool sdOk);
void disconnectWifi();
bool installFirmwareUpdate(const FirmwareUpdateInfo& update);
