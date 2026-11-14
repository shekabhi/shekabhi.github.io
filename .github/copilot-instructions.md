# Project notes for AI assistants

This is Abhishek Shukla's personal portfolio, served by GitHub Pages from the
`master` branch at https://shekabhi.github.io.

## Stack
- Plain HTML, CSS and JavaScript, no framework. GitHub Pages runs **Jekyll** only to
  build the Learning section; the rest of the site is hand-written HTML copied as-is.
- `_notes/*.md`: learning notes (front matter: title, topic, date, tags, summary,
  optional updated). Rendered with `_layouts/note.html`, listed by `learning/index.html`.
- `index.html`: home page and SEO/link-preview meta tags.
- `about/index.html`: bio, principles ("How I work"), experience, skills, education. Personal and
  career content lives here only, not on the home page. `career/` just forwards to it.
- `work/*.html`: case study pages. They share one layout; keep them consistent.
- `style.css`: theme. Colours live in `:root` (`--accent` teal, `--accent-2` indigo).
- `script.js`: mobile menu, scroll reveal, cursor glow, old service worker cleanup.
- `demo.js`: rate limiter demo, mounts on `[data-ratelimit-demo]`.
- `mcp-flow.js`: sequence diagram stepper, mounts on `[data-mcp-flow]`.
- `play/index.html` + `typing.js`: typing-speed game (Jekyll page using `_layouts/base.html`;
  page-specific scripts go in the `scripts:` front matter list). Word lists live in `typing.js`.
- `terminal.js`: terminal mode (opens with `~`, `` ` ``, `T` or the `>_` button).
  Commands live in the `switch` inside `run()`; files live in `FILES` / `PROJECTS`.
- `service-worker.js`: deliberately self-destructs to clear the old 2020 React site.
  Don't turn it into a caching service worker.

## Rules
- Animation lives in `motion.js`. It must be decoration only (page complete without it), must
  respect `prefers-reduced-motion`, and must pause when off-screen. Tests call
  `window.portfolioMotion.finishAll()` to settle everything before checking the page.
- Colours: always use the CSS variables in `:root` (never hard-code a colour in a
  component). The light theme overrides them under `:root[data-theme="light"]` and
  `prefers-color-scheme: light`. Every panel follows the theme, including the live demo,
  terminal, diagrams (SVG classes `d-*`, `f-*`, `m-*`) and code blocks. `theme.js` handles the switch.
- Mobile first: test at 390px width; no horizontal page scroll; inputs ≥ 16px.
- Accessibility: buttons need `type`, icon-only links need `aria-label`,
  respect `prefers-reduced-motion`.
- Never publish the phone number or home address. Email is fine.
- Content must match the résumé; don't invent metrics.
- The site is a portfolio, not a résumé: lead with problems, decisions and trade-offs.
- Text marked `data-draft` is an unreviewed draft (see `CONTENT-TODO.md`). Keep the
  attribute on any new drafted text; remove it only when Abhishek has reviewed it.

## Caching
- GitHub Pages caches files for about 10 minutes. Every stylesheet and script link carries
  `?v={{ v }}` (the build time, set at the top of each page) so a new deploy never mixes new HTML
  with old cached CSS/JS. Keep the stamp on any new local `<script>` or stylesheet.

## Checks
- `npm run check` = Jekyll build + HTML validation + Playwright tests (desktop and mobile).
- Tests read `_site/learning/notes.json`, so every new note is tested automatically.
- Learning pages are written for readers: public pages show no personal plan or progress.
  The private plan view (localStorage `study-plan`) is the only place for that, and tests check it.
- Add or update a test in `tests/site.spec.js` for any new section or terminal command.
