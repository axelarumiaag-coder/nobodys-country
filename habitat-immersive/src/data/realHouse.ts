// Habitatge real incorporat a partir d'un vídeo gravat amb mòbil.
// Les imatges i el recorregut es generen amb scripts/video/process_video.py a partir de
// scripts/video/casa-real.config.json. Aquí només s'hi afegeix el que el vídeo no pot donar:
// textos i la posició dels punts de navegació sobre els fotogrames.
//
// IMPORTANT: no s'ha inventat cap dada comercial. Preu, ubicació, superfícies, nombre
// d'habitacions i banys queden com a «pendents» fins que el propietari els proporcioni.
import generated from './casa-real.generated.json';
import type { Property } from './types';

export interface FrameHotspot {
  /** Posició sobre el fotograma, en % (0–100) */
  x: number;
  y: number;
  label: string;
  /** Parada de destinació; si no n'hi ha, és un punt informatiu */
  to?: string;
}
export interface FrameView {
  id: string;
  label: string;
  src: string;
  width: number;
  height: number;
  /** Segon del vídeo original d'on prové el fotograma */
  time: number;
  hotspots: FrameHotspot[];
}
export interface FrameStop {
  id: string;
  name: string;
  views: FrameView[];
}
export interface FrameTour {
  id: string;
  propertySlug: string;
  title: string;
  notice: string;
  stops: FrameStop[];
}

// Punts situats on el pas cap a l'altre espai és visible al fotograma
const HOTSPOTS: Record<string, FrameHotspot[]> = {
  'entrada/acces-sala': [{ x: 56, y: 60, label: "Entra a la sala d'estar", to: 'sala' }],
  'passadis/passadis': [{ x: 30, y: 52, label: 'Bany (només es veu des del passadís)' }],
  'sala/finestral': [{ x: 52, y: 58, label: 'Surt a la terrassa', to: 'terrassa' }],
  'menjador/acces-cuina': [{ x: 88, y: 48, label: 'Passa a la cuina', to: 'cuina' }],
};

export const realTour: FrameTour = {
  id: 'casa-real',
  propertySlug: 'casa-real-terrassa',
  title: 'Habitatge amb terrassa',
  notice:
    'Recorregut visual creat amb fotogrames reals d’un vídeo gravat amb mòbil. No és una visita 360° ni una reconstrucció 3D: cada vista mostra només el que la càmera va enregistrar.',
  stops: generated.stops.map((s) => ({
    id: s.id,
    name: s.name,
    views: s.views.map((v) => ({ id: v.id, label: v.label, src: v.src, width: v.width, height: v.height, time: v.time, hotspots: HOTSPOTS[`${s.id}/${v.id}`] ?? [] })),
  })),
};

const view = (stop: string, id: string) => {
  const v = realTour.stops.find((s) => s.id === stop)!.views.find((x) => x.id === id)!;
  return { src: v.src, alt: v.label, widths: [Math.round((v.width * 480) / v.height), v.width] as [number, number], portrait: true };
};

// Fotograma més representatiu de cada espai (per a miniatures)
const COVER: Record<string, string> = { entrada: 'acces-sala', sala: 'finestral', menjador: 'taula', terrassa: 'vistes', cuina: 'taulell', dormitori: 'prestatges' };

export const realProperty: Property = {
  slug: 'casa-real-terrassa',
  reference: 'HI-REAL-001',
  title: 'Habitatge amb terrassa',
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
  tourId: 'casa-real',
  tourKind: 'frames',
  summary: 'Un habitatge real presentat a partir d’un vídeo: sala d’estar amb finestral, zona de menjador, cuina i una terrassa àmplia amb vistes als terrats veïns.',
  description: [
    'Aquesta fitxa s’ha preparat exclusivament a partir d’un vídeo gravat amb mòbil. La descripció es limita al que s’hi veu; les dades comercials s’afegiran quan el propietari les confirmi.',
    'Des de l’entrada, una porta de fusta treballada i un pas en arc donen a la sala d’estar, amb parets de color terracota, terra de rajola i un gran finestral amb cortines que dona a la terrassa. Al vídeo també s’hi veu una llar de foc amb revestiment de pedra.',
    'La zona de menjador té mobles de fusta, un moble escriptori i una taula. La cuina, amb mobles de fusta i taulell fosc, inclou una columna amb forn i microones i armaris alts.',
    'La terrassa és l’espai més ampli del vídeo: paviment de rajola, una zona coberta, jardineres, una caseta de fusta i vistes obertes als habitatges veïns. El recorregut acaba en un dormitori amb prestatges de llibres; també s’hi veuen un passadís i, de lluny, un bany.',
  ],
  features: [
    'Terrassa amb zona coberta i jardineres',
    'Caseta de fusta a la terrassa',
    'Finestral amb sortida a la terrassa',
    'Llar de foc amb revestiment de pedra',
    'Cuina amb columna de forn i microones',
    'Terra de rajola a la zona de dia',
  ],
  images: [
    view('terrassa', 'caseta'),
    view('sala', 'finestral'),
    view('entrada', 'acces-sala'),
    view('menjador', 'taula'),
    view('cuina', 'taulell'),
    view('terrassa', 'vistes'),
    view('terrassa', 'jardineres'),
    view('dormitori', 'prestatges'),
  ],
  spaces: realTour.stops.map((s) => ({ id: s.id, name: s.name, image: (s.views.find((v) => v.id === COVER[s.id]) ?? s.views[0]).src })),
  video: generated.clip,
};
