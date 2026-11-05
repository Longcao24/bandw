#pragma once
#include <math.h>
#include <stdint.h>

// Units: acceleration in g; angular velocity in degrees/second; time in ms.
// Board mounted flat at neutral, X is the left/right tilt axis, Y runs along the forearm, Z faces up.
// Roll (left/right) is the rotation about Y; pitch tips Y (the forearm) up/down about the elbow.
// Change TILT_SIGN if left/right is reversed (debug mode prints ax..gz). HELP accepts either pitch
// direction, so it does not depend on which way +Y points on the board.
static const float TILT_SIGN = 1.0f;
// WATER / FOOD / NO and the neutral re-arm are exactly the v0.4.0 (3-gesture) rules, which worked well on
// the wrist. 0.5.0 also required the forearm pitch to be back within 12 deg and an axis margin before a tilt,
// which a real arm rarely satisfies: the band looked frozen. HELP and YES below never block those three.
static const float TILT_ENTER_DEG = 22.0f;
static const float TILT_EXIT_DEG = 12.0f;
static const float SHAKE_DPS = 100.0f;
static const uint32_t HOLD_MS = 250;
static const uint32_t NEUTRAL_MS = 200;
static const uint32_t COOLDOWN_MS = 650;
// HELP: two quick, big forearm dips the same way.
static const float PITCH_ENTER_DEG = 40.0f;  // each dip must pass this (was 25: everyday arm movement)
static const float PITCH_EXIT_DEG = 12.0f;   // ...and come back under this
static const float AXIS_MARGIN_DEG = 8.0f;   // a dip must be mostly pitch, not a tilt
static const float MIN_PLANE_G = 0.4f;       // below this, X/Z cannot define roll (forearm near vertical)
static const uint32_t DIP_MAX_MS = 700;      // one dip: out and back within this
static const uint32_t HELP_WINDOW_MS = 2000; // both dips within this
// YES: a double tap, with the wrist not tilted. A short wait lets a shake (whose jolts look like taps) win as NO.
// Recorded on a real band (2026-11-05), the IMU's hardware double-tap flag never fired while each finger tap showed
// as a 2.9-3.2 g one-sample spike after a still wrist, so taps are also found in software from those spikes.
static const uint32_t TAP_CONFIRM_MS = 150;
static const float TAP_SPIKE_G = 1.8f;          // |a| above this = an impact
static const float TAP_QUIET_DPS = 60.0f;       // the wrist was not moving just before the first tap
static const uint32_t TAP_GAP_MIN_MS = 100, TAP_GAP_MAX_MS = 700;   // second tap after the first
// NO: three alternating fast wrist rotations within this window (0.9 s missed wide, slow shakes on a real wrist).
#ifndef SHAKE_WINDOW_MS_VALUE
#define SHAKE_WINDOW_MS_VALUE 1500
#endif
static const uint32_t SHAKE_WINDOW_MS = SHAKE_WINDOW_MS_VALUE;
// HELP also accepts one big sweep through neutral: forearm past -PITCH_ENTER_DEG and past +PITCH_ENTER_DEG (either
// order) within HELP_WINDOW_MS, which is how "lower it, then raise it" was done on a real wrist.
#ifndef HELP_SWEEP_VALUE
#define HELP_SWEEP_VALUE true
#endif
static const bool HELP_SWEEP = HELP_SWEEP_VALUE;

enum class Gesture { None, Water, Food, No, Yes, Help };

static inline float pitchAngle(float x, float y, float z) {
    float m = sqrtf(x*x + y*y + z*z), s = m > 0 ? y / m : 0;
    return asinf(s > 1 ? 1 : s < -1 ? -1 : s) * 57.2957795f;
}

// Collects `samples` steady samples (100 = 2 s at 50 Hz) of one pose. Up to MAX_REJECTS jittery samples are
// tolerated per window, so a small tremor does not restart the count. checkPlane rejects a forearm near vertical
// (only meaningful once the data is in the band frame, see Orientation).
class Calibrator {
    float sx = 0, sy = 0, sz = 0;
    int n = 0, rejects = 0;
public:
    static const int SAMPLES = 100, MAX_REJECTS = 10;
    int samples = SAMPLES;
    bool checkPlane = true;
    float meanX = 0, meanY = 0, meanZ = 0;
    void reset() { sx = sy = sz = 0; n = rejects = 0; }
    int count() const { return n; }
    bool add(float x, float y, float z, float gx, float gy, float gz) {
        float m = sqrtf(x*x + y*y + z*z);
        bool ok = m > 0.85f && m < 1.15f && (!checkPlane || sqrtf(x*x + z*z) > 0.6f)
            && fabsf(gx) < 20 && fabsf(gy) < 20 && fabsf(gz) < 20
            && (!n || (fabsf(x - sx/n) < 0.08f && fabsf(y - sy/n) < 0.08f && fabsf(z - sz/n) < 0.08f));
        if (!ok) { if (++rejects > MAX_REJECTS) reset(); return false; }
        sx += x; sy += y; sz += z;
        if (++n < samples) return false;
        meanX = sx / n; meanY = sy / n; meanZ = sz / n;
        reset();
        return true;
    }
};

// How the IMU sits in the band. The detector expects the BAND frame: X across the wrist (+ = right tilt),
// Y along the forearm, Z out of the back of the wrist. The 3-step calibration (hold still, tilt left, tilt right)
// measures gravity in each pose and builds that frame from the raw board axes, so any mounting works
// (e.g. a board turned 90 deg in the strap, which otherwise reads a sideways tilt as a forearm dip).
struct Orientation {
    // Rows: band X, Y, Z expressed in board coordinates.
    float m[3][3] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};
    void apply(float& x, float& y, float& z) const {
        float a = m[0][0]*x + m[0][1]*y + m[0][2]*z, b = m[1][0]*x + m[1][1]*y + m[1][2]*z, c = m[2][0]*x + m[2][1]*y + m[2][2]*z;
        x = a; y = b; z = c;
    }
    bool identity() const {
        for (int i = 0; i < 3; ++i) for (int j = 0; j < 3; ++j) if (fabsf(m[i][j] - (i == j ? 1.0f : 0.0f)) > 1e-6f) return false;
        return true;
    }
    static float dot(const float* a, const float* b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
    static bool unit(float* v) { float n = sqrtf(dot(v, v)); if (n < 1e-3f) return false; v[0] /= n; v[1] /= n; v[2] /= n; return true; }
    // Degrees between two gravity readings.
    static float angle(const float* a, const float* b) {
        float c = dot(a, b) / (sqrtf(dot(a, a)) * sqrtf(dot(b, b)) + 1e-9f);
        return acosf(c > 1 ? 1 : c < -1 ? -1 : c) * 57.2957795f;
    }
    // g0 = neutral, gl = tilted left, gr = tilted right (board coordinates). False if the tilts were not
    // usable (too small, or not to opposite sides); the orientation is then left unchanged.
    bool fromTilts(const float* g0, const float* gl, const float* gr) {
        float z[3] = {g0[0], g0[1], g0[2]};
        if (!unit(z)) return false;
        float dl[3], dr[3], x[3];
        float pl = dot(gl, z), pr = dot(gr, z);
        for (int i = 0; i < 3; ++i) { dl[i] = gl[i] - pl * z[i]; dr[i] = gr[i] - pr * z[i]; }
        if (sqrtf(dot(dl, dl)) < 0.25f || sqrtf(dot(dr, dr)) < 0.25f || dot(dl, dr) >= 0) return false; // >= ~15 deg, opposite sides
        for (int i = 0; i < 3; ++i) x[i] = dr[i] - dl[i];            // gravity moves toward +X when tilting right
        float px = dot(x, z);
        for (int i = 0; i < 3; ++i) x[i] -= px * z[i];
        if (!unit(x)) return false;
        float y[3] = {z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0]};   // y = z cross x
        for (int i = 0; i < 3; ++i) { m[0][i] = x[i]; m[1][i] = y[i]; m[2][i] = z[i]; }
        return true;
    }
    // gu = gravity with the hand raised (forearm tipped up at the elbow), board coordinates. Points band +Y
    // toward the hand so "hand up" is positive pitch; the tilts alone cannot tell the forearm's direction.
    bool setForward(const float* gu) {
        float d[3] = {gu[0], gu[1], gu[2]};
        float pz = dot(d, m[2]), px = dot(d, m[0]);
        for (int i = 0; i < 3; ++i) d[i] -= pz * m[2][i] + px * m[0][i];
        if (sqrtf(dot(d, d)) < 0.25f) return false;                  // too small (< ~15 deg) or mostly a tilt
        if (dot(d, m[1]) < 0) for (int i = 0; i < 3; ++i) m[1][i] = -m[1][i];
        return true;
    }
};

class GestureDetector {
    float baseline = 0, filtered = 0, pitchBaseline = 0, filteredPitch = 0;
    bool initialized = false, armed = false, neutralTiming = false;
    uint32_t neutralAt = 0, lastEmission = 0, candidateAt = 0;
    uint32_t lastMotion = 0, shakeStart = 0, pulseAt = 0;
    uint32_t tapAt = 0, dipStart = 0, firstDipAt = 0, spikeAt = 0, lowAt = 0, highAt = 0;
    int quietRun = 0;
    bool spikeOpen = false, inSpike = false;
    int candidate = 0, shakeSign = 0, shakePulses = 0;
    int dipDir = 0, pairDir = 0, dips = 0;
    bool cooling = false, tapPending = false;

    static float angle(float x, float z) { return atan2f(x, z) * 57.2957795f; }
    static float wrap(float degrees) {
        while (degrees > 180) degrees -= 360;
        while (degrees < -180) degrees += 360;
        return degrees;
    }
    Gesture emit(Gesture result, uint32_t now) {
        armed = false; neutralTiming = false; cooling = true; lastEmission = now;
        candidate = 0; shakePulses = 0; shakeSign = 0; tapPending = false; dipDir = dips = 0;
        spikeOpen = false; lowAt = highAt = 0;
        return result;
    }
public:
    // Why the last double tap did not become YES (nullptr = accepted or none). For the USB log only.
    const char* tapNote = nullptr;
    // For the raw-data stream: bit0 armed, bit1 cooling, bit2 tap pending, bit3 tilt candidate, bit4 inside a dip.
    uint8_t stateBits() const {
        return (armed ? 1 : 0) | (cooling ? 2 : 0) | (tapPending ? 4 : 0) | (candidate ? 8 : 0) | (dipDir ? 16 : 0);
    }
    float rollDeg() const { return filtered; }
    float pitchDeg() const { return filteredPitch; }

    void calibrate(float x, float y, float z, uint32_t now) {
        baseline = angle(x, z); filtered = 0; initialized = true;
        pitchBaseline = pitchAngle(x, y, z); filteredPitch = 0;
        armed = false; neutralTiming = false; cooling = false; tapPending = false;
        candidate = 0; shakePulses = 0; shakeSign = 0; lastMotion = now; dipDir = dips = 0;
        spikeOpen = inSpike = false; quietRun = 0; lowAt = highAt = 0;
    }
    void disarm() {
        armed = false; neutralTiming = false; candidate = 0; shakePulses = 0; shakeSign = 0; tapPending = false;
        dipDir = dips = 0; spikeOpen = false; lowAt = highAt = 0;
    }

    // doubleTap: the IMU's hardware double-tap flag for this sample (latched, read once per sample).
    Gesture update(float x, float y, float z, float gx, float gy, float gz, uint32_t now, bool doubleTap = false) {
        tapNote = nullptr;
        if (!initialized) return Gesture::None;
        if (!isfinite(x) || !isfinite(y) || !isfinite(z) || !isfinite(gx) || !isfinite(gy) || !isfinite(gz)) {
            disarm(); return Gesture::None;
        }
        float magnitude = sqrtf(x*x + y*y + z*z);
        float speed = sqrtf(gx*gx + gy*gy + gz*gz);
        // With the forearm near vertical, atan2(x, z) is mostly noise: freeze roll there.
        bool level = sqrtf(x*x + z*z) >= MIN_PLANE_G;
        if (level) {
            float tilt = TILT_SIGN * wrap(angle(x, z) - baseline);
            filtered += 0.22f * wrap(tilt - filtered);
            filtered = wrap(filtered);
        }
        // Shocks (|a| far from 1 g) say nothing about the forearm angle and must not fake a HELP dip.
        if (magnitude > 0.5f && magnitude < 1.5f) filteredPitch += 0.22f * ((pitchAngle(x, y, z) - pitchBaseline) - filteredPitch);
        if (speed > 70 || magnitude < 0.8f || magnitude > 1.2f) lastMotion = now;
        // Software double tap: a spike after >= 100 ms of a still wrist opens a pair, a second spike 0.1-0.7 s later
        // closes it. Each spike counts once, however many samples it spans.
        bool spike = magnitude > TAP_SPIKE_G, newSpike = spike && !inSpike;
        inSpike = spike;
        if (spikeOpen && uint32_t(now - spikeAt) > TAP_GAP_MAX_MS) spikeOpen = false;
        if (newSpike) {
            uint32_t gap = uint32_t(now - spikeAt);
            if (spikeOpen && gap >= TAP_GAP_MIN_MS) { doubleTap = true; spikeOpen = false; }
            else if (!spikeOpen && quietRun >= 5) { spikeOpen = true; spikeAt = now; }
        }
        quietRun = speed < TAP_QUIET_DPS && !spike ? quietRun + 1 : 0;
        if (cooling && uint32_t(now - lastEmission) >= COOLDOWN_MS) cooling = false;
        if (!armed) {
            // v0.4.0 rule: only the left/right tilt has to be back near neutral (pitch is free).
            bool neutral = !cooling && fabsf(filtered) < TILT_EXIT_DEG && speed < 40 && magnitude > 0.85f && magnitude < 1.15f;
            if (neutral) {
                if (!neutralTiming) { neutralAt = now; neutralTiming = true; }
                if (uint32_t(now - neutralAt) >= NEUTRAL_MS) armed = true;
            } else neutralTiming = false;
            if (doubleTap) tapNote = cooling ? "cooldown after last gesture" : "not re-armed yet (tilt back to neutral)";
            return Gesture::None;
        }
        // NO (v0.4.0): three alternating fast rotations on Y within 900 ms.
        // Any rapid motion cancels a tilt candidate, so shaking cannot also emit FOOD/WATER.
        if (shakePulses && uint32_t(now - shakeStart) > SHAKE_WINDOW_MS) { shakePulses = 0; shakeSign = 0; }
        int sign = gy > SHAKE_DPS ? 1 : gy < -SHAKE_DPS ? -1 : 0;
        if (sign && sign != shakeSign && (!shakePulses || uint32_t(now - pulseAt) >= 80)) {
            if (!shakePulses) shakeStart = now;
            shakeSign = sign; pulseAt = now; ++shakePulses;
            if (shakePulses >= 3) return emit(Gesture::No, now);
        }
        // YES: hardware double tap with the wrist not tilted. Confirmed TAP_CONFIRM_MS later unless a shake is
        // under way (a NO emitted meanwhile clears it too).
        if (doubleTap && !tapPending) {
            if (fabsf(filtered) >= TILT_ENTER_DEG) tapNote = "wrist tilted";
            else { tapPending = true; tapAt = now; }
        }
        if (tapPending && uint32_t(now - tapAt) >= TAP_CONFIRM_MS) {
            tapPending = false;
            if (shakePulses < 2) return emit(Gesture::Yes, now);
            tapNote = "looked like a shake";
        }
        // HELP: two quick dips the same way, out past PITCH_ENTER_DEG and back under PITCH_EXIT_DEG, each within
        // DIP_MAX_MS, both within HELP_WINDOW_MS. A held pitch (hand to mouth, forearm on the lap) is not a dip.
        float roll = fabsf(filtered), pitch = fabsf(filteredPitch);
        if (HELP_SWEEP && pitch > PITCH_ENTER_DEG && pitch >= roll + AXIS_MARGIN_DEG) {
            if (filteredPitch < 0) lowAt = now; else highAt = now;
            if (lowAt && highAt && (lowAt > highAt ? lowAt - highAt : highAt - lowAt) <= HELP_WINDOW_MS) return emit(Gesture::Help, now);
        }
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
        // WATER / FOOD (v0.4.0), plus: not while a YES is pending or the forearm is vertical.
        if (tapPending || !level || uint32_t(now - lastMotion) < 150 || magnitude < 0.85f || magnitude > 1.15f) {
            candidate = 0; return Gesture::None;
        }
        int direction = filtered < -TILT_ENTER_DEG ? -1 : filtered > TILT_ENTER_DEG ? 1 : 0;
        if (!direction) { candidate = 0; return Gesture::None; }
        if (candidate != direction) { candidate = direction; candidateAt = now; }
        if (uint32_t(now - candidateAt) >= HOLD_MS) return emit(direction < 0 ? Gesture::Water : Gesture::Food, now);
        return Gesture::None;
    }
};
