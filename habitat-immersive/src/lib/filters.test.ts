import { describe, expect, it } from 'vitest';
import { properties } from '../data/properties';
import { applyFilters, defaultFilters, filtersFromParams, filtersToParams, activeFilterCount } from './filters';

describe('filtres del catàleg', () => {
  it('sense filtres mostra els set habitatges (6 de demo + 1 real)', () => {
    expect(properties).toHaveLength(7);
    expect(applyFilters(properties, defaultFilters)).toHaveLength(7);
  });
  it('filtra per operació', () => {
    const lloguer = applyFilters(properties, { ...defaultFilters, operation: 'lloguer' });
    expect(lloguer.length).toBeGreaterThan(0);
    expect(lloguer.every((p) => p.operation === 'lloguer')).toBe(true);
    const compra = applyFilters(properties, { ...defaultFilters, operation: 'compra' });
    // l'habitatge real no té operació confirmada: no apareix si es filtra per operació
    expect(compra.length + lloguer.length).toBe(6);
  });
  it('filtra per municipi, preu, habitacions, superfície i visita virtual', () => {
    expect(applyFilters(properties, { ...defaultFilters, municipality: 'Sitges' }).map((p) => p.slug)).toEqual(['atic-terrassa-sitges']);
    expect(applyFilters(properties, { ...defaultFilters, operation: 'compra', maxPrice: 600000 }).every((p) => p.price <= 600000)).toBe(true);
    expect(applyFilters(properties, { ...defaultFilters, minPrice: 1000000 }).every((p) => p.price >= 1000000)).toBe(true);
    expect(applyFilters(properties, { ...defaultFilters, minBedrooms: 4 }).every((p) => p.bedrooms >= 4)).toBe(true);
    expect(applyFilters(properties, { ...defaultFilters, minSurface: 200 }).every((p) => p.surface >= 200)).toBe(true);
    const tours = applyFilters(properties, { ...defaultFilters, tourOnly: true });
    expect(tours.length).toBe(3);
    expect(tours.every((p) => p.tourId)).toBe(true);
  });
  it('ordena per preu', () => {
    const asc = applyFilters(properties, { ...defaultFilters, sort: 'preu-asc' })
      .map((p) => p.price)
      .filter((p): p is number => p != null);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = applyFilters(properties, { ...defaultFilters, sort: 'preu-desc' })
      .map((p) => p.price)
      .filter((p): p is number => p != null);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });
  it('serialitza i llegeix els filtres de la URL', () => {
    const f = { ...defaultFilters, operation: 'compra' as const, municipality: 'Girona', maxPrice: 400000, minBedrooms: 2, tourOnly: true, sort: 'preu-desc' as const };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    expect(activeFilterCount(f)).toBe(5);
    expect(filtersFromParams(new URLSearchParams('operacio=xx&max=abc'))).toEqual(defaultFilters);
  });
  it('les dades pendents no compleixen filtres i van al final en ordenar per preu', () => {
    const real = properties.find((p) => p.kind === 'real')!;
    expect(real.price).toBeNull();
    expect(applyFilters(properties, { ...defaultFilters, maxPrice: 10_000_000 })).not.toContain(real);
    expect(applyFilters(properties, { ...defaultFilters, minBedrooms: 1 })).not.toContain(real);
    expect(applyFilters(properties, { ...defaultFilters, sort: 'preu-asc' }).at(-1)).toBe(real);
    expect(applyFilters(properties, { ...defaultFilters, sort: 'preu-desc' }).at(-1)).toBe(real);
    expect(applyFilters(properties, defaultFilters)[0]).toBe(real);
  });
});
