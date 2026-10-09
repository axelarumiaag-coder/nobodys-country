// Llista de totes les imatges que es generen. Les rutes són relatives a public/media.
import { ROOMS } from './apartment.js';

const apt = (palette, time = 'day') => ({ type: 'apartment', palette, time });
const V = {
  salaA: { pos: [5.6, 1.45, 0.6], target: [1.2, 1.0, 3.6], fov: 60 },
  salaB: { pos: [3.4, 1.45, 3.7], target: [3.0, 1.05, -2], fov: 64 },
  cuinaA: { pos: [6.0, 1.5, 0.7], target: [9.2, 1.0, 3.2], fov: 62 },
  cuinaB: { pos: [7.1, 1.55, 3.85], target: [9.0, 1.0, 0.4], fov: 64 },
  dorm: { pos: [3.75, 1.5, 4.95], target: [1.2, 0.9, 7.8], fov: 64 },
  dorm2: { pos: [9.0, 1.5, 5.0], target: [6.2, 0.8, 7.6], fov: 64 },
  terrassa: { pos: [9.4, 1.65, -0.5], target: [2.5, 0.8, -3.0], fov: 62 },
  terrassaMar: { pos: [0.6, 1.6, -0.6], target: [7, 0.9, -3.2], fov: 62 },
  bany: { pos: [2.5, 1.5, 3.05], target: [0.9, 1.0, 0.6], fov: 68 },
};
const photo = (out, scene, view) => ({ kind: 'photo', out, scene, ...view });

const tour = (id, palette) => Object.entries(ROOMS).map(([room, r]) => ({ kind: 'pano', out: `tours/${id}/${room}`, scene: apt(palette), pos: r.cam, face: 1600, width: 4096 }));

export const JOBS = [
  { kind: 'photo', out: 'brand/hero', scene: { type: 'villa', time: 'golden' }, pos: [11, 1.5, 20], target: [-0.5, 2.8, 2], fov: 50, width: 2400, height: 1350 },
  { kind: 'photo', out: 'brand/tour', scene: apt('mediterrani', 'golden'), pos: [6.2, 1.5, 3.9], target: [2.0, 1.1, -1.5], fov: 66, width: 2000, height: 1250 },

  photo('properties/atic-sitges/1', apt('mediterrani', 'golden'), V.terrassa),
  photo('properties/atic-sitges/2', apt('mediterrani'), V.salaA),
  photo('properties/atic-sitges/3', apt('mediterrani'), V.cuinaA),
  photo('properties/atic-sitges/4', apt('mediterrani'), V.dorm),
  photo('properties/atic-sitges/5', apt('mediterrani'), V.salaB),

  photo('properties/casa-begur/1', { type: 'villa', time: 'day' }, { pos: [-12, 1.7, 21], target: [0.5, 2.6, 2], fov: 52 }),
  photo('properties/casa-begur/2', apt('calid'), V.salaA),
  photo('properties/casa-begur/3', { type: 'bathroom', palette: 'calid' }, V.bany),
  photo('properties/casa-begur/4', apt('calid'), V.dorm),

  photo('properties/pis-born/1', { type: 'born', time: 'day' }, { pos: [4, 1.7, 10], target: [-0.5, 8.5, 0], fov: 62 }),
  photo('properties/pis-born/2', apt('urba'), V.salaA),
  photo('properties/pis-born/3', apt('urba'), V.cuinaB),
  photo('properties/pis-born/4', apt('urba'), V.dorm2),

  photo('properties/pis-girona/1', { type: 'block', time: 'soft' }, { pos: [9, 1.7, 22], target: [0, 6, 0], fov: 55 }),
  photo('properties/pis-girona/2', apt('nordic', 'soft'), V.salaA),
  photo('properties/pis-girona/3', apt('nordic', 'soft'), V.cuinaA),
  photo('properties/pis-girona/4', apt('nordic', 'soft'), V.dorm2),

  photo('properties/masia-sant-cugat/1', { type: 'masia', time: 'golden' }, { pos: [13, 1.7, 22], target: [0, 4.5, 0], fov: 50 }),
  photo('properties/masia-sant-cugat/2', apt('rustic'), V.salaB),
  photo('properties/masia-sant-cugat/3', apt('rustic'), V.cuinaB),
  photo('properties/masia-sant-cugat/4', { type: 'bathroom', palette: 'rustic' }, V.bany),

  photo('properties/apartament-tarragona/1', apt('mar'), V.terrassaMar),
  photo('properties/apartament-tarragona/2', apt('mar'), V.salaB),
  photo('properties/apartament-tarragona/3', apt('mar'), V.dorm),
  photo('properties/apartament-tarragona/4', { type: 'bathroom', palette: 'mar' }, V.bany),

  ...tour('atic-sitges', 'mediterrani'),
  ...tour('pis-girona', 'nordic'),
];
