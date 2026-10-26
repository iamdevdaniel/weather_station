#include <ESP8266WiFi.h>

#include "firmware.h"

namespace {

StationConfig stationConfig;
String bootId;
uint32_t sampleSequence = 0;
uint32_t samplesUntilUpload = 0;

uint32_t samplesPerUpload() {
  const uint32_t count =
      (stationConfig.uploadSeconds + stationConfig.sampleSeconds - 1) /
      stationConfig.sampleSeconds;
  return count ? count : 1;
}

}  // namespace

void setup() {
  if (FirmwareConfig::SERIAL_LOGGING) {
    Serial.begin(115200);
    Serial.println();
    Serial.printf("Firmware %s | free heap: %u bytes\n",
                  FirmwareConfig::VERSION, ESP.getFreeHeap());
  }

  WiFi.persistent(false);
  powerBegin(bootId, sampleSequence, samplesUntilUpload, stationConfig);
  if (samplesUntilUpload) WiFi.mode(WIFI_OFF);
  const bool realBoot = !powerIsDeepSleepWake();

  const bool sdReady = storageBegin();
  if (sdReady && realBoot) storageRecordBoot(bootId);
  if (FirmwareConfig::SERIAL_LOGGING) {
    Serial.println(sdReady ? "SD ready" : "SD failed");
    if (sdReady) storagePrintErrorLog();
  }

  sensorsBegin();
  const uint16_t batteryRaw = readBatteryAdcRaw();
  const String sample = readSampleJson(bootId, sampleSequence,
                                       powerElapsedMs(), batteryRaw);

  if (realBoot) reportDeviceHealth(sample, sdReady);

  if (sdReady) {
    if (storageAppend(sample)) {
      if (FirmwareConfig::SERIAL_LOGGING) Serial.println(sample);
      sampleSequence++;
    }

    if (!samplesUntilUpload) {
      uploadPendingSamples(powerElapsedMs(), bootId, stationConfig);
      samplesUntilUpload =
          storagePendingCount() ? 1 : samplesPerUpload();
    }
  }

  disconnectWifi();
  if (samplesUntilUpload) samplesUntilUpload--;
  powerSleep(bootId, sampleSequence, samplesUntilUpload, stationConfig,
             stationConfig.sampleSeconds);
}

void loop() {}
