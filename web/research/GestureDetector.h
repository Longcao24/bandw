#pragma once
#include <math.h>
#include <stdint.h>

// Units: acceleration in g; angular velocity in degrees/second; time in ms.
// Board mounted flat at neutral, X is the left/right tilt axis, Y runs along the forearm, Z faces up.
// Roll (left/right) is the rotation about Y; pitch tips Y (the forearm) up/down about the elbow.
// Change TILT_SIGN if left/right is reversed (debug mode prints ax..gz). HELP accepts either pitch
// direction, so it does not depend on which way +Y points on the board.
static const float TILT_SIGN = 1.0f;
static const float TILT_ENTER_DEG = 22.0f;
static const float TILT_EXIT_DEG = 12.0f;
static const float PITCH_ENTER_DEG = 25.0f;
static const float PITCH_EXIT_DEG = 12.0f;
static const float AXIS_MARGIN_DEG = 8.0f;  // the held axis must beat the other one by this much
static const float MIN_PLANE_G = 0.4f;      // below this, X/Z cannot define roll (forearm near vertical)
static const float SHAKE_DPS = 100.0f;
static const uint32_t HOLD_MS = 250;
static const uint32_t DIP_MAX_MS = 700;      // one HELP dip: out past PITCH_ENTER_DEG and back, at most this long
static const uint32_t HELP_WINDOW_MS = 2000; // both dips of a HELP must fit in this window
static const uint32_t NEUTRAL_MS = 200;
static const uint32_t COOLDOWN_MS = 650;
static const uint32_t TAP_CONFIRM_MS = 150;
static const uint32_t TAP_QUIET_BEFORE_MS = 300;
static const float TAP_STILL_DPS = 50.0f;   // arm motion before a tap (e.g. setting the arm down) rejects YES

enum class Gesture { None, Water, Food, No, Yes, Help };

static inline float pitchAngle(float x, float y, float z) {
    float m = sqrtf(x*x + y*y + z*z), s = m > 0 ? y / m : 0;
    return asinf(s > 1 ? 1 : s < -1 ? -1 : s) * 57.2957795f;
}

// Collects 100 steady samples (2 s at 50 Hz) of the neutral pose. Up to MAX_REJECTS jittery
// samples are tolerated per window, so a small tremor does not restart the count.
class Calibrator {
    float sx = 0, sy = 0, sz = 0;
    int n = 0, rejects = 0;
public:
    static const int SAMPLES = 100, MAX_REJECTS = 10;
    float meanX = 0, meanY = 0, meanZ = 0;
    void reset() { sx = sy = sz = 0; n = rejects = 0; }
    int count() const { return n; }
    bool add(float x, float y, float z, float gx, float gy, float gz) {
        float m = sqrtf(x*x + y*y + z*z);
        bool ok = m > 0.85f && m < 1.15f && sqrtf(x*x + z*z) > 0.6f
            && fabsf(gx) < 20 && fabsf(gy) < 20 && fabsf(gz) < 20
            && (!n || (fabsf(x - sx/n) < 0.08f && fabsf(y - sy/n) < 0.08f && fabsf(z - sz/n) < 0.08f));
        if (!ok) { if (++rejects > MAX_REJECTS) reset(); return false; }
        sx += x; sy += y; sz += z;
        if (++n < SAMPLES) return false;
        meanX = sx / n; meanY = sy / n; meanZ = sz / n;
        reset();
        return true;
    }
};

class GestureDetector {
    float baseline = 0, filtered = 0, pitchBaseline = 0, filteredPitch = 0;
    bool initialized = false, armed = false, neutralTiming = false;
    uint32_t neutralAt = 0, lastEmission = 0, candidateAt = 0;
    uint32_t lastMotion = 0, shakeStart = 0, pulseAt = 0;
    uint32_t tapAt = 0, lastStir = 0, dipStart = 0, firstDipAt = 0;
    int candidate = 0, shakeSign = 0, shakePulses = 0, lastSign = 0;
    int stirRun = 0, fastRun = 0, dipDir = 0, pairDir = 0, dips = 0;
    bool cooling = false, tapPending = false;

    static float angle(float x, float z) { return atan2f(x, z) * 57.2957795f; }
    static float wrap(float degrees) {
        while (degrees > 180) degrees -= 360;
        while (degrees < -180) degrees += 360;
        return degrees;
    }
    Gesture emit(Gesture result, uint32_t now) {
        armed = false; neutralTiming = false; cooling = true; lastEmission = now;
        candidate = 0; shakePulses = 0; shakeSign = 0; lastSign = 0; tapPending = false; dipDir = dips = 0;
        return result;
    }
public:
    void calibrate(float x, float y, float z, uint32_t now) {
        baseline = angle(x, z); filtered = 0; initialized = true;
        pitchBaseline = pitchAngle(x, y, z); filteredPitch = 0;
        armed = false; neutralTiming = false; cooling = false; tapPending = false;
        candidate = 0; shakePulses = 0; shakeSign = 0; lastSign = 0; lastMotion = now;
        lastStir = now - 1000U; stirRun = fastRun = 0; dipDir = dips = 0;
    }
    void disarm() {
        armed = false; neutralTiming = false; candidate = 0; shakePulses = shakeSign = lastSign = 0; tapPending = false;
        dipDir = dips = 0;
    }

    // doubleTap: the IMU's hardware double-tap flag for this sample (latched, read once per sample).
    Gesture update(float x, float y, float z, float gx, float gy, float gz, uint32_t now, bool doubleTap = false) {
        if (!initialized) return Gesture::None;
        if (!isfinite(x) || !isfinite(y) || !isfinite(z) || !isfinite(gx) || !isfinite(gy) || !isfinite(gz)) {
            disarm(); return Gesture::None;
        }
        float magnitude = sqrtf(x*x + y*y + z*z);
        float speed = sqrtf(gx*gx + gy*gy + gz*gz);
        // With the forearm near vertical, atan2(x, z) is mostly noise: freeze roll and block tilt.
        bool level = sqrtf(x*x + z*z) >= MIN_PLANE_G;
        if (level) {
            float tilt = TILT_SIGN * wrap(angle(x, z) - baseline);
            filtered += 0.22f * wrap(tilt - filtered);
            filtered = wrap(filtered);
        }
        // Shocks (|a| far from 1 g) say nothing about the forearm angle and must not fake a HELP dip.
        if (magnitude > 0.5f && magnitude < 1.5f) filteredPitch += 0.22f * ((pitchAngle(x, y, z) - pitchBaseline) - filteredPitch);
        if (speed > 70 || magnitude < 0.8f || magnitude > 1.2f) lastMotion = now;
        // Rotation only counts for YES when it lasts 2 consecutive samples, so the jolt of the tap itself
        // never vetoes it, while lowering the arm onto a table (a set-down impact) does.
        stirRun = speed > TAP_STILL_DPS ? stirRun + 1 : 0;
        fastRun = speed > SHAKE_DPS ? fastRun + 1 : 0;
        if (stirRun >= 2) lastStir = now;
        if (fastRun >= 2) tapPending = false;
        if (cooling && uint32_t(now - lastEmission) >= COOLDOWN_MS) cooling = false;
        bool rest = level && fabsf(filtered) < TILT_EXIT_DEG && fabsf(filteredPitch) < PITCH_EXIT_DEG;
        if (!armed) {
            bool neutral = !cooling && rest && speed < 40 && magnitude > 0.85f && magnitude < 1.15f;
            if (neutral) {
                if (!neutralTiming) { neutralAt = now; neutralTiming = true; }
                if (uint32_t(now - neutralAt) >= NEUTRAL_MS) armed = true;
            } else neutralTiming = false;
            return Gesture::None;
        }
        // Three alternating fast rotations on Y within 900 ms = one wrist shake. A pulse needs two
        // consecutive samples, so a single jolt (e.g. a tap) is not counted.
        // Any rapid motion cancels a tilt candidate, so shaking cannot also emit FOOD/WATER.
        if (shakePulses && uint32_t(now - shakeStart) > 900) { shakePulses = 0; shakeSign = 0; }
        int sign = gy > SHAKE_DPS ? 1 : gy < -SHAKE_DPS ? -1 : 0;
        bool sustained = sign && sign == lastSign;
        lastSign = sign;
        if (sustained && sign != shakeSign && (!shakePulses || uint32_t(now - pulseAt) >= 80)) {
            if (!shakePulses) shakeStart = now;
            shakeSign = sign; pulseAt = now; ++shakePulses;
            if (shakePulses >= 3) return emit(Gesture::No, now);
        }
        // Double tap = YES, only from a still neutral pose and confirmed after a quiet window,
        // so the jolts of a shake are never read as a tap (sustained fast rotation cancels it, see above).
        if (doubleTap && !tapPending && rest && uint32_t(now - lastStir) >= TAP_QUIET_BEFORE_MS) {
            tapPending = true; tapAt = now;
        }
        if (tapPending && uint32_t(now - tapAt) >= TAP_CONFIRM_MS) {
            tapPending = false;
            if (rest) return emit(Gesture::Yes, now);
        }
        // HELP = two quick forearm dips the same way (out past PITCH_ENTER_DEG and back under PITCH_EXIT_DEG,
        // each within DIP_MAX_MS, both within HELP_WINDOW_MS). A held pitch (hand to mouth, forearm lowered
        // onto the lap) is never a dip, so everyday postures cannot call for help.
        float roll = fabsf(filtered), pitch = fabsf(filteredPitch);
        if (dips && uint32_t(now - firstDipAt) > HELP_WINDOW_MS) dips = 0;
        if (!dipDir) {
            if (pitch > PITCH_ENTER_DEG && pitch >= roll + AXIS_MARGIN_DEG) {
                dipDir = filteredPitch < 0 ? -1 : 1; dipStart = now;
                if (dips && dipDir != pairDir) dips = 0;
            }
        } else if (pitch < PITCH_EXIT_DEG) {
            if (uint32_t(now - dipStart) > DIP_MAX_MS) dips = 0;
            else {
                if (!dips) { firstDipAt = dipStart; pairDir = dipDir; }
                if (++dips >= 2) return emit(Gesture::Help, now);
            }
            dipDir = 0;
        } else if (uint32_t(now - dipStart) > DIP_MAX_MS) dips = 0;
        if (tapPending || !level || uint32_t(now - lastMotion) < 150 || magnitude < 0.85f || magnitude > 1.15f) {
            candidate = 0; return Gesture::None;
        }
        int direction = roll > TILT_ENTER_DEG && roll >= pitch + AXIS_MARGIN_DEG ? (filtered < 0 ? -1 : 1) : 0;
        if (!direction) { candidate = 0; return Gesture::None; }
        if (candidate != direction) { candidate = direction; candidateAt = now; }
        if (uint32_t(now - candidateAt) >= HOLD_MS) return emit(direction < 0 ? Gesture::Water : Gesture::Food, now);
        return Gesture::None;
    }
};
