#include "../BandW_Sense/GestureDetector.h"
#include <assert.h>
#include <stdio.h>
#include <vector>

struct Rig {
    GestureDetector detector;
    uint32_t now;
    std::vector<Gesture> events;
    explicit Rig(uint32_t start = 0) : now(start) { detector.calibrate(0, 0, 1, now); }
    // roll = left/right tilt about Y, pitch = forearm tipping about the elbow (+pitch = +ay; HELP accepts
    // either sign, so the physical direction of +Y on the board does not matter), tap = double-tap flag.
    void sample(float tilt = 0, float gy = 0, float magnitude = 1, float pitch = 0, bool tap = false) {
        float r = tilt / 57.2957795f, p = pitch / 57.2957795f;
        Gesture result = detector.update(cosf(p)*sinf(r)*magnitude, sinf(p)*magnitude, cosf(p)*cosf(r)*magnitude,
                                         0, gy, 0, now, tap);
        if (result != Gesture::None) events.push_back(result);
        now += 20;
    }
    void hold(float tilt, int ms) { for (int t=0; t<ms; t+=20) sample(tilt); }
    void holdPitch(float pitch, int ms) { holdRP(0, pitch, ms); }
    void holdRP(float tilt, float pitch, int ms) { for (int t=0; t<ms; t+=20) sample(tilt, 0, 1, pitch); }
    void tap() { sample(0, 0, 1, 0, true); }
    // One quick dip: pitch out to `pitch` for `ms`, then back to neutral for `gap` ms.
    void dip(float pitch, int ms = 300, int gap = 300) { holdPitch(pitch, ms); holdPitch(0, gap); }
    void helpDips(float pitch = 40) { dip(pitch); dip(pitch); }
    // Natural posture change: ramp the pitch at `dps` then hold it.
    void rampPitch(float to, float dps, int holdMs) {
        float p = 0, step = dps * 0.02f * (to < 0 ? -1 : 1);
        while (fabsf(p) < fabsf(to)) { p += step; if (fabsf(p) > fabsf(to)) p = to; sample(0, 0, 1, p); }
        holdPitch(to, holdMs);
    }
    void neutral() { hold(0, 2200); }
};
static bool only(const Rig& r, Gesture g) { return r.events.size()==1 && r.events[0]==g; }
static void shake(Rig& r, int tapPhase = -1) {
    for (int phase=0; phase<3; ++phase)
        for (int i=0; i<5; ++i) r.sample(0, phase%2 ? -220 : 220, 1, 0, phase==tapPhase && i==0);
}
int main() {
    Rig r; r.neutral();
    r.hold(-45, 1600); assert(r.events.size()==1 && r.events[0]==Gesture::Water);
    r.hold(-45, 3000); assert(r.events.size()==1); // Held posture never repeats.
    r.hold(45, 1800); assert(r.events.size()==1); // Must return to neutral first.
    r.neutral(); r.hold(45, 1600); assert(r.events.size()==2 && r.events[1]==Gesture::Food);
    r.neutral();
    for (int i=0; i<5; ++i) r.sample(0, 220);
    for (int i=0; i<5; ++i) r.sample(0, -220);
    for (int i=0; i<5; ++i) r.sample(0, 220);
    assert(r.events.size()==3 && r.events[2]==Gesture::No);
    r.hold(45, 2000); assert(r.events.size()==3); // Shake cannot also trigger a tilt.
    Rig brief; brief.neutral(); brief.hold(-45, 200); brief.neutral(); assert(brief.events.empty());
    Rig single; single.neutral();
    for(int i=0;i<15;++i) single.sample(0,200);
    single.neutral(); assert(single.events.empty()); // One fast rotation isn't a shake.
    Rig slow; slow.neutral(); slow.sample(0,220); slow.hold(0,1000); slow.sample(0,-220);
    slow.hold(0,1000); slow.sample(0,220); assert(slow.events.empty());
    Rig unstable; unstable.neutral();
    for(int i=0;i<100;++i) unstable.sample(45,0,1.7f);
    assert(unstable.events.empty());
    Rig invalid; invalid.neutral();
    assert(invalid.detector.update(NAN,0,1,0,0,0,invalid.now)==Gesture::None);
    invalid.hold(45,1800); assert(invalid.events.empty());
    Rig overflow(UINT32_MAX-1000); overflow.neutral(); overflow.hold(45,1600);
    assert(overflow.events.size()==1 && overflow.events[0]==Gesture::Food);
    Rig reconnect; reconnect.neutral(); reconnect.detector.disarm(); reconnect.hold(-45,1800);
    assert(reconnect.events.empty()); reconnect.neutral(); reconnect.hold(-45,1500);
    assert(reconnect.events.size()==1);
    Rig upright; upright.detector.calibrate(-1,0,0,upright.now);
    upright.hold(-90,1000); upright.hold(-115,600);
    assert(upright.events.size()==1 && upright.events[0]==Gesture::Water);
    Rig gentle; gentle.neutral(); gentle.hold(-25,600);
    assert(gentle.events.size()==1 && gentle.events[0]==Gesture::Water);
    gentle.neutral(); gentle.hold(25,600);
    assert(gentle.events.size()==2 && gentle.events[1]==Gesture::Food);
    Rig resting; resting.neutral();
    for(int i=0;i<300;++i) resting.sample(i%2 ? 10 : -10, i%2 ? 70 : -70);
    assert(resting.events.empty());
    Rig softShake; softShake.neutral();
    for(int phase=0;phase<3;++phase)
        for(int i=0;i<5;++i) softShake.sample(0,phase%2 ? -110 : 110);
    assert(only(softShake, Gesture::No));
    softShake.hold(25,1000); assert(softShake.events.size()==1);
    softShake.hold(0,500); softShake.hold(25,600);
    assert(softShake.events.size()==2 && softShake.events[1]==Gesture::Food);

    // Forearm near vertical (gravity on Y): atan2(x, z) is noise and must never emit.
    Rig vertical; vertical.neutral();
    unsigned seed = 12345;
    for (int i=0;i<250;++i) {
        seed = seed*1103515245u + 12345u; float nx = (int((seed>>16)%61) - 30) / 1000.0f;
        seed = seed*1103515245u + 12345u; float nz = (int((seed>>16)%61) - 30) / 1000.0f;
        if (vertical.detector.update(0.02f+nx, 0.998f, 0.03f+nz, 0, 0, 0, vertical.now) != Gesture::None) vertical.events.push_back(Gesture::None);
        vertical.now += 20;
    }
    assert(vertical.events.empty());
    // Single gyro spikes (one sample each) are not shake pulses.
    Rig spikes; spikes.neutral();
    for (int i=0;i<6;++i) { spikes.sample(0, i%2 ? -250 : 250); spikes.hold(0, 60); }
    assert(spikes.events.empty());

    // HELP: two quick forearm dips the same way, in either direction.
    Rig help; help.neutral(); help.helpDips(); assert(only(help, Gesture::Help));
    help.helpDips(); help.holdPitch(40, 3000); assert(help.events.size()==1); // must return to neutral first
    Rig helpUp; helpUp.neutral(); helpUp.helpDips(-40); assert(only(helpUp, Gesture::Help));
    Rig gentleHelp; gentleHelp.neutral(); gentleHelp.helpDips(30); assert(only(gentleHelp, Gesture::Help));
    Rig oneDip; oneDip.neutral(); oneDip.dip(40); oneDip.neutral(); assert(oneDip.events.empty());
    Rig swing; swing.neutral(); swing.dip(40); swing.dip(-40); swing.neutral(); assert(swing.events.empty()); // through neutral
    Rig slowDips; slowDips.neutral(); slowDips.dip(40, 1000); slowDips.dip(40, 1000); slowDips.neutral();
    assert(slowDips.events.empty());
    Rig farDips; farDips.neutral(); farDips.dip(40, 300, 1800); farDips.dip(40); farDips.neutral(); assert(farDips.events.empty());
    Rig diagonal; diagonal.neutral(); diagonal.holdRP(30, 30, 300); diagonal.neutral(); diagonal.holdRP(30, 30, 300);
    diagonal.neutral(); assert(diagonal.events.empty());
    Rig rollDominant; rollDominant.neutral(); rollDominant.holdRP(-40, 15, 1600); assert(only(rollDominant, Gesture::Water));
    Rig pitchDominant; pitchDominant.neutral(); for (int i=0;i<2;++i) { pitchDominant.holdRP(10, 40, 300); pitchDominant.holdRP(0, 0, 300); }
    assert(only(pitchDominant, Gesture::Help));
    Rig helpRearm; helpRearm.neutral(); helpRearm.helpDips(); helpRearm.hold(-45, 1800);
    assert(only(helpRearm, Gesture::Help)); helpRearm.neutral(); helpRearm.hold(-45, 1600);
    assert(helpRearm.events.size()==2 && helpRearm.events[1]==Gesture::Water);
    Rig pitchedRest; pitchedRest.holdPitch(20, 2200); pitchedRest.holdRP(-45, 20, 1600); assert(pitchedRest.events.empty());
    // Everyday postures held at 25-66 deg (and past the vertical cutoff) never call for help, either way.
    const float postures[] = {30, 40, 50, 60, 85, -30, -40, -50, -60, -85};
    for (float p : postures) {
        Rig lap; lap.neutral(); lap.rampPitch(p, 100, 3000); assert(lap.events.empty());   // forearm onto the lap / raised
        Rig sip; sip.neutral(); sip.rampPitch(p, 100, 1000); sip.rampPitch(0, 100, 600);     // sip from a cup, twice
        sip.rampPitch(p, 100, 1000); sip.rampPitch(0, 100, 600); assert(sip.events.empty());
    }
    // A pitched neutral (calibrated with the forearm at 45 deg) still reaches HELP.
    Rig pitchedCal; pitchedCal.detector.calibrate(0, 0.7071f, 0.7071f, pitchedCal.now);
    for (int i=0;i<110;++i) pitchedCal.sample(0, 0, 1, 45);
    for (int k=0;k<2;++k) { pitchedCal.holdPitch(75, 300); pitchedCal.holdPitch(45, 300); }
    assert(only(pitchedCal, Gesture::Help));
    Rig pitchedCal2; pitchedCal2.detector.calibrate(0, 0.7071f, 0.7071f, pitchedCal2.now);
    for (int i=0;i<110;++i) pitchedCal2.sample(0, 0, 1, 45);
    for (int k=0;k<2;++k) { pitchedCal2.holdPitch(15, 300); pitchedCal2.holdPitch(45, 300); }
    assert(only(pitchedCal2, Gesture::Help));

    // YES: hardware double tap, confirmed from neutral.
    Rig yes; yes.neutral(); yes.tap(); yes.hold(0, 300); assert(only(yes, Gesture::Yes));
    Rig yesUnarmed; yesUnarmed.tap(); yesUnarmed.hold(0, 300); assert(yesUnarmed.events.empty());
    Rig yesTilted; yesTilted.neutral(); yesTilted.hold(18, 600); yesTilted.sample(18, 0, 1, 0, true);
    yesTilted.hold(18, 300); assert(yesTilted.events.empty());
    Rig yesShake; yesShake.neutral(); shake(yesShake, 1); yesShake.hold(0, 500); assert(only(yesShake, Gesture::No));
    Rig tapRotate; tapRotate.neutral(); tapRotate.tap(); for (int i=0;i<3;++i) tapRotate.sample(0, 150);
    tapRotate.hold(0, 300); assert(tapRotate.events.empty());
    Rig rotateTap; rotateTap.neutral(); rotateTap.sample(0,150); rotateTap.sample(0,150); rotateTap.hold(0,100);
    rotateTap.tap(); rotateTap.hold(0, 300); assert(rotateTap.events.empty());
    rotateTap.sample(0,150); rotateTap.sample(0,150); rotateTap.hold(0,400);
    rotateTap.tap(); rotateTap.hold(0, 300); assert(only(rotateTap, Gesture::Yes));
    Rig yesCooldown; yesCooldown.neutral(); yesCooldown.tap(); yesCooldown.hold(0, 180); yesCooldown.tap();
    yesCooldown.hold(0, 1000); assert(only(yesCooldown, Gesture::Yes));
    yesCooldown.tap(); yesCooldown.hold(0, 300); assert(yesCooldown.events.size()==2 && yesCooldown.events[1]==Gesture::Yes);
    Rig tapSpike; tapSpike.neutral(); tapSpike.tap(); tapSpike.sample(0,0,2.5f); tapSpike.sample(0,0,2.5f);
    tapSpike.hold(0, 1500); assert(only(tapSpike, Gesture::Yes));
    Rig tapInvalid; tapInvalid.neutral(); tapInvalid.tap();
    tapInvalid.detector.update(NAN,0,1,0,0,0,tapInvalid.now); tapInvalid.hold(0, 300); assert(tapInvalid.events.empty());
    Rig tapDisarm; tapDisarm.neutral(); tapDisarm.tap(); tapDisarm.detector.disarm(); tapDisarm.hold(0, 300);
    assert(tapDisarm.events.empty());
    // A one-sample gyro jolt from the tap itself (or from the first tap of the pair) does not veto YES.
    Rig tapJolt; tapJolt.neutral(); tapJolt.sample(0, 109, 1, 0, true); tapJolt.hold(0, 300); assert(only(tapJolt, Gesture::Yes));
    Rig firstJolt; firstJolt.neutral(); firstJolt.sample(0, 113); firstJolt.hold(0, 220); firstJolt.tap(); firstJolt.hold(0, 300);
    assert(only(firstJolt, Gesture::Yes));
    // Lowering the arm onto a table (sustained motion right before the impact) is not YES.
    Rig setDown; setDown.neutral(); for (int i=0;i<10;++i) setDown.sample(0, 60); setDown.tap(); setDown.hold(0, 300);
    assert(setDown.events.empty());
    Rig overflow2(UINT32_MAX-1000); overflow2.neutral(); overflow2.tap(); overflow2.hold(0, 300);
    overflow2.neutral(); overflow2.helpDips();
    assert(overflow2.events.size()==2 && overflow2.events[0]==Gesture::Yes && overflow2.events[1]==Gesture::Help);

    // Calibrator: tolerant of a few jittery samples, rejects a pose it cannot use.
    Calibrator cal; int n = 0;
    for (int i=0;i<200 && !cal.add(0.1f, 0.2f, 0.97f, 2, -3, 1); ++i) ++n;
    assert(n==99 && fabsf(cal.meanY-0.2f) < 1e-4f);
    Calibrator jitter; bool done = false; n = 0;
    while (!done && n < 400) { ++n; done = jitter.add(n%20 ? 0.0f : 0.2f, 0, n%33 ? 1.0f : 0.9f, n%45 ? 0 : 40, 0, 0); }
    assert(done && n < 120 && fabsf(jitter.meanX) < 0.01f);
    Calibrator upY; done = false;
    for (int i=0;i<400 && !done;++i) done = upY.add(0.05f, 0.99f, 0.05f, 0, 0, 0);
    assert(!done);
    Calibrator moving; done = false;
    for (int i=0;i<400 && !done;++i) done = moving.add(sinf(i*0.3f)*0.5f, 0, 0.85f, 0, 60, 0);
    assert(!done);
    puts("PASS: left/right, hold, neutral rearm, shake priority, transient/slow/noisy motion, invalid input, reconnect, "
         "timer rollover, vertical forearm, HELP (two forearm dips, postures rejected), YES (double tap), calibrator");
}
