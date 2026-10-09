import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function NotFoundPage({ message = 'Aquesta pàgina no existeix o s’ha mogut.' }: { message?: string }) {
  return (
    <div className="page not-found">
      <div className="container not-found__inner">
        <p className="eyebrow">Error 404</p>
        <h1 className="page__title">Aquesta porta no porta enlloc</h1>
        <p className="lead">{message}</p>
        <div className="cta__actions">
          <Link to="/" className="btn btn--primary">
            <Icon name="home" /> Torna a l'inici
          </Link>
          <Link to="/habitatges" className="btn btn--ghost">
            Veure habitatges
          </Link>
        </div>
      </div>
    </div>
  );
}
