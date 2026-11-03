import type { AnalysisResult, RiskLevel } from "./types";

type ModelPayload = {
  summary: string;
  dataCollected: string[];
  sharing: string[];
  rights: string[];
  cookies: string;
  risks: {
    level: RiskLevel;
    score: number;
    flags: string[];
    notes: string;
  };
};

type GroqErrorBody = {
  error?: {
    message?: string;
    code?: string;
    failed_generation?: string;
  };
  choices?: { message?: { content?: string } }[];
};

const SYSTEM = `You are a privacy policy analyst. Always respond with a single valid JSON object and nothing else.`;

const JSON_INSTRUCTIONS = `Return a JSON object with exactly these keys:
- "summary": string — a thorough plain-language brief of 3 to 5 paragraphs (roughly 250-400 words)
- "dataCollected": string array (data categories collected)
- "sharing": string array (how data is shared or sold)
- "rights": string array (user rights and choices)
- "cookies": string (cookies / tracking summary)
- "risks": object with:
  - "level": one of "low", "medium", "high"
  - "score": integer from 1 to 10
  - "flags": string array of red flags
  - "notes": string risk rationale

For "summary", write a substantial, readable brief in flowing prose (complete sentences; no bullet points, no headings, no markdown). Separate paragraphs with a blank line (\\n\\n). Cover, in order:
1. what the policy is, who it applies to, and the main categories of data collected;
2. how that data is used and whether/how it is shared, sold or disclosed to third parties and partners;
3. how long data is kept, what rights and controls users have (access, correction, deletion, opt-out, consent choices) and how to exercise them;
4. tracking and cookies, plus notable gaps, vague wording or points a reader should watch out for.
Expand on specifics from the policy instead of restating generic statements. Do not be brief: aim for a complete brief a non-lawyer can act on.

Example shape:
{"summary":"First paragraph...\\n\\nSecond paragraph...","dataCollected":["..."],"sharing":["..."],"rights":["..."],"cookies":"...","risks":{"level":"medium","score":5,"flags":["..."],"notes":"..."}}

Be accurate. If something is unclear, say so briefly in the relevant field. Do not wrap the JSON in markdown.`;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODELS = [
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
];

// Groq's implicit completion cap is too small for this prompt: the models burn
// the whole budget before emitting JSON, which Groq reports as
// "max completion tokens reached before generating a valid document".
const MAX_COMPLETION_TOKENS = 3072;

const MAX_POLICY_CHARS = 24000;

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 140)}...` : flat;
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonObject(text: string): string {
  const cleaned = stripFences(text);
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return cleaned.slice(start, end + 1);
    }
    throw new Error(
      `No JSON object found in model output. The model replied with: ${preview(cleaned)}`,
    );
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
    .filter(Boolean);
}

function normalizeLevel(value: unknown): RiskLevel {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text.startsWith("low")) return "low";
  if (text.startsWith("high")) return "high";
  if (text.startsWith("med") || text.startsWith("moderate")) return "medium";
  return "medium";
}

function parsePayload(raw: string): ModelPayload {
  const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
  const risks = (parsed.risks ?? {}) as Record<string, unknown>;
  const scoreRaw = Number(risks.score);
  const score = Number.isFinite(scoreRaw)
    ? Math.min(10, Math.max(1, Math.round(scoreRaw)))
    : 5;

  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "No summary could be generated.",
    dataCollected: asStringArray(parsed.dataCollected),
    sharing: asStringArray(parsed.sharing),
    rights: asStringArray(parsed.rights),
    cookies:
      typeof parsed.cookies === "string" && parsed.cookies.trim()
        ? parsed.cookies.trim()
        : "Cookie / tracking details were not clearly stated.",
    risks: {
      level: normalizeLevel(risks.level),
      score,
      flags: asStringArray(risks.flags),
      notes:
        typeof risks.notes === "string" && risks.notes.trim()
          ? risks.notes.trim()
          : "Risk notes unavailable.",
    },
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 502;
}

function isJsonModeFailure(message: string): boolean {
  return (
    /failed to generate json/i.test(message) ||
    /failed_generation/i.test(message) ||
    /json_validate/i.test(message) ||
    /adjust your prompt/i.test(message)
  );
}

function isMissingModel(message: string, status: number): boolean {
  return (
    status === 404 ||
    /decommissioned/i.test(message) ||
    /model[^\n]{0,80}not (found|supported|available)/i.test(message)
  );
}

function modelCandidates(): string[] {
  const preferred = process.env.GROQ_MODEL?.trim();
  const list = preferred
    ? [preferred, ...DEFAULT_MODELS.filter((m) => m !== preferred)]
    : DEFAULT_MODELS;
  return [...new Set(list)];
}

async function callGroq(
  apiKey: string,
  model: string,
  userPrompt: string,
  useJsonMode: boolean,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0,
    max_tokens: MAX_COMPLETION_TOKENS,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
  };
  if (useJsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await response.text();
  let data: GroqErrorBody = {};
  try {
    data = JSON.parse(raw) as GroqErrorBody;
  } catch {
    // keep empty
  }

  if (!response.ok) {
    const failedGen = data.error?.failed_generation;
    if (failedGen && isJsonModeFailure(data.error?.message || "")) {
      try {
        // Recover usable JSON from Groq's failed_generation payload when possible
        JSON.parse(extractJsonObject(failedGen));
        return failedGen;
      } catch {
        // fall through to throw
      }
    }

    const message =
      data.error?.message || `Groq request failed (HTTP ${response.status}).`;
    const error = new Error(message) as Error & {
      status?: number;
      failedGeneration?: string;
    };
    error.status = response.status;
    if (failedGen) error.failedGeneration = failedGen;
    throw error;
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Groq returned an empty response.");
  }
  return text;
}

async function generateWithResilience(
  apiKey: string,
  userPrompt: string,
): Promise<string> {
  const models = modelCandidates();
  let lastError: unknown;
  let lastModel = "";

  for (const modelName of models) {
    let skipModel = false;

    // First strict JSON mode, then plain text JSON if needed
    for (const useJsonMode of [true, false]) {
      if (skipModel) break;

      for (let attempt = 0; attempt < 2; attempt++) {
        lastModel = modelName;
        try {
          const text = await callGroq(
            apiKey,
            modelName,
            userPrompt,
            useJsonMode,
          );
          // Validate early so we can retry on bad payloads
          parsePayload(text);
          return text;
        } catch (error) {
          lastError = error;
          const status =
            error && typeof error === "object" && "status" in error
              ? Number((error as { status?: number }).status)
              : 0;
          const message =
            error instanceof Error ? error.message : String(error);

          if (isMissingModel(message, status)) {
            skipModel = true;
            break;
          }

          if (isJsonModeFailure(message) && useJsonMode) {
            // drop to non-json mode for this model
            break;
          }

          if (!isRetryableStatus(status) || attempt === 1) {
            break;
          }
          await sleep(700 * 2 ** attempt);
        }
      }
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "Unknown Groq error.";
  const status =
    lastError && typeof lastError === "object" && "status" in lastError
      ? Number((lastError as { status?: number }).status)
      : 0;

  if (
    isRetryableStatus(status) ||
    /rate limit|high demand|unavailable/i.test(detail)
  ) {
    throw new Error(
      "Groq is rate-limited or busy right now. Wait a few seconds and try Analyze again.",
    );
  }
  throw new Error(lastModel ? `${detail} (last model: ${lastModel})` : detail);
}

export async function summarizePrivacyPolicy(params: {
  inputUrl: string;
  policyUrl: string;
  policyText: string;
}): Promise<Omit<AnalysisResult, "trackers">> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY. Add it to .env.local and restart the server.",
    );
  }

  const policyText =
    params.policyText.length > MAX_POLICY_CHARS
      ? `${params.policyText.slice(0, MAX_POLICY_CHARS)}\n\n[Truncated for analysis]`
      : params.policyText;

  const userPrompt = `${JSON_INSTRUCTIONS}

Site URL: ${params.inputUrl}
Privacy policy URL: ${params.policyUrl}

Privacy policy text:
"""
${policyText}
"""

Respond with JSON only.`;

  const text = await generateWithResilience(apiKey, userPrompt);
  const payload = parsePayload(text);

  return {
    inputUrl: params.inputUrl,
    policyUrl: params.policyUrl,
    summary: payload.summary,
    dataCollected: payload.dataCollected,
    sharing: payload.sharing,
    rights: payload.rights,
    cookies: payload.cookies,
    risks: payload.risks,
    analyzedAt: new Date().toISOString(),
  };
}
