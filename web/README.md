# BandW Web Flasher

Static Web Serial flasher for the existing **XIAO nRF52840 Sense and Sense Plus** BandW application. Hosted by GitHub Pages through `.github/workflows/pages.yml`. No CDN scripts, runtime npm dependencies, account or backend.

## Use

Open the HTTPS site in desktop Chrome/Edge, connect the board by a data USB cable, select and confirm the hardware variant (regular Sense is the default), then click **Kết nối USB**. Select the running board; the page toggles DTR at 1200 baud to enter bootloader automatically. Chrome may require another user gesture to grant access to the newly enumerated USB port: click **Chọn cổng nạp mới** and select it. Click **Nạp BandW** to start. Normal BandW firmware does not require a physical double-reset. A stalled application or different firmware may still need double-reset recovery.

Bootloader USB VID is 0x2886. Regular Sense accepts PID 0x0045/0x0145; Sense Plus accepts 0x0065/0x0165. Each selector option uses its own USB filter and firmware. Runtime IDs also include the generic Plus IDs produced by Seeed's mbed core; the user must confirm that the actual board has the Sense IMU. USB IDs cannot prove hardware identity. No arbitrary file upload and no bootloader/SoftDevice updates are exposed.

## Firmware and protocol

`firmware/manifest-sense.json` (regular Sense) and `firmware/manifest.json` (Plus) pin the source commit, exact sizes and SHA-256 hashes of `.bin` and legacy `.dat`, extracted from the corresponding successful Arduino CLI DFU ZIP. The page verifies SHA-256, dat device type and firmware CRC16 before opening a transfer. Application-only mode is hard-coded.

`dfu.mjs` implements legacy Nordic serial DFU with SLIP framing, HCI header checksum, CRC16, modulo-8 sequence numbering, fragmented ACK parsing, bounded retransmission with the same sequence, erase/write pacing and transport cleanup. Timers never simulate progress; progress advances only after ACKs. Transport acceptance is not proof the application booted, so the completion screen asks the user to verify the board in the Android app.

Protocol sources: [Adafruit nrfutil](https://github.com/adafruit/Adafruit_nRF52_nrfutil/blob/master/nordicsemi/dfu/dfu_transport_serial.py), [Nordic HCI implementation](https://github.com/adafruit/Adafruit_nRF52_Bootloader/blob/master/lib/sdk/components/libraries/hci/hci_transport.c). Nordic-derived framing is covered by `LICENSE-NORDIC.txt`.

## Development

```sh
node --test web/tests/*.test.mjs
python3 -m http.server 8765 --directory web
```

Tests exercise the full bundled image, exact reconstructed bytes, corrupted images, CRC reference vector, malformed/split ACKs, sequence rollover, retransmission and USB disconnect. Browser verification must additionally check the real USB chooser, 1200-baud reset and physical flashing. No firmware should be claimed hardware-verified solely from the fake-port tests.

## Updating the bundled firmware

Build the Sense Plus target with `firmware/scripts/build-sense-plus.sh`. Extract only the application bin and dat from `.tooling/firmware-plus-build/BandW_Sense.ino.zip`, regenerate `web/firmware/manifest.json` with sizes, SHA-256 and the exact source commit, then run tests before publishing. Keep the application and dat from the same ZIP. Never substitute the source-code ZIP or a binary for the other board.

For regular Sense, compile with `arduino-cli compile --fqbn Seeeduino:mbed:xiaonRF52840Sense --output-dir .tooling/firmware-standard-build firmware/BandW_Sense` (no Plus preprocessor flag). Extract its application bin/dat as `bandw-sense.bin`/`bandw-sense.dat` and update `manifest-sense.json`. Regular Sense firmware has passed compilation and image-integrity tests; physical flashing has only been verified on Sense Plus so far.
