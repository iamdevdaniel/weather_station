#include "firmware.h"

extern "C" {
#include <user_interface.h>
}

namespace {

constexpr uint32_t RTC_MAGIC = 0x57533135;
// ESP8266 RTC offsets use 4-byte words. Skip the first 128 bytes used by OTA.
constexpr uint32_t RTC_OFFSET = 32;

struct RtcState {
  uint32_t magic;
  uint32_t bootNonce;
  uint32_t sequence;
  uint32_t samplesUntilUpload;
  uint32_t sampleSeconds;
  uint32_t uploadSeconds;
  uint64_t elapsedMs;
  uint32_t checksum;
};

static_assert(RTC_OFFSET * 4 + sizeof(RtcState) <= 512,
              "RTC state exceeds user memory");

RtcState state{};
uint64_t elapsedAtBoot = 0;

uint32_t stateChecksum(const RtcState& value) {
  const uint32_t* words = reinterpret_cast<const uint32_t*>(&value);
  const size_t wordCount = offsetof(RtcState, checksum) / sizeof(uint32_t);
  uint32_t checksum = 2166136261UL;
  for (size_t index = 0; index < wordCount; index++) {
    checksum ^= words[index];
    checksum *= 16777619UL;
  }
  return checksum;
}

bool loadState() {
  if (ESP.getResetInfoPtr()->reason != REASON_DEEP_SLEEP_AWAKE) return false;
  if (!ESP.rtcUserMemoryRead(RTC_OFFSET, reinterpret_cast<uint32_t*>(&state),
                             sizeof(state))) {
    return false;
  }
  return state.magic == RTC_MAGIC && state.checksum == stateChecksum(state) &&
         state.sampleSeconds >= 5 && state.uploadSeconds >= 15;
}

void saveState() {
  state.checksum = stateChecksum(state);
  ESP.rtcUserMemoryWrite(RTC_OFFSET, reinterpret_cast<uint32_t*>(&state),
                         sizeof(state));
}

}  // namespace

void powerBegin(String& bootId, uint32_t& sequence,
                uint32_t& samplesUntilUpload, StationConfig& config) {
  if (!loadState()) {
    randomSeed(ESP.getChipId() ^ micros());
    state = RtcState{};
    state.magic = RTC_MAGIC;
    state.bootNonce = random(0x7fffffff);
    state.sampleSeconds = FirmwareConfig::DEFAULT_SAMPLE_SECONDS;
    state.uploadSeconds = FirmwareConfig::DEFAULT_UPLOAD_SECONDS;
  }

  elapsedAtBoot = state.elapsedMs;
  bootId = String(ESP.getChipId(), HEX) + "-" + String(state.bootNonce, HEX);
  sequence = state.sequence;
  samplesUntilUpload = state.samplesUntilUpload;
  config.sampleSeconds = state.sampleSeconds;
  config.uploadSeconds = state.uploadSeconds;
}

uint64_t powerElapsedMs() { return elapsedAtBoot + millis(); }

bool powerIsDeepSleepWake() {
  return ESP.getResetInfoPtr()->reason == REASON_DEEP_SLEEP_AWAKE;
}

void powerSleep(const String&, uint32_t sequence,
                uint32_t samplesUntilUpload, const StationConfig& config,
                uint32_t sleepSeconds) {
  state.sequence = sequence;
  state.samplesUntilUpload = samplesUntilUpload;
  state.sampleSeconds = config.sampleSeconds;
  state.uploadSeconds = config.uploadSeconds;
  state.elapsedMs = powerElapsedMs() + sleepSeconds * 1000ULL;
  saveState();

  if (FirmwareConfig::SERIAL_LOGGING) Serial.flush();
  const RFMode wakeMode =
      samplesUntilUpload ? WAKE_RF_DISABLED : WAKE_RF_DEFAULT;
  ESP.deepSleep(sleepSeconds * 1000000ULL, wakeMode);
  delay(1000);
}
