import { describe, expect, it } from 'vitest';
import { tours } from '../data/tours';
import { properties } from '../data/properties';
import { shortestDelta, vectorToView, viewToVector, wrapDeg } from './sphere';

describe('visita virtual', () => {
  it('cada visita de demostració té les quatre estances connectades', () => {
    for (const t of Object.values(tours).filter((x) => x.id !== 'habitacio-real')) {
      expect(Object.keys(t.scenes).sort()).toEqual(['cuina', 'dormitori', 'dormitori2', 'sala']);
      for (const s of Object.values(t.scenes)) {
        expect(s.links.length).toBeGreaterThan(0);
        for (const l of s.links) expect(t.scenes[l.to]).toBeDefined();
      }
      // totes les estances són accessibles des de l'inici
      const seen = new Set([t.start]);
      const queue = [t.start];
      while (queue.length) for (const l of t.scenes[queue.shift()!].links) if (!seen.has(l.to)) (seen.add(l.to), queue.push(l.to));
      expect(seen.size).toBe(4);
      expect(properties.find((p) => p.slug === t.propertySlug)?.tourId).toBe(t.id);
    }
  });
  it('les conversions yaw/pitch ↔ vector són coherents', () => {
    for (const [y, p] of [
      [0, 0],
      [90, 10],
      [-135, -30],
      [179, 45],
    ]) {
      const v = viewToVector(y, p);
      const r = vectorToView(...v);
      expect(r.yaw).toBeCloseTo(y, 6);
      expect(r.pitch).toBeCloseTo(p, 6);
    }
    expect(wrapDeg(190)).toBe(-170);
    expect(shortestDelta(170, -170)).toBe(20);
  });
  it('les panoràmiques i les imatges referenciades existeixen', async () => {
    const fs = await import('node:fs');
    const exists = (p: string) => fs.existsSync(`public${p}`);
    for (const t of Object.values(tours))
      for (const s of Object.values(t.scenes)) {
        expect(exists(s.full), s.full).toBe(true);
        expect(exists(s.preview), s.preview).toBe(true);
      }
    for (const p of properties)
      for (const im of p.images) {
        expect(exists(`${im.src}.jpg`), im.src).toBe(true);
        expect(exists(`${im.src}-sm.jpg`), im.src).toBe(true);
      }
  });
});
