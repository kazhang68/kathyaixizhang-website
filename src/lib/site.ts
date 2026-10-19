export const site = {
  name: "Kathy Zhang",
  description: "Software engineer, systems tinkerer, and endlessly curious human. A little corner of the internet for things I build and things I learn.",
  email: "kazhang68@gmail.com",
  github: "https://github.com/kazhang68",
  linkedin: "https://www.linkedin.com/in/kathyzhang-111/",
  resume: "https://docs.google.com/document/d/1ahuyYG2i4bqLGUcgCTlEXR-dkEWrEo-YUtIplRq7wuQ/export?format=pdf",
  repository: "https://github.com/kazhang68/kathyaixizhang-website",
};

export function pathTo(path = "") {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
