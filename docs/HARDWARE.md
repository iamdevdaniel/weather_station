# Hardware Reference

The station uses a NodeMCU-style ESP8266 / ESP-12N, BME280, BH1750, MAX4466,
74HC4067 mux, microSD module, T-BAT CN3065, 3.6 V 3600 mAh 18650 battery, and a
330 kOhm / 100 kOhm / 100 nF battery-sense circuit. The assembled circuit has
been tested with all sensors, mux channels, and SD read/write operating together.

## Connections

**BME280**

| ESP pin | Board pin |
| --- | --- |
| `3.3 V` | `VCC` |
| `GND` | `GND` |
| `D1 / GPIO5` | `SCL / SCK` |
| `D2 / GPIO4` | `SDA / SDI` |
| `3.3 V` | `CSB`, if exposed |
| `GND` | `SDO`, if exposed; address `0x76` |

**BH1750**

| ESP pin | Board pin |
| --- | --- |
| `3.3 V` | `VCC` |
| `GND` | `GND` |
| `D1 / GPIO5` | `SCL` |
| `D2 / GPIO4` | `SDA` |
| No connection | `ADDR`; address `0x23` |

**MAX4466**

| ESP pin | Board pin |
| --- | --- |
| `3.3 V` | `VCC` |
| `GND` | `GND` |
| `A0`, through mux `SIG` and `C0` | `OUT` |

**MicroSD**

| ESP pin | Board pin |
| --- | --- |
| `VIN / 5 V` | `VCC` |
| `GND` | `GND` |
| `D5 / GPIO14` | `SCK / CLK` |
| `D6 / GPIO12` | `MISO` |
| `D7 / GPIO13` | `MOSI` |
| `D8 / GPIO15` | `CS` |

**74HC4067 mux**

| ESP or source pin | Mux pin |
| --- | --- |
| `3.3 V` | `VCC` |
| `GND` | `GND`, `EN`, `S1`, `S2`, `S3` |
| `A0` | `SIG` |
| `D3 / GPIO0` | `S0` |
| MAX4466 `OUT` | `C0` |
| Battery sense node | `C1` |

Leave `C2`–`C15` empty. Place a 100 nF capacitor directly between mux `VCC` and
`GND`.

**T-BAT**

| ESP or perfboard connection | T-BAT connection |
| --- | --- |
| `VIN / 5 V`, through power switch | `5V OUT` |
| `GND` | `GND` |
| 330 kOhm resistor input | Raw `BAT+` |

## Electrical notes

- The 330 kOhm output is the battery-sense node. Connect it to mux `C1`, one end
  of the 100 kOhm resistor, and one end of a 100 nF capacitor. Ground the other
  ends of both parts.
- Confirm raw battery polarity and approximately 3.0–4.2 V with a multimeter.
  Never connect raw battery voltage directly to `A0`.
- Do not power the NodeMCU from USB and T-BAT 5 V simultaneously.
- Connect `D0 / GPIO16` to `RST` with a removable deep-sleep jumper. Leave unused
  `D4 / GPIO2` high during boot.
- Keep MAX4466 gain fixed, remove DC bias, calculate AC RMS, and flag readings
  near ADC clipping at `0` or `1023`. Any decibel value is estimated, not
  calibrated SPL; choose its final reference after enclosure assembly.
