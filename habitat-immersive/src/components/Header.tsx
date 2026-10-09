import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { Icon } from './Icon';

const NAV = [
  { to: '/habitatges', label: 'Habitatges' },
  { to: '/#visites', label: 'Visites virtuals' },
  { to: '/#metode', label: 'Com treballem' },
  { to: '/contacte', label: 'Contacte' },
];

export function Header() {
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const overHero = pathname === '/' && !scrolled && !open;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [pathname, hash]);
  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // El menú mòbil és germà de <header>: el backdrop-filter de la capçalera crearia
  // un bloc contenidor i retallaria el menú (position: fixed).
  return (
    <>
      <header className={`site-header${overHero ? ' site-header--hero' : ''}${scrolled ? ' is-scrolled' : ''}`}>
        <div className="container site-header__inner">
          <Link to="/" className="site-header__brand" aria-label="HABITAT IMMERSIVE, inici">
            <Logo light={overHero} />
          </Link>
          <nav className="site-nav" aria-label="Navegació principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `site-nav__link${isActive && !n.to.includes('#') ? ' is-active' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/visita/atic-sitges" className="btn btn--small btn--primary site-header__cta">
            <Icon name="pano" size={18} /> Entra en un pis
          </Link>
          <button
            className={`menu-toggle${open ? ' is-open' : ''}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Tanca el menú' : 'Obre el menú'}
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>
      <div id="mobile-menu" className={`mobile-menu${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <nav aria-label="Navegació mòbil">
          {NAV.map((n, i) => (
            <Link key={n.to} to={n.to} style={{ transitionDelay: open ? `${80 + i * 50}ms` : '0ms' }} tabIndex={open ? 0 : -1}>
              {n.label}
              <Icon name="arrowRight" />
            </Link>
          ))}
          <Link to="/visita/atic-sitges" className="btn btn--primary" style={{ transitionDelay: open ? '300ms' : '0ms' }} tabIndex={open ? 0 : -1}>
            <Icon name="pano" /> Entra en un pis
          </Link>
        </nav>
      </div>
    </>
  );
}
