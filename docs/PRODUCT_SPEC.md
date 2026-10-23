# Product Specification

V1 is one solar-powered outdoor station measuring temperature, humidity,
atmospheric pressure, light, approximate noise, and battery voltage. It keeps
working through sensor and network failures and presents current and historical
readings in a web interface.

Multiple stations, calibrated SPL, forecasts, alerts, user accounts, cellular
connectivity, and a custom PCB are outside V1.

## Core operation

- Take one sample every 60 seconds and save it to microSD before using the
  network.
- Read the microphone before Wi-Fi activity. After changing mux channels, wait
  briefly and discard the first ADC reading.
- Represent a failed sensor with a `null` value and quality flag without stopping
  other measurements.
- Attempt an upload every five minutes. Send 1–10 samples, stay below 8 KB, and
  recover pending data oldest first.
- After failure, retry once immediately and then wait for the next upload cycle.
- Delete queued data only after a matching successful response. Restarts and
  firmware updates never erase it.
- Ignore duplicates safely. Server-provided intervals affect only future work.
- Retain up to seven days or 10,080 samples. When full, remove the oldest complete
  upload and count the lost samples.
- Treat pressure as station pressure, not sea-level-corrected pressure.
- Preserve microphone AC RMS as the trustworthy noise value. Any decibel value
  is an estimate, not calibrated SPL.
- Retain battery ADC and voltage. Do not claim an accurate percentage until the
  reading has been checked against a multimeter.
- Choose final light and sound reference values after enclosure assembly.

## Identity and time

- Identify a sample by station, logical boot, and sequence.
- Deep-sleep wake-ups keep the logical boot identity; power loss starts a new one.
- Sequence preserves order when wall-clock time is unavailable.
- Request NTP during every upload cycle and retain the newest successful anchor
  for the current logical boot.
- `synced` means the sample coincides with the anchor.
- `derived` means the Worker calculated its time from the anchor and elapsed time.
- `missing` means no trustworthy anchor exists, so its timestamp stays `null`.
- Never infer time across a power-loss boundary.

## Remote operation and interface

- Check for firmware only after a successful upload. Install only a newer,
  compatible, verified image when power is safe.
- Failed downloads leave the running firmware and queued data intact. USB remains
  the recovery path if installed firmware cannot connect or run OTA.
- Before field installation, verify the physical ESP reports 4 MB of flash, the
  selected build layout provides an OTA slot, and the compiled firmware fits in
  that slot. The expected limit is approximately 1 MB, not 2 MB.
- `/` shows status, current readings, the current-day chart, and a calendar.
- `/:date` shows detailed readings for one selected UTC day.
- Online means contact within two upload cycles, delayed means within six, and
  offline means more than six cycles without contact.
- The interface never fabricates missing readings.
- Each device uses its own secret token. Secrets stay outside Git and D1, and the
  isolated device network requires only outbound HTTPS.
