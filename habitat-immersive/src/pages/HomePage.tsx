import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { properties } from '../data/properties';
import { realProperty } from '../data/realHouse';
import { asset } from '../lib/asset';
import { PropertyCard } from '../components/PropertyCard';
import { SearchBar } from '../components/SearchBar';
import { Reveal } from '../components/Reveal';
import { Icon } from '../components/Icon';
import { SmartImage } from '../components/SmartImage';

const featured = properties.filter((p) => p.featured).slice(0, 3);

export function HomePage() {
  useEffect(() => {
    document.title = 'HABITAT IMMERSIVE — No miris només un pis. Entra-hi.';
  }, []);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__media">
          <SmartImage src="/media/brand/hero.jpg" raw alt="Casa mediterrània blanca amb piscina a l'hora daurada" priority />
        </div>
        <div className="hero__shade" aria-hidden="true" />
        <div className="container hero__content">
          <p className="eyebrow eyebrow--light hero__eyebrow">Immobiliària digital · Catalunya</p>
          <h1 id="hero-title" className="hero__title">
            <span>No miris només un pis.</span> <em>Entra-hi.</em>
          </h1>
          <p className="hero__subtitle">Explora cada espai i descobreix la teva pròxima llar des de qualsevol lloc.</p>
          <div className="hero__actions">
            <Link to="/visita/atic-sitges" className="btn btn--primary btn--large">
              <Icon name="pano" /> Prova una visita 360°
            </Link>
            <Link to="/habitatges" className="btn btn--glass btn--large">
              Veure habitatges <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </div>
        <div className="container hero__search">
          <SearchBar />
        </div>
      </section>

      <section className="section section--real" aria-labelledby="real-title">
        <Reveal className="container real-band">
          <Link to={`/habitatges/${realProperty.slug}`} className="real-band__media" aria-label={`Veure la fitxa de ${realProperty.title}`}>
            <img src={asset(`${realProperty.images[0].src}.jpg`)} alt={realProperty.images[0].alt} loading="lazy" />
            <img src={asset(`${realProperty.images[1].src}-sm.jpg`)} alt={realProperty.images[1].alt} loading="lazy" />
            <img src={asset(`${realProperty.images[2].src}-sm.jpg`)} alt={realProperty.images[2].alt} loading="lazy" />
          </Link>
          <div className="real-band__text">
            <p className="eyebrow">Nou al catàleg · habitatge real</p>
            <h2 id="real-title" className="section__title">
              {realProperty.title}
            </h2>
            <p className="lead">{realProperty.summary}</p>
            <p className="muted">Preu i ubicació a consultar. De moment només s'ha fotografiat aquesta habitació: entra-hi i mira al voltant en 360°.</p>
            <div className="tour-feature__actions">
              <Link to={`/visita/${realProperty.tourId}`} className="btn btn--primary">
                <Icon name="pano" /> Entra a l'habitació
              </Link>
              <Link to={`/habitatges/${realProperty.slug}`} className="link-arrow">
                Veure la fitxa <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="section" aria-labelledby="featured-title">
        <div className="container">
          <Reveal className="section__head">
            <div>
              <p className="eyebrow">Selecció</p>
              <h2 id="featured-title" className="section__title">
                Habitatges destacats
              </h2>
            </div>
            <Link to="/habitatges" className="link-arrow">
              Veure tot el catàleg <Icon name="arrowRight" size={18} />
            </Link>
          </Reveal>
          <div className="grid grid--cards">
            {featured.map((p, i) => (
              <Reveal key={p.slug} delay={i * 90}>
                <PropertyCard property={p} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="visites" className="section section--tour" aria-labelledby="tour-title">
        <div className="container tour-feature">
          <Reveal className="tour-feature__media">
            <Link to="/visita/atic-sitges" className="tour-feature__frame" aria-label="Obre la visita virtual de l'àtic de Sitges">
              <SmartImage src="/media/brand/tour.jpg" raw alt="Interior de l'àtic de demostració amb la sala oberta a la terrassa" />
              <span className="tour-feature__play">
                <span className="hotspot hotspot--static" aria-hidden="true">
                  <span className="hotspot__ring" />
                  <span className="hotspot__core">
                    <Icon name="pano" size={20} />
                  </span>
                </span>
                <span>Entra a l'àtic</span>
              </span>
            </Link>
          </Reveal>
          <Reveal className="tour-feature__text" delay={120}>
            <p className="eyebrow">Visites virtuals 360°</p>
            <h2 id="tour-title" className="section__title">
              Passeja per casa abans de visitar-la
            </h2>
            <p className="lead">
              Arrossega per mirar al voltant, apropa't als detalls i fes clic a les portes per passar d'una estança a l'altra. El plànol t'indica en tot moment on ets i cap a on
              mires.
            </p>
            <ul className="steps">
              <li>
                <span className="steps__n">01</span>
                <div>
                  <h3>Mira al voltant</h3>
                  <p>Gira 360° amb el ratolí, el dit o el teclat.</p>
                </div>
              </li>
              <li>
                <span className="steps__n">02</span>
                <div>
                  <h3>Canvia d'estança</h3>
                  <p>Els punts de navegació et porten de la sala a la cuina o als dormitoris.</p>
                </div>
              </li>
              <li>
                <span className="steps__n">03</span>
                <div>
                  <h3>Orienta't amb el plànol</h3>
                  <p>Un plànol interactiu ressalta l'estança actual i la direcció de la mirada.</p>
                </div>
              </li>
            </ul>
            <div className="tour-feature__actions">
              <Link to="/visita/atic-sitges" className="btn btn--primary">
                <Icon name="pano" /> Entra al pis de Sitges
              </Link>
              <Link to="/habitatges?visita=1" className="link-arrow">
                Habitatges amb visita <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="metode" className="section" aria-labelledby="method-title">
        <div className="container">
          <Reveal className="section__head section__head--center">
            <p className="eyebrow">Com treballem</p>
            <h2 id="method-title" className="section__title">
              Menys desplaçaments, decisions més segures
            </h2>
          </Reveal>
          <div className="pillars">
            {[
              { icon: 'pano' as const, t: 'Visita primer, desplaça’t després', d: 'Recorre l’habitatge a distància i reserva la visita presencial només quan encaixa amb tu.' },
              { icon: 'layers' as const, t: 'Informació completa', d: 'Plànols, superfícies, eficiència energètica i característiques detallades a cada fitxa.' },
              { icon: 'home' as const, t: 'Acompanyament local', d: 'Un equip que coneix cada barri, de la Costa Brava al Camp de Tarragona.' },
            ].map((p, i) => (
              <Reveal key={p.t} className="pillar" delay={i * 100}>
                <span className="pillar__icon">
                  <Icon name={p.icon} size={26} />
                </span>
                <h3>{p.t}</h3>
                <p>{p.d}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="stats" delay={100}>
            <div>
              <strong>1 + 6</strong>
              <span>casa real i habitatges de demostració</span>
            </div>
            <div>
              <strong>360°</strong>
              <span>visites interactives</span>
            </div>
            <div>
              <strong>0 €</strong>
              <span>en serveis de pagament</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section--cta">
        <Reveal className="container cta">
          <h2 className="section__title">Busques una llar o vols vendre la teva?</h2>
          <p className="lead">Explica’ns què necessites i et proposarem habitatges amb visita virtual.</p>
          <div className="cta__actions">
            <Link to="/contacte" className="btn btn--primary btn--large">
              Parla amb nosaltres
            </Link>
            <Link to="/habitatges" className="btn btn--ghost btn--large">
              Explora el catàleg
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
