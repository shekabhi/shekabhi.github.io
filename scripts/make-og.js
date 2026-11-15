// Makes a 1200x630 link-preview image for every learning note, in og/<note>.jpg.
// Run after adding or renaming a note:  npm run og   (it builds the site first)
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const notes = JSON.parse(fs.readFileSync(path.join(root, "_site", "learning", "notes.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const html = (n) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #0b0f17; color: #e5e9f0; font-family: Inter, "Helvetica Neue", Arial, sans-serif; position: relative; overflow: hidden; }
  .g { position: absolute; inset: 0; background: radial-gradient(700px circle at 12% 8%, rgba(94,234,212,.16), transparent 60%), radial-gradient(800px circle at 95% 95%, rgba(129,140,248,.18), transparent 60%); }
  .w { position: relative; height: 100%; padding: 70px 80px; display: flex; flex-direction: column; }
  .topic { font: 500 26px ui-monospace, "DejaVu Sans Mono", monospace; color: #5eead4; letter-spacing: .06em; text-transform: uppercase; }
  h1 { font-size: ${n.title.length > 48 ? 62 : 74}px; font-weight: 800; letter-spacing: -.03em; line-height: 1.08; margin-top: 26px; }
  p { font-size: 30px; line-height: 1.4; color: #8b97a8; margin-top: 26px; max-width: 980px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .foot { margin-top: auto; display: flex; align-items: center; gap: 18px; font-size: 28px; font-weight: 600; }
  .mark { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 14px; border: 2px solid #5eead4; color: #5eead4; font-weight: 800; font-size: 22px; }
  .url { margin-left: auto; font: 24px ui-monospace, "DejaVu Sans Mono", monospace; color: #8b97a8; }
</style></head><body><div class="g"></div><div class="w">
  <div class="topic">${esc(n.topic)}</div><h1>${esc(n.title)}</h1><p>${esc(n.summary)}</p>
  <div class="foot"><span class="mark">AS</span>Abhishek Shukla<span class="url">shekabhi.github.io/learning</span></div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  fs.mkdirSync(path.join(root, "og"), { recursive: true });
  for (const n of notes) {
    const slug = n.url.replace(/^\/learning\/|\/$/g, "");
    await page.setContent(html(n));
    await page.screenshot({ path: path.join(root, "og", `${slug}.jpg`), type: "jpeg", quality: 86 });
    console.log("og/" + slug + ".jpg");
  }
  await browser.close();
})();
