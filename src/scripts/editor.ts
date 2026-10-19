import DOMPurify from "dompurify";
import { marked } from "marked";
import { buildMarkdown, DRAFT_KEY, importMarkdown, isPostDraft, MAX_FILE_SIZE, slugify, validateDraft, type PostDraft } from "../lib/markdown";
import { site } from "../lib/site";

function requiredElement<T extends HTMLElement>(id: string, type: { new (...args: never[]): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Missing editor element: ${id}`);
  return element;
}

const title = requiredElement("post-title", HTMLInputElement);
const description = requiredElement("post-description", HTMLInputElement);
const date = requiredElement("post-date", HTMLInputElement);
const tags = requiredElement("post-tags", HTMLInputElement);
const body = requiredElement("post-body", HTMLTextAreaElement);
const preview = requiredElement("markdown-preview", HTMLDivElement);
const status = requiredElement("editor-status", HTMLParagraphElement);
const publish = requiredElement("publish-post", HTMLAnchorElement);
const upload = requiredElement("markdown-file", HTMLInputElement);
const dropZone = requiredElement("drop-zone", HTMLDivElement);
const form = requiredElement("editor-form", HTMLFormElement);
const today = new Date().toLocaleDateString("en-CA");
date.value = today;

let storageError = "";
let publishMessage = "";
let saveTimer: ReturnType<typeof setTimeout>;

function readDraft(): PostDraft {
  return { title: title.value, description: description.value, date: date.value, tags: tags.value, body: body.value };
}

function setStatus(message: string, kind: "error" | "success" | "" = "") {
  status.textContent = message;
  status.className = `editor-status ${kind}`;
}

function hasContent() {
  const draft = readDraft();
  return Boolean(draft.title || draft.description || draft.tags || draft.body);
}

function setDraft(draft: PostDraft) {
  title.value = draft.title;
  description.value = draft.description;
  date.value = draft.date;
  tags.value = draft.tags;
  body.value = draft.body;
}

function updatePreview() {
  preview.innerHTML = DOMPurify.sanitize(marked.parse(body.value, { async: false }), {
    ALLOWED_TAGS: ["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "del", "blockquote", "ul", "ol", "li", "pre", "code", "a", "img", "hr", "table", "thead", "tbody", "tr", "th", "td", "input"],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "start", "align", "type", "checked", "disabled"],
  });
  preview.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  preview.querySelectorAll("img").forEach((image) => { image.loading = "lazy"; });
  preview.querySelectorAll("input").forEach((input) => { input.disabled = true; });
  const draft = readDraft();
  const invalid = validateDraft(draft);
  publish.setAttribute("aria-disabled", String(Boolean(invalid)));
  if (invalid) {
    publish.removeAttribute("href");
    publishMessage = "";
    publish.textContent = "Continue on GitHub \u2197";
    return;
  }
  const query = new URLSearchParams({ filename: `${draft.date}-${slugify(draft.title)}.md`, value: buildMarkdown(draft) });
  const url = `${site.repository}/new/main/src/content/blog?${query}`;
  const longPost = url.length > 7000;
  publish.href = longPost ? `${site.repository}/upload/main/src/content/blog` : url;
  publish.textContent = longPost ? "Upload on GitHub \u2197" : "Continue on GitHub \u2197";
  publishMessage = longPost ? "This post is too long to prefill a GitHub URL. Download .md, then choose Upload on GitHub and upload that file." : "";
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(readDraft()));
    storageError = "";
    setStatus(publishMessage || "Draft saved in this browser. Nothing has been published.", publishMessage ? "" : "success");
  } catch (error) {
    storageError = `Browser storage is unavailable (${error instanceof Error ? error.message : "storage error"}). Download your draft to keep it.`;
    setStatus(storageError, "error");
  }
}

function refresh(save = true) {
  updatePreview();
  if (save) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 350);
  }
}

try {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    const draft: unknown = JSON.parse(saved);
    if (!isPostDraft(draft)) throw new Error("The saved draft has an unsupported format.");
    setDraft(draft);
    setStatus("Your previous draft has been restored. Nothing has been published.", "success");
  }
} catch (error) {
  storageError = `Couldn't restore the saved draft: ${error instanceof Error ? error.message : "storage error"}. Import a downloaded copy to recover it.`;
  setStatus(storageError, "error");
}
refresh(false);
if (publishMessage && !storageError) setStatus(publishMessage);

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", () => refresh());
window.addEventListener("pagehide", () => {
  clearTimeout(saveTimer);
  if (hasContent()) saveDraft();
});

publish.addEventListener("click", (event) => {
  const invalid = validateDraft(readDraft());
  if (invalid) {
    event.preventDefault();
    setStatus(invalid, "error");
    return;
  }
  clearTimeout(saveTimer);
  saveDraft();
  if (!storageError) setStatus(publishMessage || "Opening GitHub. Review the file and commit there to publish; this editor cannot confirm a commit.", "");
});

requiredElement("download-post", HTMLButtonElement).addEventListener("click", () => {
  const draft = readDraft();
  const invalid = validateDraft(draft);
  if (invalid) { setStatus(invalid, "error"); return; }
  const url = URL.createObjectURL(new Blob([buildMarkdown(draft)], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${draft.date}-${slugify(draft.title)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Markdown file downloaded. Your draft is still here; nothing has been published.", "success");
});

requiredElement("clear-draft", HTMLButtonElement).addEventListener("click", () => {
  if (!window.confirm("Clear this browser's draft? Download a copy first if you want to keep it.")) return;
  clearTimeout(saveTimer);
  setDraft({ title: "", description: "", date: today, tags: "", body: "" });
  try {
    localStorage.removeItem(DRAFT_KEY);
    storageError = "";
    setStatus("Draft cleared. A fresh page awaits.");
  } catch (error) {
    storageError = `The editor was cleared, but browser storage could not be cleared: ${error instanceof Error ? error.message : "storage error"}.`;
    setStatus(storageError, "error");
  }
  refresh(false);
  title.focus();
});

async function importFile(file: File) {
  if (!/\.(md|markdown)$/i.test(file.name)) { setStatus("Please choose a .md or .markdown file.", "error"); return; }
  if (file.size > MAX_FILE_SIZE) { setStatus("That file is too large. Please choose a Markdown file smaller than 1 MB.", "error"); return; }
  try {
    const draft = importMarkdown(await file.text(), file.name.replace(/\.(md|markdown)$/i, "").replace(/-/g, " "), today);
    if (hasContent() && !window.confirm("Replace the current draft with this Markdown file? Download a copy first if you want to keep it.")) return;
    setDraft(draft);
    refresh(false);
    saveDraft();
    if (!storageError) setStatus(`Imported ${file.name}. Check the title, description, date, and tags before publishing. ${publishMessage}`, "success");
  } catch (error) {
    setStatus(`Couldn't import this file: ${error instanceof Error ? error.message : "unknown error"}. Your current draft was not changed.`, "error");
  }
}

requiredElement("import-file", HTMLButtonElement).addEventListener("click", () => upload.click());
upload.addEventListener("change", async () => {
  const file = upload.files?.[0];
  if (file) await importFile(file);
  upload.value = "";
});
dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("dragging"); });
dropZone.addEventListener("dragleave", (event) => {
  if (!(event.relatedTarget instanceof Node) || !dropZone.contains(event.relatedTarget)) dropZone.classList.remove("dragging");
});
dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  const files = event.dataTransfer?.files;
  if (!files || files.length !== 1) { setStatus("Drop one Markdown file at a time.", "error"); return; }
  await importFile(files[0]);
});

body.addEventListener("paste", (event) => {
  const pasted = event.clipboardData?.getData("text/plain") || "";
  if (!/^(?:\uFEFF)?---\r?\n/.test(pasted)) return;
  event.preventDefault();
  try {
    const draft = importMarkdown(pasted, title.value, today);
    if (hasContent() && !window.confirm("This includes front matter. Replace the current draft with the pasted post?")) return;
    setDraft(draft);
    refresh(false);
    saveDraft();
    if (!storageError) setStatus(`Full Markdown post imported from the clipboard. Review the fields before publishing. ${publishMessage}`, "success");
  } catch (error) {
    setStatus(`Couldn't paste this post: ${error instanceof Error ? error.message : "unknown error"}. Your draft was not changed.`, "error");
  }
});
