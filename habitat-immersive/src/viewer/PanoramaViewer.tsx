// Visor panoràmic 360° amb Three.js.
// - Cada estança és una imatge equirectangular aplicada a l'interior d'una esfera.
// - La càmera és al centre; arrossegar canvia yaw/pitch, la roda o el pessic canvien el camp de visió.
// - Les transicions entre estances fan un petit "avanç" cap al punt i un fos encadenat entre esferes.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import type { TourScene } from '../data/tours';
import { clamp, shortestDelta, viewToVector, wrapDeg } from '../lib/sphere';
import { Icon } from '../components/Icon';

export interface ViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  rotate(deltaYaw: number): void;
}

export type ViewerStatus = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

interface Props {
  scene: TourScene;
  onNavigate: (to: string) => void;
  onStatus?: (s: ViewerStatus) => void;
  onView?: (yaw: number, pitch: number, fov: number) => void;
  onFirstInteraction?: () => void;
  reducedMotion?: boolean;
  /** Incrementar per tornar a intentar la càrrega després d'un error */
  retryKey?: number;
}

const FOV_DEFAULT = 78;
const FOV_MIN = 30;
const FOV_MAX = 100;
const PITCH_LIMIT = 85;
const RADIUS = 50;

type Tween = { start: number; dur: number; update: (t: number) => void; done?: () => void };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const PanoramaViewer = forwardRef<ViewerHandle, Props>(function PanoramaViewer(
  { scene, onNavigate, onStatus, onView, onFirstInteraction, reducedMotion = false, retryKey = 0 },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const hotspotEls = useRef(new Map<string, HTMLButtonElement>());
  const [shownScene, setShownScene] = useState<TourScene | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);

  // Estat mutable del motor (no provoca renders de React)
  const S = useRef({
    renderer: null as THREE.WebGLRenderer | null,
    scene3: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(FOV_DEFAULT, 1, 0.1, 200),
    current: null as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null,
    incoming: null as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null,
    yaw: 0,
    pitch: 0,
    fov: FOV_DEFAULT,
    vYaw: 0,
    vPitch: 0,
    dragging: false,
    interacted: false,
    autoRotate: true,
    tweens: [] as Tween[],
    dirty: true,
    textures: new Map<string, THREE.Texture>(),
    loader: new THREE.TextureLoader(),
    maxTex: 4096,
    shownId: '' as string,
    pendingLink: null as null | { yaw: number; pitch: number },
    raf: 0,
    lastViewEmit: '',
  });

  const props = useRef({ onNavigate, onStatus, onView, onFirstInteraction, reducedMotion });
  props.current = { onNavigate, onStatus, onView, onFirstInteraction, reducedMotion };

  const markInteracted = useCallback(() => {
    const s = S.current;
    s.autoRotate = false;
    if (!s.interacted) {
      s.interacted = true;
      props.current.onFirstInteraction?.();
    }
  }, []);

  const addTween = (dur: number, update: (t: number) => void, done?: () => void) => {
    S.current.tweens.push({ start: performance.now(), dur: Math.max(1, dur), update, done });
    S.current.dirty = true;
  };

  // ---------------------------------------------------------------------------
  // Inicialització del renderitzador
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const s = S.current;
    const host = canvasHost.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    } catch {
      props.current.onStatus?.({
        state: 'error',
        message: 'El teu navegador no admet WebGL, necessari per a la visita 360°. Prova-ho amb una versió recent de Chrome, Firefox, Safari o Edge.',
      });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'viewer__canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);
    s.renderer = renderer;
    s.maxTex = renderer.capabilities.maxTextureSize;

    const geo = new THREE.SphereGeometry(RADIUS, 96, 64);
    geo.scale(-1, 1, 1);
    const mk = (r: number) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false }));
      m.scale.setScalar(r);
      return m;
    };
    s.current = mk(1);
    s.current.visible = false;
    s.incoming = mk(0.98);
    s.incoming.visible = false;
    s.incoming.renderOrder = 1;
    s.scene3.add(s.current, s.incoming);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      s.camera.aspect = w / h;
      s.camera.updateProjectionMatrix();
      s.dirty = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const tmp = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    let last = performance.now();
    const loop = (now: number) => {
      s.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // animacions
      if (s.tweens.length) {
        s.tweens = s.tweens.filter((tw) => {
          const t = clamp((now - tw.start) / tw.dur, 0, 1);
          tw.update(ease(t));
          if (t >= 1) {
            tw.done?.();
            return false;
          }
          return true;
        });
        s.dirty = true;
      }
      // inèrcia
      if (!s.dragging && (Math.abs(s.vYaw) > 0.01 || Math.abs(s.vPitch) > 0.01)) {
        s.yaw += s.vYaw * dt;
        s.pitch = clamp(s.pitch + s.vPitch * dt, -PITCH_LIMIT, PITCH_LIMIT);
        const k = Math.pow(0.04, dt);
        s.vYaw *= k;
        s.vPitch *= k;
        s.dirty = true;
      }
      if (s.autoRotate && !props.current.reducedMotion && s.current?.visible && !s.tweens.length) {
        s.yaw += 2.2 * dt;
        s.dirty = true;
      }
      if (!s.dirty) return;
      s.dirty = false;

      const [x, y, z] = viewToVector(s.yaw, s.pitch);
      s.camera.fov = s.fov;
      s.camera.updateProjectionMatrix();
      s.camera.position.set(0, 0, 0);
      s.camera.lookAt(x, y, z);
      s.camera.updateMatrixWorld();
      renderer.render(s.scene3, s.camera);

      // posició dels punts de navegació (elements DOM sobre el canvas)
      const w = host.clientWidth;
      const h = host.clientHeight;
      s.camera.getWorldDirection(fwd);
      hotspotEls.current.forEach((el) => {
        const yaw = Number(el.dataset.yaw);
        const pitch = Number(el.dataset.pitch);
        const v = viewToVector(yaw, pitch);
        tmp.set(v[0], v[1], v[2]);
        const facing = tmp.dot(fwd);
        tmp.multiplyScalar(10).project(s.camera);
        const visible = facing > 0.15 && Math.abs(tmp.x) < 1.25 && Math.abs(tmp.y) < 1.25;
        const sx = ((tmp.x + 1) / 2) * w;
        const sy = ((1 - tmp.y) / 2) * h;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.classList.toggle('is-hidden', !visible);
        el.tabIndex = visible ? 0 : -1;
      });

      const yawN = wrapDeg(s.yaw);
      const key = `${yawN.toFixed(1)}|${s.pitch.toFixed(1)}|${s.fov.toFixed(1)}`;
      if (key !== s.lastViewEmit) {
        s.lastViewEmit = key;
        props.current.onView?.(yawN, s.pitch, s.fov);
        const hostEl = hostRef.current;
        if (hostEl) {
          hostEl.dataset.yaw = yawN.toFixed(1);
          hostEl.dataset.pitch = s.pitch.toFixed(1);
          hostEl.dataset.fov = s.fov.toFixed(1);
        }
      }
    };
    s.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      s.textures.forEach((t) => t.dispose());
      s.textures.clear();
      geo.dispose();
      s.current?.material.dispose();
      s.incoming?.material.dispose();
      s.scene3.clear();
      renderer.dispose();
      renderer.domElement.remove();
      s.renderer = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Càrrega de textures
  // ---------------------------------------------------------------------------
  const loadTexture = useCallback((url: string) => {
    const s = S.current;
    const cached = s.textures.get(url);
    if (cached) return Promise.resolve(cached);
    return new Promise<THREE.Texture>((resolve, reject) => {
      s.loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, s.renderer?.capabilities.getMaxAnisotropy() ?? 1);
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          s.textures.set(url, tex);
          resolve(tex);
        },
        undefined,
        () => reject(new Error(url))
      );
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Canvi d'estança
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const s = S.current;
    if (!s.renderer || !s.current || !s.incoming) return;
    let cancelled = false;
    const first = !s.current.visible;
    const rm = props.current.reducedMotion;
    props.current.onStatus?.({ state: 'loading' });
    setNavigating(scene.id);

    // Mentre carrega: avançar lleugerament cap al punt clicat (efecte "caminar")
    const link = s.pendingLink;
    s.pendingLink = null;
    if (!first && link && !rm) {
      const y0 = s.yaw;
      const p0 = s.pitch;
      const f0 = s.fov;
      const dy = shortestDelta(wrapDeg(y0), link.yaw);
      addTween(650, (t) => {
        s.yaw = y0 + dy * t;
        s.pitch = p0 + (clamp(link.pitch * 0.4, -20, 10) - p0) * t;
        s.fov = f0 + (Math.max(FOV_MIN + 10, f0 - 22) - f0) * t;
      });
    }

    const big = scene.full;
    const useFull = s.maxTex >= 4096;
    loadTexture(scene.preview)
      .catch(() => (useFull ? loadTexture(big) : Promise.reject(new Error('preview'))))
      .then((tex) => {
        if (cancelled) return;
        const finish = () => {
          s.shownId = scene.id;
          setShownScene(scene);
          setNavigating(null);
          if (hostRef.current) hostRef.current.dataset.scene = scene.id;
          props.current.onStatus?.({ state: 'ready' });
          // Substitueix per la versió d'alta resolució quan arribi
          if (useFull) {
            loadTexture(big)
              .then((hi) => {
                if (s.shownId === scene.id && s.current) {
                  s.current.material.map = hi;
                  s.current.material.needsUpdate = true;
                  s.dirty = true;
                  if (hostRef.current) hostRef.current.dataset.hires = scene.id;
                }
              })
              .catch(() => {
                /* ens quedem amb la previsualització */
              });
          }
        };
        if (first) {
          s.current!.material.map = tex;
          s.current!.material.needsUpdate = true;
          s.current!.material.opacity = 1;
          s.current!.visible = true;
          s.yaw = scene.initialView.yaw;
          s.pitch = scene.initialView.pitch;
          s.fov = FOV_DEFAULT;
          s.dirty = true;
          finish();
          return;
        }
        // fos encadenat cap a la nova esfera
        const inc = s.incoming!;
        inc.material.map = tex;
        inc.material.needsUpdate = true;
        inc.material.opacity = 0;
        inc.visible = true;
        const fStart = s.fov;
        addTween(
          rm ? 180 : 700,
          (t) => {
            inc.material.opacity = t;
            if (!rm) s.fov = fStart + (FOV_DEFAULT - fStart) * t;
          },
          () => {
            s.current!.material.map = tex;
            s.current!.material.needsUpdate = true;
            inc.visible = false;
            inc.material.opacity = 0;
            if (rm) s.fov = FOV_DEFAULT;
            finish();
          }
        );
      })
      .catch(() => {
        if (cancelled) return;
        setNavigating(null);
        props.current.onStatus?.({ state: 'error', message: `No s'ha pogut carregar la panoràmica de «${scene.name}». Comprova la connexió o torna-ho a provar.` });
      });
    return () => {
      cancelled = true;
    };
  }, [scene, loadTexture, retryKey]);

  // Precàrrega de les estances veïnes per fer les transicions instantànies
  useEffect(() => {
    if (!shownScene) return;
    const id = window.setTimeout(() => {
      // Les previsualitzacions es descarreguen al navegador sense pujar-les a la GPU
      for (const l of shownScene.links) {
        const img = new Image();
        img.src = `${shownScene.preview.replace(/[^/]+-preview\.jpg$/, '')}${l.to}-preview.jpg`;
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [shownScene]);

  // ---------------------------------------------------------------------------
  // Controls: ratolí, tàctil, roda i teclat
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = hostRef.current!;
    const s = S.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let pinchDist = 0;
    let pinchFov = FOV_DEFAULT;

    const degPerPx = () => s.fov / (el.clientHeight || 1);

    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-hotspot], button, a')) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      markInteracted();
      if (pointers.size === 1) {
        s.dragging = true;
        s.vYaw = s.vPitch = 0;
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = performance.now();
        el.classList.add('is-dragging');
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchFov = s.fov;
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) s.fov = clamp(pinchFov * (pinchDist / d), FOV_MIN, FOV_MAX);
        s.dirty = true;
        return;
      }
      if (!s.dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const k = degPerPx();
      s.yaw -= dx * k;
      s.pitch = clamp(s.pitch + dy * k, -PITCH_LIMIT, PITCH_LIMIT);
      const dtt = Math.max(1, now - lastT) / 1000;
      s.vYaw = (-dx * k) / dtt;
      s.vPitch = (dy * k) / dtt;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
      s.dirty = true;
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        s.dragging = false;
        el.classList.remove('is-dragging');
        if (performance.now() - lastT > 80 || props.current.reducedMotion) s.vYaw = s.vPitch = 0;
        s.vYaw = clamp(s.vYaw, -240, 240);
        s.vPitch = clamp(s.vPitch, -160, 160);
      } else if (pointers.size === 1) {
        const [p] = [...pointers.values()];
        lastX = p.x;
        lastY = p.y;
        pinchDist = 0;
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      markInteracted();
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      s.fov = clamp(s.fov + d * 0.04, FOV_MIN, FOV_MAX);
      s.dirty = true;
    };
    const key = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 30 : 10;
      let handled = true;
      if (e.key === 'ArrowLeft') s.yaw -= step;
      else if (e.key === 'ArrowRight') s.yaw += step;
      else if (e.key === 'ArrowUp') s.pitch = clamp(s.pitch + step, -PITCH_LIMIT, PITCH_LIMIT);
      else if (e.key === 'ArrowDown') s.pitch = clamp(s.pitch - step, -PITCH_LIMIT, PITCH_LIMIT);
      else if (e.key === '+' || e.key === '=') s.fov = clamp(s.fov - 8, FOV_MIN, FOV_MAX);
      else if (e.key === '-' || e.key === '_') s.fov = clamp(s.fov + 8, FOV_MIN, FOV_MAX);
      else handled = false;
      if (handled) {
        e.preventDefault();
        markInteracted();
        s.dirty = true;
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('keydown', key);
    };
  }, [markInteracted]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn() {
        markInteracted();
        const s = S.current;
        const f0 = s.fov;
        const f1 = clamp(f0 - 12, FOV_MIN, FOV_MAX);
        addTween(props.current.reducedMotion ? 1 : 260, (t) => (s.fov = f0 + (f1 - f0) * t));
      },
      zoomOut() {
        markInteracted();
        const s = S.current;
        const f0 = s.fov;
        const f1 = clamp(f0 + 12, FOV_MIN, FOV_MAX);
        addTween(props.current.reducedMotion ? 1 : 260, (t) => (s.fov = f0 + (f1 - f0) * t));
      },
      resetView() {
        markInteracted();
        const s = S.current;
        const sc = shownScene ?? scene;
        const y0 = s.yaw;
        const dy = shortestDelta(wrapDeg(y0), sc.initialView.yaw);
        const p0 = s.pitch;
        const f0 = s.fov;
        s.vYaw = s.vPitch = 0;
        addTween(props.current.reducedMotion ? 1 : 600, (t) => {
          s.yaw = y0 + dy * t;
          s.pitch = p0 + (sc.initialView.pitch - p0) * t;
          s.fov = f0 + (FOV_DEFAULT - f0) * t;
        });
      },
      rotate(d: number) {
        markInteracted();
        const s = S.current;
        const y0 = s.yaw;
        addTween(props.current.reducedMotion ? 1 : 400, (t) => (s.yaw = y0 + d * t));
      },
    }),
    [markInteracted, scene, shownScene]
  );

  const go = (l: TourScene['links'][number]) => {
    if (navigating) return;
    markInteracted();
    S.current.pendingLink = { yaw: l.yaw, pitch: l.pitch };
    S.current.vYaw = S.current.vPitch = 0;
    onNavigate(l.to);
  };

  return (
    <div
      ref={hostRef}
      className="viewer"
      tabIndex={0}
      aria-label={`Visor 360° — ${shownScene?.name ?? scene.name}. Arrossega o fes servir les fletxes per mirar al voltant.`}
      role="application"
    >
      <div ref={canvasHost} className="viewer__stage" />
      <div className="viewer__hotspots">
        {shownScene?.links.map((l) => (
          <button
            key={`${shownScene.id}-${l.to}`}
            data-hotspot
            data-yaw={l.yaw}
            data-pitch={l.pitch}
            data-to={l.to}
            className={`hotspot is-hidden${navigating === l.to ? ' is-loading' : ''}`}
            ref={(el) => {
              const key = `${l.to}`;
              if (el) hotspotEls.current.set(key, el);
              else hotspotEls.current.delete(key);
              S.current.dirty = true;
            }}
            onClick={() => go(l)}
            aria-label={`Ves a ${l.label}`}
          >
            <span className="hotspot__ring" aria-hidden="true" />
            <span className="hotspot__core" aria-hidden="true">
              <Icon name="arrowRight" size={18} />
            </span>
            <span className="hotspot__label">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
