"use client";

import { useState, type FormEvent } from "react";
import RiskDashboard from "./RiskCharts";
import { buildJsonReport, buildMarkdownReport, reportFileName } from "@/lib/report";
import type {
  AnalysisResult,
  AnalyzeResponse,
  RiskLevel,
  TrackerCategory,
} from "@/lib/types";

type TabId =
  | "analyze"
  | "summary"
  | "data"
  | "sharing"
  | "risks"
  | "charts"
  | "trackers";

const TABS: { id: TabId; label: string }[] = [
  { id: "analyze", label: "Analyze" },
  { id: "summary", label: "Summary" },
  { id: "data", label: "Data collected" },
  { id: "sharing", label: "Sharing & rights" },
  { id: "risks", label: "Risks" },
  { id: "charts", label: "Risk charts" },
  { id: "trackers", label: "Cookies & trackers" },
];

const RISK_COPY: Record<RiskLevel, string> = {
  low: "Lower concern",
  medium: "Moderate concern",
  high: "Higher concern",
};

const CATEGORY_LABEL: Record<TrackerCategory, string> = {
  essential: "Essential",
  analytics: "Analytics",
  advertising: "Advertising",
  functional: "Functional",
  social: "Social",
  unknown: "Unclassified",
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return <p className="muted">{empty}</p>;
  }
  return (
    <ul className="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Prose({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return <p className="prose">{text}</p>;
  }

  return (
    <>
      {paragraphs.map((part, index) => (
        <p className="prose" key={index}>
          {part}
        </p>
      ))}
    </>
  );
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function PrivacyAnalyzer() {
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<TabId>("analyze");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("Finding privacy policy and summarizing…");
    setLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!data.ok) {
        setResult(null);
        setError(data.error);
        setTab("analyze");
        return;
      }
      setResult(data.result);
      setStatus(null);
      setTab("summary");
    } catch {
      setResult(null);
      setError("Network error while analyzing. Check your connection and try again.");
      setTab("analyze");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  const locked = !result && tab !== "analyze";

  return (
    <div className="shell">
      <header className="hero">
        <p className="brand">PolicyBrief</p>
        <h1 className="headline">Know what a site does with your data.</h1>
        <p className="lede">
          Paste a website, we locate its privacy policy, and Groq turns the
          legalese into a clear brief.
        </p>
      </header>

      <nav className="tabs" aria-label="Result sections">
        {TABS.map((item) => {
          const disabled = item.id !== "analyze" && !result;
          return (
            <button
              key={item.id}
              type="button"
              className={`tab${tab === item.id ? " is-active" : ""}`}
              onClick={() => {
                if (!disabled) setTab(item.id);
              }}
              disabled={disabled}
              aria-selected={tab === item.id}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {result && (
        <div className="toolbar">
          <button
            type="button"
            className="export-btn"
            onClick={() =>
              downloadText(
                reportFileName(result, "md"),
                buildMarkdownReport(result),
                "text/markdown",
              )
            }
          >
            Export report
          </button>
          <button
            type="button"
            className="export-btn ghost"
            onClick={() =>
              downloadText(
                reportFileName(result, "json"),
                buildJsonReport(result),
                "application/json",
              )
            }
          >
            JSON
          </button>
        </div>
      )}

      <section className="panel" aria-live="polite">
        {tab === "analyze" && (
          <div className="panel-body">
            <h2 className="panel-title">Analyze a site</h2>
            <p className="panel-copy">
              Enter a homepage or any page on the site. We discover the privacy
              policy link, read it, and summarize the important parts.
            </p>
            <form className="analyze-form" onSubmit={onSubmit}>
              <label className="field-label" htmlFor="site-url">
                Website URL
              </label>
              <div className="field-row">
                <input
                  id="site-url"
                  name="url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  required
                />
                <button type="submit" className="cta" disabled={loading || !url.trim()}>
                  {loading ? "Working…" : "Analyze"}
                </button>
              </div>
            </form>
            {loading && status && <p className="status">{status}</p>}
            {error && <p className="error" role="alert">{error}</p>}
            {result && !loading && (
              <p className="status ok">
                Last analyzed {formatWhen(result.analyzedAt)}. Open the other
                tabs for the brief, or run another site above.
              </p>
            )}
          </div>
        )}

        {tab === "summary" && result && (
          <div className="panel-body">
            <h2 className="panel-title">Summary</h2>
            <p className="meta">
              Policy:{" "}
              <a href={result.policyUrl} target="_blank" rel="noopener noreferrer">
                {result.policyUrl}
              </a>
            </p>
            <Prose text={result.summary} />
          </div>
        )}

        {tab === "data" && result && (
          <div className="panel-body">
            <h2 className="panel-title">Data collected</h2>
            <p className="panel-copy">
              Categories of personal information this policy says the site
              gathers.
            </p>
            <BulletList
              items={result.dataCollected}
              empty="No clear data-collection categories were identified."
            />
          </div>
        )}

        {tab === "sharing" && result && (
          <div className="panel-body">
            <h2 className="panel-title">Sharing &amp; rights</h2>
            <div className="split">
              <div>
                <h3 className="subhead">Sharing</h3>
                <BulletList
                  items={result.sharing}
                  empty="Sharing practices were not clearly described."
                />
              </div>
              <div>
                <h3 className="subhead">Your rights</h3>
                <BulletList
                  items={result.rights}
                  empty="User rights were not clearly described."
                />
              </div>
            </div>
            <h3 className="subhead">Cookies &amp; tracking (as stated in the policy)</h3>
            <p className="prose">{result.cookies}</p>
          </div>
        )}

        {tab === "risks" && result && (
          <div className="panel-body">
            <h2 className="panel-title">Risks</h2>
            <div className={`risk-badge risk-${result.risks.level}`}>
              <span className="risk-score">{result.risks.score}/10</span>
              <span>{RISK_COPY[result.risks.level]}</span>
            </div>
            <p className="prose">{result.risks.notes}</p>
            <h3 className="subhead">Flags</h3>
            <BulletList
              items={result.risks.flags}
              empty="No specific red flags were called out."
            />
          </div>
        )}

        {tab === "charts" && result && <RiskDashboard result={result} />}

        {tab === "trackers" && result && (
          <div className="panel-body">
            <h2 className="panel-title">Cookies &amp; trackers</h2>
            <p className="panel-copy">
              Detected by scanning the pages we fetched for cookies set in
              response headers and for known tracking scripts, pixels and
              iframes.
            </p>

            <div className="stat-row">
              <div className="stat">
                <span className="stat-value">{result.trackers.counts.cookies}</span>
                <span className="stat-label">Cookies</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {result.trackers.technologies.length}
                </span>
                <span className="stat-label">Technologies</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {result.trackers.counts.byCategory.analytics}
                </span>
                <span className="stat-label">Analytics cookies</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {result.trackers.counts.byCategory.advertising}
                </span>
                <span className="stat-label">Advertising cookies</span>
              </div>
            </div>

            <h3 className="subhead">Cookies set by the site</h3>
            {result.trackers.cookies.length ? (
              <ul className="tracker-list">
                {result.trackers.cookies.map((cookie) => (
                  <li
                    className="tracker-item"
                    key={`${cookie.name}-${cookie.domain}`}
                  >
                    <div className="tracker-head">
                      <code className="tracker-name">{cookie.name}</code>
                      <span className={`tag tag-${cookie.category}`}>
                        {CATEGORY_LABEL[cookie.category]}
                      </span>
                    </div>
                    <p className="tracker-meta">
                      {cookie.vendor ? `${cookie.vendor} · ` : ""}
                      {cookie.session ? "Session" : "Persistent"}
                      {cookie.secure ? " · Secure" : ""}
                      {cookie.httpOnly ? " · HttpOnly" : ""}
                      {cookie.sameSite ? ` · SameSite=${cookie.sameSite}` : ""}
                      {cookie.domain ? ` · ${cookie.domain}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No cookies were set in the response headers of the pages we
                scanned.
              </p>
            )}

            <h3 className="subhead">Tracking technologies</h3>
            {result.trackers.technologies.length ? (
              <ul className="tracker-list">
                {result.trackers.technologies.map((tech) => (
                  <li className="tracker-item" key={tech.vendor}>
                    <div className="tracker-head">
                      <span className="tracker-name">{tech.vendor}</span>
                      <span className={`tag tag-${tech.category}`}>
                        {CATEGORY_LABEL[tech.category]}
                      </span>
                    </div>
                    <p className="tracker-meta">
                      Found via {tech.sources.join(", ")} · {tech.example}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No known tracking technologies were found in the page HTML.
              </p>
            )}

            {result.trackers.notes.length > 0 && (
              <ul className="bullet-list notes">
                {result.trackers.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {locked && (
          <div className="panel-body">
            <p className="muted">Run an analysis first to unlock this tab.</p>
          </div>
        )}
      </section>
    </div>
  );
}
