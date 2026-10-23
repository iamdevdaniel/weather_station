#include <SPI.h>
#include <SD.h>
#include <math.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>

#include "arduino_secrets.h"

const uint8_t SD_CS = D8;
const uint8_t MIC_PIN = A0;
const uint8_t SCHEMA_VERSION = 1;

const char* FILE_NAME = "/noise.csv";
const char* API_URL =
    "https://weather-station-api.maydanachi.workers.dev/api/v1/uploads";

// Temporary certificate pin for the first upload test. Replace with normal CA
// validation before treating this as finished firmware. Valid until 2027-01-14.
const char* TLS_FINGERPRINT =
    "C7 4F 76 97 F1 73 6E A8 0C 11 92 1C 07 7E AD 41 CA EB AB A0";

String bootId;
bool uploadComplete = false;
unsigned long nextUploadAttemptMs = 0;

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  const unsigned long deadline = millis() + 20000;
  while (WiFi.status() != WL_CONNECTED && (long)(deadline - millis()) > 0) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed; sensor logging will continue.");
  }
}

bool uploadSoundSample(double rms, int minValue, int maxValue, unsigned long capturedAtMs) {
  if (WiFi.status() != WL_CONNECTED) return false;

  const String uploadId = bootId + "-upload-0";
  const String sampleId = bootId + "-sample-0";
  const bool clipped = minValue <= 5 || maxValue >= 1018;

  String body;
  body.reserve(700);
  body += "{\"schemaVersion\":" + String(SCHEMA_VERSION);
  body += ",\"stationId\":\"station-1\",\"uploadId\":\"" + uploadId;
  body += "\",\"bootId\":\"" + bootId;
  body += "\",\"firmwareVersion\":\"upload-smoke-test-1\",\"timeAnchor\":null,";
  body += "\"samples\":[{\"sampleId\":\"" + sampleId;
  body += "\",\"sequence\":0,\"elapsedSinceBootMs\":" + String(capturedAtMs);
  body += ",\"temperatureC\":null,\"humidityPct\":null,\"lightLux\":null";
  body += ",\"soundRmsAdc\":" + String(rms, 2);
  body += ",\"soundEstimatedDb\":null,\"batteryAdcRaw\":null,\"batteryVoltageV\":null";
  body += clipped ? ",\"qualityFlags\":[\"sound_clipped\"]}]}" : ",\"qualityFlags\":[]}]}";

  BearSSL::WiFiClientSecure client;
  client.setFingerprint(TLS_FINGERPRINT);

  HTTPClient http;
  if (!http.begin(client, API_URL)) {
    Serial.println("HTTPS setup failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(DEVICE_API_TOKEN));

  const int status = http.POST(body);
  const String response = status > 0 ? http.getString() : http.errorToString(status);
  http.end();

  Serial.printf("Upload status: %d\n", status);
  Serial.println(response);

  const String expectedVersion = "\"schemaVersion\":" + String(SCHEMA_VERSION);
  const String expectedUploadId = "\"uploadId\":\"" + uploadId + "\"";
  const bool validResponse =
      status >= 200 && status < 300 &&
      response.indexOf(expectedVersion) >= 0 &&
      response.indexOf(expectedUploadId) >= 0 &&
      response.indexOf("\"stored\":true") >= 0;

  if (status >= 200 && status < 300 && !validResponse) {
    Serial.println("Upload response does not match this firmware schema");
  }
  return validResponse;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  bootId = String(ESP.getChipId(), HEX) + "-" + String(ESP.getCycleCount(), HEX);

  if (!SD.begin(SD_CS)) {
    Serial.println("SD INIT FAILED");
    while (true) delay(1000);
  }

  if (SD.exists(FILE_NAME)) {
    SD.remove(FILE_NAME);
  }

  File file = SD.open(FILE_NAME, FILE_WRITE);

  if (!file) {
    Serial.println("FILE CREATE FAILED");
    while (true) delay(1000);
  }

  file.println("elapsed_ms,avg,min,max,p2p,rms");
  file.close();

  Serial.println("Fresh noise.csv created");
  connectWifi();
}

void loop() {
  const unsigned long WINDOW_MS = 1000;

  unsigned long start = millis();

  uint32_t count = 0;
  double sum = 0;
  double sumSquares = 0;

  int minValue = 1023;
  int maxValue = 0;

  while (millis() - start < WINDOW_MS) {
    int v = analogRead(MIC_PIN);

    sum += v;
    sumSquares += (double)v * v;
    count++;

    if (v < minValue) minValue = v;
    if (v > maxValue) maxValue = v;

    yield();
  }

  double avg = sum / count;

  double variance =
      (sumSquares / count) -
      (avg * avg);

  if (variance < 0) {
    variance = 0;
  }

  double rms = sqrt(variance);
  int p2p = maxValue - minValue;

  unsigned long elapsed = millis();

  File file = SD.open(FILE_NAME, FILE_WRITE);

  if (file) {
    file.print(elapsed);
    file.print(",");
    file.print(avg, 2);
    file.print(",");
    file.print(minValue);
    file.print(",");
    file.print(maxValue);
    file.print(",");
    file.print(p2p);
    file.print(",");
    file.println(rms, 2);

    file.close();
  }

  Serial.printf(
    "t=%lu avg=%.2f min=%d max=%d p2p=%d rms=%.2f\n",
    elapsed,
    avg,
    minValue,
    maxValue,
    p2p,
    rms
  );

  if (!uploadComplete && (long)(millis() - nextUploadAttemptMs) >= 0) {
    uploadComplete = uploadSoundSample(rms, minValue, maxValue, elapsed);
    nextUploadAttemptMs = millis() + 15000;
  }
}
