# WC2026 Analytics — Agent Brief

## Project Overview

Static web SPA tracking FIFA World Cup 2026 match analytics. No framework, no build step. Pure HTML/CSS/JS with Chart.js. Hosted on GitHub Pages.

**Live site:** https://amazingmarshal.github.io/World-Cup/  
**Repo:** https://github.com/amazingmarshal/World-Cup  
**Local path:** `C:\Users\MARSHAL\Downloads\World-Cup-main\World-Cup-main\`

---

## Tech Stack

| Layer | Tech |
|---|---|
| SPA routing | Hash-based (`#/`, `#/match/:id`, `#/team/:id`, `#/predictions`) |
| Charts | Chart.js 4.4.1 via CDN |
| Styling | Pure CSS Grid/Flexbox, CSS variables |
| Data | JSON files in `data/` |
| Hosting | GitHub Pages (push to `main` = auto-deploy) |

---

## File Structure

```
index.html                          ← SPA shell + CDN imports
css/style.css                       ← all styles (CSS vars, grid, cards, tables)
js/app.js                           ← router + all view rendering (App object)
js/charts.js                        ← Chart.js wrappers
data/index.json                     ← registry of all teams + matches + upcoming
data/matches/YYYY-MM-DD-T1-T2.json  ← one file per match (full analytics)
data/teams/{ID}.json                ← team profile + aggregate stats + squad
data/predictions/{HOME}-{AWAY}.json ← optional pre-match predictions
AGENT_BRIEF.md                      ← this file
```

---

## Data Architecture

### `data/index.json`
Registry file. Always update when adding new matches or teams.

```json
{
  "teams": [
    { "id": "MEX", "name": "Mexico", "group": "A", "emoji": "🇲🇽" }
  ],
  "matches": [
    {
      "id": "2026-06-11-MEX-RSA",
      "date": "2026-06-11",
      "group": "A",
      "matchDay": 1,
      "home": "MEX",
      "away": "RSA",
      "scoreHome": 2,
      "scoreAway": 0,
      "venue": "Mexico City Stadium",
      "hasAnalysis": true
    }
  ],
  "upcomingMatches": []
}
```

### `data/teams/{ID}.json`
Aggregate stats across all played matches. Fields:

```json
{
  "id": "MEX", "name": "Mexico", "emoji": "🇲🇽", "group": "A",
  "coach": "Jaime Lozano", "formation": "4-1-2-3",
  "stats": {
    "matchesPlayed": 1, "wins": 1, "draws": 0, "losses": 0,
    "goalsFor": 2, "goalsAgainst": 0, "points": 3,
    "totalXG": 1.78, "xGAgainst": 0.1,
    "avgPossession": 57.1, "avgPassCompletion": 90,
    "avgTotalPasses": 547, "avgCompletedPasses": 495,
    "totalShots": 16, "shotsOnTarget": 4, "shotAccuracy": 25,
    "corners": 3, "crosses": 13, "crossesAttempted": 10, "crossesCompleted": 2, "crossCompletionPct": 20,
    "completedLineBreaks": 105, "avgBallProgressions": 23, "avgReceptionsInFinalThird": 117,
    "avgPressures": 170, "avgDirectPressures": 26, "avgForcedTurnovers": 31,
    "avgSecondBalls": 56, "avgBallRecoverySeconds": 14.38, "avgPressureDuration_s": 1.57,
    "avgTotalDistance_km": 107.3, "avgZone4Distance_km": 5.3,
    "cleanSheets": 1, "goalsScoredFromSet": 0, "goalsScoredOpenPlay": 2,
    "avgTackles": 16, "avgBlocks": 13, "avgInterceptions": 6,
    "avgAerialDuels": 33, "avgPossessionRegains": 37,
    "topSpeedKmh": 33.3, "topSpeedPlayer": "Raul JIMENEZ",
    "gkSavePercent": 100, "gkAttemptsOnGoalFaced": 3
  },
  "matches": [
    { "matchId": "2026-06-11-MEX-RSA", "opponent": "RSA", "score": "2-0", "result": "W", "xG": 1.78 }
  ],
  "squad": [
    { "number": 1, "name": "Raul RANGEL", "position": "GK" }
  ]
}
```

### `data/matches/{id}.json`
Full per-match analytics. All sections are optional — `app.js` guards `null` on every field.

```json
{
  "id": "2026-06-11-MEX-RSA",
  "date": "2026-06-11", "group": "A", "matchNumber": 1,
  "venue": "Mexico City Stadium", "kickOff": "13:00",
  "teams": { "home": "MEX", "away": "RSA" },
  "score": { "home": 2, "away": 0 },
  "formations": { "MEX": "4-1-2-3", "RSA": "5-3-2" },

  "goals": [
    { "minute": 8, "team": "MEX", "player": "Julian QUINONES",
      "bodyPart": "Right Foot", "deliveryType": "Loose Ball", "type": "open_play" }
  ],

  "lineups": {
    "MEX": [
      { "number": 9, "name": "Raul JIMENEZ", "position": "FW",
        "starter": true, "subOff": 76, "yellowCard": false }
    ]
  },

  "stats": {
    "MEX": {
      "possession": 57.1, "xG": 1.78, "attemptsAtGoal": 16, "attemptsOnTarget": 4,
      "totalPasses": 547, "completedPasses": 495, "passCompletionPct": 90,
      "completedLineBreaks": 105, "defensiveLineBreaks": 10,
      "receptionsInFinalThird": 117, "crosses": 13, "ballProgressions": 23,
      "defensivePressures": 170, "directPressures": 26, "forcedTurnovers": 31,
      "secondBalls": 56, "totalDistanceCovered_km": 107.3, "zone4Distance_km": 5.3
    }
  },

  "phasesOfPlay": {
    "MEX": {
      "inPossession": { "buildUpUnopposed": 47, "buildUpOpposed": 13, "progression": 16,
        "finalThird": 11, "longBall": 3, "attackingTransition": 10, "counterAttack": 1, "setPiece": 5 },
      "outOfPossession": { "highPress": 9, "midPress": 3, "lowPress": 0,
        "highBlock": 7, "midBlock": 25, "lowBlock": 11, "recovery": 5,
        "defensiveTransition": 12, "counterPress": 8 }
    }
  },

  "lineHeights": {
    "MEX": {
      "inPossession": {
        "buildUpLow":  { "lineHeight_m": 40, "teamLength_m": 56 },
        "buildUpMid":  { "lineHeight_m": 33, "teamLength_m": 57, "secondLine_m": 19 },
        "finalThird":  { "lineHeight_m": 47, "teamLength_m": 54 }
      },
      "outOfPossession": {
        "highBlock":   { "lineHeight_m": 43, "teamLength_m": 38 },
        "midBlock":    { "lineHeight_m": 30, "teamLength_m": 46 },
        "lowBlock":    { "lineHeight_m": 26, "teamLength_m": 35 }
      }
    }
  },

  "shotsDetail": {
    "MEX": [
      { "minute": 8, "player": "Julian QUINONES", "number": 16,
        "outcome": "OnTarget-Goal", "bodyPart": "Right Foot", "deliveryType": "Loose Ball" }
    ]
  },

  "setPlays": {
    "MEX": {
      "totalSetPlays": 36, "freeKicks": 12, "freeKicksDirect": 11,
      "freeKicksIndirect": 1, "penalties": 0,
      "corners": 3, "cornersFromLeft": 3, "cornersFromRight": 0, "throwIns": 21
    }
  },

  "crossesDetail": {
    "MEX": {
      "attempted": 10, "completed": 2,
      "deliveryTypes": { "inswing": 4, "outswing": 3, "driven": 1, "lofted": 2 },
      "topCrosser": "Israel REYES", "topCrosserAttempts": 2
    }
  },

  "defensiveSummary": {
    "MEX": {
      "possessionRegains": 37, "interceptions": 6, "tackles": 16, "blocks": 13,
      "aerialDuels": 33, "ballRecoveryTimeSeconds": 14.38, "avgPressureDurationSeconds": 1.57,
      "forcedTurnovers": 31, "topRegainer": "Jesus GALLARDO", "topRegainerCount": 8
    }
  },

  "goalkeeping": {
    "MEX": {
      "gk": "Raul RANGEL", "totalInvolvements": 37, "attemptsOnGoalFaced": 3,
      "goalsConceded": 0, "savePercent": 100,
      "saveAndRetain": 2, "aerialInterventions": 1, "crossesFaced": 8, "gkLineBreaks": 13
    }
  },

  "offeringToReceive": {
    "MEX": {
      "totalOffers": 424, "offersInFinalThird": 134, "offersInMiddleThird": 212,
      "offersInDefensiveThird": 78, "offersInsideShape": 213, "offersOutsideShape": 211,
      "totalReceived": 166, "topOfferMaker": "Julian QUINONES", "topOfferMakerCount": 54
    }
  },

  "playerPhysical": {
    "MEX": [
      { "number": 9, "name": "Raul JIMENEZ", "totalDistance_m": 7503.0,
        "zone1_m": 3337.6, "zone2_m": 2730.4, "zone3_m": 928.1,
        "zone4_m": 390.0, "zone5_m": 116.9,
        "highSpeedRuns": 67, "sprints": 33, "topSpeed_kmh": 33.3 }
    ]
  },

  "playerInPossession": {
    "MEX": [
      { "number": 9, "name": "Raul JIMENEZ",
        "passesAttempted": 17, "passesCompleted": 14, "passCompletionPct": 82,
        "lineBreaksAttempted": 3, "lineBreaksCompleted": 2,
        "attemptsAtGoal": 4, "goals": 1 }
    ]
  },

  "playerOutOfPossession": {
    "MEX": [
      { "number": 25, "name": "Roberto ALVARADO",
        "tacklesMade": 4, "tacklesWon": 2, "blocks": 0,
        "interceptions": 2, "pressingDirect": 4, "possessionRegains": 5 }
    ]
  },

  "keyPlayers": {
    "MEX": [
      { "number": 16, "name": "Julian QUINONES", "highlights": "Goal min 8. 12/12 line breaks (100%). 5 attempts." }
    ]
  },

  "tacticalAnalysis": {
    "MEX": {
      "summary": "Mexico dominated with 547 passes and 105 completed line breaks.",
      "strengths": ["Pass dominance", "Effective goal creation"],
      "weaknesses": ["Low cross completion 20%", "Only 4 shots on target from 16"]
    }
  }
}
```

---

## App.js Key Functions

| Function | What it does |
|---|---|
| `App.init()` | Load index.json → handle initial route |
| `App.handleRoute()` | Hash change → dispatch to render functions |
| `App.renderDashboard()` | Match cards grid + team chips |
| `App.renderMatch(id)` | Full analytics page — all sections |
| `App.renderTeam(id)` | Team profile — 4 chips + grouped stats + squad |
| `App.renderPredictions()` | Prediction cards from `data/predictions/` |
| `App._parseLineup(raw)` | Normalizes flat array OR `{starting, substitutes}` format |
| `App._parseKeyPlayers(kp, teamId)` | Normalizes array OR `{teamId:[]}` format |
| `App._parseTactical(ta, teamId)` | Normalizes nested OR flat tactical format |
| `App._parsePhases(phasesOfPlay, teamId)` | Normalizes nested `inPossession` OR flat |
| `App._renderShotsSection(...)` | Shots detail table |
| `App._renderLineHeightsSection(...)` | Line heights table |
| `App._renderSetPlaysSection(...)` | Set plays detail |
| `App._renderCrossesSection(...)` | Crosses delivery types |
| `App._renderOfferingSection(...)` | Offering to receive zones |
| `App._renderPlayerPhysicalFull(...)` | Full physical table with Z1-Z5 |
| `App._renderPlayerInPossessionFull(...)` | Full in-possession table |
| `App._renderPlayerDefFull(...)` | Full out-of-possession table |

---

## Current Data State (2026-06-18)

### Teams
| ID | Name | Group |
|---|---|---|
| MEX | Mexico 🇲🇽 | A |
| RSA | South Africa 🇿🇦 | A |
| KOR | Korea Republic 🇰🇷 | A |
| CZE | Czech Republic 🇨🇿 | A |
| CAN | Canada 🇨🇦 | B |
| BIH | Bosnia & Herzegovina 🇧🇦 | B |
| QAT | Qatar 🇶🇦 | B |
| SUI | Switzerland 🇨🇭 | B |

### Matches
| ID | Score | Full Analytics |
|---|---|---|
| 2026-06-11-MEX-RSA | MEX 2-0 RSA | ✅ Complete |
| 2026-06-11-KOR-CZE | KOR 2-1 CZE | ⚠️ Basic only |
| 2026-06-12-CAN-BIH | CAN 1-1 BIH | ⚠️ Basic only |
| 2026-06-13-QAT-SUI | QAT 1-1 SUI | ⚠️ Basic only |

---

## Data Sources

### Source 1 — football-data.org API (see below)
Covers: match schedule, scores, lineups (basic), standings, team info  
Does NOT cover: xG, physical data, shot maps, phases of play, tactical data

### Source 2 — FIFA Post-Match Summary Reports (PDFs)
Official FIFA PDFs released after each match. Contains everything:
xG, phases of play, line heights, shot detail, physical zones, passing networks,
offering to receive, pressing stats, GK distribution, set plays.

**Workflow:** Pull schedule/scores from API → enrich with FIFA PDF data manually.

---

---

# football-data.org API Integration

## Registration & Auth

1. Register free: https://www.football-data.org/client/register
2. Get API token from dashboard
3. All requests: `X-Auth-Token: YOUR_TOKEN` header
4. Free tier: 10 req/min, limited competitions

## Competition Code

WC2026 competition code: **`WC`** (or `FIFA WC 2026` — verify at `/competitions`)

Base URL: `https://api.football-data.org/v4`

---

## Endpoints & What to Fetch

### 1. Competition Info
```
GET /v4/competitions/WC
```
Returns: competition name, season, current matchday, number of teams.  
**Use for:** verify competition is live, get current matchday number.

---

### 2. All Matches (Schedule + Scores)
```
GET /v4/competitions/WC/matches
GET /v4/competitions/WC/matches?matchday=1
GET /v4/competitions/WC/matches?status=FINISHED
GET /v4/competitions/WC/matches?status=SCHEDULED
```

Response shape:
```json
{
  "matches": [
    {
      "id": 123456,
      "utcDate": "2026-06-11T17:00:00Z",
      "status": "FINISHED",
      "matchday": 1,
      "stage": "GROUP_STAGE",
      "group": "GROUP_A",
      "homeTeam": { "id": 758, "name": "Mexico", "tla": "MEX", "crest": "..." },
      "awayTeam": { "id": 1118, "name": "South Africa", "tla": "RSA", "crest": "..." },
      "score": {
        "fullTime": { "home": 2, "away": 0 },
        "halfTime": { "home": 1, "away": 0 }
      },
      "venue": "Mexico City Stadium",
      "referees": [...]
    }
  ]
}
```

**Map to our schema:**
```
id            → "2026-06-11-MEX-RSA"    (construct from date + tla)
utcDate       → date, kickOff
group         → "GROUP_A" → "A"
matchday      → matchDay
homeTeam.tla  → home
awayTeam.tla  → away
score.fullTime → scoreHome, scoreAway
venue         → venue
status        → FINISHED = hasAnalysis candidate
```

---

### 3. Single Match Detail
```
GET /v4/matches/{matchId}
```

Returns: same as above + referees.  
**Note:** Does NOT return xG, shots, lineups on free tier.

---

### 4. Standings / Group Table
```
GET /v4/competitions/WC/standings
```

Response:
```json
{
  "standings": [
    {
      "stage": "GROUP_STAGE",
      "type": "TOTAL",
      "group": "GROUP_A",
      "table": [
        {
          "position": 1,
          "team": { "id": 758, "name": "Mexico", "tla": "MEX" },
          "playedGames": 1, "won": 1, "draw": 0, "lost": 0,
          "points": 3, "goalsFor": 2, "goalsAgainst": 0, "goalDifference": 2
        }
      ]
    }
  ]
}
```

**Use for:** auto-update `data/teams/{ID}.json` → wins/draws/losses/points/goalsFor/goalsAgainst/matchesPlayed

---

### 5. All Teams in Competition
```
GET /v4/competitions/WC/teams
```

Response:
```json
{
  "teams": [
    {
      "id": 758,
      "name": "Mexico",
      "tla": "MEX",
      "crest": "https://crests.football-data.org/758.svg",
      "venue": "Estadio Azteca",
      "coach": { "name": "Jaime Lozano" },
      "squad": [
        { "id": 12345, "name": "Raúl Jiménez", "position": "Offence",
          "dateOfBirth": "1991-05-05", "nationality": "Mexico" }
      ]
    }
  ]
}
```

**Use for:** populate `data/teams/{ID}.json` → coach, squad (names + positions).  
**Note:** Position is generic (`Offence`, `Midfield`, `Defence`, `Goalkeeper`) — not detailed role.

---

### 6. Team Detail
```
GET /v4/teams/{teamId}
```

Returns full squad with shirt numbers (if available).

---

### 7. Person / Player
```
GET /v4/persons/{personId}
```

Returns: career stats, current team, nationality, date of birth.  
**Limited value** for our use — we need match-specific stats from FIFA PDFs.

---

## Fetch Workflow

### Step 1 — Initial Setup (run once)
```
GET /v4/competitions/WC/teams
→ For each team:
   - Create data/teams/{TLA}.json skeleton
   - Populate: id, name, coach, squad (name + position)
   - Add to data/index.json teams[]
```

### Step 2 — After Each Matchday
```
GET /v4/competitions/WC/matches?status=FINISHED&matchday=N
→ For each finished match:
   1. Create data/matches/{date}-{HOME}-{AWAY}.json skeleton
      - Set: id, date, group, matchNumber, venue, kickOff, teams, score, formations (manual)
      - Set: hasAnalysis: false initially
   2. Add entry to data/index.json matches[]
   3. Update data/index.json upcomingMatches[] (remove played, add next matchday)

GET /v4/competitions/WC/standings
→ For each team in standings:
   - Update data/teams/{TLA}.json stats:
     matchesPlayed, wins, draws, losses, points, goalsFor, goalsAgainst
```

### Step 3 — Enrich with FIFA PDF (manual, per match)
After API updates basic structure, add from PDF:
```
xG, phasesOfPlay, lineHeights, shotsDetail, setPlays, crossesDetail,
defensiveSummary, goalkeeping, offeringToReceive,
playerPhysical (with zone1-5), playerInPossession, playerOutOfPossession,
keyPlayers, tacticalAnalysis
→ Set hasAnalysis: true in index.json
```

---

## Rate Limits & Tiers

| Tier | Price | Req/min | Competitions |
|---|---|---|---|
| Free | €0 | 10 | Limited (may exclude WC) |
| Tier 1 | ~€1/mo | 10 | Most leagues |
| Tier 2 | ~€12/mo | 100 | All incl. WC |
| Tier 3 | ~€60/mo | unlimited | All + live data |

**Recommendation:** Check free tier coverage first. If WC2026 not included, Tier 2 needed.

---

## Data We Can Get from API vs PDF

| Data Field | API | FIFA PDF |
|---|---|---|
| Match schedule | ✅ | ❌ |
| Final score | ✅ | ✅ |
| Half-time score | ✅ | ✅ |
| Venue / referee | ✅ | ✅ |
| Group standings | ✅ | ❌ |
| Team info + coach | ✅ | ❌ |
| Basic squad | ✅ | ✅ |
| Goal scorers | ✅ (sometimes) | ✅ |
| Lineups | ✅ (paid tier) | ✅ |
| xG | ❌ | ✅ |
| Shots detail | ❌ | ✅ |
| Phases of play | ❌ | ✅ |
| Line heights | ❌ | ✅ |
| Physical / zones | ❌ | ✅ |
| Passing networks | ❌ | ✅ |
| Offering to receive | ❌ | ✅ |
| Pressing stats | ❌ | ✅ |
| GK distribution | ❌ | ✅ |
| Set play detail | ❌ | ✅ |
| Tactical analysis | ❌ | ✅ (manual) |

---

## Suggested Fetch Script (Node.js)

```javascript
// fetch-wc2026.js
// Run: node fetch-wc2026.js
// Env: WC_API_TOKEN=your_token

const TOKEN = process.env.WC_API_TOKEN;
const BASE  = 'https://api.football-data.org/v4';

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': TOKEN }
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

// 1. Get all teams + write skeletons
async function syncTeams() {
  const { teams } = await apiFetch('/competitions/WC/teams');
  for (const t of teams) {
    const filePath = `data/teams/${t.tla}.json`;
    // Read existing or create skeleton
    // Merge: coach, squad from API; keep existing stats from previous runs
    console.log(`Team: ${t.tla} — ${t.squad?.length || 0} players`);
  }
}

// 2. Get standings → update team stats
async function syncStandings() {
  const { standings } = await apiFetch('/competitions/WC/standings');
  for (const group of standings) {
    for (const row of group.table) {
      const tla = row.team.tla;
      // Update data/teams/{tla}.json stats:
      // matchesPlayed, wins, draws, losses, points, goalsFor, goalsAgainst
    }
  }
}

// 3. Get finished matches → update index.json + create match skeletons
async function syncMatches(matchday) {
  const { matches } = await apiFetch(
    `/competitions/WC/matches?matchday=${matchday}&status=FINISHED`
  );
  for (const m of matches) {
    const date   = m.utcDate.slice(0, 10);
    const home   = m.homeTeam.tla;
    const away   = m.awayTeam.tla;
    const id     = `${date}-${home}-${away}`;
    const group  = m.group?.replace('GROUP_', '') || '?';

    const skeleton = {
      id, date, group,
      matchNumber: m.matchday,
      venue: m.venue || '',
      kickOff: m.utcDate.slice(11, 16),
      teams: { home, away },
      score: { home: m.score.fullTime.home, away: m.score.fullTime.away },
      formations: { [home]: '', [away]: '' }, // fill manually
      goals: [],   // fill from PDF
      lineups: {}, // fill from PDF or paid API
      stats: {},   // fill from PDF
      // ... all PDF-sourced sections left empty, filled manually
    };

    // Write to data/matches/{id}.json if not exists
    console.log(`Match: ${id} — ${m.score.fullTime.home}:${m.score.fullTime.away}`);
  }
}

// 4. Upcoming matches → update index.json upcomingMatches
async function syncUpcoming() {
  const { matches } = await apiFetch(
    '/competitions/WC/matches?status=SCHEDULED'
  );
  // Take next 4 matches, write to index.json upcomingMatches[]
}

(async () => {
  await syncTeams();
  await syncStandings();
  await syncMatches(1); // pass current matchday
  await syncUpcoming();
  console.log('Done — now enrich match JSONs from FIFA PDFs');
})();
```

---

## Adding a New Match — Full Checklist

1. **API sync** → `node fetch-wc2026.js` → creates `data/matches/{id}.json` skeleton
2. **index.json** → verify match entry added, `hasAnalysis: false`
3. **FIFA PDF** → extract and add: xG, lineups, stats, phasesOfPlay, lineHeights,
   shotsDetail, setPlays, crossesDetail, defensiveSummary, goalkeeping,
   offeringToReceive, playerPhysical, playerInPossession, playerOutOfPossession,
   keyPlayers, tacticalAnalysis
4. **index.json** → set `hasAnalysis: true`
5. **Team JSONs** → update aggregate stats (or run API sync for standings)
6. **Push** → `git add -A && git commit && git push origin main`
7. **Deploy** → GitHub Pages auto-deploys in ~2 min

---

## Environment Setup for Agent

```bash
# Clone
git clone https://github.com/amazingmarshal/World-Cup.git
cd World-Cup

# Set API token
export WC_API_TOKEN=your_token_here

# No npm install needed — static site, no dependencies

# Push changes
git add -A && git commit -m "update: matchday N" && git push origin main
```

---

## CSS Variables (for UI changes)

```css
--primary: #1a3a8f   /* blue — home team */
--accent:  #d63b1f   /* red  — away team */
--green:   #1f8a43   /* goals, success */
--bg:      #f0f2f8
--card:    #ffffff
--text:    #1c2434
--border:  #e2e5ef
--radius:  14px
```
