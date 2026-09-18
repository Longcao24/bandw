#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
arduino-cli compile --fqbn Seeeduino:mbed:xiaonRF52840SensePlus \
  --build-property 'compiler.cpp.extra_flags=-DTARGET_SEEED_XIAO_NRF52840_SENSE_PLUS' \
  --output-dir "$repo_dir/.tooling/firmware-plus-build" "$repo_dir/firmware/BandW_Sense"
if [[ $# -gt 0 ]]; then
  arduino-cli upload -p "$1" --fqbn Seeeduino:mbed:xiaonRF52840SensePlus \
    --input-dir "$repo_dir/.tooling/firmware-plus-build" "$repo_dir/firmware/BandW_Sense"
fi
