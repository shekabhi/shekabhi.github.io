// Smoke tests for the portfolio. Run with: npm test
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const isMobile = (testInfo) => testInfo.project.name === "mobile";

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  expect(page.errors, "no JavaScript errors").toEqual([]);
});

test("page loads with the right title and sections", async ({ page }) => {
  await expect(page).toHaveTitle(/Abhishek Shukla/);
  for (const id of ["about", "skills", "projects", "experience", "contact"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
});

test("every in-page link points to a real section", async ({ page }) => {
  const hrefs = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute("href")));
  for (const href of hrefs) {
    await expect(page.locator(href), `${href} exists`).toHaveCount(1);
  }
});

test("local assets referenced by the page exist", async ({ page, request }) => {
  const urls = await page.evaluate(() => [
    ...[...document.querySelectorAll("link[href], script[src], img[src]")]
      .map((el) => el.getAttribute("href") || el.getAttribute("src")),
    document.querySelector('meta[property="og:image"]').content,
  ]);
  for (const u of urls.filter((u) => !/^https?:\/\/(?!shekabhi\.github\.io)/.test(u))) {
    const path = u.replace("https://shekabhi.github.io", "");
    const res = await request.get(path);
    expect(res.status(), `${path} loads`).toBe(200);
  }
});

test("no horizontal scrolling", async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("no accessibility violations", async ({ page }) => {
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("visible")));
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test.describe("terminal", () => {
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
