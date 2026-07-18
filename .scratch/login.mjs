import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 2500));
await page.screenshot({ path: '/tmp/login-signin.png' });

// flip to Sign Up
const btns = await page.$$('[role="tab"]');
if (btns[1]) await btns[1].click();
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/login-signup.png' });

// mobile
await page.setViewport({ width: 390, height: 844 });
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: '/tmp/login-mobile.png' });
await browser.close();
console.log('done');
