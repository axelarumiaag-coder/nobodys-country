// Generador de mitjans: serveix el projecte en local, obre Chromium sense capçalera i
// renderitza totes les imatges i panoràmiques definides a jobs.mjs dins de public/media.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { JOBS } from './jobs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'public/media');
const only = process.argv.slice(2);

const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const executablePath =
  process.env.CHROMIUM_PATH ||
  fs
    .readdirSync('/opt/pw-browsers')
    .filter((d) => d.startsWith('chromium-'))
    .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)
    .find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/scripts/render/index.html`);
await page.waitForFunction(() => window.HI_READY === true, null, { timeout: 60000 });

const save = (rel, dataUrl) => {
  const file = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return file;
};

for (const job of JOBS) {
  if (only.length && !only.some((o) => job.out.includes(o))) continue;
  const t0 = Date.now();
  if (job.kind === 'pano') {
    const res = await page.evaluate((j) => window.HI.renderPanorama(j), job);
    save(`${job.out}.jpg`, res.full);
    save(`${job.out}-preview.jpg`, res.preview);
  } else {
    const res = await page.evaluate((j) => window.HI.renderPerspective(j), { ...job, thumb: [800, Math.round((800 * (job.height || 1067)) / (job.width || 1600))] });
    save(`${job.out}.jpg`, res.full);
    save(`${job.out}-sm.jpg`, res.thumb);
  }
  console.log(`✓ ${job.out} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
await browser.close();
server.close();
