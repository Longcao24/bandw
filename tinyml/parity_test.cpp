// Checks that firmware/BandW_Sense/TinyGesture.h emits exactly the gestures the Python pipeline emits.
// Build/run (after bandw_tinyml.py wrote tinyml/out/bandw_model.h and parity.json):
//   c++ -std=c++11 -O2 -Itinyml/out -Ifirmware/BandW_Sense tinyml/parity_test.cpp -o /tmp/parity && /tmp/parity tinyml/out/parity.json
#include "TinyGesture.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

// Minimal reader for parity.json: [{"file": "...", "cal": [x, y, z], "events": [[k, e], ...]}, ...]
static std::string slurp(const char* p) { std::ifstream f(p); std::stringstream s; s << f.rdbuf(); return s.str(); }

int main(int argc, char** argv) {
    if (argc < 2) { fprintf(stderr, "usage: parity parity.json\n"); return 2; }
    std::string js = slurp(argv[1]);
    size_t pos = 0; int files = 0, bad = 0, total = 0;
    while ((pos = js.find("\"file\": \"", pos)) != std::string::npos) {
        pos += 9; size_t end = js.find('"', pos); std::string file = js.substr(pos, end - pos);
        size_t c = js.find("\"cal\": [", end) + 8; float cal[3]; char* q = (char*)js.c_str() + c;
        for (int i = 0; i < 3; ++i) { cal[i] = strtof(q, &q); while (*q == ',' || *q == ' ') ++q; }
        size_t e = js.find("\"events\": [", c) + 11; std::vector<std::pair<int, int>> want;
        q = (char*)js.c_str() + e;
        while (*q == '[' || *q == ' ' || *q == ',') {
            if (*q == '[') { ++q; int k = strtol(q, &q, 10); while (*q == ',' || *q == ' ') ++q; int at = strtol(q, &q, 10); want.push_back({k, at}); ++q; }
            else ++q;
            if (*q == ']') break;
        }
        pos = e;
        // replay the CSV through the C++ classifier
        std::ifstream f(file); std::string line; std::getline(f, line);
        std::vector<std::string> cols; { std::stringstream h(line); std::string x; while (std::getline(h, x, ',')) cols.push_back(x); }
        auto col = [&](const char* n) { for (size_t i = 0; i < cols.size(); ++i) if (cols[i] == n) return (int)i; return -1; };
        int iax = col("ax_g"), iay = col("ay_g"), iaz = col("az_g"), igx = col("gx_dps"), igy = col("gy_dps");
        TinyGesture tg; tg.calibrate(cal[0], cal[1], cal[2]);
        std::vector<std::pair<int, int>> got; int n = 0;
        while (std::getline(f, line)) {
            std::vector<std::string> v; std::stringstream s(line); std::string x; while (std::getline(s, x, ',')) v.push_back(x);
            ++n;
            int k = tg.update(strtof(v[iax].c_str(), 0), strtof(v[iay].c_str(), 0), strtof(v[iaz].c_str(), 0), strtof(v[igx].c_str(), 0), strtof(v[igy].c_str(), 0));
            if (k) got.push_back({k, n});
        }
        ++files; total += want.size();
        if (got != want) {
            ++bad; printf("MISMATCH %s: python %zu events, C++ %zu events\n", file.c_str(), want.size(), got.size());
            for (size_t i = 0; i < want.size() || i < got.size(); ++i)
                if (i >= want.size() || i >= got.size() || want[i] != got[i]) {
                    printf("  first difference at #%zu: python %d@%d, C++ %d@%d\n", i, i < want.size() ? want[i].first : -1, i < want.size() ? want[i].second : -1,
                           i < got.size() ? got[i].first : -1, i < got.size() ? got[i].second : -1); break; }
        }
    }
    printf("%s: %d file(s), %d gesture event(s) compared, %d mismatching file(s)\n", bad ? "FAIL" : "PASS", files, total, bad);
    return bad ? 1 : 0;
}
