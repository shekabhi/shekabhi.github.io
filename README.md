# Abhishek Shukla — Portfolio

[![CI](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/ci.yml)
[![Link check](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/links.yml/badge.svg)](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/links.yml)

Personal portfolio at **https://shekabhi.github.io**: a dark, modern single page in
plain HTML, CSS and JavaScript, with no build step.

## Files
- `index.html`: home page (hero, live demo, case study cards, principles, career, contact)
- `work/*.html`: one page per case study (problem, constraints, design, trade-offs, results)
- `style.css`: theme and layout (accent colours are under `:root`)
- `script.js`: mobile menu, scroll reveal, cursor glow
- `demo.js`: the live sliding-window rate limiter demo
- `mcp-flow.js`: the step-through OAuth2 + PKCE diagram on the MCP page
- `terminal.js`: terminal mode (press `~` or `T`, or click `>_`)
- `tests/`: browser tests that run on every push
- `CONTENT-TODO.md`: **AI-drafted text that still needs your review** (marked `data-draft` in the HTML)

## Work on it locally
```bash
npm install
npm run serve      # http://localhost:4173
npm run check      # HTML validation + browser tests
```

## Automation (`.github/`)
- **CI**: validates the HTML and runs the browser tests (desktop and phone) on every push and pull request.
- **Link check**: finds dead links every Monday and whenever the page changes.
- **Dependabot**: opens a monthly pull request to update the test tools.
- **Templates**: issue forms for bugs and ideas, and a pull request checklist.

Hosted on GitHub Pages from the `master` branch.
