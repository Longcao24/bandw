// Replays recordings through firmware/BandW_Sense/GestureDetector.h (the real firmware code) and scores it.
//   recordings (Live 3D guided sessions, band frame): per prompted gesture hit / wrong / miss, false events in NONE_daily
//   UMAHand traces (--uma DIR): false gestures per hour of everyday hand activity
// Build: c++ -std=c++11 -O2 -Ifirmware/BandW_Sense tinyml/replay.cpp -o /tmp/replay
// Run:   /tmp/replay tinyml/data/recordings/*.csv --uma tinyml/data/umahand/TRACES
#include "GestureDetector.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <dirent.h>
#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

static const char* NAME[] = {"-", "WATER", "FOOD", "NO", "YES", "HELP"};
struct Row { float ax, ay, az, gx, gy, gz, roll, pitch; int tap, event; std::string label, step; };

static std::vector<Row> readRecording(const char* path) {
    std::ifstream f(path); std::string line; std::vector<Row> out;
    std::getline(f, line); std::vector<std::string> h; { std::stringstream s(line); std::string x; while (std::getline(s, x, ',')) h.push_back(x); }
    auto col = [&](const char* n) { for (size_t i = 0; i < h.size(); ++i) if (h[i] == n) return (int)i; return -1; };
    int L = col("label"), S = col("step"), AX = col("ax_g"), AY = col("ay_g"), AZ = col("az_g"), GX = col("gx_dps"), GY = col("gy_dps"), GZ = col("gz_dps"),
        T = col("tap"), E = col("event"), R = col("roll_deg"), P = col("pitch_deg");
    while (std::getline(f, line)) {
        std::vector<std::string> v; std::stringstream s(line); std::string x; while (std::getline(s, x, ',')) v.push_back(x);
        if ((int)v.size() < (int)h.size()) continue;
        Row r; r.label = v[L]; r.step = S >= 0 ? v[S] : "";
        r.ax = atof(v[AX].c_str()); r.ay = atof(v[AY].c_str()); r.az = atof(v[AZ].c_str());
        r.gx = atof(v[GX].c_str()); r.gy = atof(v[GY].c_str()); r.gz = atof(v[GZ].c_str());
        r.tap = atoi(v[T].c_str()); r.event = atoi(v[E].c_str()); r.roll = atof(v[R].c_str()); r.pitch = atof(v[P].c_str());
        out.push_back(r);
    }
    return out;
}

// The band's calibration baseline, recovered from rest samples: logged (filtered, relative) angle vs raw angle.
static void baseline(const std::vector<Row>& rows, float* g) {
    double br = 0, bp = 0; int n = 0;
    for (const Row& r : rows) if (r.label == "NONE_rest" || r.label == "rest") {
        float m = sqrtf(r.ax*r.ax + r.ay*r.ay + r.az*r.az);
        br += atan2f(r.ax, r.az) * 57.2957795f - r.roll; bp += asinf(r.ay / m) * 57.2957795f - r.pitch; ++n;
    }
    if (n) { br /= n; bp /= n; }
    float rr = br / 57.2957795f, pp = bp / 57.2957795f;
    g[0] = sinf(rr) * cosf(pp); g[1] = sinf(pp); g[2] = cosf(rr) * cosf(pp);
}

int main(int argc, char** argv) {
    const char* uma = nullptr; std::vector<const char*> recs;
    for (int i = 1; i < argc; ++i) { if (!strcmp(argv[i], "--uma") && i + 1 < argc) uma = argv[++i]; else recs.push_back(argv[i]); }
    std::map<std::string, std::map<std::string, int>> score;   // gesture -> hit/wrong/miss
    int dailyFalse = 0; double dailySecs = 0; int agree = 0, compared = 0;
    for (const char* path : recs) {
        std::vector<Row> rows = readRecording(path);
        float g[3]; baseline(rows, g);
        GestureDetector d; uint32_t t = 0; d.calibrate(g[0], g[1], g[2], t);
        std::vector<int> ev(rows.size(), 0);
        for (size_t i = 0; i < rows.size(); ++i) {
            const Row& r = rows[i];
            ev[i] = (int)d.update(r.ax, r.ay, r.az, r.gx, r.gy, r.gz, t += 20, r.tap != 0);
        }
        for (size_t i = 0; i < rows.size(); ++i) if (rows[i].event) { ++compared; for (size_t j = i > 10 ? i - 10 : 0; j < i + 10 && j < rows.size(); ++j) if (ev[j] == rows[i].event) { ++agree; break; } }
        // prompts
        size_t i = 0;
        while (i < rows.size()) {
            size_t j = i; while (j < rows.size() && rows[j].label == rows[i].label && rows[j].step == rows[i].step) ++j;
            const std::string& lab = rows[i].label;
            if (lab == "WATER" || lab == "FOOD" || lab == "NO" || lab == "YES" || lab == "HELP") {
                bool hit = false, other = false;
                for (size_t k = i; k < j + 50 && k < rows.size(); ++k) if (ev[k]) { if (lab == NAME[ev[k]]) hit = true; else other = true; }
                score[lab][hit ? "hit" : other ? "wrong" : "miss"]++;
            }
            if (lab == "NONE_daily") { dailySecs += (j - i) / 50.0; for (size_t k = i; k < j; ++k) if (ev[k]) ++dailyFalse; }
            i = j;
        }
    }
    if (!recs.empty()) {
        printf("recordings (%zu file(s)); replay agrees with the band's own events: %d/%d\n", recs.size(), agree, compared);
        for (const char* gname : {"WATER", "FOOD", "NO", "YES", "HELP"}) {
            auto& s = score[gname]; int n = s["hit"] + s["wrong"] + s["miss"];
            printf("  %-5s hit %2d/%-2d  wrong %d  miss %d\n", gname, s["hit"], n, s["wrong"], s["miss"]);
        }
        printf("  false gestures during 'everyday activity': %d in %.0f s\n", dailyFalse, dailySecs);
    }
    if (uma) {
        int cnt[6] = {0}; double secs = 0;
        for (int u = 1; u <= 25; ++u) {
            char dir[1024]; snprintf(dir, sizeof dir, "%s/output_%d", uma, u);
            DIR* D = opendir(dir); if (!D) continue;
            while (dirent* e = readdir(D)) {
                if (!strstr(e->d_name, ".csv")) continue;
                char p[2048]; snprintf(p, sizeof p, "%s/%s", dir, e->d_name);
                FILE* f = fopen(p, "r"); if (!f) continue;
                GestureDetector d; uint32_t t = 0; d.calibrate(0, 0, 1, t);
                for (int k = 0; k < 50; ++k) d.update(0, 0, 1, 0, 0, 0, t += 20);
                char line[512]; int n = 0; double last = 0;
                while (fgets(line, sizeof line, f)) {
                    double v[7]; char* q = line; for (int k = 0; k < 7; ++k) { v[k] = strtod(q, &q); if (*q == ',') ++q; }
                    last = v[0];
                    if (n++ % 2) continue;   // 100 -> 50 Hz
                    int g = (int)d.update(v[1], v[2], v[3], v[4], v[5], v[6], t += 20);
                    if (g) cnt[g]++;
                }
                secs += last / 1000; fclose(f);
            }
            closedir(D);
        }
        double h = secs / 3600; int tot = 0; for (int k = 1; k < 6; ++k) tot += cnt[k];
        printf("UMAHand %.2f h: %.0f false gestures/h  (WATER %d, FOOD %d, NO %d, YES %d, HELP %d)\n", h, tot / h, cnt[1], cnt[2], cnt[3], cnt[4], cnt[5]);
    }
}
