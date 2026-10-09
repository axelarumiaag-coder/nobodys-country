// Definició de les visites virtuals. Cada estança és una panoràmica equirectangular 2:1.
// Els punts de navegació s'expressen en graus (yaw/pitch) des del punt de captura,
// el mateix format que faríeu servir amb fotografies 360° reals.
import layout from './demoTourLayout.json';
import { asset } from '../lib/asset';

export interface TourView {
  yaw: number; // graus, 0 = +X; creix cap a +Z (vegeu src/lib/sphere.ts)
  pitch: number; // graus, positiu cap amunt
}
export interface TourLink extends TourView {
  to: string;
  label: string;
}
export interface TourScene {
  id: string;
  name: string;
  /** Panoràmica de baixa resolució que es mostra mentre carrega la definitiva */
  preview: string;
  /** Panoràmica a resolució completa (4096 × 2048) */
  full: string;
  initialView: TourView;
  links: TourLink[];
  /** Punt de captura sobre el plànol (metres) */
  planPoint: [number, number];
}
export interface Tour {
  id: string;
  propertySlug: string;
  title: string;
  /** Avís que es mostra dins del visor */
  notice: string;
  start: string;
  scenes: Record<string, TourScene>;
}

const NOTICE =
  'Visita de demostració: panoràmiques 360° renderitzades a partir d’un model 3D fictici. Pots mirar al voltant i canviar d’estança, però no és un desplaçament lliure per l’espai.';

function buildScenes(tourId: string): Record<string, TourScene> {
  const scenes: Record<string, TourScene> = {};
  for (const [id, r] of Object.entries(layout.rooms)) {
    scenes[id] = {
      id,
      name: r.name,
      preview: asset(`/media/tours/${tourId}/${id}-preview.jpg`),
      full: asset(`/media/tours/${tourId}/${id}.jpg`),
      initialView: r.initialView,
      planPoint: r.viewpoint as [number, number],
      links: layout.links.filter((l) => l.from === id).map((l) => ({ to: l.to, label: l.label, yaw: l.yaw, pitch: l.pitch })),
    };
  }
  return scenes;
}

export const tours: Record<string, Tour> = {
  'atic-sitges': {
    id: 'atic-sitges',
    propertySlug: 'atic-terrassa-sitges',
    title: 'Àtic amb terrassa i vistes al mar',
    notice: NOTICE,
    start: 'sala',
    scenes: buildScenes('atic-sitges'),
  },
  'pis-girona': {
    id: 'pis-girona',
    propertySlug: 'pis-obra-nova-girona',
    title: "Pis d'obra nova amb balcó",
    notice: NOTICE,
    start: 'sala',
    scenes: buildScenes('pis-girona'),
  },
};
