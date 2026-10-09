// Exporta la geometria de la visita (estances, portes i punts de navegació en yaw/pitch)
// a src/data/demoTourLayout.json. Els angles es calculen des del punt exacte on s'ha
// renderitzat cada panoràmica, de manera que els punts coincideixen amb les portes reals.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOMS, LINKS } from './apartment.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const deg = (r) => Math.round(((r * 180) / Math.PI) * 10) / 10;
const dir = (from, to) => {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(...d);
  return { yaw: deg(Math.atan2(d[2], d[0])), pitch: deg(Math.asin(d[1] / len)) };
};
const LOOK = { sala: [3.0, 1.2, -1], cuina: [8.6, 1.0, 3.2], dormitori: [2.0, 0.8, 7.8], dormitori2: [6.5, 0.8, 7.4] };

const layout = {
  units: 'm',
  bounds: { x: 0, z: 0, w: 10, h: 8.4 },
  terrace: { x: 0, z: -3.3, w: 10, h: 3.3 },
  rooms: Object.fromEntries(
    Object.entries(ROOMS).map(([id, r]) => [id, { name: r.name, rect: r.rect, viewpoint: [r.cam[0], r.cam[2]], initialView: { ...dir(r.cam, LOOK[id]), pitch: -4 } }])
  ),
  extraRooms: [{ name: 'Bany', rect: [4.2, 4.6, 5.6, 8.4] }],
  doors: [
    { x: 3.0, z: 4.6, w: 0.9, axis: 'x' },
    { x: 4.5, z: 4.6, w: 0.8, axis: 'x' },
    { x: 5.75, z: 4.6, w: 0.8, axis: 'x' },
  ],
  openings: [{ x: 6.6, z: 0.55, w: 3.4, axis: 'z' }],
  windows: [
    { x: 0.8, z: 0, w: 4.8, axis: 'x' },
    { x: 7.2, z: 0, w: 2.2, axis: 'x' },
    { x: 0, z: 1.2, w: 2.2, axis: 'z' },
    { x: 0, z: 5.7, w: 1.8, axis: 'z' },
    { x: 10, z: 1.35, w: 1.65, axis: 'z' },
    { x: 10, z: 5.8, w: 1.8, axis: 'z' },
  ],
  links: LINKS.map((l) => ({ from: l.from, to: l.to, label: l.label, ...dir(ROOMS[l.from].cam, l.target) })),
};
const out = path.join(root, 'src/data/demoTourLayout.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(layout, null, 2) + '\n');
console.log('Escrit', path.relative(root, out));
