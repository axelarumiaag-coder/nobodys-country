// Catàleg. Els anuncis de `demoProperties` són FICTICIS: preus, adreces i característiques
// s'han inventat per a aquesta demo. `realProperty` és un habitatge real afegit a partir d'un
// vídeo (vegeu realHouse.ts): no té dades comercials inventades.
import type { FloorPlanData, Property } from './types';
import layout from './demoTourLayout.json';
import { realProperty } from './realHouse';

const img = (slug: string, n: number, alt: string) => ({ src: `/media/properties/${slug}/${n}`, alt });

/** Plànol de la tipologia renderitzada (compartit per les dues propietats amb visita) */
export const demoTourPlan: FloorPlanData = {
  bounds: { x: 0, z: -3.3, w: 10, h: 11.7 },
  rooms: [
    { name: 'Terrassa', rect: [0, -3.3, 10, 0], kind: 'outdoor' },
    ...Object.entries(layout.rooms).map(([id, r]) => ({
      name: r.name,
      rect: r.rect as [number, number, number, number],
      sceneId: id,
    })),
    ...layout.extraRooms.map((r) => ({ name: r.name, rect: r.rect as [number, number, number, number], kind: 'service' as const })),
  ],
  doors: layout.doors as FloorPlanData['doors'],
  windows: layout.windows as FloorPlanData['windows'],
  openings: layout.openings as FloorPlanData['openings'],
};

const demoProperties: Property[] = [
  {
    slug: 'atic-terrassa-sitges',
    reference: 'HI-DEMO-001',
    title: 'Àtic amb terrassa i vistes al mar',
    operation: 'compra',
    type: 'Àtic',
    price: 595000,
    municipality: 'Sitges',
    area: 'Garraf',
    neighbourhood: 'Terramar',
    surface: 92,
    outdoorSurface: 32,
    bedrooms: 2,
    bathrooms: 1,
    floor: '4a planta amb ascensor',
    year: 2019,
    energy: 'A',
    featured: true,
    tourId: 'atic-sitges',
    summary: 'Un àtic lluminós amb sala oberta a una terrassa de 32 m² davant del Mediterrani.',
    description: [
      "Aquest àtic s'organitza al voltant d'una gran sala d'estar amb vidriera de terra a sostre que s'obre a una terrassa de 32 m². La llum entra tot el dia i la vista sobre el mar es converteix en el veritable protagonista de la casa.",
      'La cuina, oberta a la sala amb una illa central, combina mobiliari de tons oliva, taulell de pedra natural i prestatges de fusta. La zona de dia queda clarament separada del descans: dos dormitoris exteriors, el principal amb armari encastat, i un bany complet.',
      'Els acabats són contemporanis i càlids: parquet de roure, fusteria amb trencament de pont tèrmic, climatització per aerotèrmia i persianes motoritzades. Una llar pensada per viure-hi tot l’any.',
    ],
    features: [
      'Terrassa de 32 m² orientada al mar',
      'Cuina oberta amb illa',
      'Parquet de roure natural',
      'Aerotèrmia i terra radiant',
      'Fusteria amb vidre baix emissiu',
      'Ascensor i plaça d’aparcament opcional',
    ],
    images: [
      img('atic-sitges', 1, "Terrassa de l'àtic amb vistes al mar a l'hora daurada"),
      img('atic-sitges', 2, "Sala d'estar amb sofà de lli, butaca oliva i menjador"),
      img('atic-sitges', 3, 'Cuina oberta amb illa central i mobles verd oliva'),
      img('atic-sitges', 4, 'Dormitori principal amb llit de matrimoni i tauletes de fusta'),
      img('atic-sitges', 5, "Sala d'estar oberta a la terrassa a través de la vidriera"),
    ],
    plan: demoTourPlan,
  },
  {
    slug: 'casa-piscina-begur',
    reference: 'HI-DEMO-002',
    title: 'Casa mediterrània amb piscina',
    operation: 'compra',
    type: 'Casa',
    price: 1290000,
    municipality: 'Begur',
    area: 'Baix Empordà',
    neighbourhood: 'Sa Riera',
    surface: 248,
    outdoorSurface: 860,
    bedrooms: 4,
    bathrooms: 3,
    year: 2016,
    energy: 'B',
    featured: true,
    summary: 'Arquitectura blanca, pedra local i una piscina orientada a la posta de sol.',
    description: [
      "Casa unifamiliar de línies netes situada en una parcel·la de 860 m² envoltada de pins i oliveres. Els volums blancs es combinen amb un mur de pedra local que dialoga amb el paisatge de l'Empordà.",
      'La planta baixa és un gran espai diàfan de sala, menjador i cuina que s’obre al porxo i a la piscina mitjançant vidrieres corredisses. A la planta superior, la suite principal disposa de terrassa pròpia.',
      'Jardí mediterrani de baix consum, pèrgola de fusta, zona de gandules i un aparcament cobert per a dos vehicles.',
    ],
    features: ['Piscina de 10 × 4 m', 'Parcel·la de 860 m²', 'Suite amb terrassa', 'Porxo amb pèrgola', 'Plaques fotovoltaiques', 'Garatge per a dos cotxes'],
    images: [
      img('casa-begur', 1, 'Façana de la casa blanca amb piscina i jardí mediterrani'),
      img('casa-begur', 2, "Sala d'estar amb acabats càlids de fusta"),
      img('casa-begur', 3, 'Bany amb banyera exempta i rajola artesanal'),
      img('casa-begur', 4, 'Dormitori amb tèxtils naturals'),
    ],
    plan: {
      bounds: { x: 0, z: 0, w: 16, h: 12 },
      rooms: [
        { name: 'Sala-menjador', rect: [0, 0, 8, 6] },
        { name: 'Cuina', rect: [8, 0, 12, 6] },
        { name: 'Rebost', rect: [12, 0, 16, 3], kind: 'service' },
        { name: 'Bany', rect: [12, 3, 16, 6], kind: 'service' },
        { name: 'Dormitori', rect: [0, 6, 5, 12] },
        { name: 'Dormitori', rect: [5, 6, 9.5, 12] },
        { name: 'Distribuïdor', rect: [9.5, 6, 11, 12], kind: 'service' },
        { name: 'Suite', rect: [11, 6, 16, 12] },
      ],
      doors: [
        { x: 2, z: 6, w: 0.9, axis: 'x' },
        { x: 9.6, z: 6, w: 0.8, axis: 'x' },
        { x: 13, z: 3, w: 0.8, axis: 'x' },
      ],
      windows: [
        { x: 1, z: 0, w: 6, axis: 'x' },
        { x: 9, z: 0, w: 2, axis: 'x' },
        { x: 0, z: 7.5, w: 2.5, axis: 'z' },
        { x: 16, z: 7.5, w: 3, axis: 'z' },
      ],
      openings: [{ x: 8, z: 1, w: 4, axis: 'z' }],
    },
  },
  {
    slug: 'pis-senyorial-born',
    reference: 'HI-DEMO-003',
    title: 'Pis senyorial al Born',
    operation: 'lloguer',
    type: 'Pis',
    price: 2150,
    municipality: 'Barcelona',
    area: 'Barcelonès',
    neighbourhood: 'el Born',
    surface: 84,
    bedrooms: 2,
    bathrooms: 1,
    floor: '2a planta',
    year: 1890,
    energy: 'D',
    featured: true,
    summary: 'Sostres alts, balcons de forja i el caràcter del Barcelona antic, totalment renovat.',
    description: [
      'Pis en una finca de finals del segle XIX amb façana restaurada, balcons de forja i persianes de llibret. La rehabilitació ha conservat els elements amb valor patrimonial i ha incorporat instal·lacions noves.',
      "La sala d'estar ocupa la part de façana i rep la llum a través de dos balcons. La cuina, independent, s'ha resolt amb mobles d'un verd profund i taulell clar.",
      'Lloguer de llarga durada. Es lliura moblat o sense mobles segons preferència.',
    ],
    features: ['Sostres de 3,4 m', 'Dos balcons a façana', 'Finca restaurada', 'Aire condicionat per conductes', 'Moblat opcional', 'A 5 minuts del parc de la Ciutadella'],
    images: [
      img('pis-born', 1, 'Façana històrica amb balcons de forja i persianes verdes'),
      img('pis-born', 2, "Sala d'estar amb sofà de vellut oliva"),
      img('pis-born', 3, 'Cuina amb mobles de color verd fosc'),
      img('pis-born', 4, 'Segon dormitori amb escriptori sota la finestra'),
    ],
    plan: {
      bounds: { x: 0, z: 0, w: 7, h: 13 },
      rooms: [
        { name: 'Sala', rect: [0, 0, 7, 4.5] },
        { name: 'Dormitori', rect: [0, 4.5, 3.6, 8.2] },
        { name: 'Bany', rect: [3.6, 4.5, 7, 6.5], kind: 'service' },
        { name: 'Passadís', rect: [3.6, 6.5, 4.8, 13], kind: 'service' },
        { name: 'Dormitori', rect: [0, 8.2, 3.6, 13] },
        { name: 'Cuina', rect: [4.8, 8.6, 7, 13] },
      ],
      doors: [
        { x: 1.5, z: 4.5, w: 0.8, axis: 'x' },
        { x: 4.5, z: 4.5, w: 0.8, axis: 'x' },
        { x: 3.6, z: 9.5, w: 0.8, axis: 'z' },
        { x: 4.8, z: 9.5, w: 0.8, axis: 'z' },
      ],
      windows: [
        { x: 0.8, z: 0, w: 1.4, axis: 'x' },
        { x: 4.6, z: 0, w: 1.4, axis: 'x' },
        { x: 0.8, z: 13, w: 1.6, axis: 'x' },
      ],
    },
  },
  {
    slug: 'pis-obra-nova-girona',
    reference: 'HI-DEMO-004',
    title: "Pis d'obra nova amb balcó",
    operation: 'compra',
    type: 'Pis',
    price: 349000,
    municipality: 'Girona',
    area: 'Gironès',
    neighbourhood: 'Santa Eugènia',
    surface: 92,
    outdoorSurface: 9,
    bedrooms: 2,
    bathrooms: 1,
    floor: '3a planta',
    year: 2025,
    energy: 'A',
    tourId: 'pis-girona',
    summary: 'Promoció nova d’estètica nòrdica, llum suau i una distribució pensada per al dia a dia.',
    description: [
      "Habitatge d'obra nova en un edifici de cinc plantes amb façana blanca i gelosies de fusta. Comparteix tipologia amb l'àtic de demostració: sala oberta, cuina amb illa i dos dormitoris exteriors.",
      'Els acabats segueixen una línia nòrdica: fusta clara, parets blanques, cuina lacada i tèxtils en grisos i verds suaus.',
      'Edifici de consum gairebé nul amb ventilació de doble flux, aerotèrmia i zones verdes comunitàries.',
    ],
    features: ['Certificat energètic A', 'Balcó de 9 m²', 'Ventilació de doble flux', 'Zones verdes comunitàries', 'Trasters disponibles', 'Lliurament previst 2025'],
    images: [
      img('pis-girona', 1, "Edifici d'obra nova amb balcons i gelosies de fusta"),
      img('pis-girona', 2, "Sala d'estar d'estil nòrdic amb llum suau"),
      img('pis-girona', 3, 'Cuina blanca amb illa central'),
      img('pis-girona', 4, 'Segon dormitori amb zona de treball'),
    ],
    plan: demoTourPlan,
  },
  {
    slug: 'masia-rehabilitada-sant-cugat',
    reference: 'HI-DEMO-005',
    title: 'Masia rehabilitada amb jardí',
    operation: 'compra',
    type: 'Masia',
    price: 1150000,
    municipality: 'Sant Cugat del Vallès',
    area: 'Vallès Occidental',
    neighbourhood: 'Valldoreix',
    surface: 312,
    outdoorSurface: 2400,
    bedrooms: 5,
    bathrooms: 3,
    year: 1820,
    energy: 'C',
    summary: 'Murs de pedra, porta adovellada i interiors rehabilitats amb sensibilitat contemporània.',
    description: [
      'Masia catalana de dues plantes i golfes, amb murs de pedra originals i teulada a dues aigües. La rehabilitació integral ha respectat la volumetria tradicional i ha incorporat confort actual.',
      'A la planta baixa, una gran cuina-menjador amb terra de rajola de fang, una sala amb llar de foc i un porxo lateral amb pèrgola. A la planta pis, cinc dormitoris i tres banys.',
      'Finca de 2.400 m² amb oliveres centenàries, xiprers i un hort, a pocs minuts del centre de Sant Cugat.',
    ],
    features: ['Finca de 2.400 m²', 'Murs de pedra originals', 'Llar de foc', 'Porxo amb pèrgola', 'Oliveres centenàries', 'Pou i reg per degoteig'],
    images: [
      img('masia-sant-cugat', 1, 'Masia de pedra amb teulada a dues aigües i oliveres'),
      img('masia-sant-cugat', 2, "Sala d'estar amb terra de rajola de fang"),
      img('masia-sant-cugat', 3, 'Cuina amb mobles clars i terra de fang'),
      img('masia-sant-cugat', 4, 'Bany amb rajola artesanal terrosa'),
    ],
    plan: {
      bounds: { x: 0, z: 0, w: 14, h: 9 },
      rooms: [
        { name: 'Sala amb llar de foc', rect: [0, 0, 6, 5] },
        { name: 'Entrada', rect: [6, 0, 8, 9], kind: 'service' },
        { name: 'Cuina-menjador', rect: [8, 0, 14, 5] },
        { name: 'Despatx', rect: [0, 5, 4, 9] },
        { name: 'Bany', rect: [4, 5, 6, 9], kind: 'service' },
        { name: 'Celler', rect: [8, 5, 14, 9], kind: 'service' },
      ],
      doors: [
        { x: 6, z: 2, w: 1, axis: 'z' },
        { x: 8, z: 2, w: 1, axis: 'z' },
        { x: 6.5, z: 9, w: 1, axis: 'x' },
        { x: 2, z: 5, w: 0.8, axis: 'x' },
      ],
      windows: [
        { x: 2, z: 9, w: 1, axis: 'x' },
        { x: 10.5, z: 9, w: 1, axis: 'x' },
        { x: 0, z: 2, w: 1.2, axis: 'z' },
        { x: 14, z: 2, w: 1.2, axis: 'z' },
      ],
    },
  },
  {
    slug: 'apartament-mar-tarragona',
    reference: 'HI-DEMO-006',
    title: 'Apartament davant del mar',
    operation: 'lloguer',
    type: 'Apartament',
    price: 1380,
    municipality: 'Tarragona',
    area: 'Tarragonès',
    neighbourhood: "Platja de l'Arrabassada",
    surface: 68,
    outdoorSurface: 14,
    bedrooms: 1,
    bathrooms: 1,
    floor: '5a planta',
    year: 2008,
    energy: 'C',
    summary: 'Despertar-se amb el mar: un apartament serè amb terrassa a primera línia.',
    description: [
      "Apartament a primera línia de la platja de l'Arrabassada, amb terrassa de 14 m² i vistes obertes al mar. Interiors en blancs, fusta clara i blaus suaus.",
      'Sala-menjador amb cuina americana, un dormitori doble amb armari i un bany renovat amb dutxa.',
      'Lloguer de temporada o de llarga durada. Comunitat amb piscina i plaça d’aparcament inclosa.',
    ],
    features: ['Primera línia de mar', 'Terrassa de 14 m²', 'Piscina comunitària', 'Aparcament inclòs', 'Bany renovat', 'Moblat i equipat'],
    images: [
      img('apartament-tarragona', 1, 'Terrassa amb vistes obertes al mar'),
      img('apartament-tarragona', 2, "Sala d'estar en tons blancs i blaus suaus"),
      img('apartament-tarragona', 3, 'Dormitori lluminós amb tèxtils de lli'),
      img('apartament-tarragona', 4, 'Bany amb rajola blava i mirall rodó'),
    ],
    plan: {
      bounds: { x: 0, z: -2, w: 9, h: 9.5 },
      rooms: [
        { name: 'Terrassa', rect: [0, -2, 9, 0], kind: 'outdoor' },
        { name: 'Sala-cuina', rect: [0, 0, 6, 4.5] },
        { name: 'Dormitori', rect: [6, 0, 9, 4.5] },
        { name: 'Bany', rect: [6, 4.5, 9, 7.5], kind: 'service' },
        { name: 'Entrada', rect: [0, 4.5, 6, 7.5], kind: 'service' },
      ],
      doors: [
        { x: 6, z: 3.2, w: 0.8, axis: 'z' },
        { x: 6.8, z: 4.5, w: 0.8, axis: 'x' },
        { x: 2, z: 7.5, w: 0.9, axis: 'x' },
      ],
      windows: [
        { x: 0.6, z: 0, w: 4.8, axis: 'x' },
        { x: 6.6, z: 0, w: 1.8, axis: 'x' },
      ],
      openings: [{ x: 1, z: 4.5, w: 3, axis: 'x' }],
    },
  },
];

export const properties: Property[] = [realProperty, ...demoProperties];

export const getProperty = (slug: string) => properties.find((p) => p.slug === slug);
export const getPropertyByTour = (tourId: string) => properties.find((p) => p.tourId === tourId);
export const municipalities = Array.from(new Set(properties.map((p) => p.municipality).filter((m): m is string => !!m))).sort((a, b) => a.localeCompare(b, 'ca'));

/** Habitatges similars: mateixa operació primer, després per proximitat de preu relatiu i tipus.
 *  Si falta el preu, es prioritzen els habitatges amb visita. */
export function similarProperties(p: Property, n = 3): Property[] {
  return properties
    .filter((o) => o.slug !== p.slug)
    .map((o) => ({
      o,
      score:
        (o.operation === p.operation || p.operation == null ? 0 : 10) +
        (o.price != null && p.price != null ? Math.abs(Math.log(o.price / p.price)) : 1) +
        (o.type === p.type ? 0 : 0.5) +
        (o.tourId ? -0.2 : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((x) => x.o);
}
