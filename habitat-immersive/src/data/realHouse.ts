// Habitatge real: de moment només se n'ha fotografiat una estança (un dormitori).
// La panoràmica 360° s'ha muntat amb scripts/video/sphere_from_photos.py a partir de 10 fotos
// fetes amb un iPhone (objectiu 0,5×) des del centre de l'habitació. Les fotos de la galeria són
// vistes extretes de la mateixa panoràmica (scripts/video/views_from_pano.py).
//
// IMPORTANT: no s'ha inventat cap dada comercial. Preu, ubicació, superfícies, nombre
// d'habitacions i banys queden com a «pendents» fins que el propietari els proporcioni.
import type { Property } from './types';

const BASE = '/media/real/habitacio';
const foto = (n: number, alt: string) => ({ src: `${BASE}/fotos/${n}`, alt });

export const REAL_TOUR_ID = 'habitacio-real';

export const realPano = {
  full: `${BASE}/dormitori.jpg`,
  preview: `${BASE}/dormitori-preview.jpg`,
  /** Fotos utilitzades i fracció de l'esfera coberta per imatge real */
  photos: 10,
  coverage: 0.955,
};

export const realProperty: Property = {
  slug: 'habitacio-real',
  reference: 'HI-REAL-001',
  title: 'Habitació real en 360°',
  kind: 'real',
  operation: null,
  type: 'Habitatge',
  price: null,
  municipality: null,
  area: null,
  neighbourhood: null,
  surface: null,
  bedrooms: null,
  bathrooms: null,
  year: null,
  energy: null,
  featured: true,
  tourId: REAL_TOUR_ID,
  summary: 'Un dormitori real fotografiat amb un iPhone i convertit en una visita 360°. De moment és l’única estança disponible d’aquest habitatge.',
  description: [
    'Aquesta fitxa es basa exclusivament en les fotos d’una habitació. La descripció es limita al que s’hi veu; les dades de l’habitatge s’afegiran quan el propietari les confirmi.',
    'És un dormitori amb un llit, un armari de fusta de pi de dues portes, un escriptori amb cadira i flexo, i prestatges amb llibres a la paret. Té terra de fusta, parets blanques amb gotelé, un radiador i una porta interior.',
    'Pots entrar-hi i mirar al voltant en 360°: la panoràmica s’ha muntat amb deu fotos fetes des del centre de l’habitació.',
  ],
  features: ['Armari de fusta de dues portes', 'Escriptori amb cadira', 'Prestatges per a llibres', 'Terra de fusta', 'Radiador', 'Llum de sostre'],
  images: [
    foto(1, 'Escriptori amb cadira, flexo i prestatges de llibres'),
    foto(2, 'Armari de fusta de pi de dues portes'),
    foto(3, 'Llit al costat de l’armari'),
    foto(4, 'Porta de l’habitació'),
  ],
};
