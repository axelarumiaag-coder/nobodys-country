import { useCallback, useEffect, useState } from 'react';
import type { PropertyImage } from '../data/types';
import { Icon } from './Icon';
import { SmartImage } from './SmartImage';
import { asset } from '../lib/asset';

export function Gallery({ images, title }: { images: PropertyImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const go = useCallback((d: number) => setIndex((i) => (i + d + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [lightbox, go]);

  const img = images[index];
  return (
    <section className="gallery" aria-label={`Galeria d'imatges de ${title}`}>
      <div className="gallery__main">
        <button className="gallery__open" onClick={() => setLightbox(true)} aria-label="Amplia la imatge">
          <SmartImage key={img.src} src={img.src} alt={img.alt} sizes="(max-width: 900px) 100vw, 66vw" priority={index === 0} />
        </button>
        <button className="gallery__nav gallery__nav--prev" onClick={() => go(-1)} aria-label="Imatge anterior">
          <Icon name="arrowLeft" />
        </button>
        <button className="gallery__nav gallery__nav--next" onClick={() => go(1)} aria-label="Imatge següent">
          <Icon name="arrowRight" />
        </button>
        <span className="gallery__count">
          {index + 1} / {images.length}
        </span>
      </div>
      <div className="gallery__thumbs" role="tablist" aria-label="Miniatures">
        {images.map((im, i) => (
          <button
            key={im.src}
            role="tab"
            aria-selected={i === index}
            className={`gallery__thumb${i === index ? ' is-active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Mostra la imatge ${i + 1}: ${im.alt}`}
          >
            <SmartImage src={im.src} alt="" sizes="160px" />
          </button>
        ))}
      </div>
      <p className="gallery__credit">Visualitzacions 3D de demostració generades per ordinador.</p>
      {lightbox && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Imatge ampliada" onClick={() => setLightbox(false)}>
          <img src={asset(`${img.src}.jpg`)} alt={img.alt} onClick={(e) => e.stopPropagation()} />
          <p className="lightbox__caption">{img.alt}</p>
          <button className="lightbox__close" onClick={() => setLightbox(false)} aria-label="Tanca">
            <Icon name="close" />
          </button>
          <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => (e.stopPropagation(), go(-1))} aria-label="Imatge anterior">
            <Icon name="arrowLeft" />
          </button>
          <button className="lightbox__nav lightbox__nav--next" onClick={(e) => (e.stopPropagation(), go(1))} aria-label="Imatge següent">
            <Icon name="arrowRight" />
          </button>
        </div>
      )}
    </section>
  );
}
