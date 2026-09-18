#include "../BandW_Sense/GestureDetector.h"
#include <assert.h>
#include <stdio.h>
#include <vector>

struct Rig {
    GestureDetector detector;
    uint32_t now;
    std::vector<Gesture> events;
    explicit Rig(uint32_t start = 0) : now(start) { detector.calibrate(0, 1, now); }
    void sample(float tilt = 0, float gy = 0, float magnitude = 1) {
        float radians = tilt / 57.2957795f;
        Gesture result = detector.update(sinf(radians)*magnitude, 0, cosf(radians)*magnitude, 0, gy, 0, now);
        if (result != Gesture::None) events.push_back(result);
        now += 20;
    }
    void hold(float tilt, int ms) { for (int t=0; t<ms; t+=20) sample(tilt); }
    void neutral() { hold(0, 2200); }
};
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
    puts("PASS: left/right, hold, neutral rearm, shake priority, transient/slow/noisy motion, invalid input, reconnect, timer rollover");
}
