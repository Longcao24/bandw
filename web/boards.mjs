// USB IDs from Seeeduino:mbed 2.9.3 boards.txt. The standard Sense shares
// IDs with the non-Sense model; users must confirm the physical Sense variant.
export const BOARDS = {
  sense: {
    label: 'XIAO nRF52840 Sense (thường)',
    fqbn: 'Seeeduino:mbed:xiaonRF52840Sense',
    manifest: 'manifest-sense.json', stem: 'bandw-sense',
    bootPids: [0x0045, 0x0145], appPids: [0x8045]
  },
  plus: {
    label: 'XIAO nRF52840 Sense Plus',
    fqbn: 'Seeeduino:mbed:xiaonRF52840SensePlus',
    manifest: 'manifest.json', stem: 'bandw-sense-plus',
    bootPids: [0x0065, 0x0165], appPids: [0x8064, 0x8065, 0x0064, 0x0164]
  }
};
export function portIds(board, bootOnly = false) {
  return bootOnly ? board.bootPids : [...board.bootPids, ...board.appPids];
}
export function matchesManifest(board, manifest) {
  return manifest.applicationOnly === true && manifest.fqbn === board.fqbn
    && manifest.firmware?.file === `${board.stem}.bin` && manifest.init?.file === `${board.stem}.dat`;
}
