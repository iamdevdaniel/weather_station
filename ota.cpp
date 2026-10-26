#include "firmware.h"

#include <BearSSLHelpers.h>
#include <ESP8266HTTPClient.h>
#include <SD.h>
#include <Updater.h>
#include <WiFiClientSecureBearSSL.h>

#include "arduino_secrets.h"

namespace {

constexpr char UPDATE_FILE[] = "/firmware.bin";

String sha256Hex(BearSSL::HashSHA256& hash) {
  const uint8_t* digest = static_cast<const uint8_t*>(hash.hash());
  char hex[65];
  for (uint8_t index = 0; index < 32; index++) {
    snprintf(hex + index * 2, 3, "%02x", digest[index]);
  }
  hex[64] = '\0';
  return hex;
}

}  // namespace

bool installFirmwareUpdate(const FirmwareUpdateInfo& update) {
  if (FirmwareConfig::SERIAL_LOGGING) {
    Serial.printf("OTA: downloading %s\n", update.version.c_str());
  }
  SD.remove(UPDATE_FILE);

  BearSSL::X509List certificate(GTS_ROOT_R4);
  BearSSL::WiFiClientSecure client;
  client.setTrustAnchors(&certificate);

  HTTPClient http;
  if (!http.begin(client, update.url)) return false;
  http.addHeader("Authorization", "Bearer " DEVICE_API_TOKEN);
  const int status = http.GET();
  const int contentLength = http.getSize();
  if (status != HTTP_CODE_OK || contentLength <= 0 ||
      static_cast<uint32_t>(contentLength) > ESP.getFreeSketchSpace()) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.printf("OTA: download rejected (%d, %d bytes)\n", status,
                    contentLength);
    }
    http.end();
    return false;
  }

  File file = SD.open(UPDATE_FILE, FILE_WRITE);
  if (!file) {
    http.end();
    return false;
  }

  BearSSL::HashSHA256 hash;
  hash.begin();
  WiFiClient* stream = http.getStreamPtr();
  uint8_t buffer[512];
  int downloaded = 0;
  uint32_t lastDataAt = millis();
  while (downloaded < contentLength && millis() - lastDataAt < 15000) {
    const size_t available = stream->available();
    if (!available) {
      delay(1);
      continue;
    }
    const size_t count = stream->readBytes(
        buffer, min(available, static_cast<size_t>(sizeof(buffer))));
    if (!count || file.write(buffer, count) != count) break;
    hash.add(buffer, count);
    downloaded += count;
    lastDataAt = millis();
    yield();
  }
  hash.end();
  file.close();
  http.end();

  if (downloaded != contentLength ||
      !sha256Hex(hash).equalsIgnoreCase(update.sha256)) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.println("OTA: incomplete download or hash mismatch");
    }
    SD.remove(UPDATE_FILE);
    return false;
  }

  file = SD.open(UPDATE_FILE, FILE_READ);
  if (!file || !Update.begin(file.size())) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.println("OTA: flash could not start");
    }
    file.close();
    SD.remove(UPDATE_FILE);
    return false;
  }

  const size_t updateSize = file.size();
  const size_t written = Update.writeStream(file);
  file.close();
  const bool installed = written == updateSize && Update.end();
  SD.remove(UPDATE_FILE);
  if (!installed) {
    if (FirmwareConfig::SERIAL_LOGGING) {
      Serial.printf("OTA: flash failed (%u)\n", Update.getError());
    }
    return false;
  }

  if (FirmwareConfig::SERIAL_LOGGING) {
    Serial.println("OTA: installed; restarting");
    Serial.flush();
  }
  ESP.restart();
  return true;
}
