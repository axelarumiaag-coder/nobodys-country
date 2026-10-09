import { Link } from 'react-router-dom';
import type { Property } from '../data/types';
import { formatPrice, operationLabel } from '../lib/format';
import { Icon } from './Icon';
import { SmartImage } from './SmartImage';

export function PropertyCard({ property: p, priority = false }: { property: Property; priority?: boolean }) {
  return (
    <article className="card">
      <Link to={`/habitatges/${p.slug}`} className="card__link" aria-label={`${p.title}, ${p.municipality}, ${formatPrice(p.price, p.operation)}`}>
        <div className="card__media">
          <SmartImage src={p.images[0].src} alt={p.images[0].alt} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" priority={priority} />
          <div className="card__badges">
            <span className="badge">{operationLabel(p.operation)}</span>
            {p.tourId && (
              <span className="badge badge--tour">
                <Icon name="pano" size={15} /> Visita 360°
              </span>
            )}
          </div>
          <span className="card__demo">Anunci fictici</span>
        </div>
        <div className="card__body">
          <div className="card__meta">
            <span>{p.type}</span>
            <span aria-hidden="true">·</span>
            <span>
              <Icon name="pin" size={14} /> {p.municipality}
            </span>
          </div>
          <h3 className="card__title">{p.title}</h3>
          <p className="card__price">{formatPrice(p.price, p.operation)}</p>
          <ul className="card__facts" aria-label="Característiques principals">
            <li>
              <Icon name="area" size={17} /> {p.surface} m²
            </li>
            <li>
              <Icon name="bed" size={17} /> {p.bedrooms} hab.
            </li>
            <li>
              <Icon name="bath" size={17} /> {p.bathrooms} {p.bathrooms === 1 ? 'bany' : 'banys'}
            </li>
          </ul>
        </div>
      </Link>
    </article>
  );
}
