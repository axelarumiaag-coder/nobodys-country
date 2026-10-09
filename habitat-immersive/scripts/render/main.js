// Pipeline de render: escenes procedurals -> fotografies en perspectiva i panoràmiques equirectangulars 360°.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { sky, landscape, setMaxAnisotropy } from './lib.js';
import { buildApartment, WINDOWS } from './apartment.js';
import { buildExterior } from './exteriors.js';

RectAreaLightUniformsLib.init();

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

const TIMES = {
  day: {
    sunDir: [-0.42, 0.62, -0.66],
    sun: '#fff1dc',
    sunI: 3.4,
    hemiSky: '#dfe9f2',
    hemiGround: '#bba486',
    hemiI: 0.55,
    skyTop: '#6f9cc4',
    skyHorizon: '#eee6d6',
    exposure: 0.95,
    area: 2.2,
  },
  golden: {
    sunDir: [-0.75, 0.22, -0.62],
    sun: '#ffbe7d',
    sunI: 3.6,
    hemiSky: '#f0d9c0',
    hemiGround: '#a88d6c',
    hemiI: 0.45,
    skyTop: '#7f98b5',
    skyHorizon: '#f6c995',
    exposure: 1.0,
    area: 1.6,
  },
  soft: {
    sunDir: [0.35, 0.75, -0.55],
    sun: '#fff6ea',
    sunI: 2.2,
    hemiSky: '#e6ecf0',
    hemiGround: '#c0ad92',
    hemiI: 0.75,
    skyTop: '#9bb4c9',
    skyHorizon: '#eef0ee',
    exposure: 1.0,
    area: 2.6,
  },
};

/** Construeix una escena completa a partir d'una especificació */
function buildScene(spec) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const t = TIMES[spec.time || 'day'];
  const sunDir = new THREE.Vector3(...t.sunDir).normalize();
  let center = new THREE.Vector3(5, 0, 4);
  let shadowSize = 10;
  let interior = false;

  if (spec.type === 'apartment') {
    const apt = buildApartment(spec.palette);
    root.add(apt.group);
    interior = true;
    for (const w of WINDOWS) {
      const l = new THREE.RectAreaLight(t.hemiSky, t.area, w.size[0], w.size[1]);
      l.position.set(...w.pos);
      l.lookAt(...w.look);
      root.add(l);
    }
    landscape(root, { sea: true, center: new THREE.Vector3(5, 0, 4) });
  } else {
    const ext = buildExterior(spec, t);
    root.add(ext.group);
    center = ext.center || center;
    shadowSize = ext.shadowSize || 30;
    interior = !!ext.interior;
    if (ext.areaLights)
      for (const a of ext.areaLights) {
        const l = new THREE.RectAreaLight(t.hemiSky, t.area * (a.k || 1), a.size[0], a.size[1]);
        l.position.set(...a.pos);
        l.lookAt(...a.look);
        root.add(l);
      }
  }

  scene.fog = new THREE.Fog(t.skyHorizon, 80, 520);
  sky(root, { top: t.skyTop, horizon: t.skyHorizon, sunDir, sunColor: t.sun });
  const hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemiI * (interior ? 1 : 1.4));
  root.add(hemi);
  const sun = new THREE.DirectionalLight(t.sun, t.sunI);
  sun.position.copy(center).addScaledVector(sunDir, 60);
  sun.target.position.copy(center);
  root.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -shadowSize;
  sc.right = sc.top = shadowSize;
  sc.near = 1;
  sc.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  root.add(sun);

  return { scene, root, exposure: t.exposure * (spec.exposure || 1), interior };
}

/** Il·luminació indirecta aproximada: mapa d'entorn capturat des del punt de vista */
const pmrem = new THREE.PMREMGenerator(renderer);
function bakeEnvironment(ctx, pos) {
  const { scene, root } = ctx;
  root.position.set(-pos[0], -pos[1], -pos[2]);
  root.updateMatrixWorld(true);
  renderer.toneMappingExposure = 1;
  const rt = pmrem.fromScene(scene, 0.04, 0.05, 600);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  scene.environment = rt.texture;
  scene.environmentIntensity = ctx.interior ? 0.9 : 0.6;
}

function makeComposer(scene, camera, w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, w, h);
  ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  ao.blendIntensity = 0.95;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  return {
    composer,
    dispose: () => {
      rt.dispose();
      composer.dispose();
      ao.dispose();
    },
  };
}

function jpeg(quality = 0.86) {
  return canvas.toDataURL('image/jpeg', quality);
}
function downscale(w, h, quality = 0.84) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(canvas, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

/** Fotografia en perspectiva */
async function renderPerspective(job) {
  const ctx = buildScene(job.scene);
  const w = job.width || 1600;
  const h = job.height || 1067;
  renderer.setSize(w, h, false);
  const camera = new THREE.PerspectiveCamera(job.fov || 62, w / h, 0.05, 900);
  camera.position.set(...job.pos);
  camera.lookAt(...job.target);
  bakeEnvironment(ctx, job.pos);
  renderer.toneMappingExposure = ctx.exposure;
  const { composer, dispose } = makeComposer(ctx.scene, camera, w, h);
  composer.render();
  const out = { full: jpeg(0.86) };
  if (job.thumb) out.thumb = downscale(job.thumb[0], job.thumb[1]);
  dispose();
  disposeScene(ctx.scene);
  return out;
}

const FACES = [
  { f: [1, 0, 0], u: [0, 1, 0] },
  { f: [-1, 0, 0], u: [0, 1, 0] },
  { f: [0, 1, 0], u: [0, 0, 1] },
  { f: [0, -1, 0], u: [0, 0, -1] },
  { f: [0, 0, 1], u: [0, 1, 0] },
  { f: [0, 0, -1], u: [0, 1, 0] },
];
const TAN = 1.25; // marge per evitar costures de l'oclusió ambiental a les vores

/** Panoràmica equirectangular 2:1 renderitzada des d'un punt */
async function renderPanorama(job) {
  const ctx = buildScene(job.scene);
  const face = job.face || 1600;
  const pos = new THREE.Vector3(...job.pos);
  bakeEnvironment(ctx, job.pos);
  renderer.toneMappingExposure = ctx.exposure;
  renderer.setSize(face, face, false);
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(TAN) * 180) / Math.PI, 1, 0.05, 900);
  const { composer, dispose } = makeComposer(ctx.scene, camera, face, face);
  composer.renderToScreen = false;

  const copyScene = new THREE.Scene();
  const copyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const copyMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tex, vUv); }',
    depthTest: false,
    depthWrite: false,
  });
  copyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat));

  const faceTargets = [];
  const basis = [];
  for (const F of FACES) {
    const f = new THREE.Vector3(...F.f);
    const u = new THREE.Vector3(...F.u);
    camera.position.copy(pos);
    camera.up.copy(u);
    camera.lookAt(pos.clone().add(f));
    camera.updateMatrixWorld(true);
    const r = new THREE.Vector3().crossVectors(f, u);
    composer.render();
    const target = new THREE.WebGLRenderTarget(face, face, { type: THREE.UnsignedByteType, generateMipmaps: false });
    copyMat.uniforms.tex.value = composer.readBuffer.texture;
    renderer.setRenderTarget(target);
    renderer.render(copyScene, copyCam);
    renderer.setRenderTarget(null);
    faceTargets.push(target);
    basis.push({ f, u, r });
  }
  dispose();

  const W = job.width || 4096;
  const Hh = W / 2;
  renderer.setSize(W, Hh, false);
  const uniforms = { tanH: { value: TAN } };
  for (let i = 0; i < 6; i++) {
    uniforms[`t${i}`] = { value: faceTargets[i].texture };
    uniforms[`f${i}`] = { value: basis[i].f };
    uniforms[`u${i}`] = { value: basis[i].u };
    uniforms[`r${i}`] = { value: basis[i].r };
  }
  const decl = [0, 1, 2, 3, 4, 5].map((i) => `uniform sampler2D t${i}; uniform vec3 f${i}; uniform vec3 u${i}; uniform vec3 r${i};`).join('\n');
  const pick = [0, 1, 2, 3, 4, 5]
    .map((i) => `{ float k = dot(d, f${i}); if (k > best) { best = k; vec2 p = vec2(dot(d, r${i}), dot(d, u${i})) / k / tanH; col = texture2D(t${i}, p * 0.5 + 0.5).rgb; } }`)
    .join('\n');
  const eqMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      ${decl}
      uniform float tanH;
      varying vec2 vUv;
      void main(){
        float lon = vUv.x * 6.28318530718;
        float th = (1.0 - vUv.y) * 3.14159265359;
        vec3 d = vec3(cos(lon) * sin(th), cos(th), sin(lon) * sin(th));
        float best = -2.0; vec3 col = vec3(0.0);
        ${pick}
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const eqScene = new THREE.Scene();
  eqScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), eqMat));
  renderer.setRenderTarget(null);
  renderer.render(eqScene, copyCam);
  const out = { full: jpeg(0.88), preview: downscale(1024, 512, 0.8) };
  for (const t of faceTargets) t.dispose();
  eqMat.dispose();
  disposeScene(ctx.scene);
  return out;
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) m.dispose();
    }
  });
  if (scene.environment) scene.environment.dispose();
}

window.HI = { renderPerspective, renderPanorama };
window.HI_READY = true;
