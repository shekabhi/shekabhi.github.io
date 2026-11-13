// Smoke tests for the portfolio. Run with: npm test
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const isMobile = (testInfo) => testInfo.project.name === "mobile";
const CASES = ["mcp-server", "pasoe", "fips", "rate-limiter"];
const PAGES = ["/", ...CASES.map((c) => `/work/${c}.html`)];

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

    test("no accessibility violations", async ({ page }) => {
      await reveal(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0].target})`)).toEqual([]);
    });
  });
}

test.describe("home page", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("has every section and a card for each case study", async ({ page }) => {
    for (const id of ["demo", "work", "principles", "career", "contact"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    for (const c of CASES) {
      await expect(page.locator(`.case-card a[href="work/${c}.html"]`)).toHaveCount(1);
    }
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

test("terminal also opens on a case study page", async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), "keyboard shortcuts are desktop only");
  await page.goto("/work/fips.html");
  await page.keyboard.press("KeyT");
  await expect(page.locator(".term-overlay")).toBeVisible();
});
