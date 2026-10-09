import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { properties } from '../data/properties';
import { applyFilters, activeFilterCount, defaultFilters, filtersFromParams, filtersToParams, type Filters, type SortOrder } from '../lib/filters';
import { FilterPanel } from '../components/FilterPanel';
import { PropertyCard } from '../components/PropertyCard';
import { Icon } from '../components/Icon';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const results = useMemo(() => applyFilters(properties, filters), [filters]);
  const [panelOpen, setPanelOpen] = useState(false);
  const count = activeFilterCount(filters);

  useEffect(() => {
    document.title = 'Habitatges — HABITAT IMMERSIVE';
  }, []);

  // Guardem els paràmetres més recents en una ref: dos canvis seguits no es trepitgen
  // encara que el render sigui asíncron (React Router no encua les actualitzacions funcionals).
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  }, [params]);
  const update = (patch: Partial<Filters>) => {
    const next = filtersToParams({ ...filtersFromParams(latest.current), ...patch });
    latest.current = next;
    setParams(next, { replace: true });
  };

  return (
    <div className="page catalog">
      <div className="container">
        <header className="page__head">
          <p className="eyebrow">Catàleg</p>
          <h1 className="page__title">Habitatges</h1>
          <p className="lead">Sis habitatges de demostració a Catalunya. Tots els anuncis són ficticis.</p>
        </header>

        <div className="catalog__layout">
          <aside className={`catalog__filters${panelOpen ? ' is-open' : ''}`}>
            <div className="catalog__filters-head">
              <h2>Filtres</h2>
              <button className="tour-btn tour-btn--light" onClick={() => setPanelOpen(false)} aria-label="Tanca els filtres">
                <Icon name="close" />
              </button>
            </div>
            <FilterPanel filters={filters} onChange={update} />
            <button className="btn btn--primary btn--block catalog__apply" onClick={() => setPanelOpen(false)}>
              Mostra {results.length} {results.length === 1 ? 'resultat' : 'resultats'}
            </button>
          </aside>

          <section className="catalog__results" aria-label="Resultats">
            <div className="catalog__bar">
              <p className="catalog__count" aria-live="polite" data-testid="result-count">
                <strong>{results.length}</strong> {results.length === 1 ? 'habitatge' : 'habitatges'}
              </p>
              <button className="btn btn--ghost btn--small catalog__filter-btn" onClick={() => setPanelOpen(true)}>
                <Icon name="sliders" size={18} /> Filtres{count ? ` (${count})` : ''}
              </button>
              <label className="catalog__sort">
                <span>Ordena per</span>
                <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortOrder })} name="sort">
                  <option value="relevancia">Rellevància</option>
                  <option value="preu-asc">Preu: de menor a major</option>
                  <option value="preu-desc">Preu: de major a menor</option>
                </select>
              </label>
            </div>

            {results.length ? (
              <div className="grid grid--cards grid--catalog">
                {results.map((p, i) => (
                  <div key={p.slug} className="card-enter" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                    <PropertyCard property={p} priority={i < 2} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                <Icon name="search" size={32} />
                <h2>Cap habitatge coincideix amb aquests filtres</h2>
                <p>Prova d'ampliar el pressupost o de treure algun filtre.</p>
                <button className="btn btn--primary" onClick={() => update({ ...defaultFilters })}>
                  Esborra els filtres
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
      {panelOpen && <div className="scrim" onClick={() => setPanelOpen(false)} aria-hidden="true" />}
    </div>
  );
}
