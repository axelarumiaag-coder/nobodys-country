export type Operation = 'compra' | 'lloguer';
export type PropertyType = 'Pis' | 'Àtic' | 'Casa' | 'Masia' | 'Apartament';

export interface PropertyImage {
  /** Ruta base sense extensió dins de /public. Es generen variants `.jpg` (1600 px) i `-sm.jpg` (800 px). */
  src: string;
  alt: string;
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

export interface Property {
  slug: string;
  reference: string;
  title: string;
  operation: Operation;
  type: PropertyType;
  price: number;
  municipality: string;
  area: string; // comarca
  neighbourhood: string;
  surface: number;
  outdoorSurface?: number;
  bedrooms: number;
  bathrooms: number;
  floor?: string;
  year: number;
  energy: 'A' | 'B' | 'C' | 'D' | 'E';
  summary: string;
  description: string[];
  features: string[];
  images: PropertyImage[];
  tourId?: string;
  featured?: boolean;
  plan: FloorPlanData;
}
