const USER_AGENT =
  "Mozilla/5.0 (compatible; PolicyBriefBot/1.0; +https://localhost) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type FetchedPage = {
  url: string;
  html: string;
  status: number;
  cookies: string[];
};

function readSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }
  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

export async function fetchPage(
  url: string,
  timeoutMs = 15000,
): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(`Unexpected content type from ${url}`);
    }

    const html = await response.text();
    return {
      url: response.url || url,
      html,
      status: response.status,
      cookies: readSetCookies(response.headers),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timed out fetching ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
