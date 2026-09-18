#pragma once
#include <math.h>
#include <stdint.h>

// Units: acceleration in g; angular velocity in degrees/second; time in ms.
// Board mounted flat at neutral, X is the left/right tilt axis, Z faces up.
// Change TILT_SIGN if the physical left/right direction is reversed.
static const float TILT_SIGN = 1.0f;
static const float TILT_ENTER_DEG = 30.0f;
static const float TILT_EXIT_DEG = 12.0f;
static const float SHAKE_DPS = 150.0f;
static const uint32_t HOLD_MS = 500;
static const uint32_t NEUTRAL_MS = 400;
static const uint32_t COOLDOWN_MS = 1200;

enum class Gesture { None, Water, Food, No };

class GestureDetector {
    float baseline = 0, filtered = 0;
    bool initialized = false, armed = false, neutralTiming = false;
    uint32_t neutralAt = 0, lastEmission = 0, candidateAt = 0;
    uint32_t lastMotion = 0, shakeStart = 0, pulseAt = 0;
    int candidate = 0, shakeSign = 0, shakePulses = 0;
    bool cooling = false;

    static float angle(float x, float z) { return atan2f(x, z) * 57.2957795f; }
    static float wrap(float degrees) {
        while (degrees > 180) degrees -= 360;
        while (degrees < -180) degrees += 360;
        return degrees;
    }
    Gesture emit(Gesture result, uint32_t now) {
        armed = false; neutralTiming = false; cooling = true; lastEmission = now;
        candidate = 0; shakePulses = 0; shakeSign = 0;
        return result;
    }
public:
    void calibrate(float x, float z, uint32_t now) {
        baseline = angle(x, z); filtered = 0; initialized = true;
        armed = false; neutralTiming = false; cooling = false;
        candidate = 0; shakePulses = 0; shakeSign = 0; lastMotion = now;
    }
    void disarm() { armed = false; neutralTiming = false; candidate = 0; shakePulses = 0; shakeSign = 0; }

    Gesture update(float x, float y, float z, float gx, float gy, float gz, uint32_t now) {
        if (!initialized) return Gesture::None;
        if (!isfinite(x) || !isfinite(y) || !isfinite(z) || !isfinite(gx) || !isfinite(gy) || !isfinite(gz)) {
            disarm(); return Gesture::None;
        }
        float magnitude = sqrtf(x*x + y*y + z*z);
        float speed = sqrtf(gx*gx + gy*gy + gz*gz);
        float tilt = TILT_SIGN * wrap(angle(x, z) - baseline);
        filtered += 0.22f * wrap(tilt - filtered);
        filtered = wrap(filtered);
        if (speed > 70 || magnitude < 0.8f || magnitude > 1.2f) lastMotion = now;
        if (cooling && uint32_t(now - lastEmission) >= COOLDOWN_MS) cooling = false;
        if (!armed) {
            bool neutral = !cooling && fabsf(filtered) < TILT_EXIT_DEG && speed < 40 && magnitude > 0.85f && magnitude < 1.15f;
            if (neutral) {
                if (!neutralTiming) { neutralAt = now; neutralTiming = true; }
                if (uint32_t(now - neutralAt) >= NEUTRAL_MS) armed = true;
            } else neutralTiming = false;
            return Gesture::None;
        }
        // Three alternating fast rotations on Y within 900 ms = one wrist shake.
        // Any rapid motion cancels a tilt candidate, so shaking cannot also emit FOOD/WATER.
        if (shakePulses && uint32_t(now - shakeStart) > 900) { shakePulses = 0; shakeSign = 0; }
        int sign = gy > SHAKE_DPS ? 1 : gy < -SHAKE_DPS ? -1 : 0;
        if (sign && sign != shakeSign && (!shakePulses || uint32_t(now - pulseAt) >= 80)) {
            if (!shakePulses) shakeStart = now;
            shakeSign = sign; pulseAt = now; ++shakePulses;
            if (shakePulses >= 3) return emit(Gesture::No, now);
        }
        if (uint32_t(now - lastMotion) < 300 || magnitude < 0.85f || magnitude > 1.15f) {
            candidate = 0; return Gesture::None;
        }
        int direction = filtered < -TILT_ENTER_DEG ? -1 : filtered > TILT_ENTER_DEG ? 1 : 0;
        if (!direction) { candidate = 0; return Gesture::None; }
        if (candidate != direction) { candidate = direction; candidateAt = now; }
        if (uint32_t(now - candidateAt) >= HOLD_MS) return emit(direction < 0 ? Gesture::Water : Gesture::Food, now);
        return Gesture::None;
    }
};
