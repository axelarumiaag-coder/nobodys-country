import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo />
          <p>Una nova manera de descobrir habitatges: entra-hi, mira al voltant i decideix amb calma, des de qualsevol lloc.</p>
        </div>
        <div>
          <h3>Explora</h3>
          <ul>
            <li>
              <Link to="/habitatges">Tots els habitatges</Link>
            </li>
            <li>
              <Link to="/habitatges?operacio=compra">Comprar</Link>
            </li>
            <li>
              <Link to="/habitatges?operacio=lloguer">Llogar</Link>
            </li>
            <li>
              <Link to="/habitatges?visita=1">Amb visita virtual</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Agència</h3>
          <ul>
            <li>
              <Link to="/#metode">Com treballem</Link>
            </li>
            <li>
              <Link to="/#visites">Visites virtuals</Link>
            </li>
            <li>
              <Link to="/contacte">Contacte</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Sobre aquesta demo</h3>
          <p className="site-footer__note">
            HABITAT IMMERSIVE és una marca fictícia. Els sis habitatges de demostració són ficticis i les seves imatges són visualitzacions 3D generades per ordinador i no
            corresponen a cap immoble real. L'«Habitatge amb terrassa» és real: les imatges són fotogrames del seu vídeo i no se n'ha inventat cap dada comercial. Els formularis no
            envien dades a cap servidor.
          </p>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} HABITAT IMMERSIVE · Projecte de demostració</span>
        <span>Fet amb React, Three.js i molta llum mediterrània.</span>
      </div>
    </footer>
  );
}
