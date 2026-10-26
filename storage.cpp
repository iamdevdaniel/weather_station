#include "firmware.h"

#include <ArduinoJson.h>
#include <SD.h>

namespace {

constexpr char QUEUE_FILE[] = "/queue.jsonl";
constexpr char TEMP_FILE[] = "/queue.tmp";
constexpr char BACKUP_FILE[] = "/queue.bak";
constexpr char DROPPED_FILE[] = "/dropped.txt";
constexpr char ERROR_LOG_FILE[] = "/errors.log";
constexpr char BOOT_LOG_FILE[] = "/boots.txt";
constexpr char BOOT_LOG_TEMP_FILE[] = "/boots.tmp";
constexpr uint32_t MAX_ERROR_LOG_BYTES = 32 * 1024;
constexpr uint8_t MAX_BOOT_LOG_ENTRIES = 20;

uint32_t pendingSamples = 0;
uint32_t droppedSamples = 0;
bool storageReady = false;

void saveDroppedCount() {
  SD.remove(DROPPED_FILE);
  File file = SD.open(DROPPED_FILE, FILE_WRITE);
  if (file) {
    file.print(droppedSamples);
    file.close();
  }
}

bool replaceQueue(uint32_t bytesToRemove) {
  SD.remove(TEMP_FILE);
  File source = SD.open(QUEUE_FILE, FILE_READ);
  File target = SD.open(TEMP_FILE, FILE_WRITE);
  if (!source || !target || !source.seek(bytesToRemove)) {
    source.close();
    target.close();
    SD.remove(TEMP_FILE);
    return false;
  }

  uint8_t buffer[128];
  while (source.available()) {
    const size_t count = source.read(buffer, sizeof(buffer));
    if (target.write(buffer, count) != count) {
      source.close();
      target.close();
      SD.remove(TEMP_FILE);
      return false;
    }
    yield();
  }
  source.close();
  target.close();

  SD.remove(BACKUP_FILE);
  if (SD.exists(QUEUE_FILE) && !SD.rename(QUEUE_FILE, BACKUP_FILE)) return false;
  if (!SD.rename(TEMP_FILE, QUEUE_FILE)) {
    SD.rename(BACKUP_FILE, QUEUE_FILE);
    return false;
  }
  SD.remove(BACKUP_FILE);
  return true;
}

bool removeBatch(const UploadBatch& batch, bool countAsDropped) {
  if (!replaceQueue(batch.bytesToRemove)) return false;
  pendingSamples -= min(pendingSamples, static_cast<uint32_t>(batch.count));
  if (countAsDropped) {
    droppedSamples += batch.count;
    saveDroppedCount();
  }
  return true;
}

}  // namespace

bool storageBegin() {
  storageReady = SD.begin(FirmwareConfig::SD_CS);
  if (!storageReady) return false;

  if (!SD.exists(QUEUE_FILE) && SD.exists(BACKUP_FILE)) {
    SD.rename(BACKUP_FILE, QUEUE_FILE);
  } else if (SD.exists(QUEUE_FILE)) {
    SD.remove(BACKUP_FILE);
  }
  SD.remove(TEMP_FILE);

  pendingSamples = 0;
  File queue = SD.open(QUEUE_FILE, FILE_READ);
  while (queue && queue.available()) {
    if (queue.readStringUntil('\n').length()) pendingSamples++;
    yield();
  }
  queue.close();

  File dropped = SD.open(DROPPED_FILE, FILE_READ);
  droppedSamples = dropped ? dropped.parseInt() : 0;
  dropped.close();
  return true;
}

bool storageRecordBoot(const String& bootId) {
  String entries[MAX_BOOT_LOG_ENTRIES - 1];
  uint8_t count = 0;

  File existing = SD.open(BOOT_LOG_FILE, FILE_READ);
  while (existing && existing.available()) {
    String entry = existing.readStringUntil('\n');
    entry.trim();
    if (!entry.length()) continue;

    if (count < MAX_BOOT_LOG_ENTRIES - 1) {
      entries[count++] = entry;
    } else {
      for (uint8_t index = 1; index < count; index++) {
        entries[index - 1] = entries[index];
      }
      entries[count - 1] = entry;
    }
  }
  existing.close();

  SD.remove(BOOT_LOG_TEMP_FILE);
  File updated = SD.open(BOOT_LOG_TEMP_FILE, FILE_WRITE);
  if (!updated) return false;
  for (uint8_t index = 0; index < count; index++) {
    updated.println(entries[index]);
  }
  updated.println(bootId);
  updated.close();

  SD.remove(BOOT_LOG_FILE);
  return SD.rename(BOOT_LOG_TEMP_FILE, BOOT_LOG_FILE);
}

bool storageAppend(const String& sampleJson) {
  while (pendingSamples >= FirmwareConfig::MAX_QUEUED_SAMPLES) {
    UploadBatch oldest;
    if (!storageReadOldest(oldest) || !removeBatch(oldest, true)) return false;
  }

  File queue = SD.open(QUEUE_FILE, FILE_WRITE);
  if (!queue) return false;
  const String record = sampleJson + '\n';
  const bool written =
      queue.write(reinterpret_cast<const uint8_t*>(record.c_str()),
                  record.length()) == record.length();
  queue.flush();
  queue.close();
  if (written) pendingSamples++;
  return written;
}

bool storageReadOldest(UploadBatch& batch) {
  batch = UploadBatch{};
  File queue = SD.open(QUEUE_FILE, FILE_READ);
  if (!queue) {
    storageLogError("Could not open SD sample queue");
    return false;
  }

  uint32_t firstSequence = 0;
  uint32_t lastSequence = 0;
  while (queue.available() && batch.count < FirmwareConfig::MAX_SAMPLES_PER_UPLOAD) {
    const uint32_t lineStart = queue.position();
    String line = queue.readStringUntil('\n');
    const uint32_t lineEnd = queue.position();
    line.trim();
    if (!line.length()) continue;

    JsonDocument document;
    const DeserializationError jsonError = deserializeJson(document, line);
    if (jsonError) {
      storageLogError("Invalid JSON in SD queue at byte " +
                      String(lineStart) + " (" + jsonError.c_str() +
                      ", length " + String(line.length()) + "): " +
                      line.substring(0, 160));

      if (batch.count) {
        batch.bytesToRemove = lineStart;
        break;
      }

      queue.close();
      UploadBatch damagedEntry;
      damagedEntry.count = 1;
      damagedEntry.bytesToRemove = lineEnd;
      if (!removeBatch(damagedEntry, true)) {
        storageLogError("Could not remove damaged SD queue entry");
        return false;
      }
      storageLogError("Removed damaged SD queue entry and continued");
      return storageReadOldest(batch);
    }
    const String bootId = document["bootId"] | "";
    const uint32_t sequence = document["sequence"] | 0;
    if (!bootId.length()) {
      storageLogError("SD queue entry has no bootId at byte " +
                      String(lineStart));

      if (batch.count) {
        batch.bytesToRemove = lineStart;
        break;
      }

      queue.close();
      UploadBatch damagedEntry;
      damagedEntry.count = 1;
      damagedEntry.bytesToRemove = lineEnd;
      if (!removeBatch(damagedEntry, true)) {
        storageLogError("Could not remove invalid SD queue entry");
        return false;
      }
      storageLogError("Removed invalid SD queue entry and continued");
      return storageReadOldest(batch);
    }
    if (batch.count && bootId != batch.bootId) {
      batch.bytesToRemove = lineStart;
      break;
    }

    if (!batch.count) {
      batch.bootId = bootId;
      firstSequence = sequence;
    }
    batch.lines[batch.count++] = line;
    lastSequence = sequence;
    batch.bytesToRemove = queue.position();
  }
  queue.close();
  if (!batch.count) return false;
  batch.uploadId = batch.bootId + "-" + firstSequence + "-" + lastSequence;
  return true;
}

bool storageAcknowledge(const UploadBatch& batch) {
  if (!removeBatch(batch, false)) return false;
  droppedSamples = 0;
  saveDroppedCount();
  return true;
}

uint32_t storagePendingCount() { return pendingSamples; }

uint32_t storageDroppedCount() { return droppedSamples; }

void storageLogError(const String& message) {
  if (!storageReady) return;

  File existing = SD.open(ERROR_LOG_FILE, FILE_READ);
  const bool full = existing && existing.size() >= MAX_ERROR_LOG_BYTES;
  existing.close();
  if (full) SD.remove(ERROR_LOG_FILE);

  File log = SD.open(ERROR_LOG_FILE, FILE_WRITE);
  if (!log) return;
  log.printf("%lu ms | %s\n", millis(), message.c_str());
  log.flush();
  log.close();
}

void storagePrintErrorLog() {
  File log = SD.open(ERROR_LOG_FILE, FILE_READ);
  if (!log || !log.size()) {
    log.close();
    return;
  }

  constexpr uint32_t MAX_PRINT_BYTES = 4096;
  if (log.size() > MAX_PRINT_BYTES) {
    log.seek(log.size() - MAX_PRINT_BYTES);
    log.readStringUntil('\n');
  }

  Serial.println("--- SD error log ---");
  while (log.available()) Serial.write(log.read());
  Serial.println("--- End SD error log ---");
  log.close();
}
