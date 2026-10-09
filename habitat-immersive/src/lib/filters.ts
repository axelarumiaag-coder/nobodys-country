import type { Operation, Property } from '../data/types';

export type SortOrder = 'relevancia' | 'preu-asc' | 'preu-desc';

export interface Filters {
  operation: Operation | 'totes';
  municipality: string; // '' = tots
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number; // 0 = qualsevol
  minSurface: number; // 0 = qualsevol
  tourOnly: boolean;
  sort: SortOrder;
}

export const defaultFilters: Filters = {
  operation: 'totes',
  municipality: '',
  minPrice: null,
  maxPrice: null,
  minBedrooms: 0,
  minSurface: 0,
  tourOnly: false,
  sort: 'relevancia',
};

export function applyFilters(list: Property[], f: Filters): Property[] {
  const out = list.filter((p) => {
    if (f.operation !== 'totes' && p.operation !== f.operation) return false;
    if (f.municipality && p.municipality !== f.municipality) return false;
    if (f.minPrice != null && p.price < f.minPrice) return false;
    if (f.maxPrice != null && p.price > f.maxPrice) return false;
    if (f.minBedrooms && p.bedrooms < f.minBedrooms) return false;
    if (f.minSurface && p.surface < f.minSurface) return false;
    if (f.tourOnly && !p.tourId) return false;
    return true;
  });
  if (f.sort === 'preu-asc') out.sort((a, b) => a.price - b.price);
  else if (f.sort === 'preu-desc') out.sort((a, b) => b.price - a.price);
  else out.sort((a, b) => Number(!!b.featured) + Number(!!b.tourId) - (Number(!!a.featured) + Number(!!a.tourId)));
  return out;
}

const num = (v: string | null) => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Llegeix els filtres de la URL (?operacio=compra&municipi=Sitges&max=600000...) */
export function filtersFromParams(params: URLSearchParams): Filters {
  const op = params.get('operacio');
  const sort = params.get('ordre');
  return {
    operation: op === 'compra' || op === 'lloguer' ? op : 'totes',
    municipality: params.get('municipi') ?? '',
    minPrice: num(params.get('min')),
    maxPrice: num(params.get('max')),
    minBedrooms: num(params.get('habitacions')) ?? 0,
    minSurface: num(params.get('superficie')) ?? 0,
    tourOnly: params.get('visita') === '1',
    sort: sort === 'preu-asc' || sort === 'preu-desc' ? sort : 'relevancia',
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.operation !== 'totes') p.set('operacio', f.operation);
  if (f.municipality) p.set('municipi', f.municipality);
  if (f.minPrice != null) p.set('min', String(f.minPrice));
  if (f.maxPrice != null) p.set('max', String(f.maxPrice));
  if (f.minBedrooms) p.set('habitacions', String(f.minBedrooms));
  if (f.minSurface) p.set('superficie', String(f.minSurface));
  if (f.tourOnly) p.set('visita', '1');
  if (f.sort !== 'relevancia') p.set('ordre', f.sort);
  return p;
}

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.operation !== 'totes') n++;
  if (f.municipality) n++;
  if (f.minPrice != null) n++;
  if (f.maxPrice != null) n++;
  if (f.minBedrooms) n++;
  if (f.minSurface) n++;
  if (f.tourOnly) n++;
  return n;
}
