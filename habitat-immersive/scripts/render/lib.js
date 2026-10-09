// Biblioteca compartida del generador: textures procedurals, materials i peces bàsiques.
// Tot es genera amb codi; no es carrega cap imatge externa.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------------------
// Generador pseudoaleatori determinista (les imatges surten sempre iguals)
// ---------------------------------------------------------------------------
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const texCache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(v) {
  maxAniso = v;
}

function canvasTexture(key, w, h, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const k = `${key}|${repeat.join(',')}`;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}
function shade([r, g, b], f) {
  const cl = (v) => Math.max(0, Math.min(255, v));
  return `rgb(${cl(r * f) | 0},${cl(g * f) | 0},${cl(b * f) | 0})`;
}

function speckle(g, w, h, amount, alpha, seed) {
  const r = rng(seed);
  for (let i = 0; i < amount; i++) {
    const v = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

// Parquet de roure en llistons
export function woodTexture(base = '#b88a5a', repeat = [1, 1], seed = 3) {
  return canvasTexture(
    `wood${base}${seed}`,
    1024,
    1024,
    (g, w, h) => {
      const rgb = hexToRgb(base);
      const r = rng(seed);
      const plankH = h / 10;
      for (let row = 0; row < 10; row++) {
        let x = -r() * w * 0.5;
        while (x < w) {
          const len = w * (0.35 + r() * 0.45);
          const f = 0.93 + r() * 0.12;
          g.fillStyle = shade(rgb, f);
          g.fillRect(x, row * plankH, len, plankH);
          // veta
          for (let k = 0; k < 14; k++) {
            const y = row * plankH + r() * plankH;
            g.strokeStyle = `rgba(60,35,15,${0.04 + r() * 0.08})`;
            g.lineWidth = 0.6 + r() * 1.6;
            g.beginPath();
            g.moveTo(x, y);
            g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 8, x + len * 0.6, y + (r() - 0.5) * 8, x + len, y + (r() - 0.5) * 4);
            g.stroke();
          }
          g.fillStyle = 'rgba(40,25,10,0.35)';
          g.fillRect(x, row * plankH, 1.5, plankH);
          x += len;
        }
        g.fillStyle = 'rgba(40,25,10,0.3)';
        g.fillRect(0, row * plankH, w, 1.5);
      }
    },
    { repeat }
  );
}

// Arrebossat / pintura amb una mica de textura
export function plasterTexture(base = '#efe9df', repeat = [1, 1], seed = 5) {
  return canvasTexture(
    `plaster${base}${seed}`,
    512,
    512,
    (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const r = rng(seed);
      for (let i = 0; i < 260; i++) {
        const v = r() > 0.5 ? 255 : 0;
        g.fillStyle = `rgba(${v},${v},${v},${0.004 + r() * 0.008})`;
        g.beginPath();
        g.arc(r() * w, r() * h, 8 + r() * 40, 0, Math.PI * 2);
        g.fill();
      }
      speckle(g, w, h, 6000, 0.05, seed + 1);
    },
    { repeat }
  );
}

// Rajola (cuina, bany, terrassa)
export function tileTexture(base = '#d9d2c5', grout = '#bdb4a6', cols = 4, rows = 4, repeat = [1, 1], seed = 7, zellige = false) {
  return canvasTexture(
    `tile${base}${grout}${cols}${rows}${seed}${zellige}`,
    1024,
    1024,
    (g, w, h) => {
      g.fillStyle = grout;
      g.fillRect(0, 0, w, h);
      const rgb = hexToRgb(base);
      const r = rng(seed);
      const tw = w / cols;
      const th = h / rows;
      const gap = 5;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const f = zellige ? 0.84 + r() * 0.3 : 0.95 + r() * 0.08;
          g.fillStyle = shade(rgb, f);
          g.fillRect(x * tw + gap / 2, y * th + gap / 2, tw - gap, th - gap);
          if (zellige) {
            const grd = g.createRadialGradient(x * tw + tw * r(), y * th + th * r(), 2, x * tw + tw / 2, y * th + th / 2, tw * 0.7);
            grd.addColorStop(0, 'rgba(255,255,255,0.18)');
            grd.addColorStop(1, 'rgba(0,0,0,0.08)');
            g.fillStyle = grd;
            g.fillRect(x * tw + gap / 2, y * th + gap / 2, tw - gap, th - gap);
          }
        }
      speckle(g, w, h, 5000, 0.04, seed + 2);
    },
    { repeat }
  );
}

// Pedra (façana de masia)
export function stoneTexture(base = '#b9a48a', repeat = [1, 1], seed = 11) {
  return canvasTexture(
    `stone${base}${seed}`,
    1024,
    1024,
    (g, w, h) => {
      g.fillStyle = '#d6cab6';
      g.fillRect(0, 0, w, h);
      const rgb = hexToRgb(base);
      const r = rng(seed);
      let y = 0;
      while (y < h) {
        const rowH = 34 + r() * 30;
        let x = -r() * 60;
        while (x < w) {
          const sw = 45 + r() * 80;
          g.fillStyle = shade(rgb, 0.88 + r() * 0.2);
          g.beginPath();
          const rx = sw / 2 - 4;
          const ry = rowH / 2 - 4;
          g.ellipse(x + sw / 2, y + rowH / 2, rx, ry, (r() - 0.5) * 0.2, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(60,45,30,0.12)';
          g.lineWidth = 2;
          g.stroke();
          x += sw;
        }
        y += rowH;
      }
      speckle(g, w, h, 12000, 0.08, seed + 3);
    },
    { repeat }
  );
}

// Teixit (sofà, llit)
export function fabricTexture(base = '#d8cfc0', repeat = [1, 1], seed = 13) {
  return canvasTexture(
    `fabric${base}${seed}`,
    256,
    256,
    (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const r = rng(seed);
      for (let y = 0; y < h; y += 2) {
        g.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.03})`;
        g.fillRect(0, y, w, 1);
      }
      for (let x = 0; x < w; x += 2) {
        g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
        g.fillRect(x, 0, 1, h);
      }
    },
    { repeat }
  );
}

// Travertí / marbre suau
export function travertineTexture(base = '#e2d6c2', repeat = [1, 1], seed = 17) {
  return canvasTexture(
    `trav${base}${seed}`,
    512,
    512,
    (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const r = rng(seed);
      for (let i = 0; i < 90; i++) {
        g.strokeStyle = `rgba(120,95,60,${0.03 + r() * 0.07})`;
        g.lineWidth = 1 + r() * 3;
        const y = r() * h;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4 + (r() - 0.5) * 3);
        g.stroke();
      }
      speckle(g, w, h, 3000, 0.08, seed + 5);
    },
    { repeat }
  );
}

// Quadre abstracte per a les parets
export function artTexture(seed = 1, palette = ['#c7b299', '#6b7341', '#d98c5f', '#2b2a27', '#efe7da']) {
  return canvasTexture(`art${seed}${palette.join('')}`, 512, 640, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = palette[4];
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = palette[Math.floor(r() * 4)];
      g.globalAlpha = 0.85;
      if (r() > 0.5) {
        g.beginPath();
        g.arc(w * (0.2 + r() * 0.6), h * (0.2 + r() * 0.6), w * (0.12 + r() * 0.25), 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(w * r() * 0.6, h * r() * 0.7, w * (0.2 + r() * 0.4), h * (0.1 + r() * 0.3));
      }
    }
    g.globalAlpha = 1;
    speckle(g, w, h, 3000, 0.06, seed + 9);
  });
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
export function mat(color, { rough = 0.8, metal = 0, map = null, emissive = null, emissiveIntensity = 1, transparent = false, opacity = 1, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : color || 0xffffff,
    roughness: rough,
    metalness: metal,
    map,
    transparent,
    opacity,
    side,
  });
  if (emissive) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = emissiveIntensity;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Peces de construcció
// ---------------------------------------------------------------------------
export function box(w, h, d, material, { x = 0, y = 0, z = 0, cast = true, receive = true, radius = 0, parent = null, ry = 0 } = {}) {
  const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2) * 0.999) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

export function cyl(rt, rb, h, material, { x = 0, y = 0, z = 0, seg = 40, cast = true, parent = null } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function sphere(r, material, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, parent = null, seg = 24 } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)), material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/**
 * Paret recta amb obertures (portes/finestres).
 * axis 'x': la paret corre al llarg de X a la coordenada z=at. axis 'z': corre al llarg de Z a x=at.
 * openings: [{ from, to, bottom, top }]
 */
export function wall(group, { axis, at, from, to, height, thick = 0.14, material, openings = [] }) {
  const ops = [...openings].sort((a, b) => a.from - b.from);
  const place = (a0, a1, y0, y1) => {
    if (a1 - a0 < 0.001 || y1 - y0 < 0.001) return;
    const len = a1 - a0;
    const mid = (a0 + a1) / 2;
    const hy = y1 - y0;
    if (axis === 'x') box(len, hy, thick, material, { x: mid, y: y0 + hy / 2, z: at, parent: group });
    else box(thick, hy, len, material, { x: at, y: y0 + hy / 2, z: mid, parent: group });
  };
  let cur = from;
  for (const o of ops) {
    place(cur, o.from, 0, height);
    place(o.from, o.to, 0, o.bottom);
    place(o.from, o.to, o.top, height);
    cur = o.to;
  }
  place(cur, to, 0, height);
}

/** Finestra amb marc fi i vidre */
export function windowFrame(group, { axis, at, from, to, bottom, top, frameMat, glassMat, mullions = 1 }) {
  const t = 0.05;
  const len = to - from;
  const h = top - bottom;
  const mk = (w, hh, d, x, y, z) => box(w, hh, d, frameMat, { x, y, z, parent: group, cast: true });
  if (axis === 'x') {
    const mid = (from + to) / 2;
    mk(len, t, 0.1, mid, bottom + t / 2, at);
    mk(len, t, 0.1, mid, top - t / 2, at);
    mk(t, h, 0.1, from + t / 2, bottom + h / 2, at);
    mk(t, h, 0.1, to - t / 2, bottom + h / 2, at);
    for (let i = 1; i <= mullions; i++) mk(t * 0.8, h, 0.08, from + (len * i) / (mullions + 1), bottom + h / 2, at);
    const gl = box(len, h, 0.01, glassMat, { x: mid, y: bottom + h / 2, z: at, parent: group, cast: false, receive: false });
    gl.renderOrder = 2;
  } else {
    const mid = (from + to) / 2;
    mk(0.1, t, len, at, bottom + t / 2, mid);
    mk(0.1, t, len, at, top - t / 2, mid);
    mk(0.1, h, t, at, bottom + h / 2, from + t / 2);
    mk(0.1, h, t, at, bottom + h / 2, to - t / 2);
    for (let i = 1; i <= mullions; i++) mk(0.08, h, t * 0.8, at, bottom + h / 2, from + (len * i) / (mullions + 1));
    const gl = box(0.01, h, len, glassMat, { x: at, y: bottom + h / 2, z: mid, parent: group, cast: false, receive: false });
    gl.renderOrder = 2;
  }
}

export function glass() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xeef4f2,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------------------
// Cel i paisatge exterior
// ---------------------------------------------------------------------------
export function sky(scene, { top = '#7fa7c9', horizon = '#f3e6d0', ground = '#c9b89a', sunDir = new THREE.Vector3(0.5, 0.6, 0.6), sunColor = '#fff1d6', radius = 400 } = {}) {
  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      ground: { value: new THREE.Color(ground) },
      sunDir: { value: sunDir.clone().normalize() },
      sunColor: { value: new THREE.Color(sunColor) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.65, h), 0.8)) : mix(horizon, ground, smoothstep(0.0, 0.08, -h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/** Mar i turons llunyans, vistos per les finestres */
export function landscape(scene, { sea = true, hillColor = '#9d9e84', seaColor = '#4f7f95', center = new THREE.Vector3(5, 0, 4), seed = 21, y = 0 } = {}) {
  const g = new THREE.Group();
  g.position.y = y;
  const r = rng(seed);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), mat('#b8a888', { rough: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, -9.5, center.z);
  g.add(ground);
  if (sea) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(800, 300), new THREE.MeshStandardMaterial({ color: seaColor, roughness: 0.25, metalness: 0.1 }));
    s.rotation.x = -Math.PI / 2;
    s.position.set(center.x, -9.4, center.z - 190);
    g.add(s);
  }
  // turons
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3;
    if (sea && Math.sin(a) < -0.2) continue;
    const dist = 260 + r() * 90;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(50 + r() * 40, 24, 12), mat(hillColor, { rough: 1 }));
    hill.scale.set(1.8, 0.28 + r() * 0.2, 1);
    hill.position.set(center.x + Math.cos(a) * dist, -14, center.z + Math.sin(a) * dist);
    g.add(hill);
  }
  // pins i xiprers propers (sota l'habitatge, a la planta baixa)
  const pine = mat('#4f5a37', { rough: 0.95 });
  const trunk = mat('#6b5440', { rough: 1 });
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const dist = 22 + r() * 50;
    const x = center.x + Math.cos(a) * dist;
    const z = center.z + Math.sin(a) * dist;
    if (sea && z < center.z - 30) continue;
    const t = r();
    const tg = new THREE.Group();
    if (t > 0.5) {
      cyl(0.25, 0.35, 6, trunk, { y: 3, parent: tg });
      sphere(3.4, pine, { y: 7.5, sy: 0.45, parent: tg });
      sphere(2.4, pine, { x: 1.5, y: 7.1, sy: 0.4, parent: tg });
    } else {
      sphere(1.1, pine, { y: 4.5, sy: 4.2, parent: tg, seg: 16 });
    }
    tg.position.set(x, -9.5, z);
    g.add(tg);
  }
  scene.add(g);
  return g;
}
