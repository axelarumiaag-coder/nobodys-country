// Escenes exteriors i bany: casa mediterrània, façana del Born, bloc d'obra nova, masia i bany.
import * as THREE from 'three';
import {
  box,
  cyl,
  sphere,
  mat,
  rng,
  glass,
  wall,
  windowFrame,
  landscape,
  plasterTexture,
  stoneTexture,
  tileTexture,
  woodTexture,
  fabricTexture,
  travertineTexture,
} from './lib.js';

function cypress(parent, x, z, h = 7, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const m = mat('#3f4a30', { rough: 0.95 });
  for (let i = 0; i < 5; i++) sphere(0.75 - i * 0.1, m, { x: (r() - 0.5) * 0.2, y: h * (0.25 + i * 0.15), z: (r() - 0.5) * 0.2, sy: h * 0.13, parent: g, seg: 14 });
  g.position.set(x, 0, z);
  parent.add(g);
}

function olive(parent, x, z, s = 1, seed = 2) {
  const r = rng(seed);
  const g = new THREE.Group();
  const trunk = mat('#6b5a48', { rough: 1 });
  const leaf = mat('#8a9470', { rough: 0.95 });
  const leaf2 = mat('#76825e', { rough: 0.95 });
  const t = cyl(0.12 * s, 0.22 * s, 1.8 * s, trunk, { y: 0.9 * s, parent: g, seg: 10 });
  t.rotation.z = 0.12;
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const rad = r() * 1.3 * s;
    sphere((0.6 + r() * 0.5) * s, r() > 0.5 ? leaf : leaf2, { x: Math.cos(a) * rad, y: (2.1 + r() * 0.9) * s, z: Math.sin(a) * rad, sy: 0.6, parent: g, seg: 12 });
  }
  g.position.set(x, 0, z);
  parent.add(g);
}

function planeTree(parent, x, z, seed = 3) {
  const r = rng(seed);
  const g = new THREE.Group();
  cyl(0.18, 0.28, 4.5, mat('#9c907a', { rough: 1 }), { y: 2.25, parent: g, seg: 12 });
  const leaf = mat('#7d8b4f', { rough: 0.95 });
  const leaf2 = mat('#93a05e', { rough: 0.95 });
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const rad = r() * 2;
    sphere(1.2 + r() * 0.8, r() > 0.5 ? leaf : leaf2, { x: Math.cos(a) * rad, y: 5.2 + r() * 2, z: Math.sin(a) * rad, sy: 0.75, parent: g, seg: 12 });
  }
  g.position.set(x, 0, z);
  parent.add(g);
}

function lounger(parent, x, z, ry, color) {
  const g = new THREE.Group();
  const w = mat('#a3815e', { rough: 0.6, map: woodTexture('#a3815e', [1, 1], 91) });
  box(0.7, 0.12, 1.9, w, { y: 0.28, parent: g, radius: 0.02 });
  box(0.66, 0.08, 1.3, mat(color, { rough: 0.95, map: fabricTexture(color, [5, 5], 92) }), { y: 0.38, z: 0.25, parent: g, radius: 0.03 });
  const back = box(0.66, 0.08, 0.7, mat(color, { rough: 0.95 }), { y: 0.6, z: -0.7, parent: g, radius: 0.03 });
  back.rotation.x = -0.7;
  for (const [dx, dz] of [
    [-0.3, -0.85],
    [0.3, -0.85],
    [-0.3, 0.85],
    [0.3, 0.85],
  ])
    box(0.05, 0.22, 0.05, w, { x: dx, y: 0.11, z: dz, parent: g });
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
}

function darkGlass() {
  return new THREE.MeshPhysicalMaterial({ color: '#2f3b3f', roughness: 0.06, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 });
}

// ---------------------------------------------------------------------------
// Casa mediterrània amb piscina (Begur)
// ---------------------------------------------------------------------------
function villa(t) {
  const g = new THREE.Group();
  const white = mat('#f1ece2', { rough: 0.9, map: plasterTexture('#f1ece2', [4, 2], 101) });
  const stone = mat(null, { rough: 0.9, map: stoneTexture('#c9b28e', [3, 1], 102) });
  const dg = darkGlass();
  const frame = mat('#2b2a27', { rough: 0.4, metal: 0.5 });
  // terreny
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), mat('#9aa071', { rough: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  g.add(lawn);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(20, 11), mat(null, { rough: 0.8, map: travertineTexture('#e6dac6', [8, 4], 103) }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.02, 8.5);
  deck.receiveShadow = true;
  g.add(deck);
  // piscina
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 3.8),
    new THREE.MeshPhysicalMaterial({ color: '#5fb1bf', roughness: 0.04, metalness: 0, clearcoat: 1, envMapIntensity: 1.2 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.04, 9.5);
  g.add(water);
  for (const [w, d, x, z] of [
    [10.6, 0.3, 0, 7.45],
    [10.6, 0.3, 0, 11.55],
    [0.3, 4.4, -5.15, 9.5],
    [0.3, 4.4, 5.15, 9.5],
  ])
    box(w, 0.08, d, mat('#efe6d6', { rough: 0.7 }), { x, y: 0.06, z, parent: g });
  // planta baixa
  box(16, 3.3, 8, white, { x: 0, y: 1.65, z: 0, parent: g });
  box(4, 3.3, 8.02, stone, { x: -6.5, y: 1.65, z: 0, parent: g });
  // vidrieres planta baixa
  box(8.6, 2.7, 0.05, dg, { x: 0.6, y: 1.4, z: 4.01, parent: g });
  for (let i = 0; i <= 4; i++) box(0.06, 2.7, 0.08, frame, { x: -3.7 + i * 2.15, y: 1.4, z: 4.03, parent: g });
  box(8.7, 0.06, 0.08, frame, { x: 0.6, y: 2.75, z: 4.03, parent: g });
  // porxo amb voladís
  box(10, 0.25, 3.2, white, { x: 0.6, y: 3.42, z: 5.5, parent: g });
  box(0.25, 3.3, 0.25, white, { x: 5.4, y: 1.65, z: 6.9, parent: g });
  // planta pis
  box(10, 3.0, 7, white, { x: 2.5, y: 4.8, z: -0.5, parent: g });
  box(6.4, 2.3, 0.05, dg, { x: 3.4, y: 4.75, z: 3.01, parent: g });
  for (let i = 0; i <= 3; i++) box(0.06, 2.3, 0.08, frame, { x: 0.2 + i * 2.13, y: 4.75, z: 3.03, parent: g });
  box(10.3, 0.18, 7.3, white, { x: 2.5, y: 6.38, z: -0.5, parent: g });
  box(16.3, 0.18, 8.3, white, { x: 0, y: 3.38, z: 0, parent: g }).position.z = -0.0;
  // baranes de vidre a la terrassa superior
  box(5.6, 1.0, 0.03, glass(), { x: -3.2, y: 3.95, z: 3.95, parent: g, cast: false });
  // pèrgola de fusta
  const wood = mat('#8d6a4a', { rough: 0.8, map: woodTexture('#8d6a4a', [1, 1], 104) });
  for (let i = 0; i < 14; i++) box(0.08, 0.16, 3.0, wood, { x: -5.2 + i * 0.32, y: 3.42, z: 5.4, parent: g });
  box(4.6, 0.16, 0.16, wood, { x: -3.1, y: 3.3, z: 6.85, parent: g });
  box(0.16, 3.2, 0.16, wood, { x: -5.3, y: 1.6, z: 6.85, parent: g });
  // gandules i para-sol
  lounger(g, -3, 12.8, Math.PI, '#efe9df');
  lounger(g, -1.6, 12.8, Math.PI, '#efe9df');
  lounger(g, 2.2, 12.8, Math.PI, '#efe9df');
  cyl(0.03, 0.03, 2.5, mat('#d8cdb9'), { x: 0.3, y: 1.25, z: 13.2, parent: g });
  const umb = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.45, 24), mat('#eae1cf', { rough: 0.95 }));
  umb.position.set(0.3, 2.55, 13.2);
  umb.castShadow = true;
  g.add(umb);
  // vegetació
  cypress(g, -9.5, -1, 8, 1);
  cypress(g, -10.8, 1.5, 7, 2);
  cypress(g, 9.6, -2.5, 7.5, 3);
  olive(g, 9.5, 6.5, 1.3, 4);
  olive(g, -9.5, 9, 1.1, 5);
  olive(g, 13, 1, 1.2, 6);
  for (let i = 0; i < 9; i++) sphere(0.5 + (i % 3) * 0.15, mat('#7d8a5c', { rough: 1 }), { x: -7.8 + i * 0.5, y: 0.35, z: 4.6, sy: 0.7, parent: g, seg: 10 });
  landscape(g, { sea: true, center: new THREE.Vector3(0, 0, 0), seed: 5, y: 9.3 });
  return { group: g, center: new THREE.Vector3(0, 0, 4), shadowSize: 22 };
}

// ---------------------------------------------------------------------------
// Façana d'edifici històric (el Born, Barcelona)
// ---------------------------------------------------------------------------
function facadeBuilding(g, x0, width, floors, color, seed, shutterColor = '#5d6b4f') {
  const r = rng(seed);
  const fh = 3.4;
  const H = 4.2 + floors * fh;
  const stucco = mat(null, { rough: 0.95, map: plasterTexture(color, [width / 4, H / 4], seed) });
  const stone = mat(null, { rough: 0.95, map: stoneTexture('#c9b597', [width / 3, 1.4], seed + 1) });
  const iron = mat('#262624', { rough: 0.5, metal: 0.6 });
  const shutter = mat(shutterColor, { rough: 0.7 });
  const dark = mat('#2a2826', { rough: 0.6 });
  const cols = Math.max(2, Math.round(width / 3.2));
  const step = width / cols;
  // cos de l'edifici amb buits
  box(width, 4.2, 0.6, stone, { x: x0 + width / 2, y: 2.1, z: -0.3, parent: g });
  const openings = [];
  for (let c = 0; c < cols; c++) openings.push({ from: x0 + step * c + step / 2 - 0.6, to: x0 + step * c + step / 2 + 0.6 });
  for (let f = 0; f < floors; f++) {
    const y0 = 4.2 + f * fh;
    const wg = new THREE.Group();
    wg.position.y = y0;
    g.add(wg);
    wall(wg, { axis: 'x', at: -0.3, from: x0, to: x0 + width, height: fh, thick: 0.6, material: stucco, openings: openings.map((o) => ({ ...o, bottom: 0.15, top: 2.65 })) });
    for (const o of openings) {
      const cx = (o.from + o.to) / 2;
      box(1.2, 2.5, 0.05, dark, { x: cx, y: y0 + 1.4, z: -0.45, parent: g });
      // finestres de fusta
      box(0.05, 2.45, 0.05, mat('#e9e2d4'), { x: cx, y: y0 + 1.4, z: -0.42, parent: g });
      // persianes obertes
      const sl = box(0.6, 2.5, 0.05, shutter, { x: cx - 0.92, y: y0 + 1.4, z: 0.05, parent: g });
      const sr = box(0.6, 2.5, 0.05, shutter, { x: cx + 0.92, y: y0 + 1.4, z: 0.05, parent: g });
      for (const s of [sl, sr])
        for (let k = 0; k < 10; k++)
          box(0.56, 0.02, 0.03, mat('#000000', { rough: 1, transparent: true, opacity: 0.18 }), { x: s.position.x, y: y0 + 0.3 + k * 0.24, z: 0.085, parent: g, cast: false });
      // balcó
      const deep = f === 0 ? 0.9 : 0.55;
      const bw = f === 0 ? width - 0.6 : 1.7;
      const bx = f === 0 ? x0 + width / 2 : cx;
      if (f > 0 || o === openings[0]) {
        box(bw, 0.14, deep, mat('#d8ccb6', { rough: 0.8 }), { x: bx, y: y0 + 0.08, z: deep / 2, parent: g });
        box(bw, 0.04, 0.04, iron, { x: bx, y: y0 + 1.1, z: deep - 0.02, parent: g });
        for (let k = 0; k <= Math.floor(bw / 0.12); k++) box(0.018, 0.95, 0.018, iron, { x: bx - bw / 2 + k * 0.12, y: y0 + 0.62, z: deep - 0.02, parent: g });
        for (const side of [-1, 1]) {
          box(0.04, 0.04, deep, iron, { x: bx + (side * bw) / 2, y: y0 + 1.1, z: deep / 2, parent: g });
          for (let k = 0; k <= Math.floor(deep / 0.12); k++) box(0.018, 0.95, 0.018, iron, { x: bx + (side * bw) / 2, y: y0 + 0.62, z: k * 0.12, parent: g });
        }
        if (r() > 0.5) sphere(0.25, mat('#6f7f4a', { rough: 1 }), { x: bx - bw / 2 + 0.3, y: y0 + 0.4, z: deep / 2, sy: 0.9, parent: g, seg: 10 });
      }
    }
    // impostes
    box(width, 0.12, 0.14, mat('#e1d4bd'), { x: x0 + width / 2, y: y0, z: 0.02, parent: g });
  }
  // cornisa
  box(width + 0.2, 0.4, 0.6, mat('#e1d4bd', { rough: 0.8 }), { x: x0 + width / 2, y: 4.2 + floors * fh + 0.2, z: 0, parent: g });
  // portal i aparadors a la planta baixa
  for (let c = 0; c < cols; c++) {
    const cx = x0 + step * c + step / 2;
    box(1.6, 3.2, 0.08, c === 1 ? mat('#3c3a33', { rough: 0.5 }) : darkGlass(), { x: cx, y: 1.6, z: 0.02, parent: g });
    box(1.8, 0.12, 0.12, iron, { x: cx, y: 3.25, z: 0.05, parent: g });
  }
  return H;
}

function born() {
  const g = new THREE.Group();
  const street = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), mat(null, { rough: 0.9, map: tileTexture('#a9a196', '#8d867b', 8, 16, [40, 20], 111) }));
  street.rotation.x = -Math.PI / 2;
  street.position.z = 8;
  street.receiveShadow = true;
  g.add(street);
  box(80, 0.15, 2, mat('#bdb3a3'), { x: 0, y: 0.075, z: 1, parent: g });
  facadeBuilding(g, -6.5, 13, 4, '#dcb98a', 121, '#56634a');
  facadeBuilding(g, -19.5, 13, 5, '#d6c6ad', 122, '#6d5a43');
  facadeBuilding(g, 6.5, 12, 3, '#c98f6b', 123, '#3e5246');
  // edificis del davant (fan ombra i tanquen el carrer)
  box(60, 22, 1, mat('#cbb89c'), { x: 0, y: 11, z: 13, parent: g });
  // fanal
  const iron = mat('#262624', { rough: 0.5, metal: 0.6 });
  box(0.06, 1.2, 0.06, iron, { x: 2.4, y: 7.6, z: 0.4, parent: g });
  cyl(0.18, 0.12, 0.4, mat('#f3e8cf', { emissive: '#ffd59a', emissiveIntensity: 0.6 }), { x: 2.4, y: 7.0, z: 0.75, parent: g });
  return { group: g, center: new THREE.Vector3(0, 6, 4), shadowSize: 26 };
}

// ---------------------------------------------------------------------------
// Bloc d'obra nova (Girona)
// ---------------------------------------------------------------------------
function block() {
  const g = new THREE.Group();
  const white = mat('#f2efe9', { rough: 0.85, map: plasterTexture('#f2efe9', [5, 3], 131) });
  const wood = mat(null, { rough: 0.7, map: woodTexture('#b48a5e', [1, 1], 132) });
  const dg = darkGlass();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat('#a3a57c', { rough: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(40, 4), mat(null, { rough: 0.9, map: tileTexture('#d8d0c2', '#bdb4a5', 4, 4, [20, 2], 133) }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, 6);
  path.receiveShadow = true;
  g.add(path);
  const floors = 5;
  const fh = 3.1;
  const W = 22;
  box(W, floors * fh, 10, white, { x: 0, y: (floors * fh) / 2, z: -5, parent: g });
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    for (let i = 0; i < 4; i++) {
      const cx = -W / 2 + 2.75 + i * 5.5;
      box(4.2, 2.5, 0.05, dg, { x: cx, y: y + 1.35, z: 0.03, parent: g });
      if (f > 0) {
        box(5.0, 0.18, 1.6, white, { x: cx, y: y + 0.09, z: 0.8, parent: g });
        box(5.0, 1.0, 0.03, glass(), { x: cx, y: y + 0.68, z: 1.58, parent: g, cast: false });
      }
      // gelosia de llistons
      for (let k = 0; k < 6; k++) box(0.06, 2.6, 0.12, wood, { x: cx + 2.2 + k * 0.11, y: y + 1.4, z: 0.1, parent: g });
    }
  }
  box(W + 0.3, 0.3, 10.3, white, { x: 0, y: floors * fh + 0.15, z: -5, parent: g });
  for (const [x, z, s] of [
    [-14, 6, 1],
    [-7, 9, 2],
    [8, 9, 3],
    [15, 5, 4],
  ])
    planeTree(g, x, z, s);
  for (let i = 0; i < 18; i++) sphere(0.45, mat('#7f8c56', { rough: 1 }), { x: -10 + i * 1.2, y: 0.3, z: 2.2, sy: 0.7, parent: g, seg: 10 });
  landscape(g, { sea: false, center: new THREE.Vector3(0, 0, 0), hillColor: '#8e9576', seed: 7, y: 9.3 });
  return { group: g, center: new THREE.Vector3(0, 6, 0), shadowSize: 26 };
}

// ---------------------------------------------------------------------------
// Masia rehabilitada (Sant Cugat del Vallès)
// ---------------------------------------------------------------------------
function masia() {
  const g = new THREE.Group();
  const stone = mat(null, { rough: 0.95, map: stoneTexture('#bba586', [4, 2], 141) });
  const stone2 = mat(null, { rough: 0.95, map: stoneTexture('#bba586', [2, 2], 142) });
  const roofM = mat(null, { rough: 0.9, map: tileTexture('#ad6440', '#7d4129', 1, 10, [8, 2], 143) });
  const wood = mat('#6e4e33', { rough: 0.8 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat('#b9ab7c', { rough: 1 }));
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  g.add(field);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(22, 10), mat('#cdbb9c', { rough: 1 }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(0, 0.01, 7);
  yard.receiveShadow = true;
  g.add(yard);
  const W = 14;
  const D = 9;
  const Hh = 7;
  box(W, Hh, D, stone, { x: 0, y: Hh / 2, z: 0, parent: g });
  // teulada a dues aigües (carener perpendicular a la façana, típic de masia)
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2 - 0.4, 0);
  shape.lineTo(0, 3.2);
  shape.lineTo(W / 2 + 0.4, 0);
  shape.lineTo(-W / 2 - 0.4, 0);
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: D - 0.02, bevelEnabled: false }), stone2);
  gable.position.set(0, Hh, -D / 2 + 0.01);
  gable.castShadow = gable.receiveShadow = true;
  g.add(gable);
  const slope = Math.atan2(3.2, W / 2 + 0.4);
  const len = Math.hypot(3.2, W / 2 + 0.4) + 0.2;
  for (const s of [-1, 1]) {
    const rf = box(len, 0.18, D + 0.8, roofM, { x: (s * (W / 2 + 0.4)) / 2, y: Hh + 1.6 + 0.09, z: 0, parent: g });
    rf.rotation.z = -s * slope;
  }
  // porta adovellada
  box(1.8, 2.4, 0.1, wood, { x: 0, y: 1.2, z: D / 2 + 0.01, parent: g });
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 32, 1, false, 0, Math.PI), wood);
  arch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  arch.position.set(0, 2.4, D / 2 + 0.01);
  g.add(arch);
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    const v = box(0.35, 0.25, 0.14, mat('#cdbb9c'), { x: Math.cos(a) * 1.08, y: 2.4 + Math.sin(a) * 1.08, z: D / 2 + 0.03, parent: g });
    v.rotation.z = a - Math.PI / 2;
  }
  // finestres amb porticons
  const win = (x, y, w, h) => {
    box(w + 0.3, h + 0.3, 0.06, mat('#d9ccb3'), { x, y, z: D / 2 + 0.01, parent: g });
    box(w, h, 0.07, mat('#2a2826'), { x, y, z: D / 2 + 0.02, parent: g });
    box(w / 2, h, 0.05, mat('#6b7341', { rough: 0.7 }), { x: x - w * 0.75, y, z: D / 2 + 0.08, parent: g });
    box(w / 2, h, 0.05, mat('#6b7341', { rough: 0.7 }), { x: x + w * 0.75, y, z: D / 2 + 0.08, parent: g });
  };
  win(-4, 1.6, 1.0, 1.4);
  win(4, 1.6, 1.0, 1.4);
  win(-4, 5.0, 1.0, 1.5);
  win(0, 5.0, 1.2, 1.7);
  win(4, 5.0, 1.0, 1.5);
  win(0, 8.6, 0.6, 0.8);
  // porxo lateral amb pèrgola i taula
  for (const x of [8.2, 10.6]) box(0.4, 3, 0.4, stone2, { x, y: 1.5, z: 3.6, parent: g });
  for (let i = 0; i < 8; i++) box(3.6, 0.12, 0.12, wood, { x: 9.0, y: 3.05, z: -0.4 + i * 0.6, parent: g });
  box(1.8, 0.06, 0.9, wood, { x: 9.3, y: 0.76, z: 1.8, parent: g });
  for (const [dx, dz] of [
    [-0.8, -0.38],
    [0.8, -0.38],
    [-0.8, 0.38],
    [0.8, 0.38],
  ])
    box(0.06, 0.74, 0.06, wood, { x: 9.3 + dx, y: 0.37, z: 1.8 + dz, parent: g });
  // vegetació
  cypress(g, -9.5, 4, 9, 11);
  cypress(g, -11, 2, 8, 12);
  for (const [x, z, s] of [
    [-6, 13, 1.2],
    [6, 14, 1.1],
    [14, 10, 1.3],
    [-15, 11, 1.0],
    [2, 18, 1.2],
    [-3, 20, 1.0],
  ])
    olive(g, x, z, s, x * 7 + z);
  for (let i = 0; i < 6; i++) cyl(0.25, 0.2, 0.5, mat('#b4673f'), { x: -2.8 + i * 0.4 + (i > 2 ? 4.4 : 0), y: 0.25, z: D / 2 + 0.5, parent: g });
  landscape(g, { sea: false, center: new THREE.Vector3(0, 0, 0), hillColor: '#8f9373', seed: 9, y: 9.3 });
  return { group: g, center: new THREE.Vector3(0, 4, 3), shadowSize: 24 };
}

// ---------------------------------------------------------------------------
// Bany
// ---------------------------------------------------------------------------
function bathroom(spec) {
  const pal = {
    mediterrani: { tile: '#e8e2d6', wood: '#a3815e', accent: '#c0704d' },
    calid: { tile: '#d9c3a5', wood: '#86664a', accent: '#8a5a3c' },
    rustic: { tile: '#c9a27f', wood: '#6e4e33', accent: '#6b7341' },
    mar: { tile: '#bcd2d4', wood: '#b48e65', accent: '#4f7f95' },
    nordic: { tile: '#e7e6e1', wood: '#cba77a', accent: '#7c8a6e' },
    urba: { tile: '#3f4a43', wood: '#6a5040', accent: '#b5803f' },
  }[spec.palette || 'mediterrani'];
  const g = new THREE.Group();
  const W = 2.9;
  const D = 3.3;
  const Hh = 2.6;
  const plaster = mat(null, { rough: 0.9, map: plasterTexture('#f1ece3', [1, 1], 151) });
  const zell = mat(null, { rough: 0.22, map: tileTexture(pal.tile, '#d5cdbf', 8, 8, [1, 1], 152, true) });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(null, { rough: 0.6, map: tileTexture('#d9d1c3', '#beb5a6', 3, 3, [W / 0.9, D / 0.9], 153) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  floor.receiveShadow = true;
  g.add(floor);
  box(W + 0.4, 0.2, D + 0.4, mat('#f5f2ec'), { x: W / 2, y: Hh + 0.1, z: D / 2, parent: g });
  box(W + 0.4, 0.2, D + 0.4, mat('#ccc'), { x: W / 2, y: -0.105, z: D / 2, parent: g });
  wall(g, { axis: 'x', at: -0.1, from: -0.2, to: W + 0.2, height: Hh, thick: 0.2, material: plaster, openings: [{ from: 1.0, to: 1.9, bottom: 1.2, top: 2.25 }] });
  wall(g, { axis: 'z', at: -0.1, from: 0, to: D, height: Hh, thick: 0.2, material: plaster });
  wall(g, { axis: 'z', at: W + 0.1, from: 0, to: D, height: Hh, thick: 0.2, material: plaster });
  wall(g, { axis: 'x', at: D + 0.1, from: -0.2, to: W + 0.2, height: Hh, thick: 0.2, material: plaster });
  windowFrame(g, { axis: 'x', at: -0.02, from: 1.0, to: 1.9, bottom: 1.2, top: 2.25, frameMat: mat('#2b2a27', { metal: 0.4, rough: 0.4 }), glassMat: glass(), mullions: 0 });
  // revestiment de rajola fins a 1,2 m i a la dutxa
  const tz = (w, h, x, y, z, axis) => (axis === 'x' ? box(w, h, 0.012, zell, { x, y, z, parent: g, cast: false }) : box(0.012, h, w, zell, { x, y, z, parent: g, cast: false }));
  tz(W, 1.2, W / 2, 0.6, 0.006, 'x');
  tz(D, 1.2, 0.006, 0.6, D / 2, 'z');
  tz(1.0, 2.2, W - 0.5, 1.1, D - 0.006, 'x');
  tz(1.0, 2.2, W - 0.006, 1.1, D - 0.5, 'z');
  // banyera exempta
  const white = mat('#f7f5f0', { rough: 0.15 });
  box(0.8, 0.55, 1.7, white, { x: 0.55, y: 0.3, z: 1.35, parent: g, radius: 0.18 });
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), mat('#e6eaea', { rough: 0.05 }));
  inner.scale.set(0.65, 1.45, 1);
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(0.55, 0.585, 1.35);
  g.add(inner);
  cyl(0.012, 0.012, 1.0, mat('#2b2a27', { metal: 0.8, rough: 0.3 }), { x: 0.55, y: 0.5, z: 0.35, parent: g });
  // moble de lavabo
  const wood = mat(null, { rough: 0.55, map: woodTexture(pal.wood, [1, 1], 154) });
  box(1.3, 0.45, 0.5, wood, { x: 1.75, y: 0.62, z: 0.27, parent: g, radius: 0.02 });
  box(1.34, 0.04, 0.52, mat(null, { rough: 0.3, map: travertineTexture('#e5d8c3', [1, 1], 155) }), { x: 1.75, y: 0.865, z: 0.27, parent: g });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
  bowl.position.set(1.75, 1.04, 0.3);
  bowl.scale.set(1, 0.85, 1);
  g.add(bowl);
  cyl(0.012, 0.012, 0.3, mat('#2b2a27', { metal: 0.8, rough: 0.3 }), { x: 1.75, y: 1.12, z: 0.06, parent: g });
  // mirall rodó
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.38, 48), new THREE.MeshStandardMaterial({ color: '#cfd6d6', metalness: 1, roughness: 0.04 }));
  mirror.position.set(1.0, 1.75, 0.03);
  g.add(mirror);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.012, 8, 64), mat('#2b2a27', { metal: 0.8, rough: 0.3 }));
  ring.position.set(1.0, 1.75, 0.035);
  g.add(ring);
  // dutxa amb mampara
  box(0.01, 2.0, 1.0, glass(), { x: W - 1.0, y: 1.0, z: D - 0.5, parent: g, cast: false });
  box(1.0, 0.05, 1.0, mat('#e9e4da', { rough: 0.6 }), { x: W - 0.5, y: 0.02, z: D - 0.5, parent: g });
  cyl(0.12, 0.12, 0.02, mat('#2b2a27', { metal: 0.8, rough: 0.3 }), { x: W - 0.5, y: 2.15, z: D - 0.35, parent: g });
  // tovalloles i detalls
  box(0.5, 0.7, 0.04, mat(null, { rough: 1, map: fabricTexture('#f2eee6', [4, 4], 156) }), { x: W - 0.03, y: 1.2, z: 1.2, parent: g, ry: Math.PI / 2 });
  box(0.4, 0.06, 0.25, mat(pal.accent, { rough: 1, map: fabricTexture(pal.accent, [4, 4], 157) }), { x: 1.4, y: 0.88, z: 0.3, parent: g, radius: 0.02 });
  cyl(0.05, 0.06, 0.18, mat(pal.accent, { rough: 0.6 }), { x: 2.2, y: 0.97, z: 0.25, parent: g });
  const pot = cyl(0.18, 0.14, 0.4, mat('#efe7da', { rough: 0.8 }), { x: 0.3, y: 0.2, z: 2.75, parent: g });
  void pot;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const l = sphere(0.12, mat('#6a7a4b', { rough: 0.9 }), {
      x: 0.3 + Math.cos(a) * 0.12,
      y: 0.65 + (i % 3) * 0.12,
      z: 2.75 + Math.sin(a) * 0.12,
      sx: 0.4,
      sy: 1.8,
      sz: 0.4,
      parent: g,
      seg: 10,
    });
    l.rotation.z = Math.cos(a) * 0.4;
    l.rotation.x = Math.sin(a) * 0.4;
  }
  box(0.6, 0.01, 0.9, mat(null, { rough: 1, map: fabricTexture('#e7dfd0', [6, 6], 158) }), { x: 1.6, y: 0.006, z: 1.4, parent: g });
  const l = new THREE.PointLight('#ffd9b0', 1.2, 5, 2);
  l.position.set(1.4, 2.3, 1.6);
  g.add(l);
  landscape(g, { sea: spec.palette === 'mar' || spec.palette === 'mediterrani', center: new THREE.Vector3(1.4, 0, 1.6), seed: 13 });
  return {
    group: g,
    center: new THREE.Vector3(1.4, 0, 1.6),
    shadowSize: 6,
    interior: true,
    areaLights: [{ pos: [1.45, 1.72, 0.04], size: [0.9, 1.05], look: [1.45, 1.72, 2], k: 1.6 }],
  };
}

export function buildExterior(spec, t) {
  void t;
  switch (spec.type) {
    case 'villa':
      return villa(t);
    case 'born':
      return born();
    case 'block':
      return block();
    case 'masia':
      return masia();
    case 'bathroom':
      return bathroom(spec);
    default:
      throw new Error(`Escena desconeguda: ${spec.type}`);
  }
}
