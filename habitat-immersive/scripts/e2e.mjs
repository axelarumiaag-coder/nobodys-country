// Proves de punta a punta amb Chromium sense capçalera (playwright-core).
// Requisit: `npm run build` abans. Arrenca `vite preview`, recorre la web i el visor 360°
// i falla si alguna comprovació no es compleix o si hi ha errors a la consola.
//   node scripts/e2e.mjs [--shots <directori>]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite preview no ha arrencat')), 30000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      resolve();
    }
  });
});

const executablePath =
  process.env.CHROMIUM_PATH ||
  fs
    .readdirSync('/opt/pw-browsers')
    .filter((d) => d.startsWith('chromium-'))
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)
    .find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

let passed = 0;
const failures = [];
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    failures.push(name);
    console.log(
      `  ✗ ${name}\n      ${String(e.message || e)
        .split('\n')
        .join('\n      ')}`
    );
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
  return page;
}
const noErrors = (page) => assert(page.errors.length === 0, `Errors a la consola:\n${page.errors.join('\n')}`);
const count = (page, sel) => page.locator(sel).count();
const resultCount = async (page) => Number(await page.getByTestId('result-count').locator('strong').innerText());
async function waitCount(page, n) {
  await page.waitForFunction((n) => Number(document.querySelector('[data-testid=result-count] strong')?.textContent) === n, n, { timeout: 8000 }).catch(() => {});
  return resultCount(page);
}
/** Gira la vista amb el teclat fins que el punt cap a `to` queda a la zona central */
async function rotateUntilCentered(page, to) {
  for (let i = 0; i < 40; i++) {
    const centered = await page.evaluate((to) => {
      const el = document.querySelector(`.hotspot[data-to=${to}]`);
      if (!el || el.classList.contains('is-hidden')) return false;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      return cx > innerWidth * 0.3 && cx < innerWidth * 0.7;
    }, to);
    if (centered) return;
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
  }
  throw new Error(`No s'ha trobat el punt cap a ${to}`);
}
async function waitText(page, sel, text) {
  await page.waitForFunction(([sel, text]) => document.querySelector(sel)?.textContent?.includes(text), [sel, text], { timeout: 8000 }).catch(() => {});
  return page.locator(sel).first().innerText();
}
const viewerData = (page) => page.locator('.viewer').evaluate((el) => ({ ...el.dataset }));
async function waitScene(page, id, hires = false) {
  await page.waitForFunction((id) => document.querySelector('.viewer')?.dataset.scene === id && document.querySelector('.tour')?.dataset.status === 'ready', id, {
    timeout: 30000,
  });
  // amb GPU per programari (SwiftShader) la pujada de la textura 4096 px bloqueja uns segons
  if (hires) await page.waitForFunction((id) => document.querySelector('.viewer')?.dataset.hires === id, id, { timeout: 60000 });
}

console.log('\nHABITAT IMMERSIVE · proves e2e\n');

// ---------------------------------------------------------------------------
await test('La portada carrega amb hero, cercador i destacats', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.waitForLoadState('networkidle');
  const h1 = await page.locator('h1').innerText();
  assert(h1.includes('No miris només un pis.') && h1.includes('Entra-hi.'), `Titular inesperat: ${h1}`);
  assert((await page.locator('.hero__subtitle').innerText()).includes('Explora cada espai'), 'Falta el subtítol');
  assert((await count(page, '#featured-title ~ * .card, .section .grid--cards .card')) >= 3, 'Falten habitatges destacats');
  await page.waitForFunction(() => document.querySelector('.hero__media img')?.naturalWidth > 0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, 'desktop-home');
  noErrors(page);
  await page.context().close();
});

await test('El cercador porta al catàleg filtrat', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.getByRole('radio', { name: 'Llogar' }).click();
  await page.locator('.search select').first().selectOption('Barcelona');
  await page.getByRole('button', { name: 'Cerca' }).click();
  await page.waitForURL(/\/habitatges\?/);
  const url = new URL(page.url());
  assert(url.searchParams.get('operacio') === 'lloguer' && url.searchParams.get('municipi') === 'Barcelona', `URL: ${page.url()}`);
  assert((await waitCount(page, 1)) === 1, 'Hauria de trobar 1 lloguer a Barcelona');
  noErrors(page);
  await page.context().close();
});

await test('Els botons de navegació porten a les seccions', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.locator('.site-nav').getByRole('link', { name: 'Visites virtuals' }).click();
  await page.waitForTimeout(1600);
  const top = await page.locator('#visites').evaluate((el) => el.getBoundingClientRect().top);
  assert(Math.abs(top) < 120, `La secció #visites no s'ha desplaçat a la vista (top=${top})`);
  await page.locator('.site-nav').getByRole('link', { name: 'Habitatges' }).click();
  await page.waitForURL(BASE + '/habitatges');
  await page.locator('.site-header__cta').click();
  await page.waitForURL(/\/visita\/atic-sitges/);
  noErrors(page);
  await page.context().close();
});

await test('El catàleg mostra 7 habitatges i els filtres funcionen', async () => {
  const page = await newPage();
  await page.goto(BASE + '/habitatges');
  assert((await count(page, '.card')) === 7, 'Haurien de ser 7 targetes (6 de demo + 1 real)');
  await page.getByText('Només amb visita virtual').click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  assert((await count(page, '.card .badge--tour')) === 3, 'Totes han de tenir visita');
  await page.getByText('Només amb visita virtual').click();
  await page.locator('.filters select[name=municipality]').selectOption('Girona');
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
  await page.locator('.filters select[name=municipality]').selectOption('');
  await page.locator('.segmented__opt', { hasText: 'Comprar' }).click();
  assert((await waitCount(page, 4)) === 4, 'Hi ha d’haver 4 habitatges en venda');
  await page.locator('input[name=maxPrice]').fill('600000');
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 2);
  await page.locator('input[name=minPrice]').fill('400000');
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
  await page.locator('input[name=minPrice]').fill('');
  await page.locator('input[name=maxPrice]').fill('');
  await page.locator('.chip', { hasText: '4+' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 2);
  await page.locator('.chip', { hasText: 'Totes' }).click();
  await page.locator('.filters select[name=surface]').selectOption('200');
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 2);
  await page.locator('select[name=sort]').selectOption('preu-asc');
  await page.waitForURL(/ordre=preu-asc/);
  await page.waitForTimeout(300);
  const prices = await page.locator('.card__price').allInnerTexts();
  const nums = prices.map((p) => Number(p.replace(/[^0-9]/g, '')));
  assert(nums[0] <= nums[1], `Ordenació incorrecta: ${prices}`);
  await page
    .getByRole('button', { name: /Esborra els filtres/ })
    .first()
    .click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 7);
  await page.locator('select[name=sort]').selectOption('preu-desc');
  await page.waitForURL(/ordre=preu-desc/);
  await page.waitForTimeout(300);
  const first = Number((await page.locator('.card__price').first().innerText()).replace(/[^0-9]/g, ''));
  assert(first === 1290000, `El més car hauria de ser primer (${first})`);
  await page.locator('.segmented__opt', { hasText: 'Llogar' }).click();
  await page.locator('input[name=maxPrice]').fill('100');
  await page.waitForSelector('.empty');
  await shot(page, 'desktop-catalog-empty');
  await page.locator('.empty .btn').click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 7);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await shot(page, 'desktop-catalog');
  noErrors(page);
  await page.context().close();
});

await test('Fitxa: galeria, plànol, formulari i similars', async () => {
  const page = await newPage();
  await page.goto(BASE + '/habitatges');
  await page.locator('.card', { hasText: 'Àtic amb terrassa' }).click();
  await page.waitForURL(/\/habitatges\/atic-terrassa-sitges/);
  assert((await waitText(page, 'h1', 'Àtic')).includes('Àtic'), 'Títol de la fitxa');
  assert((await page.locator('.property__price').innerText()).includes('595.000'), 'Preu');
  const c0 = await page.locator('.gallery__count').innerText();
  await page.getByRole('button', { name: 'Imatge següent' }).first().click();
  assert((await page.locator('.gallery__count').innerText()) !== c0, 'La galeria no avança');
  await page.locator('.gallery__open').click();
  await page.waitForSelector('.lightbox img');
  await page.keyboard.press('Escape');
  assert((await count(page, '.lightbox')) === 0, 'El lightbox no es tanca');
  assert((await count(page, '.plan-card svg .plan__room')) >= 5, 'Plànol esquemàtic');
  assert((await count(page, '.similar .card')) === 3, 'Habitatges similars');
  // formulari buit -> errors
  const form = page.locator('.contact-card form');
  await form.locator('textarea').fill('');
  await form.getByRole('button', { name: /Sol·licita/ }).click();
  assert((await count(page, '.field__error')) >= 4, 'Haurien d’aparèixer errors de validació');
  await form.locator('input[name=name]').fill('Jordi Serra');
  await form.locator('input[name=email]').fill('jordi@exemple');
  await form.locator('input[name=email]').blur();
  assert((await page.locator('.field__error').first().innerText()).length > 0, 'Error de correu');
  await form.locator('input[name=email]').fill('jordi@exemple.cat');
  await form.locator('textarea').fill('Voldria visitar l’àtic aquest dissabte.');
  await form.locator('input[name=consent]').check();
  await form.getByRole('button', { name: /Sol·licita/ }).click();
  await page.waitForSelector('.form-success');
  const msg = await page.locator('.form-success').innerText();
  assert(/no s'ha enviat cap correu/i.test(msg), 'Confirmació local honesta');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await shot(page, 'desktop-property');
  noErrors(page);
  await page.context().close();
});

await test('Visor 360°: obrir, mirar amb el ratolí, zoom, punts, plànol i tornar', async () => {
  const page = await newPage();
  await page.goto(BASE + '/habitatges/atic-terrassa-sitges');
  await page.locator('.property__price-box').getByRole('link', { name: 'Entra al pis' }).click();
  await page.waitForURL(/\/visita\/atic-sitges/);
  await waitScene(page, 'sala');
  await page.waitForFunction(() => document.querySelector('.viewer')?.dataset.hires === 'sala', null, { timeout: 30000 });
  assert((await page.getByTestId('current-room').innerText()) === "Sala d'estar", 'Indicador d’estança');
  assert((await count(page, '.plan__room.is-active')) === 1, 'Plànol: estança activa');
  assert((await page.locator('.plan__room.is-active').getAttribute('aria-label')) === "Ves a Sala d'estar", 'Plànol ressalta la sala');
  // el canvas mostra imatge (no és negre ni uniforme)
  const png = await page.locator('.viewer__canvas').screenshot();
  assert(png.length > 30000, `El canvas sembla buit (${png.length} bytes)`);
  // arrossegar amb el ratolí
  const a = await viewerData(page);
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(400, 380, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const b = await viewerData(page);
  assert(Math.abs(Number(b.yaw) - Number(a.yaw)) > 10, `El yaw no canvia (${a.yaw} → ${b.yaw})`);
  assert(Number(b.pitch) < Number(a.pitch), `El pitch no canvia (${a.pitch} → ${b.pitch})`);
  // roda i botons de zoom
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(150);
  const c = await viewerData(page);
  assert(Number(c.fov) < Number(b.fov), `La roda no apropa (${b.fov} → ${c.fov})`);
  await page.getByRole('button', { name: 'Allunya' }).click();
  await page.waitForTimeout(400);
  assert(Number((await viewerData(page)).fov) > Number(c.fov), 'El botó Allunya no funciona');
  await page.getByRole('button', { name: 'Restableix la vista' }).click();
  await page.waitForTimeout(800);
  await shot(page, 'desktop-tour-sala');
  // girar amb el teclat fins veure el punt cap a la cuina i fer-hi clic
  await page.locator('.viewer').focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.waitForTimeout(200);
  const hs = page.locator('.hotspot[data-to=cuina]:not(.is-hidden)');
  await hs.waitFor({ timeout: 5000 });
  await hs.click();
  await waitScene(page, 'cuina', true);
  assert((await page.getByTestId('current-room').innerText()) === 'Cuina', 'Ara hauríem de ser a la cuina');
  assert((await page.locator('.plan__room.is-active').getAttribute('aria-label')) === 'Ves a Cuina', 'El plànol reflecteix la cuina');
  assert(new URL(page.url()).searchParams.get('estanca') === 'cuina', 'La URL recorda l’estança');
  await page.waitForTimeout(600);
  await shot(page, 'desktop-tour-cuina');
  // plànol interactiu
  await page.locator('.plan__room[aria-label="Ves a Dormitori principal"]').click();
  await waitScene(page, 'dormitori');
  assert((await page.getByTestId('current-room').innerText()) === 'Dormitori principal', 'Dormitori principal');
  await page.locator('.tour__rooms button', { hasText: 'Segon dormitori' }).click();
  await waitScene(page, 'dormitori2', true);
  assert((await page.locator('.plan__room.is-active').getAttribute('aria-label')) === 'Ves a Segon dormitori', 'Plànol: segon dormitori');
  await shot(page, 'desktop-tour-dormitori2');
  // tornar a la sala amb un punt de navegació
  await page.locator('.viewer').focus();
  await rotateUntilCentered(page, 'sala');
  await page.locator('.hotspot[data-to=sala]').click();
  await waitScene(page, 'sala');
  // pantalla completa
  await page.getByRole('button', { name: 'Pantalla completa' }).click();
  await page.waitForTimeout(400);
  const fs1 = await page.evaluate(() => !!document.fullscreenElement);
  if (fs1) {
    await page.getByRole('button', { name: 'Surt de la pantalla completa' }).click();
    await page.waitForTimeout(300);
  } else console.log('      (avís: aquest Chromium sense capçalera no permet la pantalla completa; s’ha comprovat que el botó no falla)');
  // avís de demo
  await page.getByRole('button', { name: /Experiència panoràmica de demostració/ }).click();
  assert((await page.locator('.tour__notice p').innerText()).includes('no és un desplaçament lliure'), 'Avís honest');
  // tornar a la fitxa
  await page.getByRole('link', { name: "Torna a la fitxa de l'immoble" }).click();
  await page.waitForURL(/\/habitatges\/atic-terrassa-sitges$/);
  noErrors(page);
  await page.context().close();
});

await test('Visor 360°: segona visita (Girona) i enllaç directe a una estança', async () => {
  const page = await newPage();
  await page.goto(BASE + '/visita/pis-girona?estanca=dormitori');
  await waitScene(page, 'dormitori');
  assert((await page.getByTestId('current-room').innerText()) === 'Dormitori principal', 'Enllaç directe');
  noErrors(page);
  await page.context().close();
});

await test('Moviment reduït: el visor no gira sol', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/visita/atic-sitges');
  await waitScene(page, 'sala', true);
  const a = await viewerData(page);
  await page.waitForTimeout(1200);
  const b = await viewerData(page);
  assert(a.yaw === b.yaw, `Amb moviment reduït no hi ha d'haver autorotació (${a.yaw} → ${b.yaw})`);
  noErrors(page);
  await page.context().close();
});

await test('Recursos absents: imatges i panoràmiques tenen alternativa', async () => {
  const page = await newPage();
  await page.route('**/media/properties/casa-begur/**', (r) => r.abort());
  await page.goto(BASE + '/habitatges/casa-piscina-begur');
  await page.waitForSelector('.gallery .smart-img__fallback');
  assert((await waitText(page, 'h1', 'Casa')).includes('Casa'), 'La fitxa continua funcionant');
  await page.unroute('**/media/properties/casa-begur/**');
  await page.route('**/media/tours/**', (r) => r.abort());
  await page.goto(BASE + '/visita/atic-sitges');
  await page.waitForSelector('.tour__error', { timeout: 20000 });
  await shot(page, 'desktop-tour-error');
  await page.unroute('**/media/tours/**');
  await page.getByRole('button', { name: 'Torna-ho a provar' }).click();
  await waitScene(page, 'sala');
  await page.goto(BASE + '/visita/no-existeix');
  assert((await waitText(page, 'h1', 'no porta enlloc')).includes('no porta enlloc'), '404 de visita');
  await page.context().close();
});

await test('Casa real: portada, llistat, fitxa, imatges i vídeo', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.locator('.real-band').scrollIntoViewIfNeeded();
  assert((await page.locator('#real-title').innerText()) === 'Habitatge amb terrassa', 'Franja de la casa real a la portada');
  assert((await page.locator('.section .grid--cards .card', { hasText: 'Habitatge amb terrassa' }).count()) === 1, 'Destacada a la portada');
  await page.goto(BASE + '/habitatges');
  const card = page.locator('.card', { hasText: 'Habitatge amb terrassa' });
  assert((await card.locator('.badge--real').count()) === 1, 'Distintiu «Habitatge real» al llistat');
  assert((await card.locator('.card__price').innerText()) === 'Preu a consultar', 'Preu a consultar al llistat');
  await card.click();
  await page.waitForURL(/\/habitatges\/casa-real-terrassa$/);
  assert((await waitText(page, 'h1', 'Habitatge amb terrassa')).includes('Habitatge amb terrassa'), 'Títol de la fitxa');
  assert((await page.locator('.property__price').innerText()) === 'Preu a consultar', 'Preu pendent');
  assert((await page.locator('.facts li.is-pending').count()) >= 5, 'Dades comercials pendents');
  assert((await count(page, '.explore__space')) === 7, 'Set espais identificats');
  await page.waitForFunction(() => [...document.querySelectorAll('.explore img, .gallery__main img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  await page.getByRole('button', { name: 'Imatge següent' }).first().click();
  await page.waitForFunction(() => document.querySelector('.gallery__main img')?.naturalWidth > 0);
  // vídeo amb capítols
  const v = page.locator('.vchap video').first();
  await v.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.vchap video')?.readyState >= 1, null, { timeout: 15000 });
  assert(await v.evaluate((el) => el.muted && el.duration > 25 && el.duration < 40), 'Vídeo editat sense àudio (~30 s)');
  await page.locator('.vchap__chapters button', { hasText: 'Terrassa' }).click();
  await page.waitForFunction(() => document.querySelector('.vchap__chapters .is-active')?.textContent.includes('Terrassa'), null, { timeout: 8000 });
  await page.evaluate(() => document.querySelector('.vchap video').pause());
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(700);
  await shot(page, 'desktop-real-fitxa');
  noErrors(page);
  await page.context().close();
});

await test('Casa real: recorregut visual (girar, punts, recorregut, zoom, vídeo, tornar)', async () => {
  const page = await newPage();
  const state = () => page.locator('.ftour').evaluate((el) => ({ ...el.dataset }));
  const waitView = (stop, view) =>
    page.waitForFunction(
      ([s, v]) => {
        const d = document.querySelector('.ftour')?.dataset;
        return d?.stop === s && (!v || d.view === v) && d.status === 'ready';
      },
      [stop, view],
      { timeout: 15000 }
    );
  await page.goto(BASE + '/habitatges/casa-real-terrassa');
  await page.getByRole('link', { name: 'Comença el recorregut' }).click();
  await page.waitForURL(/\/visita\/casa-real/);
  await waitView('entrada', 'acces-sala');
  assert((await page.getByTestId('current-room').innerText()) === 'Entrada', 'Indicador d’espai');
  assert((await page.locator('.ftour__zoom img').evaluate((i) => i.naturalWidth)) > 0, 'Imatge carregada');
  // girar
  await page.getByRole('button', { name: 'Gira: vista següent' }).click();
  await waitView('entrada', 'porta');
  await page.keyboard.press('ArrowLeft');
  await waitView('entrada', 'acces-sala');
  await shot(page, 'desktop-real-tour');
  // punt de navegació cap a la sala
  await page.locator('.ftour__hotspot[data-to=sala]').click();
  await waitView('sala');
  assert((await page.getByTestId('current-room').innerText()) === "Sala d'estar", 'Ara a la sala');
  assert(new URL(page.url()).searchParams.get('parada') === 'sala', 'URL per espai');
  // girar fins al finestral i sortir a la terrassa
  for (let i = 0; i < 4 && (await state()).view !== 'finestral'; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
  }
  await waitView('sala', 'finestral');
  await page.locator('.ftour__hotspot[data-to=terrassa]').click();
  await waitView('terrassa');
  await shot(page, 'desktop-real-terrassa');
  // tira del recorregut
  await page.locator('.ftour__strip button', { hasText: 'Cuina' }).click();
  await waitView('cuina');
  assert((await page.locator('.ftour__strip button.is-active').innerText()).includes('Cuina'), 'Recorregut ressalta l’espai');
  await page.getByRole('button', { name: 'Espai següent' }).click();
  await waitView('dormitori');
  // zoom
  await page.getByRole('button', { name: 'Apropa' }).click();
  await page.waitForTimeout(350);
  assert((await page.locator('.ftour__zoom').getAttribute('style')).includes('scale(1.4)'), 'El zoom apropa');
  await page.getByRole('button', { name: 'Allunya' }).click();
  // vídeo dins del recorregut
  await page.getByRole('button', { name: "Mira el vídeo d'aquest espai" }).click();
  await page.waitForSelector('.ftour__video video');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.ftour__video', { state: 'detached' });
  // avís honest
  await page.getByRole('button', { name: /no és 360°/ }).click();
  assert((await page.locator('.tour__notice p').innerText()).includes('No és una visita 360°'), 'Avís honest');
  await page.getByRole('link', { name: "Torna a la fitxa de l'immoble" }).click();
  await page.waitForURL(/\/habitatges\/casa-real-terrassa$/);
  noErrors(page);
  await page.context().close();
});

await test('Casa real: una vista que no carrega mostra alternativa i reintent', async () => {
  const page = await newPage();
  await page.route('**/media/real/casa-real/frames/sala-*', (r) => r.abort());
  await page.goto(BASE + '/visita/casa-real?parada=sala');
  await page.waitForSelector('.ftour__failed');
  assert((await page.locator('.ftour__strip button').count()) === 7, 'La resta del recorregut continua funcionant');
  await page.unroute('**/media/real/casa-real/frames/sala-*');
  await page.getByRole('button', { name: 'Torna-ho a provar' }).click();
  await page.waitForFunction(() => document.querySelector('.ftour')?.dataset.status === 'ready', null, { timeout: 10000 });
  await page.context().close();
});

await test('Mòbil: menú animat, filtres i visita amb control tàctil', async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(BASE + '/');
  await page.waitForLoadState('networkidle');
  await shot(page, 'mobile-home');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow, 'Hi ha desplaçament horitzontal a mòbil');
  await page.getByRole('button', { name: 'Obre el menú' }).tap();
  await page.waitForTimeout(700);
  assert(await page.locator('.mobile-menu.is-open').isVisible(), 'El menú mòbil no s’obre');
  await shot(page, 'mobile-menu');
  await page.locator('.mobile-menu').getByRole('link', { name: 'Habitatges' }).tap();
  await page.waitForURL(/\/habitatges$/);
  await page.locator('.catalog__filter-btn').tap();
  await page.waitForTimeout(700);
  await page.getByText('Només amb visita virtual').tap();
  assert((await waitCount(page, 3)) === 3, 'Filtre a mòbil');
  await shot(page, 'mobile-filters');
  await page.locator('.catalog__apply').tap();
  await page.waitForTimeout(600);
  await page.goto(BASE + '/habitatges/atic-terrassa-sitges');
  await shot(page, 'mobile-property');
  await page.goto(BASE + '/visita/atic-sitges');
  await waitScene(page, 'sala', true);
  await page.waitForTimeout(300);
  // arrossegar amb el dit (esdeveniments tàctils reals via CDP)
  await page.evaluate(() => {
    window.__ptr = 0;
    document.querySelector('.viewer').addEventListener('pointermove', (e) => e.pointerType === 'touch' && window.__ptr++, true);
  });
  const cdp = await page.context().newCDPSession(page);
  let a, b;
  for (let attempt = 0; attempt < 3; attempt++) {
    a = await viewerData(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 230 }] });
    for (const x of [250, 200, 150, 100]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 230 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    b = await viewerData(page);
    const received = await page.evaluate(() => window.__ptr);
    if (received > 0) break; // l'emulador no ha lliurat els esdeveniments: es reintenta
    console.log('      (avís: l’emulador tàctil no ha lliurat esdeveniments; reintent)');
  }
  assert(Math.abs(Number(b.yaw) - Number(a.yaw)) > 5, `El control tàctil no gira la vista (${a.yaw} → ${b.yaw})`);
  await page.waitForTimeout(500);
  await shot(page, 'mobile-tour');
  // recorregut de la casa real amb el dit
  await page.goto(BASE + '/habitatges/casa-real-terrassa');
  await shot(page, 'mobile-real-fitxa');
  await page.goto(BASE + '/visita/casa-real?parada=terrassa');
  await page.waitForFunction(() => document.querySelector('.ftour')?.dataset.status === 'ready');
  const v0 = await page.locator('.ftour').getAttribute('data-view');
  for (let attempt = 0; attempt < 3; attempt++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 420 }] });
    for (const x of [250, 200, 150, 100]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 420 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    if ((await page.locator('.ftour').getAttribute('data-view')) !== v0) break;
  }
  assert((await page.locator('.ftour').getAttribute('data-view')) !== v0, 'Lliscar amb el dit gira la vista');
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'Sense desplaçament horitzontal');
  await page.waitForTimeout(600);
  await shot(page, 'mobile-real-tour');
  noErrors(page);
  await page.context().close();
});

await browser.close();
server.kill();
console.log(`\n${passed} correctes, ${failures.length} errors\n`);
process.exit(failures.length ? 1 : 0);
