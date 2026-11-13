# Project notes for AI assistants

This is Abhishek Shukla's personal portfolio, served by GitHub Pages from the
`master` branch at https://shekabhi.github.io.

## Stack
- Plain HTML, CSS and JavaScript. **No build step and no framework.** Keep it that way.
- `index.html`: all page content and SEO/link-preview meta tags.
- `style.css`: theme. Colours live in `:root` (`--accent` teal, `--accent-2` indigo).
- `script.js`: mobile menu, scroll reveal, cursor glow, old service worker cleanup.
- `terminal.js`: terminal mode (opens with `~`, `` ` ``, `T` or the `>_` button).
  Commands live in the `switch` inside `run()`; files live in `FILES` / `PROJECTS`.
- `service-worker.js`: deliberately self-destructs to clear the old 2020 React site.
  Don't turn it into a caching service worker.

## Rules
- Mobile first: test at 390px width; no horizontal page scroll; inputs ≥ 16px.
- Accessibility: buttons need `type`, icon-only links need `aria-label`,
  respect `prefers-reduced-motion`.
- Never publish the phone number or home address. Email is fine.
- Content must match the résumé; don't invent metrics.

## Checks
- `npm run check` = HTML validation + Playwright tests (desktop and mobile).
- Add or update a test in `tests/site.spec.js` for any new section or terminal command.
