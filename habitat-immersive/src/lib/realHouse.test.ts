import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { realProperty, realTour } from '../data/realHouse';
import { formatPrice } from './format';

describe('habitatge real a partir del vídeo', () => {
  it('no inventa dades comercials', () => {
    for (const k of ['price', 'municipality', 'surface', 'bedrooms', 'bathrooms', 'year', 'energy', 'operation'] as const) expect(realProperty[k]).toBeNull();
    expect(formatPrice(realProperty.price, realProperty.operation)).toBe('Preu a consultar');
    expect(realProperty.plan).toBeUndefined();
  });
  it('el recorregut té els espais del vídeo i cada imatge existeix', () => {
    expect(realTour.stops.map((s) => s.id)).toEqual(['entrada', 'passadis', 'sala', 'menjador', 'terrassa', 'cuina', 'dormitori']);
    for (const s of realTour.stops) {
      expect(s.views.length).toBeGreaterThan(0);
      for (const v of s.views) {
        expect(fs.existsSync(`public${v.src}.jpg`), v.src).toBe(true);
        expect(fs.existsSync(`public${v.src}-sm.jpg`), v.src).toBe(true);
        expect(v.height).toBeGreaterThan(v.width); // fotogrames verticals de mòbil
        expect(v.height).toBeLessThanOrEqual(1024);
      }
    }
  });
  it('els punts de navegació porten a espais existents i estan dins de la imatge', () => {
    const ids = new Set(realTour.stops.map((s) => s.id));
    const all = realTour.stops.flatMap((s) => s.views.flatMap((v) => v.hotspots));
    expect(all.filter((h) => h.to).length).toBeGreaterThanOrEqual(3);
    for (const h of all) {
      if (h.to) expect(ids.has(h.to)).toBe(true);
      expect(h.x).toBeGreaterThan(0);
      expect(h.x).toBeLessThan(100);
      expect(h.y).toBeGreaterThan(0);
      expect(h.y).toBeLessThan(100);
    }
  });
  it('el vídeo editat és lleuger i té un capítol per espai', () => {
    const v = realProperty.video!;
    expect(fs.statSync(`public${v.src}`).size).toBeLessThan(5_000_000);
    expect(v.chapters.map((c) => c.stop)).toEqual(realTour.stops.map((s) => s.id));
    expect(v.chapters.every((c, i, a) => i === 0 || c.start > a[i - 1].start)).toBe(true);
  });
  it('les panoràmiques 360° recreades existeixen i declaren la zona realment gravada', () => {
    const withPano = realTour.stops.filter((s) => s.pano);
    expect(withPano.map((s) => s.id).sort()).toEqual(['cuina', 'sala', 'terrassa']);
    for (const s of withPano) {
      const p = s.pano!;
      expect(fs.existsSync(`public${p.full}`), p.full).toBe(true);
      expect(fs.existsSync(`public${p.preview}`), p.preview).toBe(true);
      expect(p.horizontalDegrees).toBeGreaterThan(60);
      expect(p.horizontalDegrees).toBeLessThan(360); // no és una esfera completa
      expect(p.coverage).toBeGreaterThan(0);
      expect(p.coverage).toBeLessThan(1);
      // el rang de mirada coincideix amb els graus horitzontals gravats
      expect(Math.abs(p.yaw[1] - p.yaw[0] - p.horizontalDegrees)).toBeLessThan(3);
      expect(p.pitch[0]).toBeLessThan(p.pitch[1]);
    }
  });
});
