#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// tools/populate_match.js  —  FIFA PMSR end-to-end crawler
//
// Usage:
//   node tools/populate_match.js <pdf_url_or_path> <HOME_CODE> <AWAY_CODE>
//
// Examples:
//   node tools/populate_match.js https://example.com/pmsr_m08.pdf QAT SUI
//   node tools/populate_match.js "C:/Downloads/pmsr_m08.pdf"      QAT SUI
//
// Outputs:
//   data/matches/YYYY-MM-DD-HOME-AWAY.json   (full match analytics)
//   data/teams/HOME.json                      (team stats updated)
//   data/teams/AWAY.json                      (team stats updated)
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const PDFTOTEXT = 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe';
const ROOT      = path.join(__dirname, '..');

// ── Download ──────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(dest);
    const req   = proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', err => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

// ── Text extraction ───────────────────────────────────────────────────────────
function extractText(pdfPath) {
  const txtPath = pdfPath.replace(/\.pdf$/i, '.txt');
  if (!fs.existsSync(txtPath)) {
    execSync(`"${PDFTOTEXT}" "${pdfPath}" "${txtPath}"`, { stdio: 'pipe' });
  }
  const raw   = fs.readFileSync(txtPath, 'utf8');
  const lines = raw.split('\n').map(l => l.trimEnd());
  console.error(`[crawler] ${lines.length} lines extracted`);
  return lines;
}

// ── Line helpers ──────────────────────────────────────────────────────────────
const findNth = (lines, pat, n = 1) => {
  let c = 0;
  for (let i = 0; i < lines.length; i++) {
    if (typeof pat === 'string' ? lines[i].includes(pat) : pat.test(lines[i])) {
      if (++c === n) return i;
    }
  }
  return -1;
};
const findAfter = (lines, pat, start) => {
  for (let i = start + 1; i < lines.length; i++) {
    if (typeof pat === 'string' ? lines[i].includes(pat) : pat.test(lines[i])) return i;
  }
  return -1;
};
const blk = (lines, start, len) =>
  start >= 0 ? lines.slice(start, Math.min(start + len, lines.length)) : [];

// ── Header ────────────────────────────────────────────────────────────────────
function parseHeader(lines) {
  // Line 0: "Qatar 1 - 1 Switzerland"
  // Line 1: "Group B - Match 8 13 June 2026 15:00 Kick Off Toronto Stadium"
  const scoreLine = lines[0] || '';
  const infoLine  = lines[1] || '';

  const scoreMatch = scoreLine.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/);
  const dateMatch  = infoLine.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
  const timeMatch  = infoLine.match(/(\d{2}:\d{2})\s+Kick Off/);
  const groupMatch = infoLine.match(/Group\s+([A-Z])/);
  const matchMatch = infoLine.match(/Match\s+(\d+)/);

  const MONTHS = {January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
  let date = '2026-00-00';
  if (dateMatch) {
    const y = dateMatch[3], m = String(MONTHS[dateMatch[2]] || 0).padStart(2,'0'), d = String(+dateMatch[1]).padStart(2,'0');
    date = `${y}-${m}-${d}`;
  }

  // Venue: everything after "Kick Off " in infoLine
  const venueMatch = infoLine.match(/Kick Off\s+(.+)$/);
  const venue = venueMatch ? venueMatch[1].trim() : '';

  return {
    homeScore: scoreMatch ? +scoreMatch[2] : 0,
    awayScore: scoreMatch ? +scoreMatch[3] : 0,
    fullTime:  scoreMatch ? `${scoreMatch[2]}-${scoreMatch[3]}` : '0-0',
    date,
    kickOff:   timeMatch ? timeMatch[1] : '00:00',
    group:     groupMatch ? groupMatch[1] : 'A',
    matchNumber: matchMatch ? +matchMatch[1] : 0,
    venue
  };
}

// ── Formations ────────────────────────────────────────────────────────────────
function parseFormations(lines) {
  const result = [];
  for (const line of lines) {
    if (line.includes('F O R M AT I O N')) {
      const m = line.match(/F O R M AT I O N\s+([\d\s\-]+)/);
      if (m) result.push(m[1].replace(/\s/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''));
    }
    if (result.length === 2) break;
  }
  return result;
}

// ── Possession ────────────────────────────────────────────────────────────────
function parsePossession(lines) {
  // PDF shows "46.7%\n\nPossession\n\n45.2%" — percentage before the "Possession" label
  const posIdx = findNth(lines, /^Possession$/, 1);
  if (posIdx < 0) return [50, 50];
  // home % = last "xx.x%" before Possession label
  let home = 50, away = 50;
  for (let i = posIdx - 1; i >= Math.max(0, posIdx - 8); i--) {
    const m = lines[i].trim().match(/^([\d.]+)%$/);
    if (m) { home = Math.round(+m[1]); break; }
  }
  // away % = first "xx.x%" after Possession label
  for (let i = posIdx + 1; i < Math.min(posIdx + 8, lines.length); i++) {
    const m = lines[i].trim().match(/^([\d.]+)%$/);
    if (m) { away = Math.round(+m[1]); break; }
  }
  return [home, away];
}

// ── Stats rows ────────────────────────────────────────────────────────────────
function parseStatsRows(lines) {
  // Data row after "Total" may span 2 lines — concatenate both
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^Total$/.test(lines[i].trim())) {
      const l1 = lines[i + 1]?.trim() || '';
      const l2 = lines[i + 2]?.trim() || '';
      const combined = (l1 + ' ' + l2).trim();
      if (combined && /\d/.test(combined)) rows.push(combined);
    }
    if (rows.length === 2) break;
  }
  return rows;
}

function parseStatsRow(row) {
  // "1 0.52 6 (3) 289 (213) 74 % 58 2 41 8 13 294 (42) 36 53 109.2 km 4.8 km"
  const nums = (row.match(/[\d.]+/g) || []).map(Number);
  // idx: 0=goals 1=xG 2=shots 3=shotsOT 4=passes 5=passComp 6=pass% 7=compLB
  //      8=defLB 9=recepFT 10=crosses 11=ballProg 12=pressures 13=directPress
  //      14=FTO 15=secBalls 16=dist 17=zone4
  return {
    goals:                    nums[0]  || 0,
    xG:                       nums[1]  || 0,
    attemptsAtGoal:           nums[2]  || 0,
    attemptsOnTarget:         nums[3]  || 0,
    totalPasses:              nums[4]  || 0,
    completedPasses:          nums[5]  || 0,
    passCompletionPct:        nums[6]  || 0,
    completedLineBreaks:      nums[7]  || 0,
    defensiveLineBreaks:      nums[8]  || 0,
    receptionsInFinalThird:   nums[9]  || 0,
    crosses:                  nums[10] || 0,
    ballProgressions:         nums[11] || 0,
    defensivePressures:       nums[12] || 0,
    directPressures:          nums[13] || 0,
    forcedTurnovers:          nums[14] || 0,
    secondBalls:              nums[15] || 0,
    totalDistanceCovered_km:  nums[16] || 0,
    zone4Distance_km:         nums[17] || 0,
  };
}

// ── Shots ─────────────────────────────────────────────────────────────────────
const OUTCOMES = [
  'On Target - Goal Prevented Deflected',
  'On Target - Goal',
  'On Target - Saved',
  'Off Target - Defensive Event',
  'Off Target - Saved',
  'Off Target',
  'Incomplete - Player On Ball Error',
  'Incomplete - Blocked',
  'Incomplete',
  'Deflected - Off Target',
];
const BODYPARTS = ['Right Foot','Left Foot','Head'];
const DELIVERIES= ['Loose Ball','Freekick','Penalty','Corner','Cross','Pass','Other'];

function tokenize(str, known) {
  const result = [];
  let rest = str.trim();
  while (rest.length > 0) {
    let matched = false;
    for (const k of known) {
      if (rest.startsWith(k)) {
        result.push(k);
        rest = rest.slice(k.length).trim();
        matched = true;
        break;
      }
    }
    if (!matched) { rest = rest.slice(1); } // skip unknown char
  }
  return result;
}

function normalizeOutcome(o) {
  // "On Target - Goal" → "OnTarget-Goal"
  return o.replace(/\s*-\s*/g, '-').replace(/\s+/g, '');
}

function parseShotsForTeam(lines, timeLineIdx) {
  if (timeLineIdx < 0) return [];
  const outIdx  = findAfter(lines, /^Outcome /, timeLineIdx);
  if (outIdx < 0) return [];
  const bodyIdx = findAfter(lines, /^Body Part /, outIdx);
  const delIdx  = findAfter(lines, /^Delivery Type /, bodyIdx >= 0 ? bodyIdx : outIdx);

  // Collect non-blank lines between Time and Outcome, skip "Player" header
  // Format A (single line): "16 10 Granit XHAKA"
  // Format B (multi-line):  "16" then blank then "10 RAPHINHA" (or "25IGOR THIAGO" no-space)
  const nonBlank = [];
  for (let i = timeLineIdx + 1; i < outIdx; i++) {
    const line = lines[i].trim();
    if (line && line !== 'Player' && !/\b20\d{2}\b/.test(line)) nonBlank.push(line);
  }

  const shots = [];
  // Detect format: if first non-blank looks like "8" or "16" only → multi-line
  const firstIsMinuteOnly = nonBlank.length > 0 && /^\d{1,3}$/.test(nonBlank[0]);
  if (firstIsMinuteOnly) {
    // Pairs: [0]=minute, [1]=playerEntry, [2]=minute, [3]=playerEntry...
    for (let j = 0; j + 1 < nonBlank.length; j += 2) {
      const min = +nonBlank[j];
      const playerStr = nonBlank[j + 1] || '';
      // "11 RAPHINHA" or "25IGOR THIAGO" (number directly attached to name)
      const pm = playerStr.match(/^(\d+)\s*([A-Za-z].+)$/);
      if (pm) shots.push({ minute: min, number: +pm[1], name: pm[2].trim() });
    }
  } else {
    // Format A: "16 10 Granit XHAKA" all on one line
    for (const line of nonBlank) {
      const m = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (m) shots.push({ minute: +m[1], number: +m[2], name: m[3].trim() });
    }
  }

  // Parse outcomes/body/delivery
  const outLine  = outIdx  >= 0 ? lines[outIdx].replace(/^Outcome\s+/,       '') : '';
  const bodyLine = bodyIdx >= 0 ? lines[bodyIdx].replace(/^Body Part\s+/,    '') : '';
  const delLine  = delIdx  >= 0 ? lines[delIdx].replace(/^Delivery Type\s+/, '') : '';

  const outcomes   = tokenize(outLine,  OUTCOMES);
  const bodyParts  = tokenize(bodyLine, BODYPARTS);
  const deliveries = tokenize(delLine,  DELIVERIES);

  return shots.map((s, i) => ({
    minute:       s.minute,
    player:       s.name,
    number:       s.number,
    outcome:      normalizeOutcome(outcomes[i]   || 'Unknown'),
    bodyPart:     bodyParts[i]  || 'Unknown',
    deliveryType: deliveries[i] || 'Unknown',
  }));
}

function parseShots(lines) {
  const t1 = findNth(lines, /^Time$/, 1);
  const t2 = findNth(lines, /^Time$/, 2);
  return {
    home: parseShotsForTeam(lines, t1),
    away: parseShotsForTeam(lines, t2),
  };
}

// ── Set Plays ─────────────────────────────────────────────────────────────────
function parseSetPlaysBlock(lines, start, end) {
  const sub  = lines.slice(start, end);
  const get  = pat => { const i = sub.findIndex(l => pat.test(l)); return i >= 0 ? +sub[i-1]?.trim() || 0 : 0; };
  return {
    totalSetPlays: get(/^Total Set Plays$/),
    freeKicks:     get(/^Total Free Kicks$/),
    penalties:     get(/^Total Penalties$/),
    corners:       get(/^Total Corners$/),
    throwIns:      get(/^Total Throw Ins$/),
  };
}

function parseSetPlays(lines) {
  const positions = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^Total Set Plays$/.test(lines[i])) positions.push(i);
    if (positions.length === 2) break;
  }
  if (positions.length < 2) return { home: {}, away: {} };
  const midpoint = Math.round((positions[0] + positions[1]) / 2);
  return {
    home: parseSetPlaysBlock(lines, positions[0] - 2, midpoint),
    away: parseSetPlaysBlock(lines, midpoint, positions[1] + 30),
  };
}

// ── Crosses ───────────────────────────────────────────────────────────────────
function parseCrossesBlock(lines, start) {
  if (start < 0) return {};
  const sub = lines.slice(start, start + 120);

  // "Attempted"/"Completed" appear twice: first as visual headers (no value),
  // second as totals (value on NEXT line). Find the one where next non-blank is a number.
  const getTotal = pat => {
    for (let i = 0; i < sub.length; i++) {
      if (!pat.test(sub[i].trim())) continue;
      for (let j = i + 1; j < Math.min(i + 4, sub.length); j++) {
        const s = sub[j].trim();
        if (!s) continue;
        const n = +s;
        if (!isNaN(n) && n >= 0 && /^\d+$/.test(s)) return n;
        break; // non-numeric non-blank after label → this occurrence has no value
      }
    }
    return 0;
  };
  // Find last numeric occurrence
  const getLastTotal = pat => {
    let last = 0;
    for (let i = 0; i < sub.length; i++) {
      if (!pat.test(sub[i].trim())) continue;
      for (let j = i + 1; j < Math.min(i + 4, sub.length); j++) {
        const s = sub[j].trim();
        if (!s) continue;
        const n = +s;
        if (!isNaN(n) && /^\d+$/.test(s)) { last = n; }
        break;
      }
    }
    return last;
  };

  const attempted  = getLastTotal(/^Attempted$/);
  const completed  = getLastTotal(/^Completed$/);
  const topCrosses = getTotal(/^Most Crosses Attempted$/);

  // top crosser name: line after the number
  let topCrosser = null, topCrosserPos = null;
  const mcIdx = sub.findIndex(l => /^Most Crosses Attempted$/.test(l.trim()));
  if (mcIdx >= 0) {
    for (let j = mcIdx + 1; j < Math.min(mcIdx + 6, sub.length); j++) {
      const l = sub[j].trim();
      if (l && !/^\d+$/.test(l) && l.length > 3 && !/^Most/.test(l)) {
        if (!topCrosser) topCrosser = l;
        else if (!topCrosserPos) { topCrosserPos = l; break; }
      }
    }
  }

  // delivery types
  const dt = {};
  const dtMap = {inswing:/^Inswing$/i, outswing:/^Outswing$/i, driven:/^Driven$/i, lofted:/^Lofted$/i, cutback:/^Cutback$/i};
  for (const [key, pat] of Object.entries(dtMap)) {
    const i = sub.findIndex(l => pat.test(l.trim()));
    if (i >= 0) {
      const rest = sub[i].trim().replace(pat, '').trim();
      dt[key] = rest ? +rest.split(/\s+/)[0] || 0 : (() => {
        for (let j = i+1; j < Math.min(i+3, sub.length); j++) {
          const n = +sub[j].trim(); if (!isNaN(n)) return n;
        }
        return 0;
      })();
    } else dt[key] = 0;
  }

  return { attempted, completed, deliveryTypes: dt, topCrosser, topCrosserPosition: topCrosserPos, topCrosserAttempts: topCrosses };
}

function parseCrosses(lines) {
  const c1 = findNth(lines, 'Crosses (Open Play)', 1);
  const c2 = findNth(lines, 'Crosses (Open Play)', 2);
  return {
    home: parseCrossesBlock(lines, c1),
    away: c2 !== c1 ? parseCrossesBlock(lines, c2) : {},
  };
}

// ── Defensive Pressure ────────────────────────────────────────────────────────
function parsePressureNums(line) {
  // Extract nums from pressure data line:
  // "315 54 1.58s 41 18.03s 133 294 57 187"
  // Fields: totalPressures, directPressures, avgDuration(s), FTO, ballRecovery(s),
  //         pushingOn, unknown, insideDirection%, outsideDirection%
  const nums = (line.match(/[\d.]+/g) || []).map(Number);
  if (nums.length < 5) return {};
  return {
    ballRecoveryTimeSeconds:    nums[4] || 0,
    avgPressureDurationSeconds: nums[2] || 0,
    pushingOnIntoPressing:      nums[5] || 0,
    pressingDirectionInside:    nums[7] || 0,
    pressingDirectionOutside:   nums[8] || 0,
  };
}

function parsePressure(lines) {
  // Home data line is immediately before the header; away data line is immediately after
  const idx = findNth(lines, 'Total Pressures Direct Pressures', 1);
  if (idx < 0) return { home: {}, away: {} };

  // Find home data line: search backwards for a line with multiple numbers
  let homeLine = '';
  for (let i = idx - 1; i >= Math.max(0, idx - 5); i--) {
    if (/\d+\s+\d+/.test(lines[i])) { homeLine = lines[i]; break; }
  }
  // Away data line: after header + one more label line, find next numeric line
  let awayLine = '';
  for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
    if (/\d+\s+\d+/.test(lines[i])) { awayLine = lines[i]; break; }
  }

  return {
    home: parsePressureNums(homeLine),
    away: parsePressureNums(awayLine),
  };
}

// ── Goalkeeping ───────────────────────────────────────────────────────────────
function valBefore(lines, labelIdx) {
  for (let j = labelIdx - 1; j >= Math.max(0, labelIdx - 6); j--) {
    const s = lines[j].trim();
    if (s && /^\d+(\.\d+)?$/.test(s)) return +s;
  }
  return null;
}

function parseGK(lines) {
  const inv1 = findNth(lines, /^Total Involvements$/, 1);
  const inv2 = findNth(lines, /^Total Involvements$/, 2);
  const glb1 = findNth(lines, /^Goalkeeper Line Breaks$/, 1);
  const glb2 = findNth(lines, /^Goalkeeper Line Breaks$/, 2);

  // Goal Prevention sections anchor GK shot stats
  const gp1 = findNth(lines, 'Goal Prevention', 1);
  const gp2 = findNth(lines, 'Goal Prevention', 2);

  const atg1 = gp1 >= 0 ? findAfter(lines, /^Total Attempts on Goal Faced$/, gp1) : -1;
  const sp1  = atg1 >= 0 ? findAfter(lines, /^Save %$/, atg1) : -1;
  const atg2 = gp2 >= 0 ? findAfter(lines, /^Total Attempts on Goal Faced$/, gp2) : -1;
  const sp2  = atg2 >= 0 ? findAfter(lines, /^Save %$/, atg2) : -1;

  return {
    home: {
      totalInvolvements:   inv1 >= 0 ? valBefore(lines, inv1) : null,
      gkLineBreaks:        glb1 >= 0 ? valBefore(lines, glb1) : null,
      attemptsOnGoalFaced: atg1 >= 0 ? valBefore(lines, atg1) : null,
      savePercent:         sp1  >= 0 ? valBefore(lines, sp1)  : null,
    },
    away: {
      totalInvolvements:   inv2 >= 0 ? valBefore(lines, inv2) : null,
      gkLineBreaks:        glb2 >= 0 ? valBefore(lines, glb2) : null,
      attemptsOnGoalFaced: atg2 >= 0 ? valBefore(lines, atg2) : null,
      savePercent:         sp2  >= 0 ? valBefore(lines, sp2)  : null,
    },
  };
}

// ── Physical ──────────────────────────────────────────────────────────────────
function parsePhysicalTeam(lines, phStart) {
  if (phStart < 0) return { players: [], sprints: [], topSpeeds: [] };

  // Player list line: "# Player" header then "1 NAME1 2 NAME2 ..."
  const playerLineIdx = findAfter(lines, /^# Player$/, phStart);
  let players = [];
  if (playerLineIdx >= 0) {
    const raw = lines[playerLineIdx + 1] || '';
    // "1 MAHMOUD ABUNADA 2 PEDRO MIGUEL ..."
    const matches = [...raw.matchAll(/(\d+)\s+([A-Z][A-Za-z\s'.]+?)(?=\s+\d+\s+[A-Z]|$)/g)];
    players = matches.map(m => ({ number: +m[1], name: m[2].trim() }));
  }

  // Sprints: line after "^Sprints (Zone 4 & 5)$"
  const sprintsIdx = findAfter(lines, /^Sprints \(Zone 4 & 5\)$/, phStart);
  const sprints = sprintsIdx >= 0
    ? (lines[sprintsIdx + 1] || '').trim().split(/\s+/).map(Number)
    : [];

  // Top speed: line after "^Top Speed (km/h)$"
  const tsIdx = findAfter(lines, /^Top Speed \(km\/h\)$/, phStart);
  const topSpeeds = tsIdx >= 0
    ? (lines[tsIdx + 1] || '').trim().split(/\s+/).map(Number)
    : [];

  return { players, sprints, topSpeeds };
}

function parsePhysical(lines) {
  const phMain = findNth(lines, 'INDIVIDUAL DATA PHYSICAL', 1);
  const ph1 = phMain >= 0 ? phMain : -1;

  // Home physical: find first "# Player" after INDIVIDUAL DATA PHYSICAL
  const homePlayerLine = ph1 >= 0 ? findAfter(lines, /^# Player$/, ph1) : -1;
  // Away physical: find second "# Player" (first one AFTER homePlayerLine)
  const ph2 = homePlayerLine >= 0 ? findAfter(lines, /^# Player$/, homePlayerLine) : -1;

  const home = parsePhysicalTeam(lines, ph1);
  const away = ph2 >= 0 ? parsePhysicalTeam(lines, ph2 - 1) : { players: [], sprints: [], topSpeeds: [] };
  return { home, away };
}

// ── Lineups ───────────────────────────────────────────────────────────────────
// Strategy: extract player data from physical section (reliable names/numbers),
// try to get positions/events from lineup text.
function parseLineupsFromPhysical(physical, lines, homeId, awayId) {
  const buildRoster = (team) => {
    const { players, sprints, topSpeeds } = team;
    // First 11 = starters, rest = subs who played
    return players.map((p, i) => ({
      number:  p.number,
      name:    p.name,
      position: 'MF', // default, will be updated
      starter: i < 11,
    }));
  };

  const homeRoster = buildRoster(physical.home);
  const awayRoster = buildRoster(physical.away);

  // Try to extract positions and events from lineup section
  // Home lineup: find first STARTING block
  const ls1 = findNth(lines, /^STARTING$/, 1);
  const ls2 = findNth(lines, /^STARTING$/, 2);

  function extractEvents(rosterMap, linesSlice) {
    for (const line of linesSlice) {
      // Home format: "16 GK Maxime CREPEAU" or number + YC/sub times
      const posMatch = line.match(/^(\d+)\s+(GK|DF|MF|FW)\s+(.+)$/);
      if (posMatch) {
        const num = +posMatch[1];
        if (rosterMap[num]) rosterMap[num].position = posMatch[2];
      }
      // Away format: "Firstname LAST GK 1" or "LAST GK 1"
      const awayPosMatch = line.match(/([A-Z][A-Za-z\s'.]+?)\s+(GK|DF|MF|FW)\s+(\d+)$/);
      if (awayPosMatch) {
        const num = +awayPosMatch[3];
        if (rosterMap[num]) rosterMap[num].position = awayPosMatch[2];
      }
      // YC/sub minute: standalone minute like "22'" or "90+1'"
      // These are harder to attribute — skip for now
    }
  }

  const homeMap = Object.fromEntries(homeRoster.map(p => [p.number, p]));
  const awayMap = Object.fromEntries(awayRoster.map(p => [p.number, p]));

  if (ls1 >= 0) extractEvents(homeMap, lines.slice(ls1, ls1 + 100));
  if (ls2 >= 0) extractEvents(awayMap, lines.slice(ls2, ls2 + 100));

  // Set GK for first player
  if (homeRoster[0]) homeRoster[0].position = 'GK';
  if (awayRoster[0]) awayRoster[0].position = 'GK';

  return { home: homeRoster, away: awayRoster };
}

// ── Goals from shots ──────────────────────────────────────────────────────────
function extractGoals(shots, homeId, awayId) {
  const goals = [];
  const process = (teamShots, teamId) => {
    for (const s of teamShots) {
      if (s.outcome === 'OnTarget-Goal') {
        goals.push({
          minute:       s.minute,
          team:         teamId,
          player:       s.player,
          number:       s.number,
          bodyPart:     s.bodyPart,
          deliveryType: s.deliveryType,
          type:         s.deliveryType === 'Penalty' ? 'set_piece' : 'open_play',
        });
      }
      if (s.outcome === 'OffTarget-DefensiveEvent' && s.bodyPart === 'Head') {
        // Likely own goal from set piece
        goals.push({
          minute:       s.minute,
          team:         homeId, // benefits home (own goal by away player)
          player:       s.player,
          number:       s.number,
          bodyPart:     s.bodyPart,
          deliveryType: s.deliveryType,
          type:         'own_goal',
          ownGoal:      true,
        });
      }
    }
  };
  process(shots.home || [], homeId);
  process(shots.away || [], awayId);
  return goals.sort((a, b) => a.minute - b.minute);
}

// ── Build match JSON ──────────────────────────────────────────────────────────
function buildMatchJson(hdr, fms, statsH, statsA, shots, setPlays, crosses, pressure, gk, physical, lineups, homeId, awayId, possession) {
  const matchId = `${hdr.date}-${homeId}-${awayId}`;
  const goals   = extractGoals(shots, homeId, awayId);

  const buildPhysicalArr = (team, { players, sprints, topSpeeds }) =>
    players.map((p, i) => ({
      number:      p.number,
      name:        p.name,
      sprints:     sprints[i]   ?? null,
      topSpeedKmh: topSpeeds[i] ?? null,
    }));

  const defH = {
    ...pressure.home,
    forcedTurnovers: statsH.forcedTurnovers,
    topRegainer: null, topRegainerCount: 0,
    topDirectPresser: null, topDirectPresserCount: 0,
    interceptions: 0, tackles: 0, blocks: 0, aerialDuels: 0,
  };
  const defA = {
    ...pressure.away,
    forcedTurnovers: statsA.forcedTurnovers,
    topRegainer: null, topRegainerCount: 0,
    topDirectPresser: null, topDirectPresserCount: 0,
    interceptions: 0, tackles: 0, blocks: 0, aerialDuels: 0,
  };

  // Use PDF possession % if available, else infer from passes
  const [hPoss, aPoss] = (possession && possession[0])
    ? possession
    : (() => {
        const tp = (statsH.totalPasses || 0) + (statsA.totalPasses || 0);
        const h  = tp ? Math.round((statsH.totalPasses / tp) * 100) : 50;
        return [h, 100 - h];
      })();

  const physH = physical.home.players.length > 0 ? buildPhysicalArr(homeId, physical.home) : [];
  const physA = physical.away.players.length > 0 ? buildPhysicalArr(awayId, physical.away) : [];

  // GK names from physical first player
  const gkH = physical.home.players[0]?.name || '';
  const gkA = physical.away.players[0]?.name || '';

  const homeGoals = goals.filter(g => g.team === homeId && !g.ownGoal).length
    + goals.filter(g => g.team === awayId && g.ownGoal).length; // but we marked team as beneficiary already
  // Actually goals already have team = benefitting team, so:
  const hGoals = goals.filter(g => g.team === homeId).length;
  const aGoals = goals.filter(g => g.team === awayId).length;

  // Top speed
  const hTopIdx = physical.home.topSpeeds.indexOf(Math.max(...physical.home.topSpeeds.filter(n => !isNaN(n) && n > 0)));
  const aTopIdx = physical.away.topSpeeds.indexOf(Math.max(...physical.away.topSpeeds.filter(n => !isNaN(n) && n > 0)));

  return {
    id: matchId,
    date: hdr.date,
    group: hdr.group,
    matchNumber: hdr.matchNumber,
    venue: hdr.venue,
    kickOff: hdr.kickOff,
    teams: { home: homeId, away: awayId },
    score: { home: hdr.homeScore, away: hdr.awayScore, fullTime: hdr.fullTime },
    formations: { [homeId]: fms[0] || '4-4-2', [awayId]: fms[1] || '4-4-2' },
    goals,
    lineups: {
      [homeId]: lineups.home,
      [awayId]: lineups.away,
    },
    stats: {
      [homeId]: { possession: hPoss, ...statsH },
      [awayId]: { possession: aPoss, ...statsA },
    },
    phasesOfPlay: {
      [homeId]: { inPossession: {}, outOfPossession: {} },
      [awayId]: { inPossession: {}, outOfPossession: {} },
    },
    lineHeights: {
      [homeId]: { inPossession: {}, outOfPossession: {} },
      [awayId]: { inPossession: {}, outOfPossession: {} },
    },
    shotsDetail: { [homeId]: shots.home || [], [awayId]: shots.away || [] },
    setPlays: { [homeId]: setPlays.home || {}, [awayId]: setPlays.away || {} },
    crossesDetail: { [homeId]: crosses.home || {}, [awayId]: crosses.away || {} },
    defensiveSummary: { [homeId]: defH, [awayId]: defA },
    goalkeeping: {
      [homeId]: {
        gk: gkH,
        totalInvolvements:   gk.home.totalInvolvements   || 0,
        attemptsOnGoalFaced: gk.home.attemptsOnGoalFaced || 0,
        goalsConceded:       aGoals,
        savePercent:         gk.home.savePercent         || 0,
        gkLineBreaks:        gk.home.gkLineBreaks        || 0,
      },
      [awayId]: {
        gk: gkA,
        totalInvolvements:   gk.away.totalInvolvements   || 0,
        attemptsOnGoalFaced: gk.away.attemptsOnGoalFaced || 0,
        goalsConceded:       hGoals,
        savePercent:         gk.away.savePercent         || 0,
        gkLineBreaks:        gk.away.gkLineBreaks        || 0,
      },
    },
    offeringToReceive: { [homeId]: {}, [awayId]: {} },
    playerPhysical: { [homeId]: physH, [awayId]: physA },
    playerInPossession: { [homeId]: [], [awayId]: [] },
    keyPlayers: { [homeId]: [], [awayId]: [] },
    tacticalAnalysis: {
      [homeId]: { summary: '', strengths: [], weaknesses: [] },
      [awayId]: { summary: '', strengths: [], weaknesses: [] },
    },
    _meta: {
      generatedBy: 'populate_match.js',
      topSpeedHome: { kmh: physical.home.topSpeeds[hTopIdx] || 0, player: physical.home.players[hTopIdx]?.name || '' },
      topSpeedAway: { kmh: physical.away.topSpeeds[aTopIdx] || 0, player: physical.away.players[aTopIdx]?.name || '' },
    }
  };
}

// ── Build/update team JSON ────────────────────────────────────────────────────
function buildTeamJson(matchJson, teamId, isHome, physTeam) {
  const existingPath = path.join(ROOT, 'data', 'teams', `${teamId}.json`);
  const existing = fs.existsSync(existingPath) ? JSON.parse(fs.readFileSync(existingPath, 'utf8')) : {};

  const s = matchJson.stats[teamId];
  const topIdx = physTeam.topSpeeds.indexOf(Math.max(...physTeam.topSpeeds.filter(n => !isNaN(n) && n > 0)));

  const xGA = matchJson.stats[isHome ? Object.keys(matchJson.stats)[1] : Object.keys(matchJson.stats)[0]]?.xG || 0;
  const goals = matchJson.goals.filter(g => g.team === teamId).length;

  const squad = physTeam.players.map((p, i) => ({
    number:   p.number,
    name:     p.name,
    position: matchJson.lineups[teamId]?.find(l => l.number === p.number)?.position || 'MF',
  }));

  const matchEntry = {
    matchId:    matchJson.id,
    opponent:   isHome ? Object.keys(matchJson.teams)[1] : Object.keys(matchJson.teams)[0],
    // Fix: use team keys from teams object
    score:      matchJson.score.fullTime,
    result:     matchJson.score.home === matchJson.score.away ? 'D'
                : (isHome ? (matchJson.score.home > matchJson.score.away ? 'W' : 'L')
                          : (matchJson.score.away > matchJson.score.home ? 'W' : 'L')),
    xG:         s.xG || 0,
  };
  matchEntry.opponent = isHome ? matchJson.teams.away : matchJson.teams.home;

  return {
    id:       teamId,
    name:     existing.name     || teamId,
    emoji:    existing.emoji    || '',
    group:    matchJson.group,
    coach:    existing.coach    || '',
    formation: matchJson.formations[teamId],
    stats: {
      matchesPlayed: 1,
      wins:   matchEntry.result === 'W' ? 1 : 0,
      draws:  matchEntry.result === 'D' ? 1 : 0,
      losses: matchEntry.result === 'L' ? 1 : 0,
      goalsFor:     goals,
      goalsAgainst: matchJson.goals.filter(g => g.team !== teamId).length,
      points: matchEntry.result === 'W' ? 3 : matchEntry.result === 'D' ? 1 : 0,
      totalXG:               s.xG                       || 0,
      xGAgainst:             xGA,
      avgPossession:         s.possession               || 0,
      avgPassCompletion:     s.passCompletionPct         || 0,
      avgTotalPasses:        s.totalPasses               || 0,
      avgCompletedPasses:    s.completedPasses           || 0,
      totalShots:            s.attemptsAtGoal            || 0,
      shotsOnTarget:         s.attemptsOnTarget          || 0,
      shotAccuracy:          s.attemptsAtGoal ? Math.round((s.attemptsOnTarget / s.attemptsAtGoal) * 100) : 0,
      corners:               matchJson.setPlays[teamId]?.corners || 0,
      crosses:               s.crosses                   || 0,
      crossesAttempted:      matchJson.crossesDetail[teamId]?.attempted || 0,
      crossesCompleted:      matchJson.crossesDetail[teamId]?.completed || 0,
      completedLineBreaks:   s.completedLineBreaks        || 0,
      avgBallProgressions:   s.ballProgressions           || 0,
      avgReceptionsInFinalThird: s.receptionsInFinalThird || 0,
      avgPressures:          s.defensivePressures         || 0,
      avgDirectPressures:    s.directPressures            || 0,
      avgForcedTurnovers:    s.forcedTurnovers            || 0,
      avgSecondBalls:        s.secondBalls                || 0,
      avgBallRecoverySeconds:     matchJson.defensiveSummary[teamId]?.ballRecoveryTimeSeconds    || 0,
      avgPressureDuration_s:      matchJson.defensiveSummary[teamId]?.avgPressureDurationSeconds || 0,
      avgTotalDistance_km:   s.totalDistanceCovered_km    || 0,
      avgZone4Distance_km:   s.zone4Distance_km           || 0,
      cleanSheets:           (matchJson.score.home === matchJson.score.away || (isHome && matchJson.score.away === 0) || (!isHome && matchJson.score.home === 0)) ? 0 : 0,
      topSpeedKmh:           physTeam.topSpeeds[topIdx]   || 0,
      topSpeedPlayer:        physTeam.players[topIdx]?.name || '',
      gkSavePercent:         matchJson.goalkeeping[teamId]?.savePercent || 0,
      gkAttemptsOnGoalFaced: matchJson.goalkeeping[teamId]?.attemptsOnGoalFaced || 0,
    },
    matches:  [matchEntry],
    squad,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const [,, urlOrPath, homeId, awayId] = process.argv;
  if (!urlOrPath || !homeId || !awayId) {
    console.error('Usage: node tools/populate_match.js <pdf_url_or_path> <HOME> <AWAY>');
    process.exit(1);
  }

  // 1. Resolve PDF path
  let pdfPath;
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    const tmpDir = require('os').tmpdir();
    pdfPath = path.join(tmpDir, `pmsr_${homeId}_${awayId}.pdf`);
    console.error(`[crawler] downloading → ${pdfPath}`);
    await download(urlOrPath, pdfPath);
  } else {
    pdfPath = path.resolve(urlOrPath);
  }

  // 2. Extract text
  const lines = extractText(pdfPath);

  // 3. Parse all sections
  console.error('[crawler] parsing header...');
  const hdr = parseHeader(lines);

  console.error('[crawler] parsing formations...');
  const fms = parseFormations(lines);

  console.error('[crawler] parsing stats...');
  const statRows = parseStatsRows(lines);
  const statsH = statRows[0] ? parseStatsRow(statRows[0]) : {};
  const statsA = statRows[1] ? parseStatsRow(statRows[1]) : {};

  console.error('[crawler] parsing shots...');
  const shots = parseShots(lines);

  console.error('[crawler] parsing set plays...');
  const setPlays = parseSetPlays(lines);

  console.error('[crawler] parsing crosses...');
  const crosses = parseCrosses(lines);

  console.error('[crawler] parsing pressure...');
  const pressure = parsePressure(lines);

  console.error('[crawler] parsing GK...');
  const gk = parseGK(lines);

  console.error('[crawler] parsing physical...');
  const physical = parsePhysical(lines);

  console.error('[crawler] parsing lineups...');
  const lineups = parseLineupsFromPhysical(physical, lines, homeId, awayId);

  console.error('[crawler] parsing possession...');
  const possession = parsePossession(lines);

  // 4. Build match JSON
  console.error('[crawler] building match JSON...');
  const matchJson = buildMatchJson(hdr, fms, statsH, statsA, shots, setPlays, crosses, pressure, gk, physical, lineups, homeId, awayId, possession);

  // 5. Write match JSON
  const matchPath = path.join(ROOT, 'data', 'matches', `${matchJson.id}.json`);
  fs.writeFileSync(matchPath, JSON.stringify(matchJson, null, 2));
  console.error(`[crawler] ✓ wrote ${matchPath}`);

  // 6. Write team JSONs
  const homeTeamJson = buildTeamJson(matchJson, homeId, true, physical.home);
  const awayTeamJson = buildTeamJson(matchJson, awayId, false, physical.away);

  const homeTeamPath = path.join(ROOT, 'data', 'teams', `${homeId}.json`);
  const awayTeamPath = path.join(ROOT, 'data', 'teams', `${awayId}.json`);
  fs.writeFileSync(homeTeamPath, JSON.stringify(homeTeamJson, null, 2));
  fs.writeFileSync(awayTeamPath, JSON.stringify(awayTeamJson, null, 2));
  console.error(`[crawler] ✓ wrote ${homeTeamPath}`);
  console.error(`[crawler] ✓ wrote ${awayTeamPath}`);

  // 7. Summary
  console.log(`\n✅ Match: ${matchJson.id}  ${hdr.fullTime}`);
  console.log(`   Formations: ${fms[0] || '?'} vs ${fms[1] || '?'}`);
  console.log(`   Goals detected: ${matchJson.goals.length} — ${matchJson.goals.map(g => `${g.minute}' ${g.team}`).join(', ')}`);
  console.log(`   Shots: ${shots.home?.length || 0} home / ${shots.away?.length || 0} away`);
  console.log(`   Players extracted: ${physical.home.players.length} home / ${physical.away.players.length} away`);
  const _m = matchJson._meta;
  console.log(`   Top speed: HOME ${_m.topSpeedHome.kmh} km/h (${_m.topSpeedHome.player}) | AWAY ${_m.topSpeedAway.kmh} km/h (${_m.topSpeedAway.player})`);
  console.log(`\n⚠️  Manual review needed:`);
  console.log(`   - Player positions (set to defaults — update lineups in match JSON)`);
  console.log(`   - Sub/YC minutes (not auto-extracted from lineup section)`);
  console.log(`   - Phases of play, line heights (visual-only in PDF)`);
  console.log(`   - keyPlayers, tacticalAnalysis`);
  console.log(`   - team name/emoji/coach in ${homeId}.json and ${awayId}.json`);
}

main().catch(err => { console.error('[crawler] ERROR:', err.message); process.exit(1); });
