import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { REAL_TOUR_ID, realPano, realProperty } from '../data/realHouse';
import { tours } from '../data/tours';
import { formatPrice } from './format';

describe('habitatge real (habitació en 360°)', () => {
  it('no inventa dades comercials', () => {
    for (const k of ['price', 'municipality', 'surface', 'bedrooms', 'bathrooms', 'year', 'energy', 'operation'] as const) expect(realProperty[k]).toBeNull();
    expect(formatPrice(realProperty.price, realProperty.operation)).toBe('Preu a consultar');
    expect(realProperty.plan).toBeUndefined();
  });
  it('la visita té una sola estança amb una panoràmica 360° completa', () => {
    const t = tours[REAL_TOUR_ID];
    expect(t.propertySlug).toBe(realProperty.slug);
    expect(Object.keys(t.scenes)).toEqual(['dormitori']);
    expect(fs.existsSync(`public${realPano.full}`)).toBe(true);
    expect(fs.existsSync(`public${realPano.preview}`)).toBe(true);
    expect(realPano.coverage).toBeGreaterThan(0.9);
    expect(realPano.coverage).toBeLessThan(1);
    // la panoràmica és equirectangular 2:1
    const buf = fs.readFileSync(`public${realPano.full}`);
    let i = 2;
    while (i < buf.length && !(buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2))) i += 2 + buf.readUInt16BE(i + 2);
    const h = buf.readUInt16BE(i + 5);
    const w = buf.readUInt16BE(i + 7);
    expect(w).toBe(2 * h);
  });
  it('les fotos de la galeria existeixen en les dues mides', () => {
    for (const im of realProperty.images) {
      expect(fs.existsSync(`public${im.src}.jpg`), im.src).toBe(true);
      expect(fs.existsSync(`public${im.src}-sm.jpg`), im.src).toBe(true);
    }
  });
  it('no queda cap material del vídeo anterior', () => {
    expect(fs.existsSync('public/media/real/casa-real')).toBe(false);
  });
});
