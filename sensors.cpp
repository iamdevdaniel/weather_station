#include "firmware.h"

#include <Adafruit_BME280.h>
#include <ArduinoJson.h>
#include <BH1750.h>
#include <Wire.h>

namespace {

Adafruit_BME280 bme;
BH1750 lightMeter;
bool bmeReady = false;
bool lightReady = false;

void selectMux(bool batteryChannel) {
  digitalWrite(FirmwareConfig::MUX_SELECT, batteryChannel ? HIGH : LOW);
  delay(3);
  analogRead(FirmwareConfig::ANALOG_INPUT);
}

void setNumberOrNull(JsonObject sample, const char* name, float value) {
  if (isnan(value)) {
    sample[name] = nullptr;
  } else {
    sample[name] = value;
  }
}

}  // namespace

void sensorsBegin() {
  Wire.begin(FirmwareConfig::SDA_PIN, FirmwareConfig::SCL_PIN);
  pinMode(FirmwareConfig::MUX_SELECT, OUTPUT);
  digitalWrite(FirmwareConfig::MUX_SELECT, HIGH);
  bmeReady = bme.begin(0x76, &Wire);
  lightReady =
      lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire);
}

uint16_t readBatteryAdcRaw() {
  selectMux(true);
  uint32_t total = 0;
  for (uint8_t index = 0; index < 8; index++) {
    total += analogRead(FirmwareConfig::ANALOG_INPUT);
    delay(2);
  }
  return total / 8;
}

String readSampleJson(const String& bootId, uint32_t sequence,
                      uint64_t elapsedMs, uint16_t batteryRaw) {
  JsonDocument document;
  JsonObject sample = document.to<JsonObject>();
  JsonArray flags = sample["qualityFlags"].to<JsonArray>();

  sample["bootId"] = bootId;
  sample["sequence"] = sequence;
  sample["elapsedSinceBootMs"] = elapsedMs;

  if (!bmeReady) bmeReady = bme.begin(0x76, &Wire);
  const float temperature = bmeReady ? bme.readTemperature() : NAN;
  const float humidity = bmeReady ? bme.readHumidity() : NAN;
  const float pressure = bmeReady ? bme.readPressure() / 100.0F : NAN;
  if (!bmeReady) {
    flags.add("bme_unavailable");
    storageLogError("BME280 unavailable");
  }
  if (bmeReady &&
      (isnan(temperature) || isnan(humidity) || isnan(pressure))) {
    flags.add("bme_read_failed");
    storageLogError("BME280 read failed");
    bmeReady = false;
  }
  setNumberOrNull(sample, "temperatureC", temperature);
  setNumberOrNull(sample, "humidityPct", humidity);
  setNumberOrNull(sample, "barometricPressure", pressure);

  if (!lightReady) {
    lightReady =
        lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire);
  }
  const float light = lightReady ? lightMeter.readLightLevel() : NAN;
  if (!lightReady) {
    flags.add("light_unavailable");
    storageLogError("BH1750 unavailable");
  }
  if (lightReady && (isnan(light) || light < 0)) {
    flags.add("light_read_failed");
    storageLogError("BH1750 read failed");
    lightReady = false;
  }
  setNumberOrNull(sample, "lightLux", light);

  selectMux(false);
  const uint32_t soundStartedAt = millis();
  uint32_t count = 0;
  double sum = 0;
  double sumSquares = 0;
  int minimum = 1023;
  int maximum = 0;
  while (millis() - soundStartedAt < FirmwareConfig::MICROPHONE_SAMPLE_MS) {
    const int value = analogRead(FirmwareConfig::ANALOG_INPUT);
    sum += value;
    sumSquares += static_cast<double>(value) * value;
    count++;
    minimum = min(minimum, value);
    maximum = max(maximum, value);
    yield();
  }
  const double average = sum / count;
  const double variance = max(0.0, sumSquares / count - average * average);
  sample["soundRmsAdc"] = sqrt(variance);
  sample["soundEstimatedDb"] = nullptr;
  if (minimum <= 5 || maximum >= 1018) flags.add("sound_clipped");

  sample["batteryAdcRaw"] = batteryRaw;
  sample["batteryVoltageV"] =
      batteryRaw * FirmwareConfig::ADC_MAX_VOLTAGE / 1023.0F *
      FirmwareConfig::BATTERY_DIVIDER_RATIO;
  flags.add("battery_uncalibrated");

  String result;
  serializeJson(document, result);
  return result;
}
