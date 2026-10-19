import { parseDocument, stringify } from "yaml";

export interface PostDraft {
  title: string;
  description: string;
  date: string;
  tags: string;
  body: string;
}

export const MAX_FILE_SIZE = 1024 * 1024;
export const DRAFT_KEY = "kathy-journal-draft-v1";

export function slugify(title: string) {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "") || "untitled";
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateDraft(draft: PostDraft) {
  if (!draft.title.trim()) return "Add a title before publishing or downloading.";
  if (!draft.description.trim()) return "Add a short description for the journal listing.";
  if (!validDate(draft.date)) return "Choose a valid publication date.";
  if (!draft.body.trim()) return "Write something in the Markdown editor first.";
  return "";
}

export function buildMarkdown(draft: PostDraft) {
  const metadata = {
    title: draft.title.trim(),
    description: draft.description.trim(),
    date: draft.date,
    tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    draft: false,
  };
  return `---\n${stringify(metadata, { lineWidth: 0 })}---\n\n${draft.body.trim()}\n`;
}

export function importMarkdown(source: string, fallbackTitle: string, today: string): PostDraft {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const result: PostDraft = { title: fallbackTitle, description: "", date: today, tags: "", body: normalized };
  if (!match) return result;

  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length) throw new Error(`Invalid front matter: ${document.errors[0].message}`);
  const metadata: unknown = document.toJS({ maxAliasCount: 0 });
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) throw new Error("Front matter must contain named fields such as title and date.");
  for (const key of ["title", "description", "date"] as const) {
    if (key in metadata) {
      const value: unknown = Reflect.get(metadata, key);
      if (typeof value !== "string") throw new Error(`The ${key} field must be text.`);
      result[key] = value;
    }
  }
  if (!validDate(result.date)) throw new Error("The imported date must use YYYY-MM-DD.");
  if ("tags" in metadata) {
    const tags: unknown = metadata.tags;
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) throw new Error("Tags must be a list of text values.");
    result.tags = tags.join(", ");
  }
  result.body = normalized.slice(match[0].length).replace(/^\n/, "");
  return result;
}

export function isPostDraft(value: unknown): value is PostDraft {
  return typeof value === "object" && value !== null &&
    ["title", "description", "date", "tags", "body"].every((key) => typeof Reflect.get(value, key) === "string");
}
