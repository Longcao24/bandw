// Sim registry (spec §5.2). Lazy loaders: id → () => import('./<id>.js').
// Shared boundary between the scaffold (sim-host, validator) and the sim modules.
export const SIM_IDS = [
  'system-flow', 'imu-axes-3d', 'tilt-angle', 'gyro-speed', 'calibration',
  'threshold-hysteresis', 'hold-timer', 'gesture-state-machine', 'shake-counter',
  'double-tap', 'forward-flex', 'main-loop', 'code-stepper', 'ble-flow',
  'tts-pipeline', 'confusion-matrix', 'imu-chart', 'gesture-gallery',
];

export const SIM_LOADERS = Object.fromEntries(SIM_IDS.map((id) => [id, () => import(`./${id}.js`)]));

export const isSimId = (id) => SIM_IDS.includes(id);

export async function loadSim(id) {
  const loader = SIM_LOADERS[id];
  if (!loader) throw new Error(`Unknown sim: ${id}`);
  return loader();
}
