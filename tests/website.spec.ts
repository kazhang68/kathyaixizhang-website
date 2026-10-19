import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

test("homepage, navigation, post, and all local links resolve without script errors", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kathy Zhang");
  await expect(page.locator(".pixel-cell")).not.toHaveCount(0);
  await expect(page.locator("#about")).toContainText("homelab");
  await expect(page.locator("#work")).toContainText("Microsoft");
  const links = await page.locator("a[href]").evaluateAll((anchors) => [...new Set(anchors.map((anchor) => anchor.getAttribute("href") || "").filter((href) => href.startsWith("/")))]);
  for (const link of links) {
    const response = await request.get(link);
    expect(response.ok(), link).toBe(true);
  }
  await page.getByRole("navigation").getByRole("link", { name: "Journal" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("rabbit hole");
  await page.locator(".post-card").first().click();
  await expect(page.locator(".prose")).toContainText("Welcome to my little corner");
  await page.getByRole("link", { name: "Back to the journal" }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  expect(errors).toEqual([]);
});

test("journal topic controls work and expose their selected state", async ({ page }) => {
  await page.goto("blog/");
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await expect(page.getByRole("button", { name: "Personal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".filter-post:visible")).toHaveCount(1);
  await page.getByRole("button", { name: /All entries/ }).click();
  await expect(page.getByRole("button", { name: /All entries/ })).toHaveAttribute("aria-pressed", "true");
});

for (const width of [360, 390, 768, 1440]) {
  test(`pages do not overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["./", "blog/", "blog/hello-world/"]) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
    }
  });
}

test("reduced motion shows fully visible static pixel lettering", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  expect(await page.locator(".pixel-cell").evaluateAll((cells) => cells.every((cell) => getComputedStyle(cell).opacity === "1"))).toBe(true);
  expect(await page.locator(".pixel-caret").evaluate((caret) => getComputedStyle(caret).opacity)).toBe("1");
  expect(await page.locator(".pixel-noise, .pixel-scan").evaluateAll((effects) => effects.every((effect) => getComputedStyle(effect).opacity === "0"))).toBe(true);
  expect(await page.locator(".pixel-name").evaluate((svg) => svg.getAnimations({ subtree: true }).length)).toBe(0);
});

test("name decodes left to right, then a decorative caret blinks", async ({ page }) => {
  await page.goto("./");
  const duration = await page.locator(".pixel-art").evaluate((art) => parseFloat(getComputedStyle(art).getPropertyValue("--render-duration")));
  const frame = async (time: number) => page.locator(".pixel-name").evaluate((svg, currentTime) => {
    for (const animation of svg.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = currentTime;
    }
    const opacity = (selector: string) => [...svg.querySelectorAll(selector)].map((element) => Number(getComputedStyle(element).opacity));
    return {
      pixels: opacity(".pixel-cell"),
      noise: opacity(".pixel-noise"),
      scan: opacity(".pixel-scan")[0],
      caret: opacity(".pixel-caret")[0],
    };
  }, time);

  const start = await frame(0);
  expect(start.pixels.every((value) => value === 0)).toBe(true);
  expect(start.caret).toBe(0);

  const middle = await frame(duration * .45);
  expect(middle.pixels[0]).toBe(1);
  expect(middle.pixels.at(-1)).toBe(0);
  expect(middle.noise.some((value) => value > 0)).toBe(true);
  expect(middle.scan).toBeGreaterThan(0);
  expect(middle.caret).toBe(0);

  const complete = await frame(duration + 10);
  expect(complete.pixels.every((value) => value === 1)).toBe(true);
  expect(complete.noise.every((value) => value === 0)).toBe(true);
  expect(complete.scan).toBe(0);
  expect(complete.caret).toBe(1);
  expect((await frame(duration + 800)).caret).toBe(0);
  expect((await frame(duration + 1300)).caret).toBe(1);
  await expect(page.locator(".pixel-name")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".pixel-caret")).not.toHaveAttribute("tabindex");
});

test("the public writing route and authoring controls are gone", async ({ page, request }) => {
  expect(existsSync(join(process.cwd(), "dist", "write", "index.html"))).toBe(false);
  for (const route of ["./", "blog/", "blog/hello-world/"]) {
    await page.goto(route);
    await expect(page.locator('a[href*="/write"], form, textarea, input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Write a post/ })).toHaveCount(0);
  }
  expect((await request.get("write/")).status()).toBe(404);
});

test("static content remains usable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://localhost:4321/kathyaixizhang-website/");
  await expect(page.locator("#about")).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Journal" }).click();
  await page.locator(".post-card").click();
  await expect(page.locator(".prose")).toContainText("An open notebook");
  await context.close();
});
