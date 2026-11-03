import * as cheerio from "cheerio";
import type {
  CookieInfo,
  TrackerCategory,
  TrackerReport,
  TrackingTechnology,
} from "./types";

type Rule = {
  vendor: string;
  category: TrackerCategory;
  hosts?: string[];
  urlPatterns?: RegExp[];
  cookiePrefix?: string[];
  cookieExact?: string[];
  inline?: RegExp[];
};

const RULES: Rule[] = [
  {
    vendor: "Google Tag Manager",
    category: "analytics",
    hosts: ["googletagmanager.com"],
    inline: [/datalayer\b/, /gtm\.js/],
  },
  {
    vendor: "Google Analytics",
    category: "analytics",
    hosts: ["google-analytics.com", "analytics.google.com"],
    cookiePrefix: ["_ga", "_gid", "_gat", "_gac_", "__utma", "__utmb", "__utmc", "__utmz"],
    inline: [/\bgtag\s*\(/, /_gaq\b/, /ga\s*\(\s*['"]create/],
  },
  {
    vendor: "Google Ads / DoubleClick",
    category: "advertising",
    hosts: ["doubleclick.net", "googleadservices.com", "googlesyndication.com", "googleads.g.doubleclick.net"],
    cookiePrefix: ["_gcl_"],
    cookieExact: ["ide", "dsid", "nid", "anid", "test_cookie", "sapid", "apisid"],
    inline: [/googlesyndication\.com/, /doubleclick\.net/],
  },
  {
    vendor: "Meta Pixel",
    category: "advertising",
    hosts: ["connect.facebook.net", "facebook.com", "facebook.net"],
    urlPatterns: [/facebook\.com\/tr/],
    cookiePrefix: ["_fbp", "_fbc"],
    cookieExact: ["fr", "datr", "sb"],
    inline: [/\bfbq\s*\(/, /fbevents\.js/],
  },
  {
    vendor: "Microsoft Clarity",
    category: "analytics",
    hosts: ["clarity.ms"],
    cookiePrefix: ["_clck", "_clsk", "clsk", "clck"],
    inline: [/clarity\.ms\/tag/],
  },
  {
    vendor: "Microsoft Advertising (UET)",
    category: "advertising",
    hosts: ["bat.bing.com", "c.bing.com"],
    cookiePrefix: ["_uet", "srm_b", "anonchk"],
    cookieExact: ["muid"],
    inline: [/bat\.bing\.com/, /\buetq\b/],
  },
  {
    vendor: "Hotjar",
    category: "analytics",
    hosts: ["hotjar.com", "hotjar.io"],
    cookiePrefix: ["_hjid", "_hjsession", "_hjabsolutesessioninprogress", "_hjincludedinsessionsample", "_hjfirstseen", "_hjtlldtest", "_hjtest"],
    inline: [/hotjar\.com\/c\/hotjar/],
  },
  {
    vendor: "HubSpot",
    category: "analytics",
    hosts: ["hs-scripts.com", "hs-analytics.net", "hubspot.com", "hsforms.net", "hsleadflows.net"],
    cookiePrefix: ["__hstc", "__hssc", "__hssrc", "hubspotutk"],
    inline: [/hs-scripts\.com/, /hs-analytics\.net/],
  },
  {
    vendor: "Segment",
    category: "analytics",
    hosts: ["segment.com", "segment.io"],
    cookiePrefix: ["ajs_anonymous_id", "ajs_user_id", "ajs_group_id"],
    inline: [/analytics\.load\(/, /cdn\.segment\.com/],
  },
  {
    vendor: "Mixpanel",
    category: "analytics",
    hosts: ["mixpanel.com", "mxpanel.com"],
    cookiePrefix: ["mp_"],
    inline: [/mixpanel\.init\(/],
  },
  {
    vendor: "Amplitude",
    category: "analytics",
    hosts: ["amplitude.com"],
    cookiePrefix: ["amplitude_id"],
    inline: [/amplitude\.getinstance\(/, /cdn\.amplitude\.com/],
  },
  {
    vendor: "Matomo",
    category: "analytics",
    hosts: ["matomo.cloud", "matomo.org", "piwik.pro"],
    cookiePrefix: ["_pk_id", "_pk_ses", "_pk_ref", "_pk_cvar", "_pk_hsr"],
    inline: [/_paq\b/, /matomo\.js/],
  },
  {
    vendor: "Plausible",
    category: "analytics",
    hosts: ["plausible.io"],
    inline: [/plausible\.io\/js/],
  },
  {
    vendor: "Fathom Analytics",
    category: "analytics",
    hosts: ["usefathom.com"],
    inline: [/usefathom\.com/],
  },
  {
    vendor: "PostHog",
    category: "analytics",
    hosts: ["posthog.com"],
    cookiePrefix: ["ph_"],
    inline: [/posthog\.init\(/],
  },
  {
    vendor: "Heap",
    category: "analytics",
    hosts: ["heap.io", "heapanalytics.com"],
    cookiePrefix: ["_hp2"],
    inline: [/heapanalytics\.com/],
  },
  {
    vendor: "FullStory",
    category: "analytics",
    hosts: ["fullstory.com"],
    cookiePrefix: ["fs_uid"],
    inline: [/fullstory\.com/],
  },
  {
    vendor: "LogRocket",
    category: "analytics",
    hosts: ["logrocket.com", "lr-ingest.io"],
    cookiePrefix: ["_lr_"],
    inline: [/logrocket\.com/],
  },
  {
    vendor: "Sentry",
    category: "functional",
    hosts: ["sentry.io", "sentry-cdn.com"],
    inline: [/sentry\.init\(/],
  },
  {
    vendor: "Cloudflare",
    category: "essential",
    hosts: ["cloudflare.com", "cloudflareinsights.com", "challenges.cloudflare.com"],
    cookiePrefix: ["__cf", "cf_clearance"],
    inline: [/cloudflareinsights\.com/, /challenges\.cloudflare\.com/],
  },
  {
    vendor: "Stripe",
    category: "essential",
    hosts: ["js.stripe.com", "m.stripe.com", "stripe.com"],
    cookiePrefix: ["__stripe_", "_stripe_"],
    inline: [/js\.stripe\.com\/v3/],
  },
  {
    vendor: "Google reCAPTCHA",
    category: "functional",
    hosts: ["recaptcha.net"],
    urlPatterns: [/google\.com\/recaptcha/],
    inline: [/grecaptcha/, /recaptcha\/api\.js/],
  },
  {
    vendor: "YouTube",
    category: "social",
    hosts: ["youtube.com", "ytimg.com", "youtube-nocookie.com"],
    cookieExact: ["ysc", "visitor_info1_live", "pref"],
    inline: [/youtube\.com\/iframe_api/, /youtube\.com\/embed/],
  },
  {
    vendor: "Vimeo",
    category: "functional",
    hosts: ["vimeo.com", "vimeocdn.com"],
    inline: [/player\.vimeo\.com/],
  },
  {
    vendor: "TikTok",
    category: "advertising",
    hosts: ["analytics.tiktok.com", "tiktok.com"],
    cookiePrefix: ["_ttp", "ttclid", "_tt_enable_cookie"],
    inline: [/analytics\.tiktok\.com/],
  },
  {
    vendor: "LinkedIn",
    category: "advertising",
    hosts: ["licdn.com", "snap.licdn.com", "linkedin.com"],
    cookiePrefix: ["li_sugr", "bcookie", "bscookie", "lidc", "usermatchhistory", "analyticssynchistory", "lms_ads"],
    inline: [/snap\.licdn\.com/, /linkedin\.com\/px/],
  },
  {
    vendor: "X / Twitter",
    category: "advertising",
    hosts: ["ads-twitter.com", "t.co", "twitter.com", "x.com"],
    cookiePrefix: ["_twitter_sess", "twid", "guest_id", "personalization_id"],
    inline: [/static\.ads-twitter\.com/, /platform\.twitter\.com/],
  },
  {
    vendor: "Pinterest",
    category: "advertising",
    hosts: ["ct.pinterest.com", "pinimg.com", "pinterest.com"],
    cookiePrefix: ["_pin_unauth", "_pinterest_"],
    inline: [/ct\.pinterest\.com/],
  },
  {
    vendor: "Snapchat",
    category: "advertising",
    hosts: ["sc-static.net", "snapchat.com"],
    cookiePrefix: ["_scid", "_sctr"],
    inline: [/sc-static\.net/],
  },
  {
    vendor: "Reddit",
    category: "advertising",
    hosts: ["redditstatic.com", "reddit.com"],
    cookiePrefix: ["_rdt_"],
    inline: [/reddit\.com\/pixel/, /redditstatic\.com/],
  },
  {
    vendor: "Quantcast",
    category: "advertising",
    hosts: ["quantserve.com", "quantcast.com"],
    cookiePrefix: ["__qca", "_dlt"],
    inline: [/quantserve\.com/],
  },
  {
    vendor: "Criteo",
    category: "advertising",
    hosts: ["criteo.com", "criteo.net"],
    cookiePrefix: ["cto_", "criteo"],
    inline: [/static\.criteo\.net/],
  },
  {
    vendor: "Taboola",
    category: "advertising",
    hosts: ["taboola.com"],
    cookiePrefix: ["t_gid", "tbl_"],
    inline: [/cdn\.taboola\.com/],
  },
  {
    vendor: "Outbrain",
    category: "advertising",
    hosts: ["outbrain.com"],
    cookiePrefix: ["obuid", "_ob_"],
    inline: [/outbrain\.com/],
  },
  {
    vendor: "Amazon Ads",
    category: "advertising",
    hosts: ["amazon-adsystem.com", "assoc-amazon.com"],
    cookiePrefix: ["ad-id", "ad-privacy"],
    inline: [/amazon-adsystem\.com/],
  },
  {
    vendor: "Yandex Metrica",
    category: "analytics",
    hosts: ["mc.yandex.ru", "yandex.com", "yandex.ru"],
    cookiePrefix: ["_ym_", "yandexuid"],
    inline: [/mc\.yandex\.ru/],
  },
  {
    vendor: "OneTrust",
    category: "essential",
    hosts: ["onetrust.com", "cookielaw.org"],
    cookiePrefix: ["optanonconsent", "optanonalertboxclosed", "eupubconsent"],
    inline: [/cdn\.cookielaw\.org/, /onetrust\.com/],
  },
  {
    vendor: "Cookiebot",
    category: "essential",
    hosts: ["cookiebot.com"],
    cookiePrefix: ["cookieconsent"],
    inline: [/consent\.cookiebot\.com/],
  },
  {
    vendor: "CookieYes",
    category: "essential",
    hosts: ["cookieyes.com"],
    cookiePrefix: ["cookieyes-"],
    inline: [/cdn-cookieyes\.com/],
  },
  {
    vendor: "Intercom",
    category: "functional",
    hosts: ["intercom.io", "intercomcdn.com", "intercom.com"],
    cookiePrefix: ["intercom-", "intercom_"],
    inline: [/widget\.intercom\.io/],
  },
  {
    vendor: "Zendesk",
    category: "functional",
    hosts: ["zdassets.com", "zendesk.com", "zopim.com"],
    cookiePrefix: ["__zlcmid", "_zendesk_"],
    inline: [/static\.zdassets\.com/, /zopim\.com/],
  },
  {
    vendor: "Klaviyo",
    category: "advertising",
    hosts: ["klaviyo.com"],
    cookiePrefix: ["__kla_id", "_kx"],
    inline: [/static\.klaviyo\.com/],
  },
  {
    vendor: "Shopify",
    category: "essential",
    hosts: ["cdn.shopify.com", "shopify.com", "shopifycdn.com"],
    cookiePrefix: ["_shopify_", "_secure_session_id", "_tracking_consent", "_landing_page", "_orig_referrer"],
    inline: [/cdn\.shopify\.com/],
  },
];

const ESSENTIAL_PREFIX = [
  "phpsessid",
  "jsessionid",
  "asp.net_sessionid",
  "laravel_session",
  "connect.sid",
  "ci_session",
  "csrftoken",
  "xsrf-token",
  "_csrf",
  "awsalb",
  "arraffinity",
  "incap_ses",
  "visid_incap",
  "ak_bmsc",
  "bm_sv",
  "__host-",
  "__secure-",
  "wordpress_",
  "wp-settings-",
  "django_",
];

const ESSENTIAL_EXACT = ["sid", "session", "sessionid", "auth", "logged_in", "token", "cookiesession"];

function classifyCookie(name: string): {
  vendor: string | null;
  category: TrackerCategory;
} {
  const lower = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.cookieExact?.includes(lower)) {
      return { vendor: rule.vendor, category: rule.category };
    }
    if (rule.cookiePrefix?.some((prefix) => lower.startsWith(prefix))) {
      return { vendor: rule.vendor, category: rule.category };
    }
  }
  if (
    ESSENTIAL_EXACT.includes(lower) ||
    ESSENTIAL_PREFIX.some((prefix) => lower.startsWith(prefix))
  ) {
    return { vendor: null, category: "essential" };
  }
  return { vendor: null, category: "unknown" };
}

export function parseSetCookie(raw: string, siteHost: string): CookieInfo | null {
  const segments = raw.split(";");
  const nameValue = segments.shift() ?? "";
  const eq = nameValue.indexOf("=");
  if (eq <= 0) return null;

  const name = nameValue.slice(0, eq).trim();
  if (!name || name.length > 128) return null;

  const attrs = new Map<string, string>();
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) attrs.set(trimmed.toLowerCase(), "");
    else {
      attrs.set(
        trimmed.slice(0, index).trim().toLowerCase(),
        trimmed.slice(index + 1).trim(),
      );
    }
  }

  const host = siteHost.toLowerCase();
  const domainAttr = attrs.get("domain")?.replace(/^\./, "").toLowerCase() ?? null;
  const domain = domainAttr ?? host;
  const thirdParty =
    domainAttr !== null && !(host === domain || host.endsWith(`.${domain}`));

  const { vendor, category } = classifyCookie(name);
  const sameSite = attrs.get("samesite");

  return {
    name,
    vendor,
    category,
    thirdParty,
    session: !attrs.has("expires") && !attrs.has("max-age"),
    secure: attrs.has("secure"),
    httpOnly: attrs.has("httponly"),
    sameSite: sameSite ? sameSite.replace(/^[a-z]/, (c) => c.toUpperCase()) : null,
    domain,
  };
}

export type TrackerScanPage = {
  url: string;
  html: string;
  cookies: string[];
};

function collectTechnologies(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): TrackingTechnology[] {
  const found = new Map<string, TrackingTechnology>();

  const add = (rule: Rule, source: string, example: string) => {
    const existing = found.get(rule.vendor);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    found.set(rule.vendor, {
      vendor: rule.vendor,
      category: rule.category,
      sources: [source],
      example,
    });
  };

  const checkUrl = (raw: string, source: string) => {
    if (!raw) return;
    let absolute: URL;
    try {
      absolute = new URL(raw, baseUrl);
    } catch {
      return;
    }
    const host = absolute.hostname.toLowerCase();
    const full = absolute.href.toLowerCase();
    for (const rule of RULES) {
      if (rule.hosts?.some((h) => host === h || host.endsWith(`.${h}`))) {
        add(rule, source, host);
        continue;
      }
      if (rule.urlPatterns?.some((pattern) => pattern.test(full))) {
        add(rule, source, host);
      }
    }
  };

  $("script[src]").each((_, el) => checkUrl($(el).attr("src") ?? "", "script"));
  $("iframe[src]").each((_, el) => checkUrl($(el).attr("src") ?? "", "iframe"));
  $("img[src]").each((_, el) => checkUrl($(el).attr("src") ?? "", "pixel"));
  $("link[rel]").each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    if (rel.includes("preconnect") || rel.includes("dns-prefetch")) {
      checkUrl($(el).attr("href") ?? "", "preconnect");
    }
  });

  const inlineText = $("script:not([src])")
    .map((_, el) => $(el).text())
    .get()
    .join("\n")
    .toLowerCase();

  if (inlineText) {
    for (const rule of RULES) {
      if (rule.inline?.some((pattern) => pattern.test(inlineText))) {
        add(rule, "inline", "inline script");
      }
    }
  }

  return [...found.values()];
}

export function analyzeTrackers(pages: TrackerScanPage[]): TrackerReport {
  const cookieMap = new Map<string, CookieInfo>();
  const techMap = new Map<string, TrackingTechnology>();
  const scannedPages: string[] = [];

  for (const page of pages) {
    if (!page.html) continue;
    scannedPages.push(page.url);

    let host = "";
    try {
      host = new URL(page.url).hostname;
    } catch {
      host = "";
    }

    for (const raw of page.cookies) {
      const info = parseSetCookie(raw, host);
      if (!info) continue;
      const key = `${info.name}|${info.domain}`;
      if (!cookieMap.has(key)) cookieMap.set(key, info);
    }

    const $ = cheerio.load(page.html);
    for (const tech of collectTechnologies($, page.url)) {
      const existing = techMap.get(tech.vendor);
      if (!existing) {
        techMap.set(tech.vendor, tech);
        continue;
      }
      for (const source of tech.sources) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
      }
    }
  }

  const cookies = [...cookieMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const technologies = [...techMap.values()].sort((a, b) =>
    a.vendor.localeCompare(b.vendor),
  );

  const byCategory: Record<TrackerCategory, number> = {
    essential: 0,
    analytics: 0,
    advertising: 0,
    functional: 0,
    social: 0,
    unknown: 0,
  };
  for (const cookie of cookies) byCategory[cookie.category] += 1;

  const notes: string[] = [
    "Only cookies sent in HTTP response headers are visible here; cookies created by JavaScript in the browser, and cookies set by third-party requests, are not included.",
  ];
  if (!cookies.length) {
    notes.unshift("No cookies were set in the response headers of the pages scanned.");
  }
  if (technologies.length) {
    notes.push(
      "Tracking technologies were identified from the page HTML (script, iframe, image and preconnect references) and known signatures.",
    );
  }

  return {
    cookies,
    technologies,
    counts: {
      cookies: cookies.length,
      thirdPartyCookies: cookies.filter((cookie) => cookie.thirdParty).length,
      byCategory,
    },
    scannedPages,
    notes,
  };
}
