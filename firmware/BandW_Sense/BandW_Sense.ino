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
// Raw-data stream for tuning (recorded on a computer). Sends one 20-byte sample per 20 ms ONLY while a client
// is subscribed; the Android app never subscribes, so normal use is unchanged.
// Layout (little endian): u16 seq · i16 ax,ay,az (mg) · i16 gx,gy,gz (0.1 dps) · u8 flags (bit0 hardware double
// tap) · u8 event (0 none, 1 WATER, 2 FOOD, 3 NO, 4 YES, 5 HELP) · i16 roll, pitch (0.1 deg, filtered, vs calibration)
BLECharacteristic rawCharacteristic("c91b0004-7d7a-4f8c-9d29-6e44c786a321", BLENotify, 20, true);
uint16_t rawSeq = 0;
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
// ---- Orientation of the board in the strap, kept across power cycles ----
// One flash page in the app-data area the bootloader preserves (0xED000-0xF4000, below the bootloader); the
// application itself is linked to end before 0xED000. A reflash keeps it; a bad/absent record means "board frame".
Orientation orient;
const uint32_t ORIENT_ADDR = 0xF3000, ORIENT_MAGIC = 0xB4D0A001;
struct OrientRecord { uint32_t magic; float m[9]; uint32_t sum; };
uint32_t orientSum(const uint32_t* w, int n) { uint32_t s = 0x2545F491u; for (int i = 0; i < n; ++i) s = ((s << 5) | (s >> 27)) ^ w[i]; return s; }
bool loadOrientation() {
    const OrientRecord* r = (const OrientRecord*)ORIENT_ADDR;
    if (r->magic != ORIENT_MAGIC || orientSum((const uint32_t*)r->m, 9) != r->sum) return false;
    for (int i = 0; i < 9; ++i) if (!isfinite(r->m[i]) || fabsf(r->m[i]) > 1.01f) return false;
    for (int i = 0; i < 3; ++i) for (int j = 0; j < 3; ++j) orient.m[i][j] = r->m[3*i + j];
    return true;
}
void nvmcWait() { while (NRF_NVMC->READY == NVMC_READY_READY_Busy) {} }
void saveOrientation() {
    OrientRecord r; r.magic = ORIENT_MAGIC;
    for (int i = 0; i < 3; ++i) for (int j = 0; j < 3; ++j) r.m[3*i + j] = orient.m[i][j];
    r.sum = orientSum((const uint32_t*)r.m, 9);
    NRF_WDT->RR[0] = WDT_RR_RR_Reload;
    NRF_NVMC->CONFIG = NVMC_CONFIG_WEN_Een; nvmcWait();
    NRF_NVMC->ERASEPAGE = ORIENT_ADDR; nvmcWait();                     // ~85 ms, CPU halted
    NRF_NVMC->CONFIG = NVMC_CONFIG_WEN_Wen; nvmcWait();
    const uint32_t* w = (const uint32_t*)&r;
    for (unsigned i = 0; i < sizeof r / 4; ++i) { ((volatile uint32_t*)ORIENT_ADDR)[i] = w[i]; nvmcWait(); }
    NRF_NVMC->CONFIG = NVMC_CONFIG_WEN_Ren; nvmcWait();
}

// ---- Calibration ----
// Quick (power-on): hold still 2 s -> neutral pose, using the saved orientation.
// Full (app button / 'c'): hold still -> tilt LEFT and hold -> tilt RIGHT and hold. Finds which board axis is
// left/right and which is "up", saves that orientation, then uses the held-still pose as neutral.
// The control characteristic reports each step: CALIBRATING, CAL_LEFT, CAL_RIGHT, then READY
// (CAL_SKIPPED first if a tilt step timed out: the previous orientation is kept).
enum CalStep : uint8_t { CAL_OFF, CAL_HOLD, CAL_LEFT, CAL_RIGHT };
CalStep calStep = CAL_OFF;
bool fullCal = false;
uint32_t calStepAt = 0;
float calG0[3], calGL[3];
Calibrator tiltCal;
const uint32_t TILT_STEP_MS = 20000;
const float TILT_MIN_DEG = 15.0f;
void resetCalibration(bool full) {
    calibrated = false; calibratedWithApp = false; calibrator.reset(); tiltCal.reset();
    detector.disarm();
    fullCal = full; calStep = CAL_HOLD; calStepAt = millis();
    calibrator.checkPlane = !full;   // full: raw board axes, orientation still unknown
    controlCharacteristic.writeValue("CALIBRATING");
    log(full ? "CALIBRATE 1/3: hold wrist still in neutral pose for 2 s." : "CALIBRATE: hold wrist still in neutral pose for 2 s.");
}
void finishCalibration(float x, float y, float z, uint32_t now) {   // x, y, z = neutral gravity in the band frame
    detector.calibrate(x, y, z, now);
    calibrated = true; calStep = CAL_OFF; calibrator.checkPlane = true;
    controlCharacteristic.writeValue("READY");
    log("CALIBRATED: L=WATER R=FOOD shake=NO 2tap=YES 2dip=HELP");
}
// Raw board-frame sample during calibration. Returns when done or still collecting.
void calibrationStep(float x, float y, float z, float gx, float gy, float gz, uint32_t now) {
    if (calStep == CAL_HOLD) {
        if (!calibrator.add(x, y, z, gx, gy, gz)) return;
        float g[3] = {calibrator.meanX, calibrator.meanY, calibrator.meanZ};
        if (!fullCal) { finishCalibration(g[0], g[1], g[2], now); return; }   // quick: samples already in the band frame
        for (int i = 0; i < 3; ++i) calG0[i] = g[i];
        calStep = CAL_LEFT; calStepAt = now; tiltCal.reset(); tiltCal.samples = 25; tiltCal.checkPlane = false;
        controlCharacteristic.writeValue("CAL_LEFT");
        log("CALIBRATE 2/3: tilt the wrist LEFT and hold.");
        return;
    }
    if (uint32_t(now - calStepAt) > TILT_STEP_MS) {      // gave up on the tilts: keep the previous orientation
        controlCharacteristic.writeValue("CAL_SKIPPED");
        log("CALIBRATE: tilt step timed out, orientation unchanged.");
        float g[3] = {calG0[0], calG0[1], calG0[2]}; orient.apply(g[0], g[1], g[2]);
        finishCalibration(g[0], g[1], g[2], now); return;
    }
    if (!tiltCal.add(x, y, z, gx, gy, gz)) return;
    float g[3] = {tiltCal.meanX, tiltCal.meanY, tiltCal.meanZ};
    if (Orientation::angle(g, calG0) < TILT_MIN_DEG) return;          // still near neutral: keep waiting
    if (calStep == CAL_LEFT) {
        for (int i = 0; i < 3; ++i) calGL[i] = g[i];
        calStep = CAL_RIGHT; calStepAt = now;
        controlCharacteristic.writeValue("CAL_RIGHT");
        log("CALIBRATE 3/3: tilt the wrist RIGHT and hold.");
        return;
    }
    Orientation o;
    if (!o.fromTilts(calG0, calGL, g)) return;                         // same side as LEFT: keep waiting
    orient = o; saveOrientation();
    log("ORIENTATION saved: X=(" + String(o.m[0][0], 2) + "," + String(o.m[0][1], 2) + "," + String(o.m[0][2], 2) + ") Y=("
        + String(o.m[1][0], 2) + "," + String(o.m[1][1], 2) + "," + String(o.m[1][2], 2) + ")");
    float n[3] = {calG0[0], calG0[1], calG0[2]}; orient.apply(n[0], n[1], n[2]);
    finishCalibration(n[0], n[1], n[2], now);
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
        && imu.writeRegister(0x59, 0x04) == IMU_SUCCESS   // TAP_THS_6D: 4 x 125 mg = 0.5 g at +-4 g (a finger tap through the strap is soft)
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
    gestureService.addCharacteristic(rawCharacteristic);
    BLE.addService(gestureService);
    BLE.setEventHandler(BLEDisconnected, onDisconnected);
    gestureCharacteristic.writeValue("");
    BLE.advertise();
    log("BandW: WATER/FOOD/NO/YES/HELP. c=full calibration, d=IMU log.");
    log(loadOrientation() ? "ORIENTATION loaded from flash." : "ORIENTATION: none saved, using board axes.");
    resetCalibration(false);
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
        if (value == "CALIBRATE") resetCalibration(true);
    }
    while (_SerialUSB.available()) {
        char input = _SerialUSB.read();
        if (input == 'c' || input == 'C') resetCalibration(true);
        if (input == 'd' || input == 'D') debugImu = !debugImu;
    }
    uint32_t now = millis();
    bool subscribed = connected && gestureCharacteristic.subscribed();
    if (subscribed != wasSubscribed) {
        detector.disarm(); // Require a neutral wrist before each new connection session.
        log(subscribed ? "APP READY" : "APP DISCONNECTED");
        wasSubscribed = subscribed;
        // No automatic recalibration on connect (0.5.0 did it and, until the wrist held perfectly still for 2 s,
        // the band ignored every gesture). Calibrate at power-on or with the app's button, as in v0.4.0.
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
        if (++badSamples == 50 && calibrated) resetCalibration(false);
        return;
    }
    badSamples = 0;
    if (debugImu && calibrated && uint32_t(now - debugAt) >= 100) {
        debugAt = now;
        log("IMU(board) " + String(x, 3) + "," + String(y, 3) + "," + String(z, 3) + ","
            + String(gx, 1) + "," + String(gy, 1) + "," + String(gz, 1) + (doubleTap ? " TAP" : ""));
    }
    if (!calibrated) {
        if (fullCal) calibrationStep(x, y, z, gx, gy, gz, now);
        else { orient.apply(x, y, z); orient.apply(gx, gy, gz); calibrationStep(x, y, z, gx, gy, gz, now); }
        return;
    }
    // Everything below (detector, debug log, raw stream) works in the band frame.
    orient.apply(x, y, z); orient.apply(gx, gy, gz);
    if (!subscribed) doubleTap = false; // No buffering or replay of gestures performed while disconnected.
    Gesture event = detector.update(x, y, z, gx, gy, gz, now, doubleTap);
    if (doubleTap) log(detector.tapNote ? String("TAP ignored: ") + detector.tapNote : String("TAP"));
    if (connected && rawCharacteristic.subscribed()) {
        uint8_t p[20];
        auto put16 = [&](int at, float v) { int32_t i = lroundf(v); if (i > 32767) i = 32767; if (i < -32768) i = -32768;
            p[at] = uint8_t(i & 0xFF); p[at + 1] = uint8_t((i >> 8) & 0xFF); };
        p[0] = rawSeq & 0xFF; p[1] = rawSeq >> 8; ++rawSeq;
        put16(2, x * 1000); put16(4, y * 1000); put16(6, z * 1000);
        put16(8, gx * 10); put16(10, gy * 10); put16(12, gz * 10);
        p[14] = (doubleTap ? 1 : 0) | uint8_t(detector.stateBits() << 1);
        p[15] = uint8_t(event);
        put16(16, detector.rollDeg() * 10); put16(18, detector.pitchDeg() * 10);
        rawCharacteristic.writeValue(p, sizeof p);
    }
    if (!subscribed) return;
    const char* command = event == Gesture::Water ? "WATER" : event == Gesture::Food ? "FOOD" : event == Gesture::No ? "NO"
        : event == Gesture::Yes ? "YES" : event == Gesture::Help ? "HELP" : nullptr;
    if (command) log(String(gestureCharacteristic.writeValue(command) ? "TX " : "TX FAILED ") + command);
}
