const { chromium } = require('@playwright/test');
const D = 'C:/Users/manag/Documents/afs-overnight/logs/v4/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('http://localhost:3067/products', { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(1500);
  for (const [i, y] of [[0, 1500], [1, 2300], [2, 3100]]) { await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(900); await p.screenshot({ path: D + 'grid' + i + '.png' }); }
  const dlg = p.getByRole('dialog');
  for (const n of ['Perforated Z', 'Gable', 'T-Style Drip Edge']) {
    try {
      const tile = p.getByRole('button', { name: new RegExp('^' + n, 'i') }).first();
      await tile.scrollIntoViewIfNeeded(); await tile.click(); await dlg.waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
      await dlg.screenshot({ path: D + n.replace(/[^a-z0-9]+/gi, '_') + '.png' });
      console.log('OK', n);
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    } catch (e) { console.log('ERR', n, String(e).slice(0, 100)); await p.keyboard.press('Escape').catch(() => {}); }
  }
  await b.close();
})();
