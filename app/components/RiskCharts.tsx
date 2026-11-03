import type { AnalysisResult, RiskLevel, TrackerCategory } from "@/lib/types";

const CATEGORY_META: Record<TrackerCategory, { label: string; color: string }> = {
  essential: { label: "Essential", color: "#5a726a" },
  analytics: { label: "Analytics", color: "#0f766e" },
  advertising: { label: "Advertising", color: "#9f1239" },
  functional: { label: "Functional", color: "#1d4ed8" },
  social: { label: "Social", color: "#6d28d9" },
  unknown: { label: "Unclassified", color: "#94a3b8" },
};

const LEVEL_META: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: "Lower concern", color: "#166534" },
  medium: { label: "Moderate concern", color: "#9a3412" },
  high: { label: "Higher concern", color: "#9f1239" },
};

const CATEGORY_ORDER: TrackerCategory[] = [
  "advertising",
  "analytics",
  "social",
  "functional",
  "essential",
  "unknown",
];

type Bar = { label: string; value: number; color: string };

function ScoreGauge({ score, level }: { score: number; level: RiskLevel }) {
  const meta = LEVEL_META[level];
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(10, Math.max(0, score)) / 10;

  return (
    <div className="gauge">
      <svg
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Risk score ${score} out of 10 — ${meta.label}`}
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgba(16, 36, 31, 0.1)"
          strokeWidth="14"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={meta.color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="70" textAnchor="middle" className="gauge-score">
          {score}
        </text>
        <text x="70" y="90" textAnchor="middle" className="gauge-max">
          / 10
        </text>
      </svg>
      <p className="gauge-label" style={{ color: meta.color }}>
        {meta.label}
      </p>
    </div>
  );
}

function BarChart({
  title,
  bars,
  emptyText,
}: {
  title: string;
  bars: Bar[];
  emptyText: string;
}) {
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);

  return (
    <div className="chart-block">
      <h3 className="subhead">{title}</h3>
      {total ? (
        <div className="bars">
          {bars.map((bar) => (
            <div className="bar-row" key={bar.label}>
              <span className="bar-label">{bar.label}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{
                    width: `${(bar.value / total) * 100}%`,
                    background: bar.color,
                  }}
                />
              </span>
              <span className="bar-value">{bar.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function RiskDashboard({ result }: { result: AnalysisResult }) {
  const { risks, trackers } = result;

  const cookieBars: Bar[] = CATEGORY_ORDER.map((category) => ({
    label: CATEGORY_META[category].label,
    value: trackers.counts.byCategory[category] ?? 0,
    color: CATEGORY_META[category].color,
  }));

  const techCounts: Record<TrackerCategory, number> = {
    essential: 0,
    analytics: 0,
    advertising: 0,
    functional: 0,
    social: 0,
    unknown: 0,
  };
  for (const tech of trackers.technologies) techCounts[tech.category] += 1;

  const techBars: Bar[] = CATEGORY_ORDER.map((category) => ({
    label: CATEGORY_META[category].label,
    value: techCounts[category],
    color: CATEGORY_META[category].color,
  }));

  return (
    <div className="panel-body">
      <h2 className="panel-title">Risk charts</h2>
      <p className="panel-copy">
        A visual read of the policy&apos;s risk rating alongside the tracking this
        site actually loads.
      </p>

      <div className="dash-grid">
        <ScoreGauge score={risks.score} level={risks.level} />
        <div className="stat-row">
          <Stat value={trackers.counts.cookies} label="Cookies" />
          <Stat
            value={trackers.counts.thirdPartyCookies}
            label="Third-party cookies"
          />
          <Stat value={trackers.technologies.length} label="Technologies" />
          <Stat value={risks.flags.length} label="Red flags" />
        </div>
      </div>

      <div className="chart-grid">
        <BarChart
          title="Cookies by category"
          bars={cookieBars}
          emptyText="No cookies were observed in the response headers."
        />
        <BarChart
          title="Trackers by category"
          bars={techBars}
          emptyText="No tracking technologies were detected."
        />
      </div>

      <h3 className="subhead">Risk flags</h3>
      {risks.flags.length ? (
        <ul className="bullet-list">
          {risks.flags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No specific red flags were called out.</p>
      )}
    </div>
  );
}
