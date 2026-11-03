import * as cheerio from "cheerio";
import { fetchPage } from "./fetch-page";
import { originOf } from "./normalize-url";

const COMMON_PATHS = [
  "/privacy",
  "/privacy-policy",
  "/privacy_policy",
  "/privacypolicy",
  "/legal/privacy",
  "/legal/privacy-policy",
  "/policies/privacy",
  "/policy/privacy",
  "/en/privacy",
  "/en/privacy-policy",
  "/about/privacy",
  "/company/privacy",
  "/terms/privacy",
];

const PRIVACY_LINK_RE =
  /privacy|privacidad|confidentialit[eé]|datenschutz|informativa/i;

function scoreHref(href: string, text: string): number {
  const hay = `${href} ${text}`.toLowerCase();
  let score = 0;
  if (hay.includes("privacy-policy") || hay.includes("privacy_policy")) score += 12;
  if (hay.includes("privacy")) score += 8;
  if (hay.includes("policy")) score += 3;
  if (hay.includes("cookie") && !hay.includes("privacy")) score -= 4;
  if (hay.includes("terms") && !hay.includes("privacy")) score -= 3;
  return score;
}

function collectCandidateLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const origin = originOf(baseUrl);
  const scored: { url: string; score: number }[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) {
      return;
    }
    if (!PRIVACY_LINK_RE.test(href) && !PRIVACY_LINK_RE.test(text)) {
      return;
    }

    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    if (!absolute.startsWith(origin)) {
      // Allow same-site CDN / www variants loosely via hostname root match later
    }

    scored.push({ url: absolute.split("#")[0], score: scoreHref(href, text) });
  });

  scored.sort((a, b) => b.score - a.score);
  return [...new Set(scored.map((s) => s.url))];
}

function looksLikePrivacyPage(html: string, url: string): boolean {
  const $ = cheerio.load(html);
  const title = $("title").text().toLowerCase();
  const h1 = $("h1").first().text().toLowerCase();
  const bodySample = $("body").text().slice(0, 4000).toLowerCase();
  const urlLower = url.toLowerCase();

  if (PRIVACY_LINK_RE.test(urlLower)) return true;
  if (PRIVACY_LINK_RE.test(title) || PRIVACY_LINK_RE.test(h1)) return true;

  const hits = [
    "personal information",
    "personal data",
    "we collect",
    "data we collect",
    "your privacy",
    "information we collect",
    "privacy policy",
  ].filter((phrase) => bodySample.includes(phrase)).length;

  return hits >= 2;
}

async function tryUrl(url: string): Promise<string | null> {
  try {
    const page = await fetchPage(url, 12000);
    if (page.status >= 400) return null;
    if (!looksLikePrivacyPage(page.html, page.url)) return null;
    return page.url;
  } catch {
    return null;
  }
}

export async function findPrivacyPolicyUrl(siteUrl: string): Promise<{
  policyUrl: string;
  homeHtml: string;
  homeUrl: string;
  homeCookies: string[];
}> {
  const home = await fetchPage(siteUrl);
  if (home.status >= 400) {
    throw new Error(`Could not load the site (HTTP ${home.status}).`);
  }

  const origin = originOf(home.url);
  const fromLinks = collectCandidateLinks(home.html, home.url);
  const fromPaths = COMMON_PATHS.map((path) => `${origin}${path}`);
  const candidates = [...new Set([...fromLinks, ...fromPaths])];

  // Probe top candidates in small parallel batches
  const batchSize = 4;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(tryUrl));
    const found = results.find((r): r is string => Boolean(r));
    if (found) {
      return { policyUrl: found, homeHtml: home.html, homeUrl: home.url, homeCookies: home.cookies };
    }
  }

  throw new Error(
    "Could not find a privacy policy on that site. Try a more specific URL.",
  );
}
