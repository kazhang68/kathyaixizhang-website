export const site = {
  name: "Kathy Zhang",
  description: "Kathy Zhang is a Software Engineer II at Microsoft and a Cornell computer science graduate. Experience, projects, and technical writing.",
  email: "kazhang68@gmail.com",
  github: "https://github.com/kazhang68",
  linkedin: "https://www.linkedin.com/in/kathyzhang-111/",
  resume: "https://docs.google.com/document/d/1ahuyYG2i4bqLGUcgCTlEXR-dkEWrEo-YUtIplRq7wuQ/export?format=pdf",
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
