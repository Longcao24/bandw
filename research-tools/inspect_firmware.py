"""Inspect the real BandW release binaries; no sensor data is simulated."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1] / 'web' / 'firmware'
print('\nBANDW / FIRMWARE ANALYSIS')
print('Source: actual release binaries on disk\n')
for name in ('manifest-sense.json', 'manifest.json'):
    manifest = json.loads((root / name).read_text())
    info = manifest['firmware']
    data = (root / info['file']).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    print(manifest['fqbn'])
    print(f'  Binary: {info["file"]}')
    print(f'  Size:   {len(data):,} bytes / {len(data)/1024:.2f} KiB')
    print(f'  SHA256: {digest}')
    print(f'  Manifest integrity: {"PASS" if digest == info["sha256"] else "FAIL"}\n')
    assert digest == info['sha256']
print('Both firmware files match their published SHA-256 hashes.')
print('This check verifies files, not gesture accuracy or physical flashing.')
