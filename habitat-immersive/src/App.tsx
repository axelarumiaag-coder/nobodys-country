import { lazy, Suspense, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { PropertyPage } from './pages/PropertyPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LogoMark } from './components/Logo';

// El visor (Three.js) es carrega només quan cal
const TourPage = lazy(() => import('./pages/TourPage').then((m) => ({ default: m.TourPage })));
// El recorregut amb fotogrames reals no necessita Three.js
const FrameTourPage = lazy(() => import('./pages/FrameTourPage').then((m) => ({ default: m.FrameTourPage })));
const FRAME_TOURS = new Set(['casa-real']);

function TourRoute() {
  const { tourId = '' } = useParams();
  const Page = FRAME_TOURS.has(tourId) ? FrameTourPage : TourPage;
  return (
    <Suspense fallback={<TourFallback />}>
      <Page key={tourId} />
    </Suspense>
  );
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 60);
      return () => window.clearTimeout(t);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <a href="#main" className="skip-link">
        Salta al contingut
      </a>
      <Header />
      <main id="main" key={pathname} className="page-enter">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

function TourFallback() {
  return (
    <div className="tour tour--fallback">
      <div className="tour__loader">
        <div className="tour__loader-inner">
          <LogoMark size={44} />
          <p>Preparant la visita…</p>
          <span className="loader-bar" />
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/habitatges" element={<CatalogPage />} />
          <Route path="/habitatges/:slug" element={<PropertyPage />} />
          <Route path="/contacte" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/visita/:tourId" element={<TourRoute />} />
      </Routes>
    </>
  );
}
