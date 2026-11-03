import * as cheerio from "cheerio";

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "nav",
  "header",
  "footer",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[aria-hidden='true']",
].join(", ");

export function extractMainText(html: string, maxChars = 50000): string {
  const $ = cheerio.load(html);
  $(NOISE_SELECTORS).remove();

  const main =
    $("main").text() ||
    $("article").text() ||
    $("[role='main']").text() ||
    $("#content, .content, .legal, .policy, .privacy").text() ||
    $("body").text();

  const cleaned = main
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars)}\n\n[Truncated for analysis]`;
}
