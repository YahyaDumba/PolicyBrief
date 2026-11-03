# PolicyBrief

Enter a website URL, discover its privacy policy, and get a clear Groq-powered summary across five tabs: Analyze, Summary, Data collected, Sharing & rights, and Risks.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` (see `.env.example`):

```bash
GROQ_API_KEY=your_key_from_https://console.groq.com/keys
```

Optional:

```bash
GROQ_MODEL=openai/gpt-oss-20b
```

3. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. `POST /api/analyze` normalizes the URL and loads the site.
2. It finds a privacy policy via page links and common paths (`/privacy`, `/privacy-policy`, …).
3. It extracts readable policy text with Cheerio.
4. Groq returns structured JSON used by the five tabs.
