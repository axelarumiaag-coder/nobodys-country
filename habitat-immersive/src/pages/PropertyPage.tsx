import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProperty, similarProperties } from '../data/properties';
import { formatNumber, formatPrice, operationLabel, orPending } from '../lib/format';
import { asset } from '../lib/asset';
import { Gallery } from '../components/Gallery';
import { FloorPlan } from '../components/FloorPlan';
import { ContactForm } from '../components/ContactForm';
import { PropertyCard } from '../components/PropertyCard';
import { Reveal } from '../components/Reveal';
import { Icon } from '../components/Icon';
import { VideoChapters } from '../components/VideoChapters';
import { NotFoundPage } from './NotFoundPage';

export function PropertyPage() {
  const { slug = '' } = useParams();
  const p = getProperty(slug);

  useEffect(() => {
    if (p) document.title = `${p.title}${p.municipality ? ` · ${p.municipality}` : ''} — HABITAT IMMERSIVE`;
  }, [p]);

  if (!p) return <NotFoundPage message="No hem trobat aquest habitatge." />;
  const similar = similarProperties(p);
  const real = p.kind === 'real';
  const frames = p.tourKind === 'frames';
  const tourUrl = p.tourId ? `/visita/${p.tourId}` : null;
  const tourCta = frames ? 'Explora la casa' : 'Entra al pis';

  const facts = [
    { icon: 'area' as const, label: 'Superfície', value: orPending(p.surface, (s) => `${s} m²${p.outdoorSurface ? ` + ${formatNumber(p.outdoorSurface)} m² ext.` : ''}`) },
    { icon: 'bed' as const, label: 'Habitacions', value: orPending(p.bedrooms) },
    { icon: 'bath' as const, label: 'Banys', value: orPending(p.bathrooms) },
    { icon: 'home' as const, label: 'Tipus', value: p.type },
    { icon: 'calendar' as const, label: 'Any', value: orPending(p.year) },
    { icon: 'energy' as const, label: 'Certificat energètic', value: orPending(p.energy) },
  ];
  const location = [p.neighbourhood, p.municipality].filter(Boolean).join(', ');

  return (
    <article className={`page property${real ? ' property--real' : ''}`}>
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
              {p.operation && <span className="badge badge--outline">{operationLabel(p.operation)}</span>}
              <span className="badge badge--outline">{p.type}</span>
              {p.tourId && (
                <span className="badge badge--tour">
                  <Icon name={frames ? 'door' : 'pano'} size={15} /> {frames ? 'Recorregut i 360° recreat' : 'Visita 360° disponible'}
                </span>
              )}
              {real ? <span className="badge badge--real">Habitatge real · {p.reference}</span> : <span className="badge badge--demo">Anunci fictici · {p.reference}</span>}
            </div>
            <h1 className="property__title">{p.title}</h1>
            <p className="property__location">
              <Icon name="pin" size={18} /> {location || 'Ubicació pendent de confirmar'} {p.area && <span>· {p.area}</span>}
            </p>
          </div>
          <div className="property__price-box">
            <p className={`property__price${p.price == null ? ' property__price--pending' : ''}`}>{formatPrice(p.price, p.operation)}</p>
            {p.operation === 'compra' && p.price != null && p.surface != null && <p className="property__ppm">{formatNumber(Math.round(p.price / p.surface))} €/m²</p>}
            {tourUrl ? (
              <Link to={tourUrl} className="btn btn--primary btn--large btn--enter">
                <Icon name="door" /> {tourCta}
              </Link>
            ) : (
              <span className="property__no-tour">
                <Icon name="info" size={16} /> Visita virtual no disponible per a aquest habitatge
              </span>
            )}
          </div>
        </header>

        {real && p.spaces && tourUrl && (
          <section className="explore" aria-labelledby="explore-title">
            <Link to={tourUrl} className="explore__main">
              <img src={asset(`${p.images[0].src}.jpg`)} alt="" />
              <span className="explore__main-text">
                <span className="eyebrow eyebrow--light">
                  Recorregut · {p.spaces.length} espais · {p.spaces.filter((s) => s.has360).length} en 360°
                </span>
                <span id="explore-title" className="explore__title">
                  Explora la casa pas a pas
                </span>
                <span className="explore__sub">Vistes 360° recreades a partir del vídeo i fotogrames reals, amb punts per avançar d'un espai a l'altre.</span>
                <span className="btn btn--light">
                  <Icon name="door" /> Comença el recorregut
                </span>
              </span>
            </Link>
            <ol className="explore__spaces" aria-label="Espais identificats al vídeo">
              {p.spaces.map((s, i) => (
                <li key={s.id}>
                  <Link to={`${tourUrl}?parada=${s.id}`} className="explore__space">
                    <img src={asset(`${s.image}-sm.jpg`)} alt="" loading="lazy" />
                    <span>
                      <em>{String(i + 1).padStart(2, '0')}</em> {s.name}
                      {s.has360 && <b className="ftour__tag">360°</b>}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <Gallery images={p.images} title={p.title} credit={real ? 'Fotogrames seleccionats del vídeo original, amb un ajust lleuger de brillantor i contrast.' : undefined} />

        <div className="property__layout">
          <div className="property__main">
            <Reveal as="section" className="property__section">
              <ul className="facts">
                {facts.map((f) => (
                  <li key={f.label} className={f.value === 'Informació pendent' ? 'is-pending' : ''}>
                    <Icon name={f.icon} size={22} />
                    <span className="facts__label">{f.label}</span>
                    <span className="facts__value">{f.value}</span>
                  </li>
                ))}
              </ul>
              {real && <p className="muted facts__note">Les dades comercials s'afegiran quan el propietari les confirmi. No s'ha deduït cap mesura a partir del vídeo.</p>}
            </Reveal>

            <Reveal as="section" className="property__section" aria-labelledby="desc-title">
              <h2 id="desc-title" className="property__h2">
                {real ? 'Què es veu al vídeo' : 'Descripció'}
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
                {real ? 'Elements visibles' : 'Característiques'}
              </h2>
              <ul className="features">
                {p.features.map((f) => (
                  <li key={f}>
                    <Icon name="check" size={18} /> {f}
                  </li>
                ))}
              </ul>
            </Reveal>

            {p.video && (
              <Reveal as="section" className="property__section" aria-labelledby="video-title">
                <div className="property__plan-head">
                  <h2 id="video-title" className="property__h2">
                    Vídeo del recorregut
                  </h2>
                  {tourUrl && (
                    <Link to={tourUrl} className="link-arrow">
                      Prefereixo explorar-la <Icon name="arrowRight" size={18} />
                    </Link>
                  )}
                </div>
                <VideoChapters {...p.video} />
                <p className="plan-card__note">
                  Vídeo editat a partir de l'original: sense àudio, sense els trams borrosos i sense els fragments on apareixen fotografies personals o pantalles.
                </p>
              </Reveal>
            )}

            {p.plan ? (
              <Reveal as="section" className="property__section" aria-labelledby="plan-title">
                <div className="property__plan-head">
                  <h2 id="plan-title" className="property__h2">
                    Plànol esquemàtic
                  </h2>
                  {tourUrl && (
                    <Link to={tourUrl} className="link-arrow">
                      Recorre'l en 360° <Icon name="arrowRight" size={18} />
                    </Link>
                  )}
                </div>
                <div className="plan-card">
                  <FloorPlan plan={p.plan} title={`Plànol esquemàtic de ${p.title}`} />
                  <p className="plan-card__note">Plànol orientatiu de la planta principal, no a escala exacta. Superfícies aproximades.</p>
                </div>
              </Reveal>
            ) : (
              real && (
                <Reveal as="section" className="property__section" aria-labelledby="plan-title">
                  <h2 id="plan-title" className="property__h2">
                    Plànol
                  </h2>
                  <p>Encara no tenim el plànol d'aquest habitatge. El vídeo no permet mesurar les estances ni situar-les amb precisió, així que no n'hem dibuixat cap.</p>
                </Reveal>
              )
            )}

            {tourUrl && (
              <Reveal as="section" className="property__section enter-banner">
                <div>
                  <p className="eyebrow eyebrow--light">{frames ? 'Recorregut visual' : 'Visita virtual 360°'}</p>
                  <h2>{frames ? 'Recorre la casa com si hi fossis' : 'Entra-hi i mira al voltant'}</h2>
                  <p>
                    {frames
                      ? `${p.spaces?.length ?? 0} espais reals; ${p.spaces?.filter((s) => s.has360).length ?? 0} es poden mirar en 360° recreat a partir del vídeo. Punts de navegació, fotogrames originals i el vídeo per capítols.`
                      : 'Sala, cuina i dos dormitoris connectats amb punts de navegació i un plànol interactiu.'}
                  </p>
                </div>
                <Link to={tourUrl} className="btn btn--light btn--large">
                  <Icon name="door" /> {tourCta}
                </Link>
              </Reveal>
            )}
          </div>

          <aside className="property__aside" aria-label="Contacte">
            <div className="contact-card">
              <h2 className="property__h2">{real ? 'Sol·licita una visita' : 'Demana informació'}</h2>
              <p className="muted">
                {real ? 'Demana el preu, la ubicació o una visita presencial. ' : 'Respon una persona de l’equip… quan això sigui un producte real. '}De moment, el formulari només
                valida i confirma localment.
              </p>
              <ContactForm
                subject={`${p.title} (${p.reference})`}
                defaultMessage={
                  real
                    ? `Hola, m'interessa l'habitatge «${p.title}» (${p.reference}). Voldria saber el preu i concertar una visita.`
                    : `Hola, m'interessa l'habitatge «${p.title}»${p.municipality ? ` a ${p.municipality}` : ''}. Voldria més informació.`
                }
              />
            </div>
          </aside>
        </div>

        <section className="section similar" aria-labelledby="similar-title">
          <div className="section__head">
            <h2 id="similar-title" className="section__title section__title--small">
              {real ? 'Altres habitatges' : 'Habitatges similars'}
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
