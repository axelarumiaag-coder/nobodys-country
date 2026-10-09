import { useState } from 'react';
import { LogoMark } from './Logo';

interface Props {
  /** Ruta base sense extensió (es generen `.jpg` i `-sm.jpg`) o URL completa */
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Si és true, `src` ja inclou l'extensió i no hi ha variant petita */
  raw?: boolean;
}

/**
 * Imatge amb càrrega progressiva i alternativa elegant si el fitxer no existeix o falla.
 * Una imatge trencada no deixa mai la targeta o la pàgina inutilitzable.
 */
export function SmartImage({ src, alt, className = '', sizes = '(max-width: 760px) 100vw, 50vw', priority = false, raw = false }: Props) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const full = raw ? src : `${src}.jpg`;
  const srcSet = raw ? undefined : `${src}-sm.jpg 800w, ${src}.jpg 1600w`;
  return (
    <span className={`smart-img smart-img--${state} ${className}`}>
      {state !== 'error' ? (
        <img
          src={full}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // @ts-expect-error fetchpriority encara no és a les definicions de React 18
          fetchpriority={priority ? 'high' : undefined}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      ) : (
        <span className="smart-img__fallback" role="img" aria-label={`${alt} (imatge no disponible)`}>
          <LogoMark size={36} />
          <span>Imatge no disponible</span>
        </span>
      )}
    </span>
  );
}
