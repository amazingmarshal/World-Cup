# ⚽ WC2026 Analytics

A static web dashboard for tracking FIFA World Cup 2026 match data, team strategies, and predictions — updated match-by-match from official post-match reports.

Live site: `https://<your-username>.github.io/wc2026-analytics`

---

## 🚀 Quick Setup

### 1. Fork / Clone

```bash
git clone https://github.com/<your-username>/wc2026-analytics.git
cd wc2026-analytics
```

### 2. Enable GitHub Pages

Go to your repo → **Settings → Pages → Source: GitHub Actions**

That's it. Every `git push` to `main` auto-deploys to Pages.

### 3. Local Preview

You need a local HTTP server (fetch() won't work on `file://`):

```bash
# Python 3
python -m http.server 8080
# then open http://localhost:8080
```

Or install the VS Code **Live Server** extension and click "Go Live".

---

## 📁 File Structure

```
wc2026-analytics/
├── index.html                  ← Single-page app shell
├── css/style.css               ← All styles
├── js/
│   ├── app.js                  ← Router + all view logic
│   └── charts.js               ← Chart.js wrappers
├── data/
│   ├── index.json              ← Registry of all matches & teams
│   ├── matches/
│   │   └── YYYY-MM-DD-T1-T2.json   ← One file per match
│   ├── teams/
│   │   └── KOR.json            ← Team profile + aggregate stats
│   └── predictions/
│       └── T1-T2.json          ← Prediction before a match
└── .github/workflows/
    └── deploy.yml              ← Auto-deploy to GitHub Pages
```

---

## 🔄 Workflow: Adding a New Match

### Step 1 — Send the PDF

Send me the match PDF. I'll return:
- `data/matches/YYYY-MM-DD-T1-T2.json` — full match data
- Updated `data/teams/T1.json` and `data/teams/T2.json`
- Updated `data/index.json`

### Step 2 — Copy the files and push

```bash
# copy the files I give you into the right folders, then:
git add .
git commit -m "Add match: KOR vs CZE (2026-06-11)"
git push
```

GitHub Actions deploys automatically within ~30 seconds.

---

## 📝 Adding a Prediction

Before a match, I can generate a `data/predictions/T1-T2.json`:

```json
{
  "homeTeam": "KOR",
  "awayTeam": "XXX",
  "predictedScore": { "home": 2, "away": 1 },
  "confidence": "medium",
  "predictedFormations": { "home": "3-4-3", "away": "4-3-3" },
  "keyMatchups": [
    "SON Heungmin vs opponent's right back",
    "HWANG Inbeom vs opponent's midfield press"
  ],
  "tacticalPrediction": "Korea expected to dominate possession with the same 3-4-3 system. Opponent will likely press high in the first 30 minutes before dropping into a mid block.",
  "predictedGoalScorers": ["HWANG Inbeom", "SON Heungmin"]
}
```

Also add the match to `data/index.json` under `upcomingMatches`:

```json
"upcomingMatches": [
  {
    "id": "2026-06-XX-KOR-XXX",
    "date": "2026-06-XX",
    "group": "A",
    "home": "KOR",
    "away": "XXX",
    "venue": "Stadium Name"
  }
]
```

---

## 🗂 Match JSON Schema

```json
{
  "id":          "YYYY-MM-DD-T1-T2",
  "tournament":  "FIFA World Cup 2026",
  "stage":       "Group Stage",
  "group":       "A",
  "matchDay":    2,
  "date":        "YYYY-MM-DD",
  "kickoff":     "20:00",
  "venue":       "Stadium Name",
  "home":        { "id": "KOR", "name": "Korea Republic", "formation": "3-4-3", "score": 2 },
  "away":        { "id": "CZE", "name": "Czechia",        "formation": "5-2-3", "score": 1 },
  "stats": {
    "KOR": { "possession":55.8, "xG":1.77, "shots":15, "shotsOnTarget":6,
             "passCompletion":89, "lineBreaks":92, "ballProgressions":27,
             "pressuresApplied":147, "directPressures":22, "forcedTurnovers":30,
             "secondBalls":49, "totalDistanceKm":111.8, ... },
    "CZE": { ... }
  },
  "goals": [
    { "time":58, "team":"CZE", "player":"Ladislav KREJCI", "bodyPart":"head", "deliveryType":"other" }
  ],
  "phases": {
    "KOR": { "inPossession": {...}, "outOfPossession": {...} },
    "CZE": { ... }
  },
  "keyPlayers": {
    "KOR": [{ "name":"HWANG Inbeom", "number":6, "role":"Midfield Hub", "highlight":"79 passes · goal 67'" }],
    "CZE": [...]
  },
  "tacticalAnalysis": {
    "summary":          "...",
    "homeStrengths":    ["...", "..."],
    "homeWeaknesses":   ["...", "..."],
    "awayStrengths":    ["...", "..."],
    "awayWeaknesses":   ["...", "..."]
  },
  "prediction": null
}
```

---

## 🏷 Team IDs Used

| Country         | ID  |
|-----------------|-----|
| Korea Republic  | KOR |
| Czechia         | CZE |
| USA             | USA |
| Mexico          | MEX |
| Canada          | CAN |
| Brazil          | BRA |
| Argentina       | ARG |
| Germany         | GER |
| France          | FRA |
| England         | ENG |
| Spain           | ESP |
| Portugal        | POR |
| *(add more...)*  |     |

---

## 📊 Tech Stack

- Vanilla JS (no framework, no build step)
- Chart.js 4.4 for charts
- Pure CSS Grid/Flexbox
- GitHub Pages for hosting
- GitHub Actions for CI/CD

No Node.js, no npm, no build — just static files.
