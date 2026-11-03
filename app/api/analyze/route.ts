import { NextResponse } from "next/server";
import { extractMainText } from "@/lib/extract-text";
import { fetchPage } from "@/lib/fetch-page";
import { findPrivacyPolicyUrl } from "@/lib/find-privacy-policy";
import { normalizeUrl } from "@/lib/normalize-url";
import { summarizePrivacyPolicy } from "@/lib/summarize";
import { analyzeTrackers } from "@/lib/trackers";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string") {
      return NextResponse.json(
        { ok: false, error: "Provide a website URL." } satisfies AnalyzeResponse,
        { status: 400 },
      );
    }

    const inputUrl = normalizeUrl(body.url);
    const { policyUrl, homeHtml, homeUrl, homeCookies } =
      await findPrivacyPolicyUrl(inputUrl);
    const policyPage = await fetchPage(policyUrl);
    if (policyPage.status >= 400) {
      return NextResponse.json(
        {
          ok: false,
          error: `Found a privacy policy link but could not load it (HTTP ${policyPage.status}).`,
        } satisfies AnalyzeResponse,
        { status: 502 },
      );
    }

    const policyText = extractMainText(policyPage.html);
    if (policyText.length < 200) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The privacy policy page did not contain enough readable text to analyze.",
        } satisfies AnalyzeResponse,
        { status: 422 },
      );
    }

    const trackers = analyzeTrackers([
      { url: homeUrl, html: homeHtml, cookies: homeCookies },
      { url: policyPage.url, html: policyPage.html, cookies: policyPage.cookies },
    ]);

    const analysis = await summarizePrivacyPolicy({
      inputUrl,
      policyUrl: policyPage.url,
      policyText,
    });

    const result: AnalysisResult = { ...analysis, trackers };

    return NextResponse.json({
      ok: true,
      result,
    } satisfies AnalyzeResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected analysis failure.";
    return NextResponse.json(
      { ok: false, error: message } satisfies AnalyzeResponse,
      { status: 500 },
    );
  }
}
