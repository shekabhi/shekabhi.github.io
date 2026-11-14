// Smoke tests for the portfolio. Run with: npm test
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const isMobile = (testInfo) => testInfo.project.name === "mobile";
const fs = require("fs");
const path = require("path");

const CASES = ["mcp-server", "pasoe", "fips", "rate-limiter"];
// Notes come from the Jekyll build, so new notes are tested automatically.
const NOTES = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_site", "learning", "notes.json"), "utf8"));
const PAGES = ["/", ...CASES.map((c) => `/work/${c}.html`), "/learning/", ...NOTES.map((n) => n.url), "/play/"];

// Collect JavaScript errors and failed requests on every page
test.beforeEach(async ({ page }) => {
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
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("visible")));
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
    for (const id of ["demo", "work", "principles", "career", "play-teaser", "contact"]) {
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
