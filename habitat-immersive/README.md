# HABITAT IMMERSIVE — demo d'immobiliària immersiva

> **No miris només un pis. Entra-hi.**

Web de demostració d'una immobiliària digital fictícia amb catàleg filtrable, fitxes completes i
**visites virtuals 360°** navegables (estil Street View, però dins d'un habitatge).

Tot el contingut dels sis habitatges de demostració és **fictici i generat per aquest mateix projecte**: marca, textos, dades dels
habitatges, plànols, fotografies (visualitzacions 3D) i panoràmiques 360°. No cal preparar cap material,
no es fa servir cap API de pagament ni cap servei amb clau.

---

## 1. Posar-la en marxa

Requisits: Node.js 18 o superior (provat amb Node 22).

```bash
cd habitat-immersive
npm install
npm run dev        # servidor de desenvolupament → http://localhost:5173
```

Altres ordres:

| Ordre | Què fa |
| --- | --- |
| `npm run build` | Comprova els tipus (TypeScript) i genera la versió de producció a `dist/` |
| `npm run preview` | Serveix `dist/` en local per provar la versió de producció |
| `npm test` | Proves unitàries (Vitest): filtres, validació, coherència de la visita i existència dels recursos |
| `npm run test:e2e` | Proves de punta a punta amb Chromium (cal `npm run build` abans). Accepta `--shots <dir>` per desar captures |
| `npm run generate:media` | Torna a renderitzar totes les imatges i panoràmiques (vegeu §5) |

> La web és una SPA amb rutes netes (`/habitatges/...`). Si la publiqueu en un allotjament estàtic, cal
> configurar que totes les rutes retornin `index.html`. **No s'ha desplegat enlloc.**

## 2. Què inclou

- **Portada**: hero a pantalla completa, titular i subtítol demanats, cercador (operació, ubicació i
  pressupost) que porta al catàleg filtrat, habitatges destacats, secció de visites virtuals, mètode i crida a l'acció.
- **Catàleg** de 6 habitatges ficticis (Sitges, Begur, Barcelona, Girona, Sant Cugat del Vallès i
  Tarragona) amb filtres reals per operació, municipi, preu mínim i màxim, habitacions, superfície i
  visita virtual, i ordenació per preu. Els filtres viuen a la URL, de manera que es poden compartir.
- **Fitxa individual**: galeria amb visor ampliat (teclat i fletxes), descripció, característiques,
  preu i ubicació, plànol esquemàtic SVG, botó **«Entra al pis»** (si hi ha visita), formulari de
  contacte i habitatges similars.
- **Formularis**: validen els camps, mostren els errors en línia i confirmen localment. **No s'envia
  cap correu ni cap dada a cap servidor**, i el missatge de confirmació ho diu explícitament.
- **Visita virtual 360°** (vegeu §3) per a dos habitatges: l'àtic de Sitges i el pis de Girona.
- **Animacions**: aparició progressiva de seccions i targetes, transició entre pàgines, hover elegants,
  menú mòbil animat, entrada al visor, punts de navegació amb pols, indicadors de càrrega i desplaçament
  suau. Amb `prefers-reduced-motion` s'eliminen els desplaçaments i l'autorotació del visor.
- **Disseny responsive** (escriptori prioritari per al visor; mòbil amb menú, filtres en full inferior
  i controls tàctils).

## 3. La visita virtual 360°

Ruta: `/visita/atic-sitges` (o `/visita/pis-girona`). Es pot enllaçar directament a una estança amb
`?estanca=cuina`.

**Com funciona.** Cada estança és una imatge **equirectangular 2:1** aplicada a l'interior d'una
esfera amb Three.js. La càmera és al centre de l'esfera:

- arrossegar amb el ratolí o el dit gira la vista (horitzontal i vertical), amb inèrcia;
- la roda, el pessic i els botons + / − apropen i allunyen (camp de visió de 30° a 100°);
- fletxes del teclat per girar, `+`/`-` per apropar;
- els **punts de navegació** són a les portes reals de cada estança; en fer-hi clic, la càmera
  «avança» cap al punt i es fa un fos encadenat cap a la panoràmica següent;
- el **plànol interactiu** ressalta l'estança actual, mostra el con de visió que gira amb la mirada i
  permet saltar a qualsevol estança;
- indicador d'estança actual, pantalla completa, brúixola per restablir la vista, botó per tornar a la
  fitxa, pantalla de càrrega, càrrega progressiva (previsualització de 1024 px → 4096 px), precàrrega de
  les estances veïnes i gestió d'errors amb «Torna-ho a provar».

**Estances de la demo**: sala d'estar, cuina, dormitori principal i segon dormitori.

**Què és i què no és (honestedat).** Les panoràmiques són **renders 360° reals** (equirectangulars, sense
costures) d'un **model 3D fictici** creat per codi. No són fotografies d'un pis real. La navegació
canvia entre **punts de vista fixos**, com Street View: no hi ha desplaçament lliure per l'espai. El
visor ho indica amb un avís discret («Experiència panoràmica de demostració»).

### Coordenades

`yaw` (graus) i `pitch` (graus) es mesuren des del punt de captura:

- columna `x` d'una panoràmica d'amplada `W` → `yaw = x / W · 360` (normalitzat a −180…180);
  és a dir, **yaw 0 és la vora esquerra** de la imatge i yaw 180 / −180 el centre;
- fila `y` d'una panoràmica d'alçada `H` → `pitch = 90 − y / H · 180`.

Així, per situar un punt de navegació en una foto 360° real, obriu-la en un editor d'imatges, mireu
les coordenades en píxels de la porta i apliqueu aquestes dues fórmules.

## 4. Afegir habitatges i panoràmiques reals

### Un habitatge nou

1. Afegiu un objecte a `src/data/properties.ts` (els tipus són a `src/data/types.ts`).
2. Deseu les fotos a `public/media/properties/<carpeta>/` amb dues mides per imatge:
   `1.jpg` (≈1600 px d'amplada) i `1-sm.jpg` (≈800 px). A les dades, `src` és la ruta **sense extensió**:
   `/media/properties/<carpeta>/1`.
3. Dibuixeu el plànol a `plan` amb rectangles en metres (`rect: [x0, z0, x1, z1]`), portes, finestres i
   obertures. El component `FloorPlan` el converteix en SVG.

Si una imatge falta o no carrega, la targeta i la galeria mostren una alternativa elegant i la pàgina
continua funcionant.

### Una visita amb fotos 360° reals

1. Captureu una panoràmica **equirectangular 2:1** per estança (càmera 360° o mòbil amb app de
   panoràmiques). Recomanat: 4096 × 2048 JPG (compatible amb pràcticament tots els dispositius) i una
   previsualització de 1024 × 512.
2. Deseu-les a `public/media/tours/<id>/<estanca>.jpg` i `<estanca>-preview.jpg`.
3. Afegiu la visita a `src/data/tours.ts`. Per a fotos reals, definiu les estances a mà:

```ts
'casa-nova': {
  id: 'casa-nova',
  propertySlug: 'slug-de-la-fitxa',
  title: 'Casa nova',
  notice: 'Visita virtual amb fotografies 360°. Pots mirar al voltant i canviar d’estança.',
  start: 'sala',
  scenes: {
    sala: {
      id: 'sala',
      name: "Sala d'estar",
      preview: '/media/tours/casa-nova/sala-preview.jpg',
      full: '/media/tours/casa-nova/sala.jpg',
      initialView: { yaw: 90, pitch: 0 },
      planPoint: [3.2, 2.5], // posició al plànol, en metres
      links: [{ to: 'cuina', label: 'Cuina', yaw: 142, pitch: -12 }],
    },
    // ...
  },
},
```

4. A la fitxa de l'habitatge, poseu `tourId: 'casa-nova'` i, si voleu el plànol clicable, afegiu
   `sceneId` a les estances corresponents de `plan.rooms`.

## 5. Com s'han generat les imatges i les panoràmiques

L'entorn on s'ha desenvolupat la demo **no tenia accés a Unsplash, Pexels, Poly Haven ni Wikimedia**:
les peticions eren bloquejades per la política de xarxa. No s'ha pogut descarregar ni **verificar** cap
fotografia o panoràmica de tercers. Per no inventar URL ni dependre d'enllaços sense comprovar, totes
les imatges es generen localment:

- `scripts/render/` conté un petit motor d'escenes amb Three.js: un pis complet modelat per codi
  (parets amb obertures, mobiliari, tèxtils, plantes, terrassa i paisatge mediterrani), una casa amb
  piscina, una façana del Born, un bloc d'obra nova, una masia i un bany. Les textures (parquet,
  arrebossat, rajola, pedra, teixit, travertí, quadres) són procedurals.
- Il·luminació: sol amb ombres suaus, llum de cel, llums d'àrea a les finestres, il·luminació
  indirecta aproximada amb un mapa d'entorn capturat des de cada punt de vista, oclusió ambiental
  (GTAO) i tonemapping ACES.
- Les **panoràmiques** es fan renderitzant les sis cares d'un cub des del punt de vista (amb marge per
  evitar costures) i convertint-les a projecció equirectangular amb un shader.
- `scripts/render/generate.mjs` obre Chromium sense capçalera, renderitza les feines de
  `scripts/render/jobs.mjs` i desa els JPG a `public/media/`. `scripts/render/export-tour.mjs` calcula
  els angles dels punts de navegació a partir de la posició real de les portes del model i els escriu a
  `src/data/demoTourLayout.json`.

Per regenerar-ho tot: `npm run generate:media && node scripts/render/export-tour.mjs`
(uns 15 minuts amb GPU per programari; molt menys amb GPU). Si Chromium no és a `/opt/pw-browsers`,
indiqueu-ne la ruta amb `CHROMIUM_PATH=/ruta/a/chrome`.

**Limitació visual:** són visualitzacions 3D estilitzades, no fotografies. Per a un producte real cal
substituir-les per fotografia i panoràmiques reals (§4). La UI ja diu a cada galeria que són
«visualitzacions 3D de demostració».

## 6. Recursos i llicències

| Recurs | Origen | Llicència / condicions |
| --- | --- | --- |
| Imatges i panoràmiques de `public/media/` (excepte `real/`) | Generades pel codi d'aquest projecte | Pròpies del projecte, sense drets de tercers |
| `public/media/real/casa-real/` | Fotogrames i vídeo editat del vídeo aportat pel propietari del projecte | Material propi; no reutilitzar fora d'aquesta demo sense permís |
| FFmpeg, OpenCV (`opencv-python-headless`), NumPy | Eines locals del procés de vídeo (no s'inclouen a la web) | LGPL / Apache-2.0 / BSD |
| Marca, textos, dades i plànols | Creats per a aquesta demo, ficticis | Propis del projecte |
| Tipografia Instrument Serif | `@fontsource/instrument-serif` (allotjada localment) | SIL Open Font License 1.1 |
| Tipografia Manrope | `@fontsource-variable/manrope` (allotjada localment) | SIL Open Font License 1.1 |
| React, React DOM, React Router | npm | MIT |
| Three.js | npm | MIT |
| Vite, Vitest, TypeScript, playwright-core | npm (només desenvolupament) | MIT / Apache-2.0 |

No es carrega res de CDNs externs: les fonts i les imatges se serveixen des del mateix lloc.
El programari és gratuït, però l'**allotjament** d'una web pública pot tenir costos o límits segons el
proveïdor. Això queda fora d'aquesta demo.

## 7. Proves

- `npm test`: 17 proves unitàries (filtres i ordenació, dades pendents de l'habitatge real, serialització a la URL, validació del
  formulari, connexió de les quatre estances, conversions de coordenades i existència de tots els
  recursos referenciats).
- `npm run test:e2e`: 13 escenaris amb Chromium real (inclosos 3 de l'habitatge real: fitxa, vídeo, recorregut i errors de càrrega): portada, cercador, navegació a seccions,
  catàleg amb tots els filtres i l'ordenació, fitxa (galeria, lightbox, plànol, formulari amb errors i
  confirmació, similars), visor 360° (canvas renderitzat, arrossegament amb ratolí, roda i botons de
  zoom, clic a punts de navegació, plànol sincronitzat, URL per estança, pantalla completa, avís de
  demo, tornada a la fitxa), segona visita i enllaç directe, moviment reduït, recursos absents
  (imatges i panoràmiques bloquejades → alternativa i reintent), i mòbil (menú, filtres en full
  inferior, sense desplaçament horitzontal, gir tàctil). També falla si hi ha errors a la consola.

## 8. Estructura

```
habitat-immersive/
├── public/media/          imatges i panoràmiques generades
├── scripts/
│   ├── render/            generador d'escenes 3D, renders i panoràmiques
│   └── e2e.mjs            proves de punta a punta
└── src/
    ├── components/        capçalera, targetes, filtres, galeria, plànol, formulari...
    ├── data/              habitatges, visites i geometria de la visita
    ├── lib/               filtres, validació, format, coordenades esfèriques
    ├── pages/             portada, catàleg, fitxa, visita, contacte, 404
    ├── viewer/            visor panoràmic Three.js
    └── styles/global.css  identitat visual i animacions
```

## 9. Habitatge real a partir d'un vídeo

La fitxa **«Habitatge amb terrassa»** (`/habitatges/casa-real-terrassa`) és una casa real incorporada a
partir d'un vídeo gravat amb mòbil. No té dades comercials inventades: preu, ubicació, superfícies,
habitacions i banys es mostren com a «Preu a consultar» o «Informació pendent».

**Què s'ha pogut extreure del vídeo** (98 s, 576 × 1024 vertical, ~31,6 fps, gravat a mà caminant):
entrada amb porta de fusta, passadís (amb el bany vist de lluny), sala d'estar amb finestral i llar de foc,
zona de menjador, terrassa àmplia amb zona coberta, jardineres i caseta de fusta, cuina i un dormitori.
Hi ha molts trams moguts o foscos (sobretot la cuina) i la càmera es desplaça mentre gira.

**Recreació 360° a partir del vídeo.** Als trams on la càmera gira sobre si mateixa,
`scripts/video/pano360.py` reconstrueix una panoràmica equirectangular de veritat:

1. tria fotogrames nítids i espaiats del tram;
2. aparella punts característics (SIFT) entre fotogrames;
3. estima la rotació de la càmera de cada fotograma (model de rotació pura + ajust de feixos) i redreça l'horitzó;
4. projecta cada fotograma sobre una esfera: amb el projector esfèric d'OpenCV, la sortida ja és
   equirectangular i cada fotograma queda a la seva longitud i latitud reals;
5. barreja els fotogrames (compensació d'exposició, costures i barreja multibanda);
6. omple la part no gravada amb una continuació molt difuminada dels colors veïns, sense inventar detalls,
   i desa el rang realment cobert.

Resultat amb aquest vídeo:

| Espai | Graus horitzontals gravats | Fotogrames |
| --- | --- | --- |
| Terrassa | 181° | 23 |
| Menjador → cuina | 130° | 22 |
| Sala (finestral) | 76° | 9 |

La sala sencera, l'entrada i el dormitori **no** s'han pogut reconstruir: la càmera avança mentre gira i
la imatge és massa moguda, i l'estimació divergeix. Aquests espais es mostren amb fotogrames reals.

Al recorregut (`/visita/casa-real`), els espais amb panoràmica s'obren en **«360° recreat»** amb el
mateix visor Three.js de les visites de demostració. La mirada queda limitada a la zona gravada, i un
selector permet passar als **fotogrames** originals. Per a la resta d'espais hi ha:

- **Recorregut amb fotogrames**: set espais en l'ordre del vídeo; dins de cada espai es «gira» passant
  d'un fotograma real a un altre (fletxes, teclat o lliscar); hi ha punts de navegació on el pas cap a
  l'altre espai es veu a la imatge, zoom, pantalla completa i una tira del recorregut.
- **Vídeo per capítols** a la fitxa i dins del recorregut: un muntatge de ~30 s sense àudio.

**Privacitat.** S'han exclòs els fragments i fotogrames on surten un retrat d'una persona, el televisor,
fotos personals de la nevera i d'un prestatge, un dibuix d'una cara i una placa amb un número; la
panoràmica de la sala s'ha limitat al tram on no apareix el retrat. El vídeo publicat no té àudio. El
vídeo original **no** es puja al repositori (`media-source/` és a `.gitignore`).

### Tornar a processar el vídeo (o afegir-ne un altre)

Requisits locals i gratuïts: FFmpeg i Python 3 amb `opencv-python-headless` i `numpy`
(`pip install opencv-python-headless numpy`).

1. Copia el vídeo a `media-source/casa-real/original.mp4`. No es modifica mai.
2. Edita `scripts/video/casa-real.config.json`: per a cada espai, les finestres de temps
   (`from`/`to`, en segons) d'on triar el fotograma més nítid, i els trams del vídeo editat. Les
   finestres serveixen també per deixar fora els moments amb dades personals. Si cal, una vista pot
   difuminar zones amb `"blur": [[x, y, amplada, alçada]]` (en fraccions de la imatge).
3. Executa `python3 scripts/video/process_video.py scripts/video/casa-real.config.json` (fotogrames i vídeo)
   i `python3 scripts/video/build_panos.py` (panoràmiques 360° recreades; els trams es configuren al mateix script).

L'script tria el fotograma més nítid de cada finestra (variància del laplacià), descarta els que són
gairebé idèntics a un altre ja triat (hash perceptual), aplica un ajust suau (contrast local, brillantor
en escenes fosques, nitidesa lleugera) i desa:

- `public/media/real/casa-real/frames/*.jpg` (1024 px d'alçada) i `*-sm.jpg` (miniatures de 480 px);
- `recorregut.mp4` (H.264) i `recorregut.webm` (VP9), sense àudio, amb el pòster;
- `src/data/casa-real.generated.json`, que la web importa.

Els textos, els punts de navegació (posició en % sobre el fotograma) i les miniatures de cada espai
es defineixen a `src/data/realHouse.ts`.

### Per a una experiència 360° real de més qualitat

- Una càmera 360° (p. ex. de la gamma de consum) o el mode panoràmica esfèrica d'un mòbil, amb trípode,
  fent **una presa per estança** des del centre, sense moure's, amb bona llum.
- Exportar en equirectangular 2:1 (idealment 6000 × 3000 o més) i afegir-les com s'explica a §4: el
  visor 360° de la web ja les admet, amb punts de navegació i plànol.
- Per a una reconstrucció 3D navegable de veritat (desplaçament lliure) caldria una captura específica
  (fotogrametria o *Gaussian splatting* amb centenars de fotos nítides o un escàner LiDAR), fora de
  l'abast d'un vídeo de mòbil com aquest.
