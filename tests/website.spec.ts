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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Journal");
  await page.locator(".post-card").first().click();
  await expect(page.locator(".prose")).toContainText("This website contains my professional experience");
  await page.getByRole("link", { name: "Back to the journal" }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  expect(errors).toEqual([]);
});

test("copy is factual and the decorative interest labels are removed", async ({ page }) => {
  const filler = /hello,?\s*world|curious human|curiosity|rabbit hole|human behind the keyboard|not just my readme|equal parts|work in progress|just like me|building & breaking things|lifelong learning|side quest|figuring things out|learning by building|always evolving|good things start|a growing collection|think out loud/i;
  for (const route of ["./", "blog/", "blog/hello-world/", "404.html"]) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText(filler);
    expect(await page.title()).not.toMatch(filler);
    for (const selector of ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]']) {
      expect(await page.locator(selector).getAttribute("content")).not.toMatch(filler);
    }
    await expect(page.locator(".interest-tags, .about-symbol")).toHaveCount(0);
  }
  await page.goto("./");
  await expect(page.locator("#about h2")).toHaveText("About");
  await expect(page.locator(".profile-card")).toContainText("Microsoft");
  await expect(page.locator(".profile-card")).toContainText("Cornell University");
  await expect(page.locator(".hero-heading")).toContainText("Software Engineer II");
  await expect(page.locator(".pixel-caret")).toHaveCount(1);
  await expect(page.locator(".site-footer")).not.toContainText("A work in progress");
});

test("journal topic controls work and expose their selected state", async ({ page }) => {
  await page.goto("blog/");
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await expect(page.getByRole("button", { name: "Personal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".filter-post:visible")).toHaveCount(1);
  await page.getByRole("button", { name: /All entries/ }).click();
  await expect(page.getByRole("button", { name: /All entries/ })).toHaveAttribute("aria-pressed", "true");
});

for (const width of [320, 360, 390, 768, 1440]) {
  test(`pages do not overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["./", "blog/", "blog/hello-world/"]) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
      expect(await page.locator(".ascii-art").evaluateAll((art) => art.every((element) =>
        element.scrollWidth <= element.clientWidth + 1,
      )), `${route} character art`).toBe(true);
    }
  });
}

test("terminal theme uses real text art and readable accent colors", async ({ page }) => {
  await page.goto("./");
  expect(await page.locator(".pixel-name").evaluate((art) => art.tagName)).toBe("PRE");
  await expect(page.locator(".pixel-name")).toContainText("██");
  await expect(page.locator(".pixel-name svg, .company-icon, .art-orbit, .art-stack")).toHaveCount(0);
  await expect(page.locator(".work-company .ascii-art")).toHaveCount(3);
  await expect(page.locator(".post-art .ascii-art")).toHaveCount(1);
  expect(await page.locator(".ascii-art").evaluateAll((art) =>
    art.every((element) => element.tagName === "PRE" && element.getAttribute("aria-hidden") === "true"),
  )).toBe(true);
  expect(await page.locator("body").evaluate((body) => getComputedStyle(body).fontFamily)).toContain("Mono");
  const accents = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const luminance = (hex: string) => {
      const channels = hex.trim().slice(1).match(/../g)!.map((channel) => {
        const value = parseInt(channel, 16) / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    return ["cyan", "green", "yellow", "purple", "pink", "orange"].map((name) => {
      const hex = style.getPropertyValue(`--${name}`);
      return {
        name,
        contrast: Math.min(...["bg", "panel"].map((background) =>
          (luminance(hex) + .05) / (luminance(style.getPropertyValue(`--${background}`)) + .05),
        )),
      };
    });
  });
  for (const { name, contrast } of accents) expect(contrast, name).toBeGreaterThanOrEqual(4.5);
  await page.goto("blog/");
  await expect(page.locator(".post-art .ascii-art")).toHaveCount(1);
  expect(await page.locator(".post-art .ascii-art").evaluate((art) => {
    const drawing = art.getBoundingClientRect();
    const frame = art.parentElement!.getBoundingClientRect();
    return drawing.left >= frame.left && drawing.right <= frame.right;
  })).toBe(true);
});

test("titles and every hero focus area have color while body copy stays neutral", async ({ page }) => {
  for (const route of ["./", "blog/", "blog/hello-world/"]) {
    await page.goto(route);
    const neutralFraction = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let total = 0;
      let neutral = 0;
      let bodyTotal = 0;
      let bodyNeutral = 0;
      while (walker.nextNode()) {
        const element = walker.currentNode.parentElement;
        const text = walker.currentNode.textContent?.trim() || "";
        if (!element || !text || element.closest('pre, [aria-hidden="true"], .sr-only, .skip-link, script, style') || !element.getClientRects().length) continue;
        const channels = getComputedStyle(element).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const isNeutral = Math.max(...channels) - Math.min(...channels) <= 20;
        total += text.length;
        if (isNeutral) neutral += text.length;
        if (element.closest(".about-copy p, .work-detail p, .work-highlights li, .post-card > p, .page-intro p, .article-header > p, .prose p, .prose li") && !element.closest("code, a")) {
          bodyTotal += text.length;
          if (isNeutral) bodyNeutral += text.length;
        }
      }
      return { all: neutral / total, body: bodyNeutral / bodyTotal };
    });
    expect(neutralFraction.all, route).toBeGreaterThan(.7);
    expect(neutralFraction.body, route).toBeGreaterThan(.9);
    const headingColors = await page.locator("h2, .work-detail h3, .post-card h3, .page-intro h1, .article-header h1").evaluateAll((headings) =>
      headings.map((heading) => getComputedStyle(heading).color),
    );
    for (const color of headingColors) expect(["rgb(0, 200, 255)", "rgb(255, 230, 0)", "rgb(196, 107, 255)", "rgb(255, 66, 189)", "rgb(114, 246, 0)"]).toContain(color);
  }
  await page.goto("./");
  await expect(page.locator(".hero-description span")).toHaveText(["Azure data pipelines", "developer tools", "AI agents"]);
  expect(await page.locator(".hero-description span").evaluateAll((terms) => terms.map((term) => getComputedStyle(term).color))).toEqual(["rgb(0, 200, 255)", "rgb(196, 107, 255)", "rgb(255, 66, 189)"]);
  await expect(page.locator(".hero-heading .term-yellow")).toHaveCSS("color", "rgb(255, 230, 0)");
  await expect(page.locator(".hero-heading .term-cyan")).toHaveCSS("color", "rgb(0, 200, 255)");
  await expect(page.locator(".hero-description")).toContainText("financial reporting");
  await expect(page.locator(".work-microsoft .work-highlights li")).toHaveCount(3);
  await expect(page.locator(".work-microsoft")).toContainText("multi-million-row");
  await expect(page.locator(".work-microsoft")).toContainText("~3 weeks to ~1 hour");
  await expect(page.locator(".work-microsoft")).toContainText("with engineering review");
});

test("header uses the original DOS Rebel lowercase glyphs with compact full-name layout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./");
  await expect(page.locator(".pixel-name")).toHaveAttribute("data-text", "kathy zhang");
  await expect(page.locator(".pixel-name")).toHaveAttribute("data-font", "DOS Rebel");
  await expect(page.locator(".pixel-caption").locator("span").first()).toHaveText("kathy zhang");
  const glyphs = await page.locator(".pixel-letter").evaluateAll((letters) => letters.map((letter) => {
    const cells = [...letter.querySelectorAll<HTMLElement>(".pixel-cell")];
    const boxes = cells.map((cell) => cell.getBoundingClientRect());
    const rows = new Map<string, number>();
    for (const cell of cells) rows.set(cell.style.top, (rows.get(cell.style.top) || 0) + 1);
    return {
      character: letter.getAttribute("data-letter"),
      rowWidths: [...rows.values()],
      top: Math.min(...boxes.map((box) => box.top)),
      bottom: Math.max(...boxes.map((box) => box.bottom)),
      left: Math.min(...boxes.map((box) => box.left)),
      right: Math.max(...boxes.map((box) => box.right)),
    };
  }));
  expect(glyphs.map(({ character }) => character).join("")).toBe("kathyzhang");
  expect(glyphs[0].rowWidths).toEqual([5, 3, 8, 6, 6, 6, 9]);
  expect(glyphs[1].rowWidths).toEqual([6, 3, 7, 6, 8]);
  expect(glyphs[9].rowWidths).toEqual([7, 6, 6, 6, 7, 3, 6, 6]);
  expect(glyphs[1].top - glyphs[0].top).toBeGreaterThan(15);
  expect(glyphs[4].bottom - glyphs[3].bottom).toBeGreaterThan(15);
  expect(glyphs[9].bottom - glyphs[8].bottom).toBeGreaterThan(15);
  expect(glyphs[5].left - glyphs[4].right).toBeGreaterThan((glyphs[1].left - glyphs[0].right) * 2);
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.locator(".pixel-name").evaluate((art) => {
      const frame = art.getBoundingClientRect();
      const cells = [...art.querySelectorAll(".pixel-cell, .pixel-echo, .pixel-caret")];
      return {
        width: frame.width,
        height: frame.height,
        contained: cells.every((cell) => {
          const bounds = cell.getBoundingClientRect();
          return bounds.left >= frame.left - 1 && bounds.right <= frame.right + 1
            && bounds.top >= frame.top - 1 && bounds.bottom <= frame.bottom + 1;
        }),
      };
    });
    expect(dimensions.width).toBeLessThanOrEqual(880);
    expect(dimensions.height).toBeLessThan(160);
    expect(dimensions.height).toBeGreaterThan(40);
    expect(dimensions.contained).toBe(true);
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kathy Zhang");
});

test("native block lettering has diagonal color and dotted shading; work art has recognizable logos", async ({ page }) => {
  await page.goto("./");
  const detail = await page.locator(".pixel-name").evaluate((art) => {
    const faces = [...art.querySelectorAll<HTMLElement>(".pixel-cell")];
    const shadows = [...art.querySelectorAll(".pixel-echo")];
    const columns = new Map<string, Set<string>>();
    for (const cell of faces) {
      const colors = columns.get(cell.style.left) || new Set<string>();
      colors.add(cell.style.color);
      columns.set(cell.style.left, colors);
    }
    return {
      cells: faces.length,
      rows: new Set(faces.map((cell) => cell.style.top)).size,
      colors: new Set(faces.map((cell) => cell.style.color)).size,
      verticalColors: Math.max(...[...columns.values()].map((colors) => colors.size)),
      blocks: faces.every((cell) => cell.textContent === "█"),
      shadows: shadows.length,
      dots: shadows.every((cell) => cell.textContent === "░"),
    };
  });
  expect(detail.cells).toBeGreaterThan(250);
  expect(detail.rows).toBe(10);
  expect(detail.colors).toBeGreaterThan(120);
  expect(detail.verticalColors).toBeGreaterThanOrEqual(7);
  expect(detail.blocks).toBe(true);
  expect(detail.shadows).toBeGreaterThan(100);
  expect(detail.dots).toBe(true);
  for (const pane of ["red", "green", "blue", "gold"]) {
    await expect(page.locator(`.ascii-window .art-${pane}`).first()).toBeAttached();
  }
  await expect(page.locator(".ascii-window .ascii-line")).toHaveCount(19);
  await expect(page.locator(".ascii-meta .ascii-line")).toHaveCount(13);
  expect(await page.locator(".ascii-window .ascii-line").evaluateAll((lines) =>
    new Set(lines.map((line) => (line.firstElementChild as HTMLElement | null)?.style.gridColumn).filter(Boolean)).size,
  )).toBeGreaterThan(4);
  expect(await page.locator(".ascii-compact").evaluateAll((art) =>
    art.every((element) => element.getBoundingClientRect().width >= 80),
  )).toBe(true);
});

test("system-font fallback keeps character artwork aligned and within its frames", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.goto("./");
  await page.evaluate(() => document.documentElement.style.setProperty("--mono", "Consolas, monospace"));
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator(".ascii-art").evaluateAll((art) => art.every((element) =>
      element.scrollWidth <= element.clientWidth + 1,
    ))).toBe(true);
    expect(await page.locator(".ascii-raster-line > span").evaluateAll((cells) => cells.every((cell) =>
      Math.abs(cell.getBoundingClientRect().width - parseFloat(getComputedStyle(cell).fontSize) * .6) < .1,
    ))).toBe(true);
    expect(await page.locator(".pixel-name").evaluate((art) => {
      const frame = art.getBoundingClientRect();
      return [...art.querySelectorAll(".pixel-cell, .pixel-echo, .pixel-caret")].every((cell) => {
        const bounds = cell.getBoundingClientRect();
        return bounds.left >= frame.left - 1 && bounds.right <= frame.right + 1;
      });
    })).toBe(true);
  }
});

test("reduced motion shows fully visible static text lettering", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  expect(await page.locator(".pixel-cell").evaluateAll((cells) => cells.every((cell) => getComputedStyle(cell).opacity === "1"))).toBe(true);
  expect(await page.locator(".pixel-caret").evaluate((caret) => getComputedStyle(caret).opacity)).toBe("1");
  expect(await page.locator(".pixel-echo").evaluateAll((cells) => cells.every((cell) => Number(getComputedStyle(cell).opacity) > 0))).toBe(true);
  expect(await page.locator(".pixel-noise, .pixel-scan").evaluateAll((effects) => effects.every((effect) => getComputedStyle(effect).opacity === "0"))).toBe(true);
  expect(await page.locator(".pixel-name").evaluate((art) => art.getAnimations({ subtree: true }).length)).toBe(0);
});

test("name decodes left to right, then a decorative caret blinks", async ({ page }) => {
  await page.goto("./");
  const duration = await page.locator(".pixel-art").evaluate((art) => parseFloat(getComputedStyle(art).getPropertyValue("--render-duration")));
  const frame = async (time: number) => page.locator(".pixel-name").evaluate((art, currentTime) => {
    for (const animation of art.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = currentTime;
    }
    const opacity = (selector: string) => [...art.querySelectorAll(selector)].map((element) => Number(getComputedStyle(element).opacity));
    return {
      pixels: opacity(".pixel-cell"),
      shadows: opacity(".pixel-echo"),
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
  expect(complete.shadows.every((value) => value >= .45)).toBe(true);
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
  await expect(page.locator(".prose")).toContainText("My personal projects include a self-hosted homelab");
  await context.close();
});
