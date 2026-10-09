import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProperty, similarProperties } from '../data/properties';
import { formatNumber, formatPrice, operationLabel } from '../lib/format';
import { Gallery } from '../components/Gallery';
import { FloorPlan } from '../components/FloorPlan';
import { ContactForm } from '../components/ContactForm';
import { PropertyCard } from '../components/PropertyCard';
import { Reveal } from '../components/Reveal';
import { Icon } from '../components/Icon';
import { NotFoundPage } from './NotFoundPage';

export function PropertyPage() {
  const { slug = '' } = useParams();
  const p = getProperty(slug);

  useEffect(() => {
    if (p) document.title = `${p.title} · ${p.municipality} — HABITAT IMMERSIVE`;
  }, [p]);

  if (!p) return <NotFoundPage message="No hem trobat aquest habitatge." />;
  const similar = similarProperties(p);

  const facts = [
    { icon: 'area' as const, label: 'Superfície', value: `${p.surface} m²${p.outdoorSurface ? ` + ${formatNumber(p.outdoorSurface)} m² ext.` : ''}` },
    { icon: 'bed' as const, label: 'Habitacions', value: String(p.bedrooms) },
    { icon: 'bath' as const, label: 'Banys', value: String(p.bathrooms) },
    { icon: 'home' as const, label: 'Tipus', value: p.type },
    { icon: 'calendar' as const, label: 'Any', value: String(p.year) },
    { icon: 'energy' as const, label: 'Certificat energètic', value: p.energy },
  ];

  return (
    <article className="page property">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Ruta de navegació">
          <Link to="/">Inici</Link>
          <span aria-hidden="true">/</span>
          <Link to="/habitatges">Habitatges</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{p.title}</span>
        </nav>

        <header className="property__head">
          <div>
            <div className="property__tags">
              <span className="badge badge--outline">{operationLabel(p.operation)}</span>
              <span className="badge badge--outline">{p.type}</span>
              {p.tourId && (
                <span className="badge badge--tour">
                  <Icon name="pano" size={15} /> Visita 360° disponible
                </span>
              )}
              <span className="badge badge--demo">Anunci fictici · {p.reference}</span>
            </div>
            <h1 className="property__title">{p.title}</h1>
            <p className="property__location">
              <Icon name="pin" size={18} /> {p.neighbourhood}, {p.municipality} <span>· {p.area}</span>
            </p>
          </div>
          <div className="property__price-box">
            <p className="property__price">{formatPrice(p.price, p.operation)}</p>
            {p.operation === 'compra' && <p className="property__ppm">{formatNumber(Math.round(p.price / p.surface))} €/m²</p>}
            {p.tourId ? (
              <Link to={`/visita/${p.tourId}`} className="btn btn--primary btn--large btn--enter">
                <Icon name="door" /> Entra al pis
              </Link>
            ) : (
              <span className="property__no-tour">
                <Icon name="info" size={16} /> Visita virtual no disponible per a aquest habitatge
              </span>
            )}
          </div>
        </header>

        <Gallery images={p.images} title={p.title} />

        <div className="property__layout">
          <div className="property__main">
            <Reveal as="section" className="property__section">
              <ul className="facts">
                {facts.map((f) => (
                  <li key={f.label}>
                    <Icon name={f.icon} size={22} />
                    <span className="facts__label">{f.label}</span>
                    <span className="facts__value">{f.value}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal as="section" className="property__section" aria-labelledby="desc-title">
              <h2 id="desc-title" className="property__h2">
                Descripció
              </h2>
              <p className="lead">{p.summary}</p>
              {p.description.map((d, i) => (
                <p key={i}>{d}</p>
              ))}
              {p.floor && (
                <p className="muted">
                  <strong>Planta:</strong> {p.floor}
                </p>
              )}
            </Reveal>

            <Reveal as="section" className="property__section" aria-labelledby="feat-title">
              <h2 id="feat-title" className="property__h2">
                Característiques
              </h2>
              <ul className="features">
                {p.features.map((f) => (
                  <li key={f}>
                    <Icon name="check" size={18} /> {f}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal as="section" className="property__section" aria-labelledby="plan-title">
              <div className="property__plan-head">
                <h2 id="plan-title" className="property__h2">
                  Plànol esquemàtic
                </h2>
                {p.tourId && (
                  <Link to={`/visita/${p.tourId}`} className="link-arrow">
                    Recorre'l en 360° <Icon name="arrowRight" size={18} />
                  </Link>
                )}
              </div>
              <div className="plan-card">
                <FloorPlan plan={p.plan} title={`Plànol esquemàtic de ${p.title}`} />
                <p className="plan-card__note">Plànol orientatiu de la planta principal, no a escala exacta. Superfícies aproximades.</p>
              </div>
            </Reveal>

            {p.tourId && (
              <Reveal as="section" className="property__section enter-banner">
                <div>
                  <p className="eyebrow eyebrow--light">Visita virtual 360°</p>
                  <h2>Entra-hi i mira al voltant</h2>
                  <p>Sala, cuina i dos dormitoris connectats amb punts de navegació i un plànol interactiu.</p>
                </div>
                <Link to={`/visita/${p.tourId}`} className="btn btn--light btn--large">
                  <Icon name="door" /> Entra al pis
                </Link>
              </Reveal>
            )}
          </div>

          <aside className="property__aside" aria-label="Contacte">
            <div className="contact-card">
              <h2 className="property__h2">Demana informació</h2>
              <p className="muted">Respon una persona de l’equip… quan això sigui un producte real. De moment, el formulari només valida i confirma localment.</p>
              <ContactForm subject={`${p.title} (${p.reference})`} defaultMessage={`Hola, m'interessa l'habitatge «${p.title}» a ${p.municipality}. Voldria més informació.`} />
            </div>
          </aside>
        </div>

        <section className="section similar" aria-labelledby="similar-title">
          <div className="section__head">
            <h2 id="similar-title" className="section__title section__title--small">
              Habitatges similars
            </h2>
            <Link to="/habitatges" className="link-arrow">
              Tot el catàleg <Icon name="arrowRight" size={18} />
            </Link>
          </div>
          <div className="grid grid--cards">
            {similar.map((s, i) => (
              <Reveal key={s.slug} delay={i * 80}>
                <PropertyCard property={s} />
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
