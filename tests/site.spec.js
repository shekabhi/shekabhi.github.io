// Smoke tests for the portfolio. Run with: npm test
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const isMobile = (testInfo) => testInfo.project.name === "mobile";
const fs = require("fs");
const path = require("path");

const CASES = ["mcp-server", "pasoe", "fips", "rate-limiter"];
// Notes come from the Jekyll build, so new notes are tested automatically.
const NOTES = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_site", "learning", "notes.json"), "utf8"));
const PAGES = ["/", ...CASES.map((c) => `/work/${c}.html`), "/learning/", "/learning/topics/", "/learning/quiz/", ...NOTES.map((n) => n.url), "/play/", "/about/"];

// Collect JavaScript errors and failed requests on every page
test.beforeEach(async ({ page }) => {
  // behave like a returning visitor: the boot screen only plays on a first visit
  await page.addInitScript(() => { try { sessionStorage.setItem("boot-seen", "1"); } catch { /* ignore */ } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("localhost")) page.errors.push(`${r.status()} ${r.url()}`);
  });
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors or missing files").toEqual([]);
});

const reveal = async (page) => {
  await page.evaluate(() => {
    document.querySelectorAll(".reveal").forEach((e) => e.classList.add("visible"));
    window.portfolioMotion?.finishAll();
  });
  await page.waitForTimeout(800);
};

for (const path of PAGES) {
  test.describe(`page ${path}`, () => {
    test.beforeEach(async ({ page }) => { await page.goto(path); });

    test("loads, with one h1 and a description", async ({ page }) => {
      await expect(page).toHaveTitle(/Abhishek Shukla/);
      await expect(page.locator("h1")).toHaveCount(1);
      const desc = await page.locator('meta[name="description"]').getAttribute("content");
      expect(desc.length).toBeGreaterThan(50);
    });

    test("every link on the page resolves", async ({ page, request }) => {
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      for (const href of new Set(hrefs)) {
        if (/^(https?:|mailto:)/.test(href)) continue;
        const url = new URL(href, page.url());
        const res = await request.get(url.pathname);
        expect(res.status(), `${href} loads`).toBe(200);
        if (url.hash) {
          const html = await res.text();
          expect(html, `${href} has that section`).toContain(`id="${url.hash.slice(1)}"`);
        }
      }
    });

    test("stylesheets and scripts carry the build version, so updates are never mixed with old cached files", async ({ page, request }) => {
      const urls = await page.$$eval('link[rel="stylesheet"][href$=".css"], link[rel="stylesheet"][href*=".css?"], script[src]',
        (els) => els.map((e) => e.getAttribute("href") || e.getAttribute("src")).filter((u) => !/^https?:/.test(u)));
      expect(urls.length).toBeGreaterThan(2);
      const versions = new Set();
      for (const u of urls) {
        const m = u.match(/\?v=(\d+)$/);
        expect(m, `${u} has a version`).not.toBeNull();
        versions.add(m[1]);
        const res = await request.get(new URL(u, page.url()).pathname);
        expect(res.status(), `${u} loads`).toBe(200);
      }
      expect(versions.size).toBe(1);
    });

    test("page is never wider than the screen", async ({ page }) => {
      // Phone browsers widen the layout to fit overflowing content, so compare
      // against the real screen width rather than window.innerWidth.
      const screen = page.viewportSize().width;
      const width = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth));
      expect(width).toBeLessThanOrEqual(screen);
    });

    for (const theme of ["dark", "light"]) {
      test(`no accessibility violations (${theme} theme)`, async ({ page }) => {
        await page.evaluate((t) => window.portfolioTheme.set(t), theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme-pref", theme);
        await reveal(page);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0].target})`)).toEqual([]);
      });
    }
  });
}

test.describe("home page", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("has every section and a card for each case study", async ({ page }) => {
    for (const id of ["demo", "work", "play-teaser", "contact"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    for (const c of CASES) {
      await expect(page.locator(`.case-card a[href="work/${c}.html"]`)).toHaveCount(1);
    }
  });

  test("play teaser links to the game and invites a first score", async ({ page }) => {
    const teaser = page.locator("#play-teaser");
    await expect(teaser.locator('a[href="/play/"]')).toHaveText("Play the typing test");
    await expect(teaser.locator(".teaser-best")).toHaveText("No score yet. Set one in 30 seconds.");
  });

  test("play teaser shows the visitor's best score", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("typing-pb", JSON.stringify({ "dev-30": 61, "common-15": 78 })));
    await page.reload();
    await expect(page.locator("#play-teaser .teaser-best")).toHaveText("Your best: 78 wpm · common words · 15s. Can you beat it?");
  });

  test("play teaser preview types itself, and stays still with reduced motion", async ({ page }) => {
    await page.locator("#play-teaser").scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator("#play-teaser .t-ok").count()).toBeGreaterThan(3);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.locator("#play-teaser").scrollIntoViewIfNeeded();
    const n = await page.locator("#play-teaser .t-ok").count();
    await page.waitForTimeout(600);
    await expect(page.locator("#play-teaser .t-ok")).toHaveCount(n);
    expect(n).toBeGreaterThan(20);
  });

  test("link preview image exists", async ({ page, request }) => {
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    const res = await request.get(new URL(og).pathname);
    expect(res.status()).toBe(200);
  });
});

test.describe("rate limiter demo", () => {
  for (const path of ["/", "/work/rate-limiter.html"]) {
    test(`allows 5 requests then rejects, on ${path}`, async ({ page }) => {
      await page.goto(path);
      const demo = page.locator("[data-ratelimit-demo]");
      const send = demo.locator(".rl-send");
      for (let i = 0; i < 5; i++) await send.click();
      await expect(demo.locator(".rl-count")).toHaveText("5/5");
      await expect(demo.locator(".rl-log .bad")).toHaveCount(0);
      await send.click();
      await expect(demo.locator(".rl-count")).toHaveText("5/5");
      await expect(demo.locator(".rl-log .bad")).toHaveCount(1);
      await expect(demo.locator(".rl-log")).toContainText("429 Too Many Requests");
      await demo.locator(".rl-reset").click();
      await expect(demo.locator(".rl-count")).toHaveText("0/5");
      await send.click();
      await expect(demo.locator(".rl-count")).toHaveText("1/5");
    });
  }
});

test.describe("learning hub", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/learning/"); });
  const cards = (page) => page.locator(".note-card:not([hidden])");

  test("lists every note, newest first", async ({ page }) => {
    await expect(cards(page)).toHaveCount(NOTES.length);
    const dates = await page.$$eval(".note-card time", (ts) => ts.map((t) => t.getAttribute("datetime")));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test("topic filter shows only that topic, and survives a reload", async ({ page }) => {
    const topic = NOTES[0].topic;
    const expected = NOTES.filter((n) => n.topic === topic).length;
    await page.locator(".topic-filters button", { hasText: topic }).click();
    await expect(cards(page)).toHaveCount(expected);
    await expect(page).toHaveURL(/\?topic=/);
    await page.reload();
    await expect(cards(page)).toHaveCount(expected);
    await page.locator('.topic-filters button[data-topic="all"]').click();
    await expect(cards(page)).toHaveCount(NOTES.length);
  });

  test("search narrows the list and shows a message when nothing matches", async ({ page }) => {
    const word = NOTES[0].title.split(" ")[0];
    await page.locator(".learn-search").fill(word.toLowerCase());
    expect(await cards(page).count()).toBeGreaterThan(0);
    await page.locator(".learn-search").fill("zzzz-no-such-note");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator(".learn-empty")).toBeVisible();
  });

  test("nav link opens the hub from the home page", async ({ page }, testInfo) => {
    await page.goto("/");
    if (isMobile(testInfo)) await page.locator(".nav-toggle").click();
    await page.locator('.nav-links a[href="/learning/"]').click();
    await expect(page).toHaveURL(/\/learning\/$/);
    await expect(page.locator("h1")).toContainText("Notes");
  });
});

test.describe("learning: topics, quiz and privacy", () => {
  const QUIZ = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_site", "learning", "quiz", "index.html"), "utf8")
    .match(/id="quiz-data">([\s\S]*?)<\/script>/)[1]);
  const planOn = (page) => page.addInitScript(() => localStorage.setItem("study-plan", "on"));
  const visibleTopics = (page) => page.locator(".topic:not([hidden])");

  test("tabs link Notes, Topics and Quiz and mark the current one", async ({ page }) => {
    for (const [url, label] of [["/learning/", "Notes"], ["/learning/topics/", "Topics"], ["/learning/quiz/", "Quiz"]]) {
      await page.goto(url);
      await expect(page.locator('.learn-tabs a[aria-current="page"]')).toHaveText(label);
      await expect(page.locator(".learn-tabs a")).toHaveCount(3);
    }
  });

  test("visitors see only topics that have notes, and no plan", async ({ page }) => {
    await page.goto("/learning/topics/");
    await expect(visibleTopics(page)).toHaveCount(NOTES.length);
    await expect(page.locator(".plan-banner")).toBeHidden();
    await expect(page.locator(".plan-todo")).toHaveCount(0);
    expect(await page.content()).not.toContain("not started");
    for (const n of NOTES) await expect(page.locator(`.topic-notes a[href="${n.url}"]`)).toBeVisible();
    // titles with commas must not be cut off
    await expect(page.locator(".topic-name", { hasText: "Java memory model, volatile & atomics" })).toBeVisible();
  });

  test("public learning pages show no personal plan or progress", async ({ page }) => {
    for (const url of ["/learning/", "/learning/topics/", "/learning/quiz/", ...NOTES.map((n) => n.url)]) {
      await page.goto(url);
      const text = await page.locator("body").innerText();
      expect(text, url).not.toMatch(/roadmap|revis|confidence|study plan|not started|my progress/i);
    }
  });

  test("notes end with a Test yourself section that reveals answers", async ({ page }) => {
    const note = NOTES[0];
    const qs = QUIZ.filter((q) => q.url === note.url);
    await page.goto(note.url);
    await expect(page.locator("#test-yourself")).toHaveText("Test yourself");
    await expect(page.locator(".qa")).toHaveCount(qs.length);
    await expect(page.locator('.toc a[href="#test-yourself"]')).toHaveCount(1);
    const first = page.locator(".qa").first();
    await expect(first.locator(".qa-a")).toBeHidden();
    await first.locator("summary").click();
    await expect(first.locator(".qa-a")).toBeVisible();
    await expect(page.locator(".qa-more a")).toHaveAttribute("href", `/learning/quiz/?note=${qs[0].note}`);
  });

  test("quiz: reveal, got it, ask again, and a summary at the end", async ({ page }) => {
    const slug = QUIZ[0].note;
    const n = QUIZ.filter((q) => q.note === slug).length;
    await page.goto(`/learning/quiz/?note=${slug}`);
    await expect(page.locator(".quiz-count")).toContainText(`Question 1 of ${n}`);
    await expect(page.locator(".quiz-a")).toBeHidden();
    await page.locator(".quiz-reveal").click();
    await expect(page.locator(".quiz-a")).toBeVisible();
    await page.locator(".quiz-again").click();             // first question: missed
    for (let i = 0; i < n; i++) {                           // everything else, plus the repeat
      await page.locator(".quiz-reveal").click();
      await page.locator(".quiz-got").click();
    }
    await expect(page.locator(".quiz-done")).toBeVisible();
    await expect(page.locator(".quiz-score")).toHaveText(`You knew ${n - 1} of ${n} on the first try.`);
    await expect(page.locator(".quiz-review-list li")).toHaveCount(1);
    await page.locator(".quiz-restart").click();
    await expect(page.locator(".quiz-count")).toContainText(`Question 1 of ${n}`);
  });

  test("quiz: topic filter and keyboard keys", async ({ page }, testInfo) => {
    await page.goto("/learning/quiz/");
    await expect(page.locator(".quiz-count")).toContainText(`of ${QUIZ.length}`);
    const topic = QUIZ[0].topic;
    await page.locator(".quiz-filters button", { hasText: topic }).click();
    await expect(page.locator(".quiz-count")).toContainText(`of ${QUIZ.filter((q) => q.topic === topic).length}`);
    await expect(page).toHaveURL(/\?topic=/);
    test.skip(isMobile(testInfo), "keyboard keys are for desktop");
    await page.locator("h1").click();
    await page.keyboard.press("Space");
    await expect(page.locator(".quiz-a")).toBeVisible();
    await page.keyboard.press("1");
    await expect(page.locator(".quiz-count")).toContainText("Question 2");
  });

  test("quiz answers are not saved for visitors", async ({ page }) => {
    await page.goto(`/learning/quiz/?note=${QUIZ[0].note}`);
    await page.locator(".quiz-reveal").click();
    await page.locator(".quiz-got").click();
    expect(await page.evaluate(() => localStorage.getItem("study-progress"))).toBeNull();
  });

  test("private plan view: full catalogue and own quiz results, only after 'plan on'", async ({ page }) => {
    await planOn(page);
    const slug = QUIZ[0].note;
    await page.goto(`/learning/quiz/?note=${slug}`);
    await page.locator(".quiz-reveal").click();
    await page.locator(".quiz-got").click();
    await page.goto("/learning/topics/");
    await expect(page.locator(".plan-banner")).toBeVisible();
    expect(await visibleTopics(page).count()).toBeGreaterThan(NOTES.length + 30);
    await expect(page.locator(".plan-area-stat").first()).toContainText("topics have notes");
    expect(await page.locator(".plan-todo").count()).toBeGreaterThan(30);
    await expect(page.locator(`.plan-stat[data-note="${slug}"]`)).toHaveText(/quiz 1\/\d+/);
  });

  test("terminal plan command is hidden from help and toggles the plan view", async ({ page }) => {
    await page.goto("/learning/topics/");
    await page.locator(".term-btn").first().evaluate((b) => b.click());
    const input = page.locator(".term-prompt input");
    await input.fill("help");
    await input.press("Enter");
    await expect(page.locator(".term-body")).not.toContainText("plan");
    await input.fill("plan on");
    await input.press("Enter");
    expect(await page.evaluate(() => localStorage.getItem("study-plan"))).toBe("on");
    await input.fill("plan off");
    await input.press("Enter");
    expect(await page.evaluate(() => localStorage.getItem("study-plan"))).toBeNull();
  });
});

test.describe("note pages", () => {
  for (const note of NOTES) {
    test(`${note.url} has a table of contents, highlighted code and copy buttons`, async ({ page }) => {
      await page.goto(note.url);
      await expect(page.locator("h1")).toHaveText(note.title);
      await expect(page.locator(".toc a").first()).toBeVisible();
      const blocks = page.locator(".note-body div.highlighter-rouge");
      expect(await blocks.count()).toBeGreaterThan(0);
      await expect(page.locator(".note-body .code-copy")).toHaveCount(await blocks.count());
      await expect(page.locator('.next-case a').first()).toBeVisible();
    });
  }
});

test.describe("theme switch", () => {
  const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const DARK = "rgb(11, 15, 23)", LIGHT = "rgb(247, 248, 251)";
  const themeBtn = async (page, testInfo) => {
    if (isMobile(testInfo)) await page.locator(".nav-toggle").click();
    return page.locator(".nav-links .theme-btn");
  };

  test("defaults to the device setting", async ({ browser }) => {
    for (const [scheme, expected] of [["light", LIGHT], ["dark", DARK]]) {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme-pref", "system");
      await expect.poll(() => bg(page)).toBe(expected);
      await ctx.close();
    }
  });

  test("button cycles System → Light → Dark → System and is remembered", async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const btn = await themeBtn(page, testInfo);
    await expect(btn).toHaveAttribute("aria-label", /System/);
    await btn.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => bg(page)).toBe(LIGHT);
    await expect(btn).toHaveAttribute("aria-label", /Light/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f7f8fb");

    // remembered on reload and on other pages
    await page.goto("/learning/");
    await expect.poll(() => bg(page)).toBe(LIGHT);

    const btn2 = await themeBtn(page, testInfo);
    await btn2.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => bg(page)).toBe(DARK);
    await btn2.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
    await expect(page.locator("html")).toHaveAttribute("data-theme-pref", "system");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
  });

  for (const [theme, panel, log] of [["light", "rgb(255, 255, 255)", "rgb(245, 247, 250)"], ["dark", "rgb(13, 19, 32)", "rgb(7, 11, 17)"]]) {
    test(`live demo follows the ${theme} theme and stays readable`, async ({ page }) => {
      await page.goto("/");
      await page.evaluate((t) => window.portfolioTheme.set(t), theme);
      const demo = page.locator("[data-ratelimit-demo]");
      await expect.poll(() => demo.locator(".rl").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(panel);
      await expect.poll(() => demo.locator(".rl-log").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(log);
      // fill the log with allowed and rejected lines, then check contrast
      for (let i = 0; i < 7; i++) await demo.locator(".rl-send").click();
      await expect(demo.locator(".rl-log .bad")).toHaveCount(2);
      await demo.scrollIntoViewIfNeeded();
      const results = await new AxeBuilder({ page }).include("[data-ratelimit-demo]").analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0].target})`)).toEqual([]);
    });
  }

  for (const [theme, panel] of [["light", "rgb(255, 255, 255)"], ["dark", "rgb(13, 19, 32)"]]) {
    test(`diagrams and code blocks follow the ${theme} theme`, async ({ page }) => {
      const bgOf = (sel) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
      await page.goto("/work/fips.html");
      await page.evaluate((t) => window.portfolioTheme.set(t), theme);
      await expect.poll(() => bgOf(".figure")).toBe(panel);
      // diagram arrows use theme colours, not fixed ones
      const arrow = await page.locator(".figure .m-line").first().evaluate((el) => getComputedStyle(el).fill);
      const line = await page.locator(".figure .d-line").first().evaluate((el) => getComputedStyle(el).stroke);
      expect(arrow).toBe(line);

      await page.goto("/learning/oauth2-pkce-in-five-minutes/");
      await expect.poll(() => bgOf(".note-body pre")).toBe(panel);
      const keyword = await page.locator(".note-body .highlight .k").first().evaluate((el) => getComputedStyle(el).color);
      expect(keyword).toBe(theme === "light" ? "rgb(124, 58, 237)" : "rgb(196, 181, 253)");
    });
  }

  for (const [theme, expected] of [["light", "rgb(255, 255, 255)"], ["dark", "rgb(7, 11, 17)"]]) {
    test(`terminal follows the ${theme} theme and stays readable`, async ({ page }) => {
      await page.goto("/");
      await page.evaluate((t) => window.portfolioTheme.set(t), theme);
      await page.locator(".term-btn").first().evaluate((b) => b.click());
      const input = page.locator(".term-prompt input");
      // print every kind of line: normal, accent, dim, error, success and links
      for (const cmd of ["help", "contact", "nope", "email"]) {
        await input.fill(cmd);
        await input.press("Enter");
      }
      await expect(page.locator(".term-body")).toContainText("command not found: nope");
      await expect.poll(() => page.locator(".term").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(expected);
      // let the terminal's opening fade finish, so contrast is measured on the final colours
      await page.locator(".term-overlay").evaluate((el) => Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished)));
      const results = await new AxeBuilder({ page }).include(".term").analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0].target})`)).toEqual([]);
    });
  }

  test("switching theme while the terminal is open recolours it", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.portfolioTheme.set("dark"));
    await page.locator(".term-btn").first().evaluate((b) => b.click());
    const input = page.locator(".term-prompt input");
    await input.fill("theme light");
    await input.press("Enter");
    await expect.poll(() => page.locator(".term").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
  });

  test("works when the browser blocks storage", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
    });
    await page.goto("/");
    const btn = await themeBtn(page, testInfo);
    await btn.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("terminal theme command", async ({ page }) => {
    await page.goto("/");
    await page.locator(".term-btn").first().evaluate((b) => b.click());
    const input = page.locator(".term-prompt input");
    await input.fill("theme light");
    await input.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator(".term-body")).toContainText("Theme set to light");
    await input.fill("theme purple");
    await input.press("Enter");
    await expect(page.locator(".term-body")).toContainText("unknown option 'purple'");
  });
});

test.describe("typing game", () => {
  const box = (page) => page.locator(".type-box");
  const firstWords = (page, n) =>
    page.$$eval(".type-words .w", (els, n) => els.slice(0, n).map((e) => e.textContent), n);
  const typeWords = async (page, list) => { for (const w of list) await page.keyboard.type(w + " "); };

  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto("/play/");
    await page.locator('[data-time="15"]').click();
    await box(page).click();
  });

  test("correct typing gives 100% accuracy and the right WPM", async ({ page }) => {
    const words = await firstWords(page, 6);
    await typeWords(page, words);
    await page.clock.runFor(16000);
    const results = page.locator(".type-results");
    await expect(results).toBeVisible();
    await expect(results.locator(".r-acc")).toHaveText("100%");
    const chars = words.reduce((n, w) => n + w.length + 1, 0);
    const expected = Math.round((chars / 5) / (15 / 60));
    await expect(results.locator(".r-wpm")).toHaveText(String(expected));
    await expect(results.locator(".r-chart polyline.c-wpm")).toHaveCount(1);
    await expect(results.locator(".r-pb")).toHaveText("New personal best!");
  });

  test("mistakes lower accuracy, are marked and counted", async ({ page }) => {
    const [w1, w2] = await firstWords(page, 2);
    const wrong = (w1[0] === "x" ? "y" : "x") + w1.slice(1);
    await typeWords(page, [wrong, w2]);
    await expect(page.locator(".type-words .w").first()).toHaveClass(/wrong/);
    await page.clock.runFor(16000);
    const acc = parseInt(await page.locator(".r-acc").textContent(), 10);
    expect(acc).toBeLessThan(100);
    await expect(page.locator(".r-chars")).toHaveText(/^\d+ \/ 1 \/ 0 \/ 0$/);
  });

  test("the clock starts on the first keystroke", async ({ page }) => {
    await page.clock.runFor(5000);
    await expect(page.locator(".type-time")).toHaveText("15");
    await page.keyboard.type("a");
    await page.clock.runFor(3000);
    await expect(page.locator(".type-time")).toHaveText("12");
  });

  test("Esc restarts with fresh words", async ({ page }) => {
    const [w1] = await firstWords(page, 1);
    await typeWords(page, [w1]);
    await page.clock.runFor(2000);
    await page.keyboard.press("Escape");
    await expect(page.locator(".type-time")).toHaveText("15");
    await expect(page.locator(".type-words .w.done")).toHaveCount(0);
    await expect(page.locator(".term-overlay")).toBeHidden();
  });

  test("personal best is remembered per mode", async ({ page }) => {
    await typeWords(page, await firstWords(page, 8));
    await page.clock.runFor(16000);
    const best = await page.locator(".r-wpm").textContent();
    await page.locator(".r-again").click();
    await typeWords(page, await firstWords(page, 1));
    await page.clock.runFor(16000);
    await expect(page.locator(".r-pb")).toHaveText(`Personal best: ${best} wpm`);
    // a different mode has its own best
    await page.locator('[data-time="30"]').click();
    await typeWords(page, await firstWords(page, 1));
    await page.clock.runFor(31000);
    await expect(page.locator(".r-pb")).toHaveText("New personal best!");
  });

  test("switching word list gives new words", async ({ page }) => {
    const before = (await firstWords(page, 10)).join(" ");
    await page.locator('[data-mode="common"]').click();
    await expect(page.locator('[data-mode="common"]')).toHaveAttribute("aria-pressed", "true");
    const after = (await firstWords(page, 10)).join(" ");
    expect(after).not.toBe(before);
  });

  test("typing 't' in the game doesn't open the terminal", async ({ page }) => {
    await page.keyboard.type("t");
    await expect(page.locator(".term-overlay")).toBeHidden();
  });

  test("keys pressed right after time runs out don't open the terminal", async ({ page }) => {
    await typeWords(page, await firstWords(page, 2));
    await page.keyboard.type("tes");          // still typing as the clock hits zero
    await page.clock.runFor(16000);
    await expect(page.locator(".type-results")).toBeVisible();
    await page.keyboard.type("ttT");          // momentum keystrokes after the end
    await expect(page.locator(".term-overlay")).toBeHidden();
    // ~ still opens the terminal on purpose
    await page.keyboard.press("Shift+Backquote");
    await expect(page.locator(".term-overlay")).toBeVisible();
    // and Esc closes it without restarting the game
    await page.keyboard.press("Escape");
    await expect(page.locator(".term-overlay")).toBeHidden();
    await expect(page.locator(".type-results")).toBeVisible();
  });

  test("terminal button tooltip doesn't mention T on the game page", async ({ page }) => {
    await expect(page.locator(".nav-links .term-btn")).toHaveAttribute("title", "Open terminal (press ~)");
    await page.goto("/");
    await expect(page.locator(".nav-links .term-btn")).toHaveAttribute("title", "Open terminal (press ~ or T)");
  });

  test("Esc on the results screen starts a new game", async ({ page }) => {
    await typeWords(page, await firstWords(page, 2));
    await page.clock.runFor(16000);
    await expect(page.locator(".type-results")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".type-stage")).toBeVisible();
    await expect(page.locator(".type-input")).toBeFocused();
    await expect(page.locator(".type-time")).toHaveText("15");
  });

  test("results pass the accessibility check in both themes", async ({ page }) => {
    await typeWords(page, await firstWords(page, 4));
    await page.clock.runFor(16000);
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => window.portfolioTheme.set(t), theme);
      await page.waitForTimeout(600); // the theme fade runs on real time, not the fake clock
      const r = await new AxeBuilder({ page }).include(".play").analyze();
      expect(r.violations.map((v) => `${theme} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(" ; ")})`)).toEqual([]);
    }
  });
});

test("terminal play command opens the game", async ({ page }) => {
  await page.goto("/");
  await page.locator(".term-btn").first().evaluate((b) => b.click());
  const input = page.locator(".term-prompt input");
  await input.fill("play");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/play\/$/);
});

test.describe("about page", () => {
  test("home page has no career or principles, only the About link", async ({ page }) => {
    await page.goto("/");
    for (const id of ["career", "principles"]) await expect(page.locator(`#${id}`)).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Tata Consultancy Services");
    await expect(page.locator("main")).not.toContainText("Things I've come to believe");
    await expect(page.locator('.nav-links a[href="/about/"]')).toHaveCount(1);
  });

  test("menu is Work, Learning, Play, About on every kind of page", async ({ page }) => {
    for (const from of ["/work/fips.html", "/learning/", "/play/", "/about/"]) {
      await page.goto(from);
      const links = await page.$$eval(".nav-links a:not(.btn)", (as) => as.map((a) => a.textContent.trim()));
      expect(links.slice(-3)).toEqual(["Learning", "Play", "About"]);
      expect(links).not.toContain("How I work");
      expect(links).not.toContain("Career");
    }
  });

  test("About link opens the page and is marked current", async ({ page }, testInfo) => {
    for (const from of ["/", "/work/fips.html", "/learning/", "/play/"]) {
      await page.goto(from);
      if (isMobile(testInfo)) await page.locator(".nav-toggle").click();
      await page.locator('.nav-links a[href="/about/"]').click();
      await expect(page).toHaveURL(/\/about\/$/);
      await expect(page.locator("h1")).toHaveText("Hi, I'm Abhishek.");
    }
    await expect(page.locator('.nav-links a[href="/about/"]')).toHaveAttribute("aria-current", "page");
  });

  test("has bio, principles, experience, skills and education", async ({ page }) => {
    await page.goto("/about/");
    await expect(page.locator(".bio")).toBeVisible();
    await expect(page.locator("#how-i-work .principles li")).toHaveCount(6);
    await expect(page.locator("#experience .roles .role")).toHaveCount(3);
    for (const text of ["Senior Software Engineer 1", "Software Engineer 2", "Tata Consultancy Services",
      "Distributed Rate Limiter", "Spring Boot", "B.Tech, Information Technology", "XRPL Blockchain Hackathon", "Performance Band A"]) {
      await expect(page.locator("main")).toContainText(text);
    }
    for (const c of CASES) await expect(page.locator(`.role-points a[href="/work/${c}.html"]`)).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText("9821178125");
  });

  test("jump links go to each section", async ({ page }) => {
    await page.goto("/about/");
    for (const id of ["how-i-work", "experience", "skills", "education"]) {
      await page.locator(`.about-jump a[href="#${id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id} h2`)).toBeInViewport();
    }
  });

  test("old /career/ address forwards to the Experience section", async ({ page }) => {
    await page.goto("/career/");
    await expect(page).toHaveURL(/\/about\/#experience$/);
    await expect(page.locator("#experience h2")).toBeInViewport();
  });

  test("terminal experience command links to the About page", async ({ page }) => {
    await page.goto("/");
    await page.locator(".term-btn").first().evaluate((b) => b.click());
    const input = page.locator(".term-prompt input");
    await input.fill("experience");
    await input.press("Enter");
    await expect(page.locator(".term-body a[href='https://shekabhi.github.io/about/']")).toHaveCount(1);
  });
});

test.describe("motion", () => {
  const HEADLINE = "I build backends that survive production.";
  const desktopOnly = (testInfo) => test.skip(isMobile(testInfo), "needs a mouse");

  test("01 headline decrypts, then reads normally", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator(".hero h1");
    await expect(h1).toHaveText(HEADLINE, { timeout: 4000 });
    await expect(h1).not.toHaveAttribute("aria-label", /./);
  });

  test("02 network background is drawn behind the intro", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator(".hero canvas.net-bg");
    await expect(canvas).toHaveCount(1);
    const painted = await canvas.evaluate((c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    });
    expect(painted).toBe(true);
  });

  test("03 requests flow through diagrams", async ({ page }) => {
    await page.goto("/work/rate-limiter.html");
    const fig = page.locator(".figure > svg[data-routes]");
    await fig.scrollIntoViewIfNeeded();
    await expect.poll(() => fig.locator(".pk").count(), { timeout: 8000 }).toBeGreaterThan(0);
  });

  test("04 diagrams draw themselves, then settle with their arrowheads", async ({ page }) => {
    await page.goto("/work/fips.html");
    const fig = page.locator(".figure > svg").first();
    expect(await fig.locator(".d-box").first().evaluate((el) => el.style.opacity)).toBe("0");
    await fig.scrollIntoViewIfNeeded();
    await expect.poll(() => fig.evaluate((svg) =>
      [...svg.querySelectorAll(".d-box, .d-text, .d-line")].every((el) => !el.style.opacity && !el.style.strokeDashoffset)
    ), { timeout: 6000 }).toBe(true);
    expect(await fig.locator(".d-line[marker-end]").count()).toBeGreaterThan(2);
  });

  test("05 numbers count up to the real values", async ({ page }) => {
    await page.goto("/work/fips.html");
    const results = page.locator(".case-body .results strong");
    await results.first().scrollIntoViewIfNeeded();
    await expect(results).toHaveText(["−40%", "+30%", "20+", "0"], { timeout: 5000 });
  });

  test("06 cards light up and tilt under the cursor", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("/");
    await reveal(page);
    const card = page.locator(".case-card").first();
    await card.scrollIntoViewIfNeeded();
    await card.hover({ position: { x: 40, y: 40 } });
    await expect.poll(() => card.evaluate((el) => el.style.transform)).toContain("perspective");
    await expect.poll(() => card.evaluate((el) => el.style.getPropertyValue("--x"))).toMatch(/px$/);
    await page.mouse.move(2, 2);
    await expect.poll(() => card.evaluate((el) => el.style.transform)).toBe("");
  });

  test("07 theme switch ripples from the button", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.__vt = 0;
      const orig = document.startViewTransition?.bind(document);
      if (orig) document.startViewTransition = (cb) => { window.__vt++; return orig(cb); };
    });
    await page.goto("/");
    if (isMobile(testInfo)) await page.locator(".nav-toggle").click();
    await page.locator(".nav-links .theme-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-pref", "light");
    expect(await page.evaluate(() => window.__vt)).toBe(1);
  });

  test("08 list items slide in one after another", async ({ page }) => {
    await page.goto("/about/");
    const list = page.locator("#how-i-work .principles");
    expect(await list.evaluate((el) => el.classList.contains("st-wait"))).toBe(true);
    await list.scrollIntoViewIfNeeded();
    await expect.poll(() => list.locator("li").last().evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
  });

  test("09 main buttons lean toward the cursor", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("/");
    const btn = page.locator(".hero-cta .btn").first();
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10);
    await expect.poll(() => btn.evaluate((el) => el.style.transform)).toContain("translate");
  });

  test("10 boot sequence plays once per visit and can be skipped", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/");
    const overlay = page.locator(".boot-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText("Started in 0.42s");
    await expect(overlay).toHaveCount(0, { timeout: 4000 });
    await expect(page.locator(".hero h1")).toHaveText(HEADLINE, { timeout: 4000 });
    // not again in the same visit: check right after load, before it could fade away by itself
    await page.reload();
    expect(await page.locator(".boot-overlay").count()).toBe(0);
    // a fresh visit can skip it with any key
    const page2 = await (await browser.newContext()).newPage();
    await page2.goto("/");
    await page2.keyboard.press("x");
    await expect(page2.locator(".boot-overlay")).toHaveCount(0, { timeout: 1000 });
    await ctx.close();
  });

  test("reduced motion: everything shows its final state straight away", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const vt = [];
    await page.addInitScript(() => {
      window.__vt = 0;
      const orig = document.startViewTransition?.bind(document);
      if (orig) document.startViewTransition = (cb) => { window.__vt++; return orig(cb); };
    });
    await page.goto("/");
    await expect(page.locator(".boot-overlay")).toHaveCount(0);
    await expect(page.locator(".hero h1")).toHaveText(HEADLINE);
    await expect(page.locator(".work-grid")).not.toHaveClass(/st-wait/);
    await page.goto("/work/fips.html");
    await expect(page.locator(".case-body .results strong").first()).toHaveText("−40%");
    expect(await page.locator(".figure .d-box").first().evaluate((el) => el.style.opacity)).toBe("");
    await page.waitForTimeout(1500);
    await expect(page.locator(".pk")).toHaveCount(0);
    await page.locator(".nav-links .theme-btn").evaluate((b) => b.click());
    await expect(page.locator("html")).toHaveAttribute("data-theme-pref", "light");
    expect(await page.evaluate(() => window.__vt)).toBe(0);
    await ctx.close();
  });
});

test.describe("MCP flow", () => {
  test("steps forward and back through all 12 steps", async ({ page }) => {
    await page.goto("/work/mcp-server.html");
    const flow = page.locator("[data-mcp-flow]");
    const next = flow.locator('[data-a="next"]'), prev = flow.locator('[data-a="prev"]');
    await expect(flow.locator(".flow-caption .step")).toHaveText("STEP 1 / 12");
    await expect(prev).toBeDisabled();
    for (let i = 0; i < 11; i++) await next.click();
    await expect(flow.locator(".flow-caption .step")).toHaveText("STEP 12 / 12");
    await expect(next).toBeDisabled();
    await expect(flow.locator(".f-step.active")).toHaveCount(1);
    await prev.click();
    await expect(flow.locator(".flow-caption .step")).toHaveText("STEP 11 / 12");
  });
});

test.describe("terminal", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  const overlay = (page) => page.locator(".term-overlay");
  const input = (page) => page.locator(".term-prompt input");
  const body = (page) => page.locator(".term-body");
  const run = async (page, cmd) => { await input(page).fill(cmd); await input(page).press("Enter"); };

  test("opens with the keyboard (~, ` and T) and closes with Esc", async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), "keyboard shortcuts are desktop only");
    for (const key of ["Backquote", "Shift+Backquote", "KeyT"]) {
      await page.keyboard.press(key);
      await expect(overlay(page), `${key} opens`).toBeVisible();
      await expect(input(page)).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(overlay(page)).toBeHidden();
    }
  });

  test("~ key works on international layouts (reports a dead key)", async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), "keyboard shortcuts are desktop only");
    await page.evaluate(() => document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Dead", code: "Backquote", bubbles: true })));
    await expect(overlay(page)).toBeVisible();
  });

  test("opens from the >_ button", async ({ page }, testInfo) => {
    if (isMobile(testInfo)) {
      await page.locator(".nav-toggle").click();
      await page.locator(".nav-links .term-btn").click();
    } else {
      await page.locator(".nav-links .term-btn").click();
    }
    await expect(overlay(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
  });

  test("runs commands", async ({ page }) => {
    await page.locator(".term-btn").first().evaluate((b) => b.click());
    await run(page, "whoami");
    await expect(body(page)).toContainText("I own features end to end");
    await run(page, "ls projects");
    await expect(body(page)).toContainText("mcp-server.md");
    await run(page, "cat projects/mcp-server.md");
    await expect(body(page)).toContainText("scope-based access control");
    await run(page, "nope");
    await expect(body(page)).toContainText("command not found: nope");
    await run(page, "clear");
    await expect(page.locator(".term-body .term-line")).toHaveCount(0);
  });

  test("tab completion and history", async ({ page }) => {
    await page.locator(".term-btn").first().evaluate((b) => b.click());
    await input(page).fill("cat ski");
    await input(page).press("Tab");
    await expect(input(page)).toHaveValue("cat skills.txt ");
    await input(page).press("Enter");
    await expect(body(page)).toContainText("Hibernate/JPA, Kafka");
    await input(page).press("ArrowUp");
    await expect(input(page)).toHaveValue("cat skills.txt");
  });

  test("phone input is at least 16px so iOS doesn't zoom", async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), "phone only");
    await page.locator(".term-hint .term-btn").click();
    await expect(input(page)).toBeVisible();
    const size = await input(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });
});

test("terminal notes command lists the learning notes", async ({ page }) => {
  await page.goto("/");
  await page.locator(".term-btn").first().evaluate((b) => b.click());
  const input = page.locator(".term-prompt input");
  await input.fill("notes");
  await input.press("Enter");
  await expect(page.locator(".term-body")).toContainText(NOTES[0].title);
  await expect(page.locator(".term-body")).toContainText(`All ${NOTES.length} notes`);
});

test("terminal also opens on a case study page", async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), "keyboard shortcuts are desktop only");
  await page.goto("/work/fips.html");
  await page.keyboard.press("KeyT");
  await expect(page.locator(".term-overlay")).toBeVisible();
});
