export type Operation = 'compra' | 'lloguer';
export type PropertyType = 'Pis' | 'Àtic' | 'Casa' | 'Masia' | 'Apartament' | 'Habitatge';

export interface PropertyImage {
  /** Ruta base sense extensió dins de /public. Es generen variants `.jpg` (1600 px) i `-sm.jpg` (800 px). */
  src: string;
  alt: string;
  /** Mides reals [petita, gran] en píxels d'amplada, si no són les estàndard (800 / 1600) */
  widths?: [number, number];
  /** Imatge vertical (p. ex. fotogrames de vídeo de mòbil) */
  portrait?: boolean;
}

/** Plànol esquemàtic en metres. x cap a la dreta, z cap avall. */
export interface PlanRoom {
  name: string;
  rect: [number, number, number, number]; // x0, z0, x1, z1
  /** Identificador d'estança de la visita virtual, si n'hi ha */
  sceneId?: string;
  kind?: 'room' | 'outdoor' | 'service';
}
export interface PlanOpening {
  x: number;
  z: number;
  w: number;
  axis: 'x' | 'z';
}
export interface FloorPlanData {
  bounds: { x: number; z: number; w: number; h: number };
  rooms: PlanRoom[];
  doors?: PlanOpening[];
  windows?: PlanOpening[];
  openings?: PlanOpening[];
}

/**
 * Un habitatge del catàleg. Els camps comercials poden ser `null` quan la dada no s'ha
 * proporcionat (p. ex. una propietat real afegida a partir d'un vídeo): la interfície
 * mostra «Preu a consultar» o «Informació pendent» en lloc d'inventar-la.
 */
export interface Property {
  slug: string;
  reference: string;
  title: string;
  /** 'demo' = anunci fictici; 'real' = habitatge real a partir de material propi */
  kind?: 'demo' | 'real';
  operation: Operation | null;
  type: PropertyType;
  price: number | null;
  municipality: string | null;
  area: string | null; // comarca
  neighbourhood: string | null;
  surface: number | null;
  outdoorSurface?: number;
  bedrooms: number | null;
  bathrooms: number | null;
  floor?: string;
  year: number | null;
  energy: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  summary: string;
  description: string[];
  features: string[];
  images: PropertyImage[];
  tourId?: string;
  /** Tipus d'experiència: panoràmiques 360° o recorregut visual amb fotogrames reals */
  tourKind?: '360' | 'frames';
  featured?: boolean;
  plan?: FloorPlanData;
  /** Espais identificats visualment (només per a habitatges reals) */
  spaces?: { id: string; name: string; image: string }[];
  /** Vídeo de recorregut editat (sense àudio) amb capítols */
  video?: { src: string; webm?: string; poster: string; duration: number; chapters: { stop: string; label: string; start: number }[] };
}
