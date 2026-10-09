// Convencions de coordenades compartides entre el generador de panoràmiques i el visor.
// Un píxel de la panoràmica a la columna u (0..1) i fila v (0 = dalt) correspon a la direcció
//   (cos(2πu)·sin(πv), cos(πv), sin(2πu)·sin(πv))
// Per tant, yaw = 2πu i pitch = π/2 − πv.

export const DEG = Math.PI / 180;

export function viewToVector(yawDeg: number, pitchDeg: number): [number, number, number] {
  const y = yawDeg * DEG;
  const p = pitchDeg * DEG;
  return [Math.cos(p) * Math.cos(y), Math.sin(p), Math.cos(p) * Math.sin(y)];
}

export function vectorToView(x: number, y: number, z: number): { yaw: number; pitch: number } {
  const len = Math.hypot(x, y, z) || 1;
  return { yaw: Math.atan2(z, x) / DEG, pitch: Math.asin(y / len) / DEG };
}

/** Normalitza un angle a l'interval (-180, 180] */
export function wrapDeg(a: number): number {
  let r = ((((a + 180) % 360) + 360) % 360) - 180;
  if (r === -180) r = 180;
  return r;
}

/** Distància angular més curta entre dos yaws (amb signe) */
export function shortestDelta(from: number, to: number): number {
  return wrapDeg(to - from);
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
