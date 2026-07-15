import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "/tmp/shot.png";
const scrollY = Number(process.argv[4] ?? 0);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
// let intro animations play, then clear the brand splash if it lingers
await new Promise((r) => setTimeout(r, 6000));
await page.evaluate(() => document.getElementById("nudge-splash")?.remove());
if (scrollY > 0) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
}
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
