#include <ArduinoBLE.h>
#include <LSM6DS3.h>
#include <Wire.h>
#include "utility/HCI.h"
#include "USB/PluggableUSBSerial.h"
#include "GestureDetector.h"

// Custom BandW service; Android uses the same UUIDs. One notification = one ASCII command.
BLEService gestureService("c91b0001-7d7a-4f8c-9d29-6e44c786a321");
BLEStringCharacteristic gestureCharacteristic("c91b0002-7d7a-4f8c-9d29-6e44c786a321", BLERead | BLENotify, 8);
BLEStringCharacteristic controlCharacteristic("c91b0003-7d7a-4f8c-9d29-6e44c786a321", BLERead | BLEWrite | BLENotify, 20);
LSM6DS3 imu(I2C_MODE, 0x6A);
GestureDetector detector;
Calibrator calibrator;
const uint32_t SAMPLE_MS = 20, WATCHDOG_MS = 4000;
uint32_t sampleAt = 0, blinkAt = 0, debugAt = 0, advertiseAt = 0;
bool calibrated = false, calibratedWithApp = false, wasSubscribed = false, ledOn = false;
bool debugImu = false, tapReady = false;
volatile bool linkDropped = false;
int badSamples = 0;

// ArduinoBLE 2.1.0 never returns the HCI packet credits that were in flight when a link drops, so after
// a few drops the next notification spins forever inside sendAclPkt and the band freezes. Reset the private
// counter (explicit instantiation may name private members) whenever no central is connected.
uint8_t HCIClass::* pendingPkt();
template<uint8_t HCIClass::* M> struct PendingPktAccess { friend uint8_t HCIClass::* pendingPkt() { return M; } };
template struct PendingPktAccess<&HCIClass::_pendingPkt>;

// Best-effort USB log. Serial.print blocks while a host holds the port open without reading, which stalls
// BLE.poll() until the phone drops the link (Serial is a UART wrapper around _SerialUSB on this core);
// send_nb queues at most one USB packet (64 bytes, longer text is cut) or drops it when the host is busy.
void log(const String& text) {
    if (!_SerialUSB.connected()) return;
    String line = text + "\r\n";
    uint32_t sent = 0;
    _SerialUSB.send_nb((uint8_t*)line.c_str(), line.length(), &sent, true);
}
void resetCalibration() {
    calibrated = false; calibratedWithApp = false; calibrator.reset();
    detector.disarm();
    controlCharacteristic.writeValue("CALIBRATING");
    log("CALIBRATE: hold wrist still in neutral pose for 2 s.");
}
void fatal(const char* message) {
    while (true) {
        log(message);
        digitalWrite(LED_BUILTIN, LOW); delay(100);
        digitalWrite(LED_BUILTIN, HIGH); delay(900);
    }
}
void onDisconnected(BLEDevice) { HCI.*pendingPkt() = 0; linkDropped = true; }
// Hardware double-tap detection (LSM6DS3TR-C), latched until TAP_SRC is read. YES is optional: a failed
// write only disables it.
bool setupTap() {
    return imu.writeRegister(0x58, 0x8F) == IMU_SUCCESS   // TAP_CFG1: interrupts on, tap X/Y/Z, latched
        && imu.writeRegister(0x59, 0x06) == IMU_SUCCESS   // TAP_THS_6D: 6 x 125 mg at +-4 g
        && imu.writeRegister(0x5A, 0x7F) == IMU_SUCCESS   // INT_DUR2: gap <= 538 ms, quiet 29 ms, shock 58 ms
        && imu.writeRegister(0x5B, 0x80) == IMU_SUCCESS   // WAKE_UP_THS: single + double tap
        && imu.writeRegister(0x5E, 0x08) == IMU_SUCCESS;  // MD1_CFG: double tap on INT1
}
// One burst read of gyro + accel (OUTX_L_G..OUTZ_H_XL) so all six axes come from the same sample.
// readRegisterRegion reports success even when I2C returns fewer bytes, so missing bytes stay zero and a
// near-zero acceleration (impossible while worn: gravity is always there) marks the sample as bad.
bool readImu(float* v) {
    uint8_t raw[12] = {};
    if (imu.readRegisterRegion(raw, 0x22, 12) != IMU_SUCCESS) return false;
    for (int i = 0; i < 6; ++i) {
        int16_t value = int16_t(raw[2*i] | (raw[2*i+1] << 8));
        v[i] = i < 3 ? imu.calcGyro(value) : imu.calcAccel(value);
    }
    return v[3]*v[3] + v[4]*v[4] + v[5]*v[5] >= 0.01f;
}
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, HIGH); // XIAO LED is active low.
    Serial.begin(115200); // Do not wait for USB: standalone battery startup must work.
    imu.settings.accelRange = 4;
    imu.settings.gyroRange = 500;
    imu.settings.accelSampleRate = 416; // tap detection needs >= 416 Hz
    imu.settings.gyroSampleRate = 104;
    if (imu.begin() != 0) fatal("ERROR: LSM6DS3 not found; check Sense board selection.");
    uint8_t ctrl3 = 0;
    if (imu.readRegister(&ctrl3, 0x12) == IMU_SUCCESS) imu.writeRegister(0x12, ctrl3 | 0x40); // CTRL3_C.BDU
    tapReady = setupTap();
    if (!tapReady) log("WARN: tap config failed; YES disabled.");
    if (!BLE.begin()) fatal("ERROR: BLE initialization failed.");
    BLE.setLocalName("BandW-Sense");
    BLE.setDeviceName("BandW-Sense");
    BLE.setAdvertisedService(gestureService);
    gestureService.addCharacteristic(gestureCharacteristic);
    gestureService.addCharacteristic(controlCharacteristic);
    BLE.addService(gestureService);
    BLE.setEventHandler(BLEDisconnected, onDisconnected);
    gestureCharacteristic.writeValue("");
    BLE.advertise();
    log("BandW: WATER/FOOD/NO/YES/HELP. c=recalibrate, d=IMU log.");
    resetCalibration();
    // A freeze (I2C, BLE stack) now resets the band instead of leaving it dead. mbed's Watchdog class is
    // not built for this variant, so use the nRF52 WDT directly; bootloader 0.6.2 keeps feeding it while
    // USB/web flashing. Once started it cannot be stopped until reset.
    if (!NRF_WDT->RUNSTATUS) {
        NRF_WDT->CONFIG = WDT_CONFIG_SLEEP_Run << WDT_CONFIG_SLEEP_Pos | WDT_CONFIG_HALT_Pause << WDT_CONFIG_HALT_Pos;
        NRF_WDT->CRV = WATCHDOG_MS * 32768 / 1000;
        NRF_WDT->RREN = WDT_RREN_RR0_Msk;
        NRF_WDT->TASKS_START = 1;
    }
}
void loop() {
    NRF_WDT->RR[0] = WDT_RR_RR_Reload;
    BLE.poll();
    bool connected = BLE.connected();
    if (!connected) HCI.*pendingPkt() = 0;
    // The stack re-enables advertising on disconnect but ignores failures; restart it explicitly.
    if (linkDropped && !connected && uint32_t(millis() - advertiseAt) >= 1000) {
        advertiseAt = millis();
        if (BLE.advertise()) { linkDropped = false; log("ADVERTISING"); }
    }
    if (controlCharacteristic.written()) {
        String value = controlCharacteristic.value(); value.trim(); value.toUpperCase();
        if (value == "CALIBRATE") resetCalibration();
    }
    while (_SerialUSB.available()) {
        char input = _SerialUSB.read();
        if (input == 'c' || input == 'C') resetCalibration();
        if (input == 'd' || input == 'D') debugImu = !debugImu;
    }
    uint32_t now = millis();
    bool subscribed = connected && gestureCharacteristic.subscribed();
    if (subscribed != wasSubscribed) {
        detector.disarm(); // Require a neutral wrist before each new connection session.
        log(subscribed ? "APP READY" : "APP DISCONNECTED");
        wasSubscribed = subscribed;
        // A calibration taken before any app connected (often on a table after power-on) is redone once worn.
        if (subscribed && calibrated && !calibratedWithApp) resetCalibration();
    }
    // LED: fast blink = calibrating, slow blink = waiting for app, short pulse every 2 s = ready.
    uint32_t ledMs = !calibrated ? 150U : !subscribed ? 800U : ledOn ? 60U : 1940U;
    if (uint32_t(now - blinkAt) >= ledMs) {
        blinkAt = now; ledOn = !ledOn; digitalWrite(LED_BUILTIN, ledOn ? LOW : HIGH);
    }
    if (uint32_t(now - sampleAt) < SAMPLE_MS) { delay(1); return; } // sleep instead of spinning
    sampleAt = now;
    float v[6] = {};
    bool valid = readImu(v);
    float gx = v[0], gy = v[1], gz = v[2], x = v[3], y = v[4], z = v[5];
    uint8_t tapSource = 0; // always read so a stale latched tap never fires later
    bool doubleTap = tapReady && imu.readRegister(&tapSource, 0x1C) == IMU_SUCCESS && (tapSource & 0x10);
    if (!valid || !isfinite(x) || !isfinite(y) || !isfinite(z) || !isfinite(gx) || !isfinite(gy) || !isfinite(gz)) {
        // Skip a bad sample; only a sustained IMU failure (1 s) forces a new calibration.
        if (++badSamples == 50 && calibrated) resetCalibration();
        return;
    }
    badSamples = 0;
    if (debugImu && uint32_t(now - debugAt) >= 100) {
        debugAt = now;
        log("IMU " + String(x, 3) + "," + String(y, 3) + "," + String(z, 3) + ","
            + String(gx, 1) + "," + String(gy, 1) + "," + String(gz, 1) + (doubleTap ? " TAP" : ""));
    }
    if (!calibrated) {
        if (calibrator.add(x, y, z, gx, gy, gz)) {
            detector.calibrate(calibrator.meanX, calibrator.meanY, calibrator.meanZ, now);
            calibrated = true; calibratedWithApp = subscribed;
            controlCharacteristic.writeValue("READY");
            log("CALIBRATED: L=WATER R=FOOD shake=NO 2tap=YES 2dip=HELP");
        }
        return;
    }
    if (!subscribed) doubleTap = false; // No buffering or replay of gestures performed while disconnected.
    Gesture event = detector.update(x, y, z, gx, gy, gz, now, doubleTap);
    if (!subscribed) return;
    const char* command = event == Gesture::Water ? "WATER" : event == Gesture::Food ? "FOOD" : event == Gesture::No ? "NO"
        : event == Gesture::Yes ? "YES" : event == Gesture::Help ? "HELP" : nullptr;
    if (command) log(String(gestureCharacteristic.writeValue(command) ? "TX " : "TX FAILED ") + command);
}
