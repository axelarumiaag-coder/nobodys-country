// Recorregut visual d'un habitatge real a partir de fotogrames d'un vídeo.
// No és una vista 360°: cada vista és un fotograma real. «Girar» passa a la vista següent
// gravada des del mateix punt i els punts de navegació només apareixen on el pas cap a
// l'altre espai és visible a la imatge.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProperty } from '../data/properties';
import { realTour, type FrameHotspot } from '../data/realHouse';
import { asset } from '../lib/asset';
import { useReducedMotion } from '../lib/useReducedMotion';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { VideoChapters } from '../components/VideoChapters';

const ZOOM_MAX = 2.2;

export function FrameTourPage() {
  const tour = realTour;
  const property = getProperty(tour.propertySlug)!;
  const reduced = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const stopIndex = Math.max(
    0,
    tour.stops.findIndex((s) => s.id === params.get('parada'))
  );
  const stop = tour.stops[stopIndex];
  const viewIndex = Math.min(stop.views.length - 1, Math.max(0, Number(params.get('vista') ?? 0) || 0));
  const view = stop.views[viewIndex];

  const shell = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [dir, setDir] = useState<'left' | 'right' | 'in' | 'none'>('none');
  const [walkFrom, setWalkFrom] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hint, setHint] = useState(true);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(() => window.matchMedia?.('(min-width: 760px)').matches ?? true);

  useEffect(() => {
    document.title = `Recorregut · ${property.title} — HABITAT IMMERSIVE`;
    document.body.classList.add('is-tour');
    return () => document.body.classList.remove('is-tour');
  }, [property.title]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(t);
  }, [hint]);

  // Precàrrega de les vistes veïnes i de la primera vista de les parades enllaçades
  useEffect(() => {
    const urls = [
      stop.views[viewIndex + 1]?.src,
      stop.views[viewIndex - 1]?.src,
      ...view.hotspots.filter((h) => h.to).map((h) => tour.stops.find((s) => s.id === h.to)?.views[0].src),
      tour.stops[stopIndex + 1]?.views[0].src,
    ];
    urls.filter(Boolean).forEach((u) => {
      const img = new Image();
      img.src = asset(`${u}.jpg`);
    });
  }, [stop, view, viewIndex, stopIndex, tour.stops]);

  const go = useCallback(
    (stopId: string, v = 0, how: 'left' | 'right' | 'in' | 'none' = 'none') => {
      setDir(reduced ? 'none' : how);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setFailed(null);
      setHint(false);
      setParams({ parada: stopId, vista: String(v) }, { replace: true });
    },
    [reduced, setParams]
  );

  const turn = useCallback(
    (d: 1 | -1) => {
      const n = stop.views.length;
      if (n < 2) return;
      go(stop.id, (viewIndex + d + n) % n, d > 0 ? 'right' : 'left');
    },
    [go, stop, viewIndex]
  );

  const enter = (h: FrameHotspot) => {
    if (!h.to) return;
    if (reduced) return go(h.to, 0);
    // Efecte d'«avançar» cap al punt abans de canviar d'espai
    setWalkFrom({ x: h.x, y: h.y });
    window.setTimeout(() => {
      setWalkFrom(null);
      go(h.to!, 0, 'in');
    }, 420);
  };

  const stepStop = (d: 1 | -1) => {
    const next = tour.stops[stopIndex + d];
    if (next) go(next.id, 0, d > 0 ? 'right' : 'left');
  };

  // Teclat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (videoOpen) {
        if (e.key === 'Escape') setVideoOpen(false);
        return;
      }
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight') turn(1);
      else if (e.key === 'ArrowLeft') turn(-1);
      else if (e.key === 'PageDown' || e.key === ']') stepStop(1);
      else if (e.key === 'PageUp' || e.key === '[') stepStop(-1);
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(ZOOM_MAX, z + 0.4));
      else if (e.key === '-') setZoom((z) => (z - 0.4 <= 1.01 ? (setPan({ x: 0, y: 0 }), 1) : z - 0.4));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      /* no disponible (p. ex. iOS) */
    }
  };

  // Gestos: lliscar per girar; amb zoom, arrossegar per desplaçar; pessic per apropar
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ x0: 0, y0: 0, px: 0, py: 0, dist: 0, z0: 1, moved: false });
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 1) Object.assign(g, { x0: e.clientX, y0: e.clientY, px: pan.x, py: pan.y, moved: false });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.dist = Math.hypot(a.x - b.x, a.y - b.y);
      g.z0 = zoom;
    }
    setHint(false);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const z = Math.min(ZOOM_MAX, Math.max(1, g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / (g.dist || 1))));
      setZoom(z);
      if (z === 1) setPan({ x: 0, y: 0 });
      g.moved = true;
      return;
    }
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (zoom > 1) setPan({ x: g.px + dx, y: g.py + dy });
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const wasPinch = pointers.current.size > 1;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (wasPinch || zoom > 1) return;
    const dx = e.clientX - g.x0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - g.y0)) turn(dx < 0 ? 1 : -1);
  };
  const onWheel = (e: React.WheelEvent) => {
    const z = Math.min(ZOOM_MAX, Math.max(1, zoom - e.deltaY * 0.002));
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  };

  const isLoaded = !!loaded[view.src];
  useEffect(() => {
    if (isLoaded || failed) setBooted(true);
  }, [isLoaded, failed]);

  const imgUrl = asset(`${view.src}.jpg`);
  const chapterStart = useMemo(() => property.video?.chapters.find((c) => c.stop === stop.id)?.stop, [property.video, stop.id]);

  return (
    <div
      ref={shell}
      className={`tour ftour${booted ? ' is-booted' : ''}${fullscreen ? ' is-fullscreen' : ''}`}
      data-stop={stop.id}
      data-view={view.id}
      data-status={failed ? 'error' : isLoaded ? 'ready' : 'loading'}
    >
      {/* Fons: el mateix fotograma desenfocat per omplir la pantalla */}
      <div key={`bg-${view.src}`} className="ftour__backdrop" style={{ backgroundImage: `url("${asset(`${view.src}-sm.jpg`)}")` }} aria-hidden="true" />

      <div className="ftour__stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <figure
          key={view.src}
          className={`ftour__frame ftour__frame--${dir}${walkFrom ? ' is-walking' : ''}`}
          style={{
            aspectRatio: `${view.width} / ${view.height}`,
            transformOrigin: walkFrom ? `${walkFrom.x}% ${walkFrom.y}%` : undefined,
          }}
        >
          <div className="ftour__zoom" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {failed === view.src ? (
              <div className="ftour__failed" role="alert">
                <Icon name="info" size={28} />
                <p>No s'ha pogut carregar aquesta vista.</p>
                <button className="btn btn--light btn--small" onClick={() => (setFailed(null), setLoaded((l) => ({ ...l, [view.src]: false })))}>
                  Torna-ho a provar
                </button>
              </div>
            ) : (
              <img
                src={imgUrl}
                alt={`${stop.name}: ${view.label}`}
                draggable={false}
                onLoad={() => setLoaded((l) => ({ ...l, [view.src]: true }))}
                onError={() => setFailed(view.src)}
                className={isLoaded ? 'is-loaded' : ''}
              />
            )}
            {isLoaded &&
              zoom === 1 &&
              view.hotspots.map((h) =>
                h.to ? (
                  <button key={h.label} className="hotspot ftour__hotspot" style={{ left: `${h.x}%`, top: `${h.y}%` }} onClick={() => enter(h)} data-to={h.to} aria-label={h.label}>
                    <span className="hotspot__ring" aria-hidden="true" />
                    <span className="hotspot__core" aria-hidden="true">
                      <Icon name="arrowRight" size={18} />
                    </span>
                    <span className="hotspot__label">{h.label}</span>
                  </button>
                ) : (
                  <span key={h.label} className="ftour__pin" style={{ left: `${h.x}%`, top: `${h.y}%` }} tabIndex={0} role="note" aria-label={h.label}>
                    <Icon name="info" size={16} />
                    <span className="ftour__pin-label">{h.label}</span>
                  </span>
                )
              )}
          </div>
          <figcaption className="ftour__caption">
            <span>{view.label}</span>
            {stop.views.length > 1 && (
              <span className="ftour__dots" aria-hidden="true">
                {stop.views.map((v, i) => (
                  <i key={v.id} className={i === viewIndex ? 'is-active' : ''} />
                ))}
              </span>
            )}
          </figcaption>
        </figure>

        {stop.views.length > 1 && (
          <>
            <button className="ftour__turn ftour__turn--left tour-btn" onClick={() => turn(-1)} aria-label="Gira: vista anterior">
              <Icon name="arrowLeft" />
            </button>
            <button className="ftour__turn ftour__turn--right tour-btn" onClick={() => turn(1)} aria-label="Gira: vista següent">
              <Icon name="arrowRight" />
            </button>
          </>
        )}
      </div>

      {/* Capçalera */}
      <div className="tour__top">
        <Link to={`/habitatges/${property.slug}`} className="tour-btn tour-btn--text" aria-label="Torna a la fitxa de l'immoble">
          <Icon name="arrowLeft" size={18} />
          <span className="tour__back-label">Tornar a la fitxa</span>
        </Link>
        <div className="tour__title">
          <span className="tour__eyebrow">
            <Icon name="home" size={13} /> Habitatge real · recorregut visual
          </span>
          <span className="tour__name">{property.title}</span>
        </div>
        <div className="tour__top-actions">
          {property.video && (
            <button className="tour-btn tour-btn--text" onClick={() => setVideoOpen(true)} aria-label="Mira el vídeo d'aquest espai">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
              </svg>
              <span className="tour__back-label">Vídeo</span>
            </button>
          )}
          <button
            className="tour-btn"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Surt de la pantalla completa' : 'Pantalla completa'}
            title={fullscreen ? 'Surt de la pantalla completa' : 'Pantalla completa'}
          >
            <Icon name={fullscreen ? 'shrink' : 'expand'} />
          </button>
          <Link to={`/habitatges/${property.slug}`} className="tour-btn" aria-label="Tanca el recorregut" title="Tanca el recorregut">
            <Icon name="close" />
          </Link>
        </div>
      </div>

      {/* Espai actual */}
      <div className="tour__room" aria-live="polite">
        <span key={stop.id} className="tour__room-inner">
          <span className="tour__room-index">
            {String(stopIndex + 1).padStart(2, '0')} / {String(tour.stops.length).padStart(2, '0')}
          </span>
          <span className="tour__room-name" data-testid="current-room">
            {stop.name}
          </span>
        </span>
      </div>

      {/* Recorregut (ordre del vídeo) */}
      <nav className={`ftour__route${routeOpen ? ' is-open' : ''}`} aria-label="Espais del recorregut">
        <div className="ftour__route-head">
          <button className="tour-btn" onClick={() => stepStop(-1)} disabled={stopIndex === 0} aria-label="Espai anterior">
            <Icon name="arrowLeft" size={18} />
          </button>
          <button className="ftour__route-toggle" onClick={() => setRouteOpen((o) => !o)} aria-expanded={routeOpen}>
            <Icon name="map" size={16} /> Recorregut <span>· ordre del vídeo</span>
            <Icon name={routeOpen ? 'minus' : 'plus'} size={14} />
          </button>
          <button className="tour-btn" onClick={() => stepStop(1)} disabled={stopIndex === tour.stops.length - 1} aria-label="Espai següent">
            <Icon name="arrowRight" size={18} />
          </button>
        </div>
        <div className="ftour__route-body">
          <ol className="ftour__strip">
            {tour.stops.map((s, i) => (
              <li key={s.id}>
                <button
                  className={s.id === stop.id ? 'is-active' : ''}
                  aria-current={s.id === stop.id ? 'location' : undefined}
                  onClick={() => go(s.id, 0, i > stopIndex ? 'right' : 'left')}
                >
                  <img src={asset(`${s.views[0].src}-sm.jpg`)} alt="" loading="lazy" />
                  <span>
                    <em>{String(i + 1).padStart(2, '0')}</em> {s.name}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* Zoom */}
      <div className="tour__controls" role="toolbar" aria-label="Controls de la vista">
        <button className="tour-btn" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.4))} aria-label="Apropa" title="Apropa">
          <Icon name="plus" />
        </button>
        <button className="tour-btn" onClick={() => (setZoom(1), setPan({ x: 0, y: 0 }))} aria-label="Allunya" title="Allunya" disabled={zoom === 1}>
          <Icon name="minus" />
        </button>
      </div>

      {/* Avís honest */}
      <div className={`tour__notice${noticeOpen ? ' is-open' : ''}`}>
        <button className="tour__notice-btn" onClick={() => setNoticeOpen((o) => !o)} aria-expanded={noticeOpen}>
          <Icon name="info" size={16} /> Fotogrames reals · no és 360°
        </button>
        {noticeOpen && <p role="note">{tour.notice}</p>}
      </div>

      <div className={`tour__hint${hint && booted ? ' is-visible' : ''}`} aria-hidden={!hint}>
        <Icon name="hand" size={22} />
        <span>
          <strong>Llisca o fes servir les fletxes</strong> per girar dins de cada espai · Toca els <strong>punts</strong> per avançar · El <strong>recorregut</strong> et porta a
          qualsevol espai
        </span>
      </div>

      <div className={`tour__loader${booted ? ' is-done' : ''}`} aria-hidden={booted}>
        <div className="tour__loader-inner">
          <LogoMark size={44} />
          <p>Preparant el recorregut…</p>
          <span className="loader-bar" />
        </div>
      </div>

      {videoOpen && property.video && (
        <div className="ftour__video" role="dialog" aria-modal="true" aria-label="Vídeo del recorregut">
          <div className="ftour__video-card">
            <div className="ftour__video-head">
              <h2>Vídeo del recorregut</h2>
              <button className="tour-btn" onClick={() => setVideoOpen(false)} aria-label="Tanca el vídeo">
                <Icon name="close" />
              </button>
            </div>
            <VideoChapters {...property.video} startAt={chapterStart} autoPlay />
            <p className="ftour__video-note">Vídeo editat sense àudio i sense els fragments amb dades personals.</p>
          </div>
        </div>
      )}
    </div>
  );
}
