import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { tours } from '../data/tours';
import { getProperty } from '../data/properties';
import { FloorPlan } from '../components/FloorPlan';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { PanoramaViewer, type ViewerHandle, type ViewerStatus } from '../viewer/PanoramaViewer';
import { useReducedMotion } from '../lib/useReducedMotion';
import { formatPrice } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function TourPage() {
  const { tourId = '' } = useParams();
  const tour = tours[tourId];
  const property = tour ? getProperty(tour.propertySlug) : undefined;
  if (!tour || !property) return <NotFoundPage message="Aquesta visita virtual no existeix." />;
  return <Tour key={tourId} tourId={tourId} />;
}

function Tour({ tourId }: { tourId: string }) {
  const tour = tours[tourId];
  const property = getProperty(tour.propertySlug)!;
  const [params, setParams] = useSearchParams();
  const requested = params.get('estanca');
  const sceneId = requested && tour.scenes[requested] ? requested : tour.start;
  const scene = tour.scenes[sceneId];
  const sceneIds = Object.keys(tour.scenes);

  const viewer = useRef<ViewerHandle>(null);
  const shell = useRef<HTMLDivElement>(null);
  const cone = useRef<SVGGElement>(null);
  const needle = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const [status, setStatus] = useState<ViewerStatus>({ state: 'loading' });
  const [booted, setBooted] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hint, setHint] = useState(true);
  const [planOpen, setPlanOpen] = useState(() => window.matchMedia?.('(min-width: 760px)').matches ?? true);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [roomFlash, setRoomFlash] = useState(0);

  useEffect(() => {
    document.title = `Visita 360° · ${property.title} — HABITAT IMMERSIVE`;
    document.body.classList.add('is-tour');
    return () => document.body.classList.remove('is-tour');
  }, [property.title]);

  useEffect(() => {
    if (status.state === 'ready') setBooted(true);
  }, [status.state]);
  useEffect(() => setRoomFlash((n) => n + 1), [sceneId]);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const navigate = useCallback(
    (to: string) => {
      if (to === sceneId || !tour.scenes[to]) return;
      setParams({ estanca: to }, { replace: true });
    },
    [sceneId, setParams, tour.scenes]
  );

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      /* alguns navegadors (iOS) no permeten la pantalla completa d'elements */
    }
  };

  const onView = useCallback((yaw: number) => {
    cone.current?.setAttribute('transform', `rotate(${yaw.toFixed(1)})`);
    // brúixola: el nord del plànol és -z (yaw = -90)
    needle.current?.style.setProperty('transform', `rotate(${(-(yaw + 90)).toFixed(1)}deg)`);
  }, []);

  const points = useMemo(
    () =>
      Object.values(tour.scenes).map((s) => ({
        id: s.id,
        x: s.planPoint[0],
        z: s.planPoint[1],
        label: s.name,
      })),
    [tour.scenes]
  );
  const idx = sceneIds.indexOf(sceneId);

  return (
    <div ref={shell} className={`tour${booted ? ' is-booted' : ''}${fullscreen ? ' is-fullscreen' : ''}`} data-status={status.state}>
      <PanoramaViewer
        ref={viewer}
        scene={scene}
        onNavigate={navigate}
        onStatus={setStatus}
        onView={onView}
        onFirstInteraction={() => setHint(false)}
        reducedMotion={reduced}
        retryKey={retry}
      />

      {/* Capçalera */}
      <div className="tour__top">
        <Link to={`/habitatges/${property.slug}`} className="tour-btn tour-btn--text" aria-label="Torna a la fitxa de l'immoble">
          <Icon name="arrowLeft" size={18} />
          <span className="tour__back-label">Tornar a la fitxa</span>
        </Link>
        <div className="tour__title">
          <span className="tour__eyebrow">
            <Icon name="pin" size={13} /> {property.municipality} · {formatPrice(property.price, property.operation)}
          </span>
          <span className="tour__name">{property.title}</span>
        </div>
        <div className="tour__top-actions">
          <button
            className="tour-btn"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Surt de la pantalla completa' : 'Pantalla completa'}
            title={fullscreen ? 'Surt de la pantalla completa' : 'Pantalla completa'}
          >
            <Icon name={fullscreen ? 'shrink' : 'expand'} />
          </button>
          <Link to={`/habitatges/${property.slug}`} className="tour-btn" aria-label="Tanca la visita" title="Tanca la visita">
            <Icon name="close" />
          </Link>
        </div>
      </div>

      {/* Estança actual */}
      <div className="tour__room" aria-live="polite">
        <span key={roomFlash} className="tour__room-inner">
          <span className="tour__room-index">
            {String(idx + 1).padStart(2, '0')} / {String(sceneIds.length).padStart(2, '0')}
          </span>
          <span className="tour__room-name" data-testid="current-room">
            {scene.name}
          </span>
        </span>
      </div>

      {/* Plànol interactiu (només si l'habitatge en té) */}
      {property.plan && (
        <aside className={`tour__plan${planOpen ? ' is-open' : ''}`} aria-label="Plànol interactiu">
          <button className="tour__plan-toggle" onClick={() => setPlanOpen((o) => !o)} aria-expanded={planOpen}>
            <Icon name="map" size={18} /> Plànol
            <Icon name={planOpen ? 'minus' : 'plus'} size={16} />
          </button>
          <div className="tour__plan-body">
            <div className="tour__plan-inner">
              <FloorPlan
                plan={property.plan}
                active={sceneId}
                points={points}
                onSelect={navigate}
                coneRef={cone}
                showAreas={false}
                labelAt="top"
                title={`Plànol de ${property.title}. Estança actual: ${scene.name}`}
                className="plan--tour"
              />
              <ul className="tour__rooms">
                {sceneIds.map((id) => (
                  <li key={id}>
                    <button className={id === sceneId ? 'is-active' : ''} aria-current={id === sceneId ? 'location' : undefined} onClick={() => navigate(id)}>
                      {tour.scenes[id].name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      )}

      {/* Controls */}
      <div className="tour__controls" role="toolbar" aria-label="Controls de la vista">
        <button className="tour-btn" onClick={() => viewer.current?.zoomIn()} aria-label="Apropa" title="Apropa">
          <Icon name="plus" />
        </button>
        <button className="tour-btn" onClick={() => viewer.current?.zoomOut()} aria-label="Allunya" title="Allunya">
          <Icon name="minus" />
        </button>
        <button className="tour-btn tour-btn--compass" onClick={() => viewer.current?.resetView()} aria-label="Restableix la vista" title="Restableix la vista">
          <svg ref={needle} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="compass-needle">
            <path d="M12 3 15 12H9Z" fill="var(--terracotta)" />
            <path d="M12 21 9 12h6Z" fill="currentColor" opacity=".55" />
          </svg>
        </button>
      </div>

      {/* Avís de demostració */}
      <div className={`tour__notice${noticeOpen ? ' is-open' : ''}`}>
        <button className="tour__notice-btn" onClick={() => setNoticeOpen((o) => !o)} aria-expanded={noticeOpen}>
          <Icon name="info" size={16} /> {tour.noticeLabel ?? 'Experiència panoràmica de demostració'}
        </button>
        {noticeOpen && <p role="note">{tour.notice}</p>}
      </div>

      {/* Ajuda inicial */}
      <div className={`tour__hint${hint && booted ? ' is-visible' : ''}`} aria-hidden={!hint}>
        <Icon name="hand" size={22} />
        <span>
          <strong>Arrossega</strong> per mirar al voltant · <strong>Roda o pessic</strong> per apropar · Toca els <strong>punts</strong> per canviar d'estança
        </span>
      </div>

      {/* Càrrega inicial */}
      <div className={`tour__loader${booted ? ' is-done' : ''}`} aria-hidden={booted}>
        <div className="tour__loader-inner">
          <LogoMark size={44} />
          <p>Preparant la visita…</p>
          <span className="loader-bar" />
        </div>
      </div>
      {booted && status.state === 'loading' && (
        <div className="tour__busy" role="status">
          <span className="spinner spinner--small" /> Carregant estança…
        </div>
      )}

      {status.state === 'error' && (
        <div className="tour__error" role="alert">
          <h2>No s'ha pogut mostrar la visita</h2>
          <p>{status.message}</p>
          <div className="tour__error-actions">
            <button className="btn btn--primary" onClick={() => setRetry((r) => r + 1)}>
              Torna-ho a provar
            </button>
            <Link className="btn btn--ghost btn--on-dark" to={`/habitatges/${property.slug}`}>
              Tornar a la fitxa
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
