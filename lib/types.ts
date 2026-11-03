export type AnalyzeRequest = {
  url: string;
};

export type RiskLevel = "low" | "medium" | "high";

export type TrackerCategory =
  | "essential"
  | "analytics"
  | "advertising"
  | "functional"
  | "social"
  | "unknown";

export type CookieInfo = {
  name: string;
  vendor: string | null;
  category: TrackerCategory;
  thirdParty: boolean;
  session: boolean;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  domain: string | null;
};

export type TrackingTechnology = {
  vendor: string;
  category: TrackerCategory;
  sources: string[];
  example: string;
};

export type TrackerReport = {
  cookies: CookieInfo[];
  technologies: TrackingTechnology[];
  counts: {
    cookies: number;
    thirdPartyCookies: number;
    byCategory: Record<TrackerCategory, number>;
  };
  scannedPages: string[];
  notes: string[];
};

export type AnalysisResult = {
  inputUrl: string;
  policyUrl: string;
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
  trackers: TrackerReport;
  analyzedAt: string;
};

export type AnalyzeSuccess = {
  ok: true;
  result: AnalysisResult;
};

export type AnalyzeError = {
  ok: false;
  error: string;
};

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeError;
