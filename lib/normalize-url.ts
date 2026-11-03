export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter a website URL.");
  }

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    withProtocol = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("That does not look like a valid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  parsed.hash = "";
  return parsed.toString();
}

export function originOf(url: string): string {
  return new URL(url).origin;
}
