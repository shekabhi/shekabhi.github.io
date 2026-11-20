// Makes the site's images in the "engineering notebook" style:
//   og/<note>.jpg          1200x630 link preview for every learning note
//   og-image.png           1200x630 link preview for the home page and case studies
//   apple-touch-icon.png   180x180 home-screen icon
// Run after adding or renaming a note:  npm run og   (it builds the site first)
// The favicon is favicon.svg (hand-written, same mark).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const notes = JSON.parse(fs.readFileSync(path.join(root, "_site", "learning", "notes.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// One colour per topic, matching the offset shadows on the site
const ACCENT = { "Core Java": "#2952e3", "Java collections": "#12a37a", "Java concurrency": "#ff5c39" };
const accentFor = (topic) => ACCENT[topic] || "#ffc23d";

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@500&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet">`;
const BASE = `
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; color: #14161f; font-family: Inter, sans-serif;
    background-color: #f7f4ec;
    background-image: linear-gradient(#bccbe3 1.5px, transparent 1.5px), linear-gradient(90deg, #bccbe3 1.5px, transparent 1.5px),
      linear-gradient(#dce5f2 1px, transparent 1px), linear-gradient(90deg, #dce5f2 1px, transparent 1px);
    background-size: 150px 150px, 150px 150px, 30px 30px, 30px 30px; }
  .card { position: absolute; inset: 52px 60px 70px 52px; background: #fffdf8; border: 4px solid #14161f; border-radius: 22px;
    box-shadow: 14px 14px 0 var(--c); padding: 52px 60px; display: flex; flex-direction: column; }
  .tag { align-self: flex-start; background: #14161f; color: #f7f4ec; font: 700 22px "JetBrains Mono", monospace; letter-spacing: .06em;
    text-transform: uppercase; padding: 8px 16px; border-radius: 8px; }
  h1 { font-family: "Space Grotesk", sans-serif; font-weight: 700; letter-spacing: -.035em; line-height: 1.04; margin-top: 30px; }
  p { font-size: 27px; line-height: 1.4; color: #555b6a; margin-top: 22px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .foot { margin-top: auto; display: flex; align-items: center; gap: 18px; font: 700 26px "Space Grotesk", sans-serif; }
  .mark { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 12px; background: #14161f; color: #f7f4ec;
    font: 700 21px "JetBrains Mono", monospace; box-shadow: 4px 4px 0 #ff5c39; }
  .url { margin-left: auto; font: 700 22px "JetBrains Mono", monospace; color: #555b6a; }`;

const noteHtml = (n) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  h1 { font-size: ${n.title.length > 52 ? 54 : n.title.length > 38 ? 62 : 72}px; }</style></head>
<body><div class="card" style="--c:${accentFor(n.topic)}">
  <span class="tag">${esc(n.topic)}</span><h1>${esc(n.title)}</h1><p>${esc(n.summary)}</p>
  <div class="foot"><span class="mark">AS</span>Abhishek Shukla<span class="url">shekabhi.github.io/learning</span></div>
</div></body></html>`;

const siteHtml = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  h1 { font-size: 84px; } .hl { background: linear-gradient(transparent 62%, #ffc23d 62%, #ffc23d 92%, transparent 92%); }</style></head>
<body><div class="card" style="--c:#2952e3">
  <span class="tag">Senior Software Engineer</span>
  <h1>I build backends that <span class="hl">survive production.</span></h1>
  <p>Case studies, a live rate-limiter demo, and 36 chapters of Java notes.</p>
  <div class="foot"><span class="mark">AS</span>Abhishek Shukla<span class="url">shekabhi.github.io</span></div>
</div></body></html>`;

const iconHtml = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  * { margin: 0; } body { width: 180px; height: 180px; background: #f7f4ec; display: grid; place-items: center; }
  .m { width: 132px; height: 132px; border-radius: 28px; background: #14161f; color: #f7f4ec; display: grid; place-items: center;
    font: 700 54px "JetBrains Mono", monospace; box-shadow: 10px 10px 0 #ff5c39; transform: translate(-5px, -5px); }
</style></head><body><div class="m">AS</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const render = async (html, file, opts = {}) => {
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, file), ...opts });
    console.log(file);
  };
  fs.mkdirSync(path.join(root, "og"), { recursive: true });
  for (const n of notes) {
    const slug = n.url.replace(/^\/learning\/|\/$/g, "");
    await render(noteHtml(n), `og/${slug}.jpg`, { type: "jpeg", quality: 86 });
  }
  await render(siteHtml, "og-image.png");
  await page.setViewportSize({ width: 180, height: 180 });
  await render(iconHtml, "apple-touch-icon.png");
  await browser.close();
})();
