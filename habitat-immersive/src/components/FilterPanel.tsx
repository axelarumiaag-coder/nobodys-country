import { municipalities } from '../data/properties';
import { activeFilterCount, defaultFilters, type Filters } from '../lib/filters';

interface Props {
  filters: Filters;
  /** Rep només els camps que canvien; el pare els combina amb l'estat més recent */
  onChange: (patch: Partial<Filters>) => void;
}

const BEDS = [0, 1, 2, 3, 4];
const SURFACES = [0, 60, 80, 100, 150, 200];

export function FilterPanel({ filters: f, onChange }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ [k]: v } as Partial<Filters>);
  const priceStep = f.operation === 'lloguer' ? 50 : 5000;
  const parsePrice = (v: string) => (v === '' ? null : Math.max(0, Number(v)));
  const count = activeFilterCount(f);

  return (
    <div className="filters" aria-label="Filtres">
      <fieldset className="filters__group">
        <legend>Operació</legend>
        <div className="segmented">
          {(
            [
              ['totes', 'Totes'],
              ['compra', 'Comprar'],
              ['lloguer', 'Llogar'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className={`segmented__opt${f.operation === v ? ' is-active' : ''}`}>
              <input type="radio" name="operation" value={v} checked={f.operation === v} onChange={() => onChange({ operation: v, minPrice: null, maxPrice: null })} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="filters__group">
        <span className="filters__label">Municipi</span>
        <select value={f.municipality} onChange={(e) => set('municipality', e.target.value)} name="municipality">
          <option value="">Tots els municipis</option>
          {municipalities.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="filters__group">
        <legend>Preu {f.operation === 'lloguer' ? '(€/mes)' : '(€)'}</legend>
        <div className="filters__row">
          <label className="filters__input">
            <span className="sr-only">Preu mínim</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={priceStep}
              placeholder="Mínim"
              name="minPrice"
              value={f.minPrice ?? ''}
              onChange={(e) => set('minPrice', parsePrice(e.target.value))}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label className="filters__input">
            <span className="sr-only">Preu màxim</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={priceStep}
              placeholder="Màxim"
              name="maxPrice"
              value={f.maxPrice ?? ''}
              onChange={(e) => set('maxPrice', parsePrice(e.target.value))}
            />
          </label>
        </div>
        {f.minPrice != null && f.maxPrice != null && f.minPrice > f.maxPrice && <p className="filters__warn">El preu mínim és superior al màxim.</p>}
      </fieldset>

      <fieldset className="filters__group">
        <legend>Habitacions</legend>
        <div className="chips">
          {BEDS.map((b) => (
            <label key={b} className={`chip${f.minBedrooms === b ? ' is-active' : ''}`}>
              <input type="radio" name="beds" checked={f.minBedrooms === b} onChange={() => set('minBedrooms', b)} />
              {b === 0 ? 'Totes' : `${b}+`}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="filters__group">
        <span className="filters__label">Superfície mínima</span>
        <select value={f.minSurface} onChange={(e) => set('minSurface', Number(e.target.value))} name="surface">
          {SURFACES.map((s) => (
            <option key={s} value={s}>
              {s === 0 ? 'Qualsevol' : `Des de ${s} m²`}
            </option>
          ))}
        </select>
      </label>

      <label className="switch">
        <input type="checkbox" checked={f.tourOnly} onChange={(e) => set('tourOnly', e.target.checked)} name="tourOnly" />
        <span className="switch__track" aria-hidden="true" />
        <span>Només amb visita virtual 360°</span>
      </label>

      <button type="button" className="btn btn--ghost btn--block" disabled={count === 0} onClick={() => onChange({ ...defaultFilters, sort: f.sort })}>
        Esborra els filtres{count ? ` (${count})` : ''}
      </button>
    </div>
  );
}
