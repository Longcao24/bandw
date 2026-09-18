#include <ArduinoBLE.h>
#include <LSM6DS3.h>
#include <Wire.h>
#include "GestureDetector.h"

// Custom BandW service; Android uses the same UUIDs. One notification = one ASCII command.
BLEService gestureService("c91b0001-7d7a-4f8c-9d29-6e44c786a321");
BLEStringCharacteristic gestureCharacteristic("c91b0002-7d7a-4f8c-9d29-6e44c786a321", BLERead | BLENotify, 8);
LSM6DS3 imu(I2C_MODE, 0x6A);
GestureDetector detector;
const uint32_t SAMPLE_MS = 20;
uint32_t sampleAt = 0, blinkAt = 0;
bool calibrated = false, wasSubscribed = false, ledOn = false;
bool debugImu = false;
uint32_t debugAt = 0;
int calibrationCount = 0;
float sumX = 0, sumZ = 0, previousX = 0, previousY = 0, previousZ = 0;

void resetCalibration() {
    calibrated = false; calibrationCount = 0; sumX = sumZ = 0;
    detector.disarm();
    Serial.println("CALIBRATE: hold wrist still in your neutral pose for 2 seconds.");
}
void fatal(const char* message) {
    Serial.println(message);
    while (true) {
        if (Serial) Serial.println(message);
        digitalWrite(LED_BUILTIN, LOW); delay(100);
        digitalWrite(LED_BUILTIN, HIGH); delay(900);
    }
}
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, HIGH); // XIAO LED is active low.
    Serial.begin(115200); // Do not wait for USB: standalone battery startup must work.
    imu.settings.accelRange = 4;
    imu.settings.gyroRange = 500;
    imu.settings.accelSampleRate = 104;
    imu.settings.gyroSampleRate = 104;
    if (imu.begin() != 0) fatal("ERROR: LSM6DS3 not found; check Sense board selection.");
    if (!BLE.begin()) fatal("ERROR: BLE initialization failed.");
    BLE.setLocalName("BandW-Sense");
    BLE.setDeviceName("BandW-Sense");
    BLE.setAdvertisedService(gestureService);
    gestureService.addCharacteristic(gestureCharacteristic);
    BLE.addService(gestureService);
    gestureCharacteristic.writeValue("");
    BLE.advertise();
    Serial.println("BandW advertising; commands: WATER / FOOD / NO. Send c to recalibrate.");
    resetCalibration();
}
void loop() {
    BLE.poll();
    if (Serial.available()) {
        char input = Serial.read();
        if (input == 'c' || input == 'C') resetCalibration();
        if (input == 'd' || input == 'D') debugImu = !debugImu;
    }
    uint32_t now = millis();
    bool subscribed = gestureCharacteristic.subscribed();
    if (subscribed != wasSubscribed) {
        detector.disarm(); // Require a neutral wrist before each new connection session.
        Serial.println(subscribed ? "APP READY" : "APP DISCONNECTED");
        wasSubscribed = subscribed;
    }
    if (calibrated && subscribed) digitalWrite(LED_BUILTIN, LOW);
    else if (uint32_t(now - blinkAt) >= (calibrated ? 800U : 150U)) {
        blinkAt = now; ledOn = !ledOn; digitalWrite(LED_BUILTIN, ledOn ? LOW : HIGH);
    }
    if (uint32_t(now - sampleAt) < SAMPLE_MS) return;
    sampleAt = now;
    float x = imu.readFloatAccelX(), y = imu.readFloatAccelY(), z = imu.readFloatAccelZ();
    float gx = imu.readFloatGyroX(), gy = imu.readFloatGyroY(), gz = imu.readFloatGyroZ();
    if (debugImu && Serial && uint32_t(now - debugAt) >= 100) {
        debugAt = now;
        Serial.print("IMU ax,ay,az,gx,gy,gz: ");
        Serial.print(x, 3); Serial.print(','); Serial.print(y, 3); Serial.print(','); Serial.print(z, 3);
        Serial.print(','); Serial.print(gx, 1); Serial.print(','); Serial.print(gy, 1); Serial.print(','); Serial.println(gz, 1);
    }
    if (!isfinite(x) || !isfinite(y) || !isfinite(z) || !isfinite(gx) || !isfinite(gy) || !isfinite(gz)) {
        resetCalibration(); return;
    }
    if (!calibrated) {
        float magnitude = sqrtf(x*x + y*y + z*z);
        bool steady = magnitude > 0.85f && magnitude < 1.15f && sqrtf(x*x + z*z) > 0.65f
            && fabsf(gx) < 15 && fabsf(gy) < 15 && fabsf(gz) < 15
            && (!calibrationCount || (fabsf(x-previousX) < 0.06f && fabsf(y-previousY) < 0.06f && fabsf(z-previousZ) < 0.06f));
        previousX = x; previousY = y; previousZ = z;
        if (!steady) { calibrationCount = 0; sumX = sumZ = 0; return; }
        sumX += x; sumZ += z;
        if (++calibrationCount >= 100) {
            detector.calibrate(sumX / calibrationCount, sumZ / calibrationCount, now);
            calibrated = true;
            Serial.println("CALIBRATED: tilt left=WATER, right=FOOD, shake=NO.");
        }
        return;
    }
    if (!subscribed) return; // No buffering or replay of gestures performed while disconnected.
    Gesture event = detector.update(x, y, z, gx, gy, gz, now);
    const char* command = event == Gesture::Water ? "WATER" : event == Gesture::Food ? "FOOD" : event == Gesture::No ? "NO" : nullptr;
    if (command) {
        bool sent = gestureCharacteristic.writeValue(command);
        Serial.print(sent ? "TX " : "TX FAILED "); Serial.println(command);
    }
}
