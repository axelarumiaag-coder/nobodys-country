import { useEffect, useRef, useState } from 'react';
import { asset } from '../lib/asset';
import { Icon } from './Icon';

interface Props {
  src: string;
  webm?: string;
  poster: string;
  duration: number;
  chapters: { stop: string; label: string; start: number }[];
  /** Capítol inicial (id de parada) */
  startAt?: string;
  autoPlay?: boolean;
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Reproductor del vídeo de recorregut amb controls propis i capítols per espai. Sense àudio. */
export function VideoChapters({ src, webm, poster, duration, chapters, startAt, autoPlay = false }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const lastSource = useRef<HTMLSourceElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const total = duration || 1;
  const current = chapters.reduce((acc, c, i) => (time >= c.start - 0.05 ? i : acc), 0);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const start = chapters.find((c) => c.stop === startAt)?.start ?? 0;
    const go = () => {
      v.currentTime = start;
      if (autoPlay) v.play().catch(() => setPlaying(false));
    };
    if (v.readyState >= 1) go();
    else v.addEventListener('loadedmetadata', go, { once: true });
  }, [startAt, autoPlay, chapters]);

  // L'error de l'última <source> vol dir que cap format és reproduïble en aquest navegador
  useEffect(() => {
    const el = lastSource.current;
    if (!el) return;
    const on = () => setFailed(true);
    el.addEventListener('error', on);
    return () => el.removeEventListener('error', on);
  }, []);

  const seek = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(total - 0.1, t));
    setTime(v.currentTime);
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setPlaying(false));
    else v.pause();
  };

  if (failed)
    return (
      <div className="vchap vchap--error" role="alert">
        <Icon name="info" /> No s'ha pogut carregar el vídeo del recorregut.
      </div>
    );

  return (
    <div className="vchap">
      <div className="vchap__stage" onClick={toggle}>
        <video
          ref={video}
          poster={asset(poster)}
          muted
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          aria-label="Vídeo del recorregut per l'habitatge, sense àudio"
        >
          {webm && <source src={asset(webm)} type="video/webm" />}
          {/* l'error de l'última font indica que el navegador no pot reproduir cap versió */}
          <source ref={lastSource} src={asset(src)} type="video/mp4" />
        </video>
        {!playing && (
          <span className="vchap__play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30">
              <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
            </svg>
          </span>
        )}
      </div>
      <div className="vchap__controls">
        <button className="vchap__btn" onClick={toggle} aria-label={playing ? 'Pausa' : 'Reprodueix'}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div
          className="vchap__bar"
          role="slider"
          tabIndex={0}
          aria-label="Posició del vídeo"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${fmt(time)} de ${fmt(total)}, ${chapters[current]?.label}`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * total);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(time + 2);
            if (e.key === 'ArrowLeft') seek(time - 2);
          }}
        >
          {chapters.map((c, i) => {
            const end = chapters[i + 1]?.start ?? total;
            return <span key={c.stop} className="vchap__seg" style={{ left: `${(c.start / total) * 100}%`, width: `${((end - c.start) / total) * 100}%` }} />;
          })}
          <span className="vchap__fill" style={{ width: `${(time / total) * 100}%` }} />
        </div>
        <span className="vchap__time">
          {fmt(time)} / {fmt(total)}
        </span>
      </div>
      <ol className="vchap__chapters" aria-label="Capítols del vídeo">
        {chapters.map((c, i) => (
          <li key={c.stop}>
            <button
              className={i === current ? 'is-active' : ''}
              aria-current={i === current ? 'step' : undefined}
              onClick={() => (seek(c.start), video.current?.play().catch(() => {}))}
            >
              <span>{fmt(c.start)}</span> {c.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
