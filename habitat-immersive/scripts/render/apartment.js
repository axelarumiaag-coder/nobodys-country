// Model 3D procedural del pis de demostració (tipologia de 4 estances + bany).
// Les mateixes coordenades s'utilitzen per al plànol SVG i per als punts de navegació.
//
// Eix X: est (+). Eix Z: interior (+), façana amb terrassa a z = 0. Unitats: metres.
import * as THREE from 'three';
import { box, cyl, sphere, wall, windowFrame, glass, mat, rng, woodTexture, plasterTexture, tileTexture, fabricTexture, travertineTexture, artTexture } from './lib.js';

export const PALETTES = {
  mediterrani: {
    wall: '#f1ebe1',
    floor: '#c6a481',
    floorType: 'wood',
    kitchenFloor: '#e6dccb',
    cabinet: '#7b7f63',
    counter: '#e5d8c3',
    sofa: '#e4dccd',
    accent: '#6f7550',
    terracotta: '#c0704d',
    wood: '#a3815e',
    metal: '#2b2a27',
    linen: '#efe9df',
    rug: '#d9cbb3',
    throwColor: '#c06a43',
    art: ['#c7b299', '#6b7341', '#d98c5f', '#2b2a27', '#efe7da'],
  },
  nordic: {
    wall: '#f5f4f0',
    floor: '#dcc4a0',
    floorType: 'wood',
    kitchenFloor: '#dedbd5',
    cabinet: '#efede8',
    counter: '#d4d1ca',
    sofa: '#a2a7a6',
    accent: '#7c8a6e',
    terracotta: '#c99a6a',
    wood: '#cba77a',
    metal: '#2e2e2c',
    linen: '#f2f0ec',
    rug: '#e8e3d9',
    throwColor: '#7c8a6e',
    art: ['#d7d2c8', '#7c8a6e', '#b9a27c', '#3a3a38', '#f4f1ea'],
  },
  calid: {
    wall: '#efe4d3',
    floor: '#b48a66',
    floorType: 'wood',
    kitchenFloor: '#e3d5bf',
    cabinet: '#a37a54',
    counter: '#ece3d4',
    sofa: '#ebe2d1',
    accent: '#8a5a3c',
    terracotta: '#b9623b',
    wood: '#86664a',
    metal: '#2a2724',
    linen: '#f1e9dc',
    rug: '#cdb79a',
    throwColor: '#8a5a3c',
    art: ['#e2c8a4', '#8a5a3c', '#c27a4a', '#2a2724', '#f3ebde'],
  },
  urba: {
    wall: '#ede7dd',
    floor: '#957359',
    floorType: 'wood',
    kitchenFloor: '#cfc6b8',
    cabinet: '#2f3530',
    counter: '#e6e1d8',
    sofa: '#5d6b4f',
    accent: '#b5803f',
    terracotta: '#a65a3a',
    wood: '#6a5040',
    metal: '#1f1f1d',
    linen: '#ece6db',
    rug: '#b9a98f',
    throwColor: '#b5803f',
    art: ['#b5803f', '#5d6b4f', '#d9cbb3', '#1f1f1d', '#ebe4d8'],
  },
  rustic: {
    wall: '#ece1cd',
    floor: '#b4673f',
    floorType: 'terracotta',
    kitchenFloor: '#b4673f',
    cabinet: '#c9b99b',
    counter: '#e0d4bf',
    sofa: '#d9c9ae',
    accent: '#6b7341',
    terracotta: '#a4532f',
    wood: '#6e4e33',
    metal: '#2b2622',
    linen: '#efe6d6',
    rug: '#c2ac8a',
    throwColor: '#6b7341',
    art: ['#a4532f', '#6b7341', '#d9c9ae', '#2b2622', '#efe6d6'],
  },
  mar: {
    wall: '#f4f2ed',
    floor: '#e0cbaa',
    floorType: 'wood',
    kitchenFloor: '#e9e6df',
    cabinet: '#8ea4a6',
    counter: '#eeebe4',
    sofa: '#d2dad7',
    accent: '#4f7f95',
    terracotta: '#d0956a',
    wood: '#b48e65',
    metal: '#30302e',
    linen: '#f5f3ef',
    rug: '#e6e0d3',
    throwColor: '#4f7f95',
    art: ['#9fc0cc', '#4f7f95', '#e0cbaa', '#30302e', '#f4f1ea'],
  },
};

export const H = 2.7; // alçada lliure

// Punts de vista de les estances (alçada d'ulls 1,55 m)
export const ROOMS = {
  sala: { name: "Sala d'estar", cam: [3.55, 1.55, 2.45], rect: [0, 0, 6.6, 4.6] },
  cuina: { name: 'Cuina', cam: [8.05, 1.55, 0.85], rect: [6.6, 0, 10, 4.6] },
  dormitori: { name: 'Dormitori principal', cam: [3.2, 1.55, 5.75], rect: [0, 4.6, 4.2, 8.4] },
  dormitori2: { name: 'Segon dormitori', cam: [7.4, 1.55, 5.55], rect: [5.6, 4.6, 10, 8.4] },
};

// Punts de navegació: posició mundial del destí visible des de cada estança
export const LINKS = [
  { from: 'sala', to: 'cuina', target: [7.9, 0.75, 1.15], label: 'Cuina' },
  { from: 'sala', to: 'dormitori', target: [3.45, 0.85, 4.6], label: 'Dormitori principal' },
  { from: 'sala', to: 'dormitori2', target: [6.15, 0.85, 4.6], label: 'Segon dormitori' },
  { from: 'cuina', to: 'sala', target: [4.6, 0.6, 1.9], label: "Sala d'estar" },
  { from: 'cuina', to: 'dormitori2', target: [6.15, 0.85, 4.6], label: 'Segon dormitori' },
  { from: 'dormitori', to: 'sala', target: [3.45, 0.85, 4.6], label: "Sala d'estar" },
  { from: 'dormitori2', to: 'sala', target: [6.15, 0.85, 4.6], label: "Sala d'estar" },
];

const DOORS = {
  dormitori: [3.0, 3.9],
  bany: [4.5, 5.3],
  dormitori2: [5.75, 6.55],
};

function plant(parent, x, z, scale = 1, seed = 1, potColor = '#c06a43') {
  const g = new THREE.Group();
  const r = rng(seed);
  const pot = mat(potColor, { rough: 0.9 });
  cyl(0.2 * scale, 0.15 * scale, 0.42 * scale, pot, { y: 0.21 * scale, parent: g });
  const leaf = mat('#5f7046', { rough: 0.85 });
  const leaf2 = mat('#73844f', { rough: 0.85 });
  const stem = mat('#5a4a35', { rough: 1 });
  cyl(0.015 * scale, 0.02 * scale, 0.9 * scale, stem, { y: 0.8 * scale, parent: g, seg: 6 });
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const h = 0.55 + r() * 0.9;
    const rad = 0.08 + r() * 0.32 * (1.2 - h / 1.6);
    const l = sphere(0.11 * scale, r() > 0.5 ? leaf : leaf2, {
      x: Math.cos(a) * rad * scale,
      y: h * scale,
      z: Math.sin(a) * rad * scale,
      sx: 1.6,
      sy: 0.25,
      sz: 0.9,
      parent: g,
      seg: 10,
    });
    l.rotation.set((r() - 0.5) * 1.2, a, (r() - 0.5) * 0.8);
  }
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

function books(parent, x0, y, z, len, axis, seed, colors) {
  const r = rng(seed);
  let p = 0;
  while (p < len - 0.05) {
    const t = 0.025 + r() * 0.035;
    const h = 0.18 + r() * 0.1;
    const m = mat(colors[Math.floor(r() * colors.length)], { rough: 0.85 });
    if (r() < 0.12) {
      p += 0.08;
      continue;
    }
    if (axis === 'z') box(0.2, h, t, m, { x: x0, y: y + h / 2, z: z + p + t / 2, parent, radius: 0.004 });
    else box(t, h, 0.2, m, { x: x0 + p + t / 2, y: y + h / 2, z, parent, radius: 0.004 });
    p += t + 0.003;
  }
}

function pendant(parent, x, y, z, metalMat, lights, warm = '#ffd9a8') {
  cyl(0.004, 0.004, H - y - 0.2, metalMat, { x, y: (H + y + 0.2) / 2, z, parent, cast: false });
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f3efe7', { rough: 0.6, side: THREE.DoubleSide }));
  shade.position.set(x, y + 0.08, z);
  shade.castShadow = false;
  parent.add(shade);
  const bulb = sphere(0.05, mat('#fff', { emissive: warm, emissiveIntensity: 6 }), { x, y: y + 0.05, z, parent });
  bulb.castShadow = false;
  const l = new THREE.PointLight(warm, 1.6, 6, 2);
  l.position.set(x, y - 0.05, z);
  lights.push(l);
  parent.add(l);
}

function chair(parent, x, z, ry, woodMat, seatMat) {
  const g = new THREE.Group();
  for (const [dx, dz] of [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ])
    cyl(0.017, 0.014, 0.45, woodMat, { x: dx, y: 0.225, z: dz, parent: g, seg: 10 });
  box(0.46, 0.04, 0.46, seatMat, { y: 0.47, parent: g, radius: 0.015 });
  box(0.44, 0.3, 0.025, woodMat, { y: 0.78, z: 0.21, parent: g, radius: 0.01 });
  for (const dx of [-0.2, 0.2]) cyl(0.014, 0.014, 0.34, woodMat, { x: dx, y: 0.62, z: 0.21, parent: g, seg: 10 });
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
}

function sofa(parent, x, z, ry, width, fabricMat, legMat, accentMat) {
  const g = new THREE.Group();
  const d = 0.95;
  box(width, 0.22, d, fabricMat, { y: 0.24, parent: g, radius: 0.05 });
  box(width, 0.5, 0.22, fabricMat, { y: 0.55, z: d / 2 - 0.11, parent: g, radius: 0.08 });
  box(0.2, 0.42, d, fabricMat, { x: -width / 2 + 0.1, y: 0.42, parent: g, radius: 0.07 });
  box(0.2, 0.42, d, fabricMat, { x: width / 2 - 0.1, y: 0.42, parent: g, radius: 0.07 });
  const seats = 3;
  const sw = (width - 0.42) / seats;
  for (let i = 0; i < seats; i++) {
    box(sw - 0.02, 0.15, d - 0.3, fabricMat, { x: -width / 2 + 0.21 + sw * (i + 0.5), y: 0.42, z: -0.08, parent: g, radius: 0.06 });
  }
  for (let i = 0; i < 2; i++) {
    const c = box(0.45, 0.42, 0.14, i === 0 ? accentMat : fabricMat, { x: -width / 2 + 0.55 + i * 0.4, y: 0.66, z: 0.22, parent: g, radius: 0.06 });
    c.rotation.x = -0.25;
    c.rotation.z = (i - 0.5) * 0.2;
  }
  const c2 = box(0.45, 0.42, 0.14, accentMat, { x: width / 2 - 0.55, y: 0.66, z: 0.22, parent: g, radius: 0.06 });
  c2.rotation.x = -0.25;
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    cyl(0.025, 0.02, 0.13, legMat, { x: dx * (width / 2 - 0.08), y: 0.065, z: dz * (d / 2 - 0.08), parent: g, seg: 10 });
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

function bed(parent, x, z, ry, width, p, seed) {
  const g = new THREE.Group();
  const len = 2.05;
  const woodM = mat(p.wood, { rough: 0.6, map: woodTexture(p.wood, [1, 1], 41) });
  const linen = mat(p.linen, { rough: 0.95, map: fabricTexture(p.linen, [6, 6], 43) });
  const throwM = mat(p.throwColor, { rough: 0.95, map: fabricTexture(p.throwColor, [6, 6], 44) });
  box(width + 0.1, 0.28, len, woodM, { y: 0.2, parent: g, radius: 0.02 });
  box(width + 0.16, 1.05, 0.08, mat(p.sofa, { rough: 0.9, map: fabricTexture(p.sofa, [4, 4], 45) }), { y: 0.62, z: len / 2 + 0.02, parent: g, radius: 0.04 });
  box(width, 0.24, len - 0.1, linen, { y: 0.46, z: -0.02, parent: g, radius: 0.08 });
  box(width + 0.04, 0.07, len * 0.62, linen, { y: 0.6, z: -len * 0.17, parent: g, radius: 0.035 });
  box(width + 0.08, 0.05, 0.55, throwM, { y: 0.64, z: -len / 2 + 0.38, parent: g, radius: 0.02 });
  const np = width > 1.5 ? 2 : 1;
  for (let i = 0; i < np; i++) {
    const px = np === 1 ? 0 : (i - 0.5) * (width * 0.5);
    const pw = np === 1 ? width * 0.7 : width * 0.44;
    const pl = box(pw, 0.2, 0.42, linen, { x: px, y: 0.7, z: len / 2 - 0.32, parent: g, radius: 0.09 });
    pl.rotation.x = -0.3;
  }
  const accentPillow = box(0.4, 0.3, 0.12, throwM, { y: 0.72, z: len / 2 - 0.56, parent: g, radius: 0.05 });
  accentPillow.rotation.x = -0.3;
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
  void seed;
  return g;
}

function nightstand(parent, x, z, p, lights) {
  const woodM = mat(p.wood, { rough: 0.6, map: woodTexture(p.wood, [1, 1], 51) });
  box(0.48, 0.5, 0.4, woodM, { x, y: 0.25, z, parent, radius: 0.015 });
  box(0.4, 0.004, 0.005, mat(p.metal, { rough: 0.4, metal: 0.8 }), { x, y: 0.38, z: z - 0.2, parent });
  cyl(0.06, 0.08, 0.22, mat(p.terracotta, { rough: 0.7 }), { x: x - 0.06, y: 0.61, z, parent });
  const shade = cyl(0.13, 0.15, 0.2, mat('#f6efe2', { rough: 0.9, emissive: '#ffcf96', emissiveIntensity: 0.35 }), { x: x - 0.06, y: 0.84, z, parent, cast: false });
  shade.material.transparent = false;
  const l = new THREE.PointLight('#ffcf96', 0.8, 4, 2);
  l.position.set(x - 0.06, 0.82, z - 0.1);
  lights.push(l);
  parent.add(l);
  books(parent, x + 0.05, 0.5, z - 0.1, 0.12, 'x', 99, ['#6b7341', '#c7b299', '#2b2a27']);
}

function artwork(parent, x, y, z, w, h, axis, seed, palette, frameColor = '#2b2a27') {
  const frame = mat(frameColor, { rough: 0.5 });
  const art = mat(null, { rough: 0.9, map: artTexture(seed, palette) });
  if (axis === 'z') {
    // pintura penjada en una paret orientada a +z o -z (cara normal en Z)
    box(w + 0.05, h + 0.05, 0.03, frame, { x, y, z, parent, cast: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), art);
    plane.position.set(x, y, z + Math.sign(z === 0 ? 1 : 1) * 0.0);
    return {
      frame,
      plane,
      place: (dir) => {
        plane.position.z = z + dir * 0.016;
        if (dir < 0) plane.rotation.y = Math.PI;
        parent.add(plane);
      },
    };
  }
  box(0.03, h + 0.05, w + 0.05, frame, { x, y, z, parent, cast: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), art);
  plane.position.set(x, y, z);
  return {
    frame,
    plane,
    place: (dir) => {
      plane.position.x = x + dir * 0.016;
      plane.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      parent.add(plane);
    },
  };
}

function curtain(parent, axis, at, from, to, color, side = 1) {
  // cortina de lli plegada; side indica cap a on queda l'interior
  const len = to - from;
  const geo = new THREE.PlaneGeometry(len, H - 0.12, Math.ceil(len * 30), 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    pos.setZ(i, Math.sin(u * 26) * 0.035);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(color, { rough: 1, side: THREE.DoubleSide, map: fabricTexture(color, [8, 8], 61) }));
  m.castShadow = true;
  m.receiveShadow = true;
  if (axis === 'x') {
    m.position.set((from + to) / 2, (H - 0.12) / 2 + 0.03, at + side * 0.13);
  } else {
    m.rotation.y = Math.PI / 2;
    m.position.set(at + side * 0.13, (H - 0.12) / 2 + 0.03, (from + to) / 2);
  }
  parent.add(m);
  // barra
  if (axis === 'x')
    cyl(0.012, 0.012, len + 0.1, mat('#2b2a27', { metal: 0.7, rough: 0.4 }), { x: (from + to) / 2, y: H - 0.07, z: at + side * 0.13, parent }).rotation.z = Math.PI / 2;
  else cyl(0.012, 0.012, len + 0.1, mat('#2b2a27', { metal: 0.7, rough: 0.4 }), { x: at + side * 0.13, y: H - 0.07, z: (from + to) / 2, parent }).rotation.x = Math.PI / 2;
}

/**
 * Construeix el pis complet.
 * Retorna { group, lights, windows } — windows serveix per afegir llum d'àrea a cada obertura.
 */
export function buildApartment(paletteName = 'mediterrani') {
  const p = PALETTES[paletteName];
  const g = new THREE.Group();
  const lights = [];

  const wallMat = mat(p.wall, { rough: 0.92, map: plasterTexture(p.wall, [2, 1], 5) });
  const ceilMat = mat('#f7f4ee', { rough: 0.95 });
  const frameMat = mat(p.metal, { rough: 0.45, metal: 0.4 });
  const glassMat = glass();
  const woodM = mat(p.wood, { rough: 0.55, map: woodTexture(p.wood, [1, 1], 71) });
  const metalM = mat(p.metal, { rough: 0.35, metal: 0.85 });

  // --- Terres
  const floorTex = p.floorType === 'terracotta' ? tileTexture(p.floor, '#8f5a3d', 4, 4, [10 / 1.2, 8.4 / 1.2], 23, true) : woodTexture(p.floor, [10 / 2.2, 8.4 / 2.2], 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 8.4), mat(null, { rough: p.floorType === 'wood' ? 0.62 : 0.8, map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(5, 0, 4.2);
  floor.receiveShadow = true;
  g.add(floor);
  const kFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.6), mat(null, { rough: 0.5, map: tileTexture(p.kitchenFloor, '#b9b0a2', 2, 2, [3.4 / 1.2, 4.6 / 1.2], 29) }));
  kFloor.rotation.x = -Math.PI / 2;
  kFloor.position.set(8.3, 0.002, 2.3);
  kFloor.receiveShadow = true;
  if (p.floorType !== 'terracotta') g.add(kFloor);

  // --- Sostre (llosa gruixuda perquè no passi el sol)
  box(10.6, 0.3, 9, ceilMat, { x: 5, y: H + 0.15, z: 4.2, parent: g });
  // forjat inferior (visible des de la terrassa)
  box(10.6, 0.3, 9, mat('#ddd6ca'), { x: 5, y: -0.162, z: 4.2, parent: g });

  // --- Façanes
  wall(g, {
    axis: 'x',
    at: -0.07,
    from: -0.14,
    to: 10.14,
    height: H,
    thick: 0.28,
    material: wallMat,
    openings: [
      { from: 0.8, to: 5.6, bottom: 0.0, top: 2.42 },
      { from: 7.2, to: 9.4, bottom: 1.02, top: 2.25 },
    ],
  });
  wall(g, {
    axis: 'z',
    at: -0.07,
    from: 0,
    to: 8.4,
    height: H,
    thick: 0.28,
    material: wallMat,
    openings: [
      { from: 1.2, to: 3.4, bottom: 0.55, top: 2.3 },
      { from: 5.7, to: 7.5, bottom: 0.7, top: 2.3 },
    ],
  });
  wall(g, {
    axis: 'z',
    at: 10.07,
    from: 0,
    to: 8.4,
    height: H,
    thick: 0.28,
    material: wallMat,
    openings: [
      { from: 1.35, to: 3.0, bottom: 1.06, top: 2.2 },
      { from: 5.8, to: 7.6, bottom: 0.7, top: 2.3 },
    ],
  });
  wall(g, { axis: 'x', at: 8.47, from: -0.14, to: 10.14, height: H, thick: 0.28, material: wallMat });

  windowFrame(g, { axis: 'x', at: 0.0, from: 0.8, to: 5.6, bottom: 0.0, top: 2.42, frameMat, glassMat, mullions: 2 });
  windowFrame(g, { axis: 'x', at: 0.0, from: 7.2, to: 9.4, bottom: 1.02, top: 2.25, frameMat, glassMat, mullions: 1 });
  windowFrame(g, { axis: 'z', at: 0.0, from: 1.2, to: 3.4, bottom: 0.55, top: 2.3, frameMat, glassMat, mullions: 1 });
  windowFrame(g, { axis: 'z', at: 0.0, from: 5.7, to: 7.5, bottom: 0.7, top: 2.3, frameMat, glassMat, mullions: 1 });
  windowFrame(g, { axis: 'z', at: 10.0, from: 1.35, to: 3.0, bottom: 1.06, top: 2.2, frameMat, glassMat, mullions: 0 });
  windowFrame(g, { axis: 'z', at: 10.0, from: 5.8, to: 7.6, bottom: 0.7, top: 2.3, frameMat, glassMat, mullions: 1 });

  // --- Envans
  const doorTop = 2.12;
  wall(g, {
    axis: 'x',
    at: 4.6,
    from: 0,
    to: 10,
    height: H,
    thick: 0.1,
    material: wallMat,
    openings: [
      { from: DOORS.dormitori[0], to: DOORS.dormitori[1], bottom: 0, top: doorTop },
      { from: DOORS.bany[0], to: DOORS.bany[1], bottom: 0, top: doorTop },
      { from: DOORS.dormitori2[0], to: DOORS.dormitori2[1], bottom: 0, top: doorTop },
    ],
  });
  wall(g, { axis: 'z', at: 6.6, from: 0, to: 4.6, height: H, thick: 0.1, material: wallMat, openings: [{ from: 0.55, to: 3.95, bottom: 0, top: 2.42 }] });
  wall(g, { axis: 'z', at: 4.2, from: 4.6, to: 8.4, height: H, thick: 0.1, material: wallMat });
  wall(g, { axis: 'z', at: 5.6, from: 4.6, to: 8.4, height: H, thick: 0.1, material: wallMat });

  // Portes: marcs i fulles
  const doorMat = mat('#f4f1ea', { rough: 0.6 });
  const handleMat = metalM;
  for (const [key, [a, b]] of Object.entries(DOORS)) {
    // marcs
    box(0.04, doorTop, 0.14, doorMat, { x: a + 0.02, y: doorTop / 2, z: 4.6, parent: g });
    box(0.04, doorTop, 0.14, doorMat, { x: b - 0.02, y: doorTop / 2, z: 4.6, parent: g });
    box(b - a, 0.04, 0.14, doorMat, { x: (a + b) / 2, y: doorTop - 0.02, z: 4.6, parent: g });
    const w = b - a - 0.06;
    if (key === 'bany') {
      box(w, doorTop - 0.04, 0.04, doorMat, { x: (a + b) / 2, y: (doorTop - 0.04) / 2, z: 4.6, parent: g });
      cyl(0.01, 0.01, 0.12, handleMat, { x: b - 0.12, y: 1.0, z: 4.57, parent: g }).rotation.z = Math.PI / 2;
    } else {
      // fulla oberta cap a l'interior de l'habitació (90º)
      const leaf = box(0.04, doorTop - 0.04, w, doorMat, { x: a + 0.05, y: (doorTop - 0.04) / 2, z: 4.6 + 0.05 + w / 2, parent: g });
      void leaf;
      cyl(0.01, 0.01, 0.12, handleMat, { x: a + 0.1, y: 1.0, z: 4.6 + w - 0.05, parent: g }).rotation.z = Math.PI / 2;
    }
  }

  // --- Terrassa exterior
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 3.2), mat(null, { rough: 0.8, map: tileTexture('#d8ccb8', '#b9ad98', 2, 2, [10.6 / 1.2, 3.2 / 1.2], 31) }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(5, -0.005, -1.6 - 0.14);
  deck.receiveShadow = true;
  g.add(deck);
  box(10.6, 0.3, 3.2, mat('#ddd6ca'), { x: 5, y: -0.16, z: -1.74, parent: g });
  box(10.6, 0.5, 0.18, wallMat, { x: 5, y: 0.25, z: -3.25, parent: g });
  box(10.6, 0.9, 0.02, glass(), { x: 5, y: 0.95, z: -3.25, parent: g, cast: false });
  plant(g, 0.6, -2.7, 1.4, 81, p.terracotta);
  plant(g, 9.3, -2.6, 1.2, 82, p.terracotta);
  // gandula exterior
  box(1.9, 0.35, 0.8, mat('#e8e1d4', { rough: 0.9 }), { x: 3.2, y: 0.18, z: -2.2, parent: g, radius: 0.05 });
  box(0.9, 0.42, 0.8, mat('#e8e1d4', { rough: 0.9 }), { x: 6.8, y: 0.21, z: -2.3, parent: g, radius: 0.08 });

  // =========================================================================
  // SALA D'ESTAR
  // =========================================================================
  const fabric = mat(p.sofa, { rough: 0.95, map: fabricTexture(p.sofa, [4, 4], 13) });
  const accentFabric = mat(p.accent, { rough: 0.95, map: fabricTexture(p.accent, [4, 4], 14) });
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.012, 2.1), mat(p.rug, { rough: 1, map: fabricTexture(p.rug, [10, 10], 15) }));
  rug.position.set(1.65, 0.006, 2.95);
  rug.receiveShadow = true;
  g.add(rug);
  sofa(g, 1.65, 4.0, 0, 2.5, fabric, woodM, accentFabric);
  // butaca
  const arm = new THREE.Group();
  box(0.8, 0.2, 0.8, accentFabric, { y: 0.3, parent: arm, radius: 0.06 });
  box(0.8, 0.45, 0.16, accentFabric, { y: 0.6, z: 0.32, parent: arm, radius: 0.07 });
  box(0.14, 0.3, 0.8, accentFabric, { x: -0.33, y: 0.5, parent: arm, radius: 0.06 });
  box(0.14, 0.3, 0.8, accentFabric, { x: 0.33, y: 0.5, parent: arm, radius: 0.06 });
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    cyl(0.02, 0.015, 0.2, woodM, { x: dx * 0.32, y: 0.1, z: dz * 0.32, parent: arm, seg: 8 });
  arm.position.set(0.75, 0, 2.15);
  arm.rotation.y = -2.18;
  g.add(arm);
  // tauleta de centre de travertí
  const trav = mat(null, { rough: 0.4, map: travertineTexture('#e2d6c2', [1, 1], 17) });
  cyl(0.5, 0.5, 0.06, trav, { x: 1.75, y: 0.36, z: 2.85, parent: g, seg: 64 });
  cyl(0.28, 0.3, 0.33, trav, { x: 1.75, y: 0.165, z: 2.85, parent: g, seg: 48 });
  books(g, 1.55, 0.39, 2.75, 0.18, 'x', 7, ['#6b7341', '#efe7da', '#c06a43']);
  sphere(0.07, mat(p.terracotta, { rough: 0.6 }), { x: 1.95, y: 0.46, z: 2.95, sy: 1.3, parent: g });
  // llum de peu en arc
  cyl(0.15, 0.15, 0.03, metalM, { x: 0.25, y: 0.015, z: 4.3, parent: g });
  const arc = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.25, 0, 4.3), new THREE.Vector3(0.4, 2.6, 4.2), new THREE.Vector3(1.3, 1.95, 3.4)), 40, 0.012, 8),
    metalM
  );
  arc.castShadow = true;
  g.add(arc);
  const lampShade = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2b2a27', { rough: 0.5, side: THREE.DoubleSide }));
  lampShade.position.set(1.3, 1.95, 3.4);
  g.add(lampShade);
  const fl = new THREE.PointLight('#ffd3a0', 1.2, 5, 2);
  fl.position.set(1.3, 1.8, 3.4);
  lights.push(fl);
  g.add(fl);
  // quadre sobre el sofà (paret z = 4.55, mirant cap a -z)
  const a1 = artwork(g, 1.65, 1.6, 4.53, 1.0, 1.25, 'z', 3, p.art);
  a1.place(-1);
  // prestatgeria a la paret oest
  const shelfX = 0.25;
  for (const y of [0.0, 0.42, 0.84, 1.26, 1.68, 2.1]) box(0.34, 0.03, 1.05, woodM, { x: shelfX, y: y + 0.015, z: 4.0, parent: g });
  box(0.34, 2.13, 0.03, woodM, { x: shelfX, y: 1.065, z: 3.49, parent: g });
  box(0.34, 2.13, 0.03, woodM, { x: shelfX, y: 1.065, z: 4.52, parent: g });
  for (const [i, y] of [0.42, 0.84, 1.26, 1.68].entries())
    books(g, shelfX, y + 0.03, 3.55, 0.85 - i * 0.12, 'z', 30 + i, ['#efe7da', '#6b7341', '#c7b299', '#2b2a27', p.terracotta, '#d8cfc0']);
  cyl(0.08, 0.06, 0.2, mat(p.terracotta, { rough: 0.7 }), { x: shelfX, y: 0.13, z: 4.25, parent: g });
  // taula de menjador i cadires
  const tableTop = box(0.95, 0.05, 1.9, woodM, { x: 5.0, y: 0.745, z: 2.25, parent: g, radius: 0.015 });
  void tableTop;
  for (const [dx, dz] of [
    [-0.38, -0.85],
    [0.38, -0.85],
    [-0.38, 0.85],
    [0.38, 0.85],
  ])
    box(0.06, 0.72, 0.06, woodM, { x: 5.0 + dx, y: 0.36, z: 2.25 + dz, parent: g });
  const seatM = mat(p.linen, { rough: 0.95, map: fabricTexture(p.linen, [3, 3], 19) });
  for (const dz of [-0.55, 0, 0.55]) {
    chair(g, 4.4, 2.25 + dz, -Math.PI / 2, woodM, seatM);
    chair(g, 5.6, 2.25 + dz, Math.PI / 2, woodM, seatM);
  }
  // centre de taula
  cyl(0.18, 0.12, 0.09, mat('#efe7da', { rough: 0.4 }), { x: 5.0, y: 0.815, z: 2.25, parent: g });
  for (let i = 0; i < 3; i++) sphere(0.045, mat(['#d98c5f', '#e3b04b', '#c06a43'][i], { rough: 0.5 }), { x: 4.95 + i * 0.05, y: 0.88, z: 2.22 + (i % 2) * 0.06, parent: g });
  pendant(g, 5.0, 1.75, 1.9, metalM, lights);
  pendant(g, 5.0, 1.75, 2.6, metalM, lights);
  plant(g, 0.55, 0.6, 1.25, 83, p.terracotta);
  plant(g, 6.15, 0.55, 1.0, 84, '#efe7da');
  // cortines a la finestra oest
  curtain(g, 'z', 0, 0.9, 1.3, p.linen, 1);
  curtain(g, 'z', 0, 3.28, 3.46, p.linen, 1);

  // =========================================================================
  // CUINA
  // =========================================================================
  const cab = mat(p.cabinet, { rough: 0.55 });
  const counterM = mat(null, { rough: 0.3, map: travertineTexture(p.counter, [2, 1], 27) });
  // banc al llarg de la paret est (x = 10)
  box(0.62, 0.86, 3.8, cab, { x: 9.62, y: 0.43, z: 2.05, parent: g });
  box(0.66, 0.04, 3.8, counterM, { x: 9.6, y: 0.88, z: 2.05, parent: g });
  // portes dels mobles (línies)
  for (let i = 0; i < 6; i++) box(0.005, 0.78, 0.008, mat(p.metal, { rough: 0.6 }), { x: 9.305, y: 0.44, z: 0.15 + (3.8 / 6) * (i + 0.5) + 0.0, parent: g, cast: false });
  box(0.008, 0.012, 3.7, mat(p.metal, { rough: 0.4, metal: 0.8 }), { x: 9.3, y: 0.78, z: 2.05, parent: g, cast: false });
  // pica i aixeta
  box(0.42, 0.012, 0.55, mat('#bfc0bc', { rough: 0.25, metal: 0.8 }), { x: 9.6, y: 0.905, z: 2.2, parent: g });
  const tap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 24, Math.PI), metalM);
  tap.position.set(9.82, 1.02, 2.2);
  tap.rotation.y = Math.PI / 2;
  g.add(tap);
  cyl(0.014, 0.014, 0.14, metalM, { x: 9.82, y: 0.95, z: 2.32, parent: g });
  // placa de cocció
  box(0.52, 0.01, 0.6, mat('#1b1b1b', { rough: 0.15 }), { x: 9.6, y: 0.905, z: 3.4, parent: g });
  // frontal de rajola
  const zell = mat(null, { rough: 0.25, map: tileTexture('#e9e4d8', '#d3ccbf', 6, 6, [3.8 / 0.6, 0.62 / 0.6], 33, true) });
  const zellA = mat(null, { rough: 0.25, map: tileTexture('#e9e4d8', '#d3ccbf', 6, 6, [1.2 / 0.6, 0.62 / 0.6], 33, true) });
  box(0.02, 0.62, 1.2, zellA, { x: 9.93, y: 1.21, z: 0.75, parent: g, cast: false });
  box(0.02, 0.62, 0.95, zellA, { x: 9.93, y: 1.21, z: 3.475, parent: g, cast: false });
  box(0.02, 0.16, 1.65, zellA, { x: 9.93, y: 0.98, z: 2.175, parent: g, cast: false });
  // prestatges oberts
  for (const y of [1.6, 1.98]) {
    box(0.28, 0.035, 1.05, woodM, { x: 9.8, y, z: 0.75, parent: g });
    box(0.28, 0.035, 0.85, woodM, { x: 9.8, y, z: 3.5, parent: g });
  }
  const ceramic = [mat('#efe7da', { rough: 0.35 }), mat(p.terracotta, { rough: 0.45 }), mat(p.accent, { rough: 0.45 })];
  for (let i = 0; i < 4; i++) cyl(0.06, 0.045, 0.14, ceramic[i % 3], { x: 9.8, y: 1.69, z: 0.4 + i * 0.22, parent: g });
  for (let i = 0; i < 3; i++) cyl(0.1, 0.07, 0.06, ceramic[(i + 1) % 3], { x: 9.8, y: 2.03 + i * 0.05, z: 0.8, parent: g });
  for (let i = 0; i < 3; i++) cyl(0.05, 0.05, 0.2, mat('#d8d4c9', { rough: 0.2, transparent: true, opacity: 0.7 }), { x: 9.8, y: 1.72, z: 3.25 + i * 0.2, parent: g });
  // columnes (forn i nevera) a la paret z = 4.6
  box(1.6, 2.3, 0.62, cab, { x: 9.2, y: 1.15, z: 4.24, parent: g });
  box(0.6, 0.6, 0.01, mat('#1d1d1c', { rough: 0.1, metal: 0.3 }), { x: 9.0, y: 1.15, z: 3.925, parent: g, cast: false });
  for (const x of [8.8, 9.6]) box(0.006, 2.2, 0.01, mat(p.metal, { rough: 0.6 }), { x, y: 1.15, z: 3.928, parent: g, cast: false });
  box(0.012, 0.5, 0.02, metalM, { x: 9.68, y: 1.25, z: 3.915, parent: g });
  // moble baix + taulell a la paret z = 4.6 (x 6.75 - 8.4)
  box(1.65, 0.86, 0.62, cab, { x: 7.57, y: 0.43, z: 4.24, parent: g });
  box(1.65, 0.04, 0.66, counterM, { x: 7.57, y: 0.88, z: 4.22, parent: g });
  box(1.65, 0.62, 0.02, zell, { x: 7.57, y: 1.21, z: 4.54, parent: g, cast: false });
  cyl(0.1, 0.1, 0.25, mat('#2b2a27', { rough: 0.4, metal: 0.5 }), { x: 7.1, y: 1.03, z: 4.3, parent: g });
  box(0.4, 0.03, 0.28, woodM, { x: 7.8, y: 0.915, z: 4.3, parent: g });
  sphere(0.06, mat('#e3b04b', { rough: 0.5 }), { x: 7.75, y: 0.97, z: 4.28, parent: g });
  // illa
  box(0.85, 0.88, 1.9, cab, { x: 8.15, y: 0.44, z: 2.55, parent: g });
  box(1.05, 0.05, 2.0, counterM, { x: 8.05, y: 0.905, z: 2.55, parent: g });
  cyl(0.16, 0.1, 0.08, mat('#efe7da', { rough: 0.35 }), { x: 8.1, y: 0.97, z: 2.3, parent: g });
  for (let i = 0; i < 4; i++)
    sphere(0.04, mat(['#e3b04b', '#c06a43', '#86a04f', '#e3b04b'][i], { rough: 0.5 }), {
      x: 8.06 + (i % 2) * 0.07,
      y: 1.01 + (i > 1 ? 0.04 : 0),
      z: 2.27 + (i % 3) * 0.04,
      parent: g,
    });
  const vase = cyl(0.06, 0.08, 0.28, mat(p.terracotta, { rough: 0.7 }), { x: 8.1, y: 1.07, z: 3.0, parent: g });
  void vase;
  for (let i = 0; i < 5; i++) {
    const st = cyl(0.004, 0.004, 0.5, mat('#6d7a4a'), { x: 8.1 + (i - 2) * 0.03, y: 1.42, z: 3.0, parent: g, seg: 5 });
    st.rotation.z = (i - 2) * 0.15;
    sphere(0.035, mat('#8d9a5f'), { x: 8.1 + (i - 2) * 0.07, y: 1.66, z: 3.0, parent: g, seg: 8 });
  }
  // tamborets
  for (const dz of [1.95, 2.55, 3.15]) {
    cyl(0.17, 0.17, 0.05, woodM, { x: 7.42, y: 0.66, z: dz, parent: g });
    for (const [dx, ddz] of [
      [-0.1, -0.1],
      [0.1, -0.1],
      [-0.1, 0.1],
      [0.1, 0.1],
    ]) {
      const leg = cyl(0.012, 0.012, 0.66, metalM, { x: 7.42 + dx, y: 0.33, z: dz + ddz, parent: g, seg: 8 });
      leg.rotation.set(ddz * 0.6, 0, -dx * 0.6);
    }
  }
  pendant(g, 8.1, 1.7, 2.1, metalM, lights);
  pendant(g, 8.1, 1.7, 3.0, metalM, lights);
  plant(g, 6.95, 0.4, 0.8, 85, p.terracotta);

  // =========================================================================
  // DORMITORI PRINCIPAL
  // =========================================================================
  const rug2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 2.6), mat(p.rug, { rough: 1, map: fabricTexture(p.rug, [10, 10], 16) }));
  rug2.position.set(2.0, 0.006, 7.1);
  rug2.receiveShadow = true;
  g.add(rug2);
  bed(g, 2.0, 7.33, 0, 1.6, p, 1);
  nightstand(g, 0.78, 8.1, p, lights);
  nightstand(g, 3.28, 8.1, p, lights);
  const a2 = artwork(g, 2.0, 1.75, 8.33, 1.3, 0.75, 'z', 11, p.art);
  a2.place(-1);
  // armari encastat
  const wardrobe = mat('#f1ede5', { rough: 0.6 });
  box(2.6, 2.45, 0.6, wardrobe, { x: 1.4, y: 1.225, z: 4.95, parent: g });
  for (let i = 1; i < 4; i++) box(0.006, 2.35, 0.01, mat('#cfc8bb'), { x: 0.1 + (2.6 / 4) * i, y: 1.225, z: 5.255, parent: g, cast: false });
  for (let i = 0; i < 4; i++) box(0.012, 0.32, 0.02, woodM, { x: 0.1 + (2.6 / 4) * (i + 0.5) + (i % 2 === 0 ? 0.25 : -0.25), y: 1.1, z: 5.27, parent: g });
  // banqueta als peus del llit
  box(1.2, 0.42, 0.42, woodM, { x: 2.0, y: 0.21, z: 5.98, parent: g, radius: 0.02 });
  box(1.1, 0.06, 0.38, accentFabric, { x: 2.0, y: 0.45, z: 5.98, parent: g, radius: 0.02 });
  plant(g, 3.85, 7.9, 1.0, 86, p.terracotta);
  curtain(g, 'z', 0, 5.5, 5.75, p.linen, 1);
  curtain(g, 'z', 0, 7.45, 7.7, p.linen, 1);
  // mirall de peu
  box(0.55, 1.7, 0.03, woodM, { x: 3.95, y: 0.85, z: 5.6, parent: g, ry: -1.2 }).rotation.x = 0.06;

  // =========================================================================
  // SEGON DORMITORI
  // =========================================================================
  const rug3 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.012, 2.4), mat(p.rug, { rough: 1, map: fabricTexture(p.rug, [10, 10], 18) }));
  rug3.position.set(6.8, 0.006, 7.1);
  rug3.receiveShadow = true;
  g.add(rug3);
  bed(g, 6.7, 7.2, -Math.PI / 2, 1.35, { ...p, throwColor: p.accent }, 2);
  nightstand(g, 5.95, 6.12, p, lights);
  const a3 = artwork(g, 5.67, 1.7, 7.2, 0.6, 0.8, 'x', 21, p.art);
  a3.place(1);
  // escriptori sota la finestra
  box(0.6, 0.035, 1.5, woodM, { x: 9.65, y: 0.74, z: 6.7, parent: g });
  for (const dz of [-0.7, 0.7]) box(0.56, 0.72, 0.035, woodM, { x: 9.65, y: 0.36, z: 6.7 + dz, parent: g });
  const laptop = box(0.32, 0.012, 0.22, mat('#bfc0bc', { metal: 0.7, rough: 0.35 }), { x: 9.55, y: 0.765, z: 6.4, parent: g });
  laptop.rotation.y = 0.2;
  cyl(0.05, 0.06, 0.1, mat(p.terracotta, { rough: 0.7 }), { x: 9.7, y: 0.81, z: 7.25, parent: g });
  chair(g, 9.05, 6.7, -Math.PI / 2, woodM, seatM);
  // prestatgeria baixa a la paret sud
  box(1.6, 0.8, 0.38, mat('#efe9df', { rough: 0.6 }), { x: 8.8, y: 0.4, z: 8.14, parent: g });
  books(g, 8.1, 0.8, 8.15, 0.6, 'x', 51, ['#efe7da', '#6b7341', '#c7b299', '#2b2a27', p.terracotta]);
  plant(g, 9.35, 8.1, 0.5, 87, '#efe7da').position.y = 0.8;
  const a4 = artwork(g, 8.8, 1.65, 8.33, 0.7, 0.9, 'z', 27, p.art);
  a4.place(-1);
  curtain(g, 'z', 10, 5.55, 5.85, p.linen, -1);
  curtain(g, 'z', 10, 7.55, 7.85, p.linen, -1);

  // Bany (porta tancada; no forma part de la visita)

  // Sòcol a totes les estances per donar realisme
  const skirting = mat('#f6f2ea', { rough: 0.6 });
  const sk = (x0, z0, x1, z1) => {
    const t = 0.012;
    const hh = 0.08;
    box(x1 - x0, hh, t, skirting, { x: (x0 + x1) / 2, y: hh / 2, z: z0 + t / 2, parent: g, cast: false });
    box(x1 - x0, hh, t, skirting, { x: (x0 + x1) / 2, y: hh / 2, z: z1 - t / 2, parent: g, cast: false });
    box(t, hh, z1 - z0, skirting, { x: x0 + t / 2, y: hh / 2, z: (z0 + z1) / 2, parent: g, cast: false });
    box(t, hh, z1 - z0, skirting, { x: x1 - t / 2, y: hh / 2, z: (z0 + z1) / 2, parent: g, cast: false });
  };
  sk(0.07, 4.65, 4.15, 8.33);
  sk(5.65, 4.65, 9.93, 8.33);

  return { group: g, lights, windows: WINDOWS };
}

// Obertures a la façana per afegir llum d'àrea (llum de cel difusa entrant)
export const WINDOWS = [
  { pos: [3.2, 1.21, 0.05], size: [4.8, 2.42], look: [3.2, 1.21, 2] },
  { pos: [8.3, 1.63, 0.05], size: [2.2, 1.23], look: [8.3, 1.63, 2] },
  { pos: [0.05, 1.42, 2.3], size: [2.2, 1.75], look: [2, 1.42, 2.3] },
  { pos: [0.05, 1.5, 6.6], size: [1.8, 1.6], look: [2, 1.5, 6.6] },
  { pos: [9.95, 1.63, 2.17], size: [1.65, 1.14], look: [8, 1.63, 2.17] },
  { pos: [9.95, 1.5, 6.7], size: [1.8, 1.6], look: [8, 1.5, 6.7] },
];
