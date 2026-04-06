# Resale Radar

AI-curated ticket resale intelligence. Claude researches upcoming events with strong
secondary market upside, you review the draft, then publish with one click.

---

## How it works

```
You click "Run Research" on GitHub
        ↓
Claude searches the web for high-resale events
        ↓
events_draft.json is committed to your repo
        ↓
You review it on GitHub (edit anything you want)
        ↓
You click "Publish Draft" → events.json goes live
        ↓
Your website updates automatically
```

---

## One-time setup (about 20 minutes)

### 1. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in → click **API Keys** in the left sidebar
3. Click **Create Key** → copy it (you'll only see it once)

### 2. Create your GitHub repo

1. Go to [github.com](https://github.com) → **+ New repository**
2. Name it `resale-radar`, set to **Public**, click **Create**
3. Upload all these files (drag & drop the whole folder):
   - `index.html`
   - `events.json`
   - `events_draft.json` (copy of events.json for now)
   - `.github/workflows/refresh.yml`
   - `.github/workflows/publish.yml`
   - `scripts/research.py`

### 3. Add your API key as a secret

1. In your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: paste your key from step 1
5. Click **Add secret**

### 4. Enable GitHub Pages

1. In your repo → **Settings** → **Pages**
2. Under "Branch" → select `main`, folder `/root`
3. Click **Save**
4. Your site will be live at: `https://YOUR-USERNAME.github.io/resale-radar/`

### 5. Update your GitHub username in index.html

Open `index.html`, find this line near the bottom:
```js
const GITHUB_USER = 'YOUR_GITHUB_USERNAME';
```
Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username. Commit the change.

---

## Day-to-day usage

### To refresh events (runs Claude research)

1. Go to your repo on GitHub
2. Click **Actions** tab → **Refresh Events (AI Research)**
3. Click **Run workflow** → optionally add a focus area (e.g. "summer concerts")
4. Click **Run workflow** (green button)
5. Wait ~60 seconds for it to finish

### To review the draft

1. After the Action finishes, go to your repo's main file list
2. Click `events_draft.json` to view what Claude found
3. Click the pencil icon to edit any fields directly on GitHub
4. Commit your edits

### To publish (go live)

1. Go to **Actions** → **Publish Draft (Go Live)**
2. Click **Run workflow** → **Run workflow**
3. Done — your site updates within 30 seconds

---

## Manually adding or editing events

You can edit `events.json` directly on GitHub at any time:
1. Click `events.json` in your repo
2. Click the pencil (edit) icon
3. Add/remove/edit events following this format:

```json
{
  "name": "Event Name",
  "type": "Sports",
  "multiple": "2–4×",
  "on_sale": "When and where tickets go on sale",
  "best_bets": "Which seats or games to target",
  "city": "City name or Multiple or TBD",
  "urgency": "now",
  "notes": "Optional one-sentence note"
}
```

- `type`: must be `Sports`, `Concert`, or `Festival`
- `urgency`: must be `now`, `soon`, or `watch`

---

## Focus areas (optional)

When running the refresh workflow, you can add a focus area to guide Claude:

- `"sports only — NBA and NHL playoffs"`
- `"summer 2026 stadium concerts"`  
- `"festival season — Bonnaroo, Lollapalooza, Outside Lands"`
- `"country music tours"` 

Leave it blank for a broad scan across all categories.

---

## Cost

Each refresh run costs roughly **$0.05–0.15** in Claude API credits (web search + generation).
Running it once a week costs under $1/month.
