import { test, expect, type Page } from "@playwright/test";
import { buildMarkdown, importMarkdown, slugify, validDate, validateDraft, type PostDraft } from "../src/lib/markdown";

const sample: PostDraft = {
  title: "A note: on \"small\" systems",
  description: "A description with: punctuation, and Unicode \u2728",
  date: "2026-10-19",
  tags: "Engineering, Notes",
  body: "## A small discovery\n\nA **useful** note.\n\n```js\nconst answer = 42;\n```",
};

async function fillDraft(page: Page, draft = sample) {
  await page.locator("#post-title").fill(draft.title);
  await page.locator("#post-description").fill(draft.description);
  await page.locator("#post-date").fill(draft.date);
  await page.locator("#post-tags").fill(draft.tags);
  await page.locator("#post-body").fill(draft.body);
}

test("front matter round-trips punctuation, dates, Unicode, and tags", () => {
  const markdown = buildMarkdown(sample);
  expect(importMarkdown(markdown, "fallback", "2020-01-01")).toEqual({ ...sample, body: `${sample.body}\n` });
  expect(markdown).toContain("draft: false");
});

test("imports plain and Windows Markdown without corrupting the body", () => {
  expect(importMarkdown("# Hello\r\n\r\nWorld", "file title", "2026-10-19")).toEqual({
    title: "file title", description: "", date: "2026-10-19", tags: "", body: "# Hello\n\nWorld",
  });
  expect(importMarkdown(`\uFEFF${buildMarkdown(sample).replace(/\n/g, "\r\n")}`, "", "2026-10-19").title).toBe(sample.title);
});

test("rejects malformed metadata and invalid dates explicitly", () => {
  expect(() => importMarkdown("---\ntitle: [broken\n---\nbody", "", sample.date)).toThrow("Invalid front matter");
  expect(() => importMarkdown("---\ntags: not-a-list\n---\nbody", "", sample.date)).toThrow("Tags must be a list");
  expect(() => importMarkdown("---\ndate: 2026-02-30\n---\nbody", "", sample.date)).toThrow("YYYY-MM-DD");
  expect(validDate("2024-02-29")).toBe(true);
  expect(validDate("2026-02-29")).toBe(false);
  expect(validDate("not a date")).toBe(false);
  expect(validateDraft({ ...sample, title: " " })).toContain("title");
  expect(validateDraft({ ...sample, description: "" })).toContain("description");
  expect(validateDraft({ ...sample, body: " " })).toContain("Write something");
});

test("filenames cannot escape the content directory", () => {
  expect(slugify("../../Hello / world? #")).toBe("hello-world");
  expect(slugify("\u2728")).toBe("untitled");
  expect(slugify("x".repeat(200))).toHaveLength(80);
});

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
    for (const route of ["./", "blog/", "blog/hello-world/", "write/"]) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
    }
  });
}

test("reduced motion shows fully visible static pixel lettering", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  expect(await page.locator(".pixel-cell").first().evaluate((cell) => getComputedStyle(cell).animationName)).toBe("none");
  expect(await page.locator(".pixel-cell").first().evaluate((cell) => getComputedStyle(cell).opacity)).toBe("1");
});

test("Markdown preview, local draft restore, and GitHub prefill preserve the full post", async ({ page }) => {
  await page.goto("write/");
  await fillDraft(page);
  await expect(page.locator("#markdown-preview h2")).toHaveText("A small discovery");
  await expect(page.locator("#markdown-preview strong")).toHaveText("useful");
  await expect(page.locator("#editor-status")).toContainText("Draft saved");
  const href = await page.locator("#publish-post").getAttribute("href");
  const url = new URL(href!);
  expect(url.origin).toBe("https://github.com");
  expect(url.pathname).toBe("/kazhang68/kathyaixizhang-website/new/main/src/content/blog");
  expect(url.searchParams.get("filename")).toBe("2026-10-19-a-note-on-small-systems.md");
  expect(url.searchParams.get("value")).toBe(buildMarkdown(sample));
  await page.reload();
  await expect(page.locator("#post-title")).toHaveValue(sample.title);
  await expect(page.locator("#post-body")).toHaveValue(sample.body);
});

test("preview strips active HTML and unsafe links", async ({ page }) => {
  await page.goto("write/");
  await page.locator("#post-body").fill('<script>window.bad = true</script><img src="x" onerror="window.bad=true"><a href="javascript:alert(1)">bad</a><iframe src="https://example.com"></iframe><input type="text">');
  await expect(page.locator("#markdown-preview script, #markdown-preview iframe, #markdown-preview [onerror], #markdown-preview a[href^='javascript:']")).toHaveCount(0);
  await expect(page.locator("#markdown-preview input")).toBeDisabled();
  expect(await page.evaluate(() => "bad" in window)).toBe(false);
});

test("imports a Markdown attachment and exports an equivalent file", async ({ page }) => {
  await page.goto("write/");
  await page.locator("#markdown-file").setInputFiles({ name: "my-post.md", mimeType: "text/markdown", buffer: Buffer.from(buildMarkdown(sample)) });
  await expect(page.locator("#post-title")).toHaveValue(sample.title);
  await expect(page.locator("#post-tags")).toHaveValue(sample.tags);
  await expect(page.locator("#editor-status")).toContainText("Imported my-post.md");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download .md/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("2026-10-19-a-note-on-small-systems.md");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(buildMarkdown(sample));
});

test("pasting a full Markdown document fills its metadata", async ({ page }) => {
  await page.goto("write/");
  await page.locator("#post-body").evaluate((element, markdown) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", markdown);
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  }, buildMarkdown(sample));
  await expect(page.locator("#post-title")).toHaveValue(sample.title);
  await expect(page.locator("#markdown-preview strong")).toHaveText("useful");
});

test("drag and drop imports a Markdown file", async ({ page }) => {
  await page.goto("write/");
  await page.locator("#drop-zone").evaluate((element, markdown) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([markdown], "dropped.md", { type: "text/markdown" }));
    element.dispatchEvent(new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }));
  }, buildMarkdown(sample));
  await expect(page.locator("#post-title")).toHaveValue(sample.title);
  await expect(page.locator("#editor-status")).toContainText("Imported dropped.md");
});

test("rejects invalid imports without losing the draft", async ({ page }) => {
  await page.goto("write/");
  await fillDraft(page);
  await page.locator("#markdown-file").setInputFiles({ name: "broken.md", mimeType: "text/markdown", buffer: Buffer.from("---\ntags: nope\n---\nbody") });
  await expect(page.locator("#editor-status")).toContainText("Couldn't import");
  await expect(page.locator("#post-title")).toHaveValue(sample.title);
  await page.locator("#markdown-file").setInputFiles({ name: "too-big.md", mimeType: "text/markdown", buffer: Buffer.alloc(1024 * 1024 + 1, "a") });
  await expect(page.locator("#editor-status")).toContainText("too large");
  await page.locator("#markdown-file").setInputFiles({ name: "not-markdown.html", mimeType: "text/html", buffer: Buffer.from("test") });
  await expect(page.locator("#editor-status")).toContainText(".md or .markdown");
});

test("long posts use the upload flow instead of truncating content", async ({ page }) => {
  await page.goto("write/");
  await fillDraft(page, { ...sample, body: "A long thought. ".repeat(1000) });
  await expect(page.locator("#publish-post")).toHaveText(/Upload on GitHub/);
  await expect(page.locator("#publish-post")).toHaveAttribute("href", /\/upload\/main\/src\/content\/blog$/);
  await expect(page.locator("#editor-status")).toContainText("too long to prefill");
});

test("empty publishing is blocked and clearing a draft requires confirmation", async ({ page }) => {
  await page.goto("write/");
  await page.locator("#publish-post").click();
  await expect(page.locator("#editor-status")).toContainText("Add a title");
  await expect(page.locator("#publish-post")).not.toHaveAttribute("href");
  await fillDraft(page);
  await expect(page.locator("#editor-status")).toContainText("Draft saved");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Clear draft" }).click();
  await expect(page.locator("#post-title")).toHaveValue(sample.title);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear draft" }).click();
  await expect(page.locator("#post-title")).toHaveValue("");
  await page.reload();
  await expect(page.locator("#post-title")).toHaveValue("");
});

test("storage errors are visible, not reported as a saved draft", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage quota exceeded", "QuotaExceededError"); };
  });
  await page.goto("write/");
  await fillDraft(page);
  await expect(page.locator("#editor-status")).toContainText("storage is unavailable");
  await expect(page.locator("#editor-status")).toHaveClass(/error/);
  await expect(page.locator("#publish-post")).toHaveAttribute("href", /github.com/);
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
