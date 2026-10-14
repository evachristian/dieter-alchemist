const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:8080/?' + Date.now()); await p.waitForTimeout(4000);
  const txt = () => p.evaluate(() => { const e = document.querySelector('#introStage, #intro'); return (document.querySelector('.i-say, .intro-text, #introText') || {}).textContent; });
  console.log('btns', await p.evaluate(() => [...document.querySelectorAll('#intro button, [id^=intro] button')].map(b => (b.id || b.className) + ':' + b.textContent.trim()).join(' | ')));
  console.log('before', await txt());
  const btn = await p.$('text=다음');
  if (btn) { await btn.tap().catch(e => console.log('tap err', e.message)); await p.waitForTimeout(800); console.log('after tap', await txt());
    await btn.click().catch(e => console.log('click err', e.message)); await p.waitForTimeout(800); console.log('after click', await txt()); }
  else console.log('no 다음 button');
  console.log('errs', errs.join('\n'));
  await b.close();
})();
