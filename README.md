# Abhishek Shukla — Portfolio

[![CI](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/ci.yml)
[![Link check](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/links.yml/badge.svg)](https://github.com/shekabhi/shekabhi.github.io/actions/workflows/links.yml)

Personal site at **https://shekabhi.github.io**: case studies, a live rate-limiter demo, and a
Learning section with 36 chapters of Java notes (Core Java, Java collections, Java concurrency).

Plain HTML, CSS and JavaScript, built by Jekyll on GitHub Pages. The look is an "engineering
notebook": graph paper, ink outlines and coloured offset shadows, with a light theme (cream paper)
and a dark theme (black paper).

## Files
- `index.html`: home page (hero, live demo, case study cards, the Java series, play teaser, contact)
- `about/index.html`: About page (bio, how I work, experience, skills, education & achievements)
- `career/index.html`: forwards old `/career/` links to `/about/#experience`
- `work/*.html`: one page per case study (problem, constraints, design, trade-offs, results)
- `style.css`: theme and layout. Colours are tokens under `:root` (dark) and `[data-theme="light"]`; the notebook look is the block at the end
- `script.js`: mobile menu and scroll reveal
- `demo.js`: the live sliding-window rate limiter demo
- `mcp-flow.js`: the step-through OAuth2 + PKCE diagram on the MCP page
- `play/` + `typing.js`: the typing-speed game (dev words or common words; 15/30/60 s)
- `motion.js`: animations (boot screen, decrypting headline, network background, diagrams that
  draw themselves with flowing requests, counters, card spotlight, staggered lists, magnetic buttons).
  All of it is skipped for visitors who turn on reduced motion.
- `theme.js`: System / Light / Dark switch (saved per visitor)
- `terminal.js`: terminal mode (press `~` or `T`, or click `>_`)
- `_notes/*.md`: **Learning notes**, one Markdown file per note
- `learning/`: the Learning hub page and a JSON feed of notes
- `_layouts/`: page templates for the Learning section
- `learning.js`: topic filters, search, table of contents, Copy and Run buttons on code
- `learning/java/`, `learning/system-design/`, `learning/databases/`, `learning/security/`, `learning/ai/`: Learning sections (`_data/sections.yml`; each area in `_data/topics.yml` names its section)
- `learning/topics/` + `topics.js`: private plan page with the whole catalogue (visitors are sent to `/learning/`)
- `learning/core-java/`, `learning/java-collections/`, `learning/java-concurrency/`: the three series pages
- `learning/quiz/` + `quiz.js`: quiz built from each note's `questions`
- `scripts/check-examples.py`: compiles and runs every runnable Java example and checks its recorded output
- `scripts/make-og.js`: link-preview images (`og/`, `og-image.png`) and the home-screen icon
- `tests/`: browser tests that run on every push
- `CONTENT-TODO.md`: **AI-drafted text that still needs your review** (marked `data-draft` in the HTML)

## Add a learning note

1. Copy `NOTE-TEMPLATE.md` into `_notes/` and give it a short, dashed name,
   e.g. `_notes/kafka-consumer-groups.md`. The file name becomes the URL:
   `https://shekabhi.github.io/learning/kafka-consumer-groups/`.
2. Fill in the details at the top (`title`, `topic`, `date`, `tags`, `summary`)
   and write the note in Markdown below them.
3. Run `npm run og` to create the note's link-preview image (`og/<note>.jpg`). A test fails if it's missing.
   If the note has runnable examples, run `npm run examples -- --update` to record their output (needs Java 21).
4. Commit and push. GitHub builds the page and adds it to the Learning hub in about a minute.

You can do this on github.com too: open the `_notes` folder, click **Add file → Create new file**.

- A **new `topic`** automatically gets its own filter button.
- Add `catalog: <topic id>` (from `_data/topics.yml`) to list the note in its Learning section (Java, System design, ...).
- Add `series: core-java` (or `java-collections`, `java-concurrency`) to make the note a chapter: it appears on
  the series page in catalogue order, with previous/next links between chapters.
- Questions without options show under "Common questions"; multiple-choice ones under "Test yourself".
- Add `questions:` (each with `q` and `a`) to show a "Test yourself" section and include them in the Quiz.
  Add `options:` and `correct:` (counting from 1) to a question to make it multiple choice.
- Runnable example: a complete program tagged `{: .runnable}`, followed by its output tagged
  `{: .run-output}`. Readers get a Run button. See `NOTE-TEMPLATE.md`.
- Private plan view: type `plan on` in the site's terminal. This browser then shows every catalogue
  topic and your own quiz results on `/learning/topics/`. Visitors never see it; `plan off` hides it.
- When you update a note, add `updated: YYYY-MM-DD` to show when it was last updated.
- A `date` in the future keeps the note hidden until that day.

## Work on it locally

Needs Node 22 and Ruby 3.3.

```bash
npm install && bundle install
npm run serve      # http://localhost:4173, rebuilds as you edit
npm run check      # build + HTML validation + browser tests
npm run examples   # compile and run the Java examples (needs Java 21)
```

## Automation (`.github/`)
- **CI**: builds the site with Jekyll (like GitHub Pages does), validates the HTML, runs the browser tests (desktop and phone, including accessibility in both themes and a privacy check), and compiles and runs every Java example on Java 21, on every push and pull request.
- **Link check**: finds dead links every Monday and whenever the page changes.
- **Dependabot**: opens a monthly pull request to update the test tools.
- **Templates**: issue forms for bugs and ideas, and a pull request checklist.

Hosted on GitHub Pages from the `master` branch.
