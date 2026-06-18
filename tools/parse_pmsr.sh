#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# tools/parse_pmsr.sh  —  FIFA PMSR one-shot extractor
#
# Usage:  bash tools/parse_pmsr.sh <path/to/pmsr.pdf>
#
# Outputs all key sections labelled to stdout — one run replaces ~10 extractions.
#
# Fully automated:  HEADER · FORMATIONS · LINEUPS · STATS · SHOTS ·
#                   SET PLAYS · CROSSES · PRESSURE · GK · PHYSICAL
#
# Still manual (visual chart data only in PDF):
#   phases-of-play counts · line heights · individual possession tables
# ─────────────────────────────────────────────────────────────────────────────

PDFTOTEXT="/c/Program Files/Git/mingw64/bin/pdftotext.exe"
PDF="${1:-}"; TXT="${PDF%.pdf}.txt"
[[ -z "$PDF" || ! -f "$PDF" ]] && { echo "Usage: $0 <pmsr.pdf>" >&2; exit 1; }

# ── Extract once, cache ───────────────────────────────────────────────────────
if [[ ! -f "$TXT" ]]; then
    "$PDFTOTEXT" "$PDF" "$TXT" 2>/dev/null
    echo "[pmsr] extracted → $TXT  ($(wc -l < "$TXT") lines)" >&2
else
    echo "[pmsr] cache: $TXT  ($(wc -l < "$TXT") lines)" >&2
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
hr()  { printf '\n\033[1;36m══ %s ══\033[0m\n' "$1"; }
blk() { [[ -n "${1:-}" && "${1:-}" -gt 0 ]] && sed -n "${1},$((${1}+${2:-20}))p" "$TXT" 2>/dev/null || true; }
ln1() { grep -nm1  "$1" "$TXT" 2>/dev/null | cut -d: -f1; }
ln2() { grep -nm2  "$1" "$TXT" 2>/dev/null | tail -1 | cut -d: -f1; }
aft() { local from="$1" pat="$2"; awk "NR>$from && /$pat/{print NR; exit}" "$TXT" 2>/dev/null || true; }

# ── MATCH HEADER ─────────────────────────────────────────────────────────────
hr "MATCH HEADER"
head -3 "$TXT"

# ── FORMATIONS ───────────────────────────────────────────────────────────────
hr "FORMATIONS  (home first, away second)"
grep "F O R M AT I O N" "$TXT" | head -2

# ── LINEUPS ───────────────────────────────────────────────────────────────────
hr "LINEUPS — HOME  (lone numbers before player = YC or sub minute)"
LS1=$(ln1 "^STARTING$")
FM1=$(aft "${LS1:-0}" "F O R M AT I O N")
[[ -n "$LS1" && -n "$FM1" ]] && blk "$LS1" "$(( FM1 - LS1 + 3 ))"

hr "LINEUPS — AWAY"
# Both formations appear before/at end of home section in this PDF format, so use fixed block
LS2=$(ln2 "^STARTING$")
[[ -n "$LS2" ]] && blk "$LS2" 90

# ── KEY STATS ────────────────────────────────────────────────────────────────
hr "KEY STATS"
echo "Order: Goals | xG | Shots(OT) | Passes(Comp) | Pass% | CompLB | DefLB | RecepFT | Crosses | BallProg | Pressures(Direct) | ForcedTO | SecBalls | Dist_km | Zone4_km"
T1=$(ln1 "^Total$"); T2=$(ln2 "^Total$")
[[ -n "$T1" ]] && { echo "HOME:"; blk "$(( T1 + 1 ))" 1; }
[[ -n "$T2" ]] && { echo "AWAY:"; blk "$(( T2 + 1 ))" 4; }

# ── SHOTS ────────────────────────────────────────────────────────────────────
hr "SHOTS — HOME"
echo "Time / #Player — then Outcome / Body Part / Delivery Type (same order)"
TM1=$(ln1 "^Time$")
OT1=$(aft "${TM1:-0}" "^Outcome ")
BP1=$(aft "${OT1:-$TM1}" "^Body Part ")
DT1=$(aft "${BP1:-$TM1}" "^Delivery Type ")
[[ -n "$TM1" && -n "$OT1" ]] && blk "$(( TM1 - 1 ))" "$(( OT1 - TM1 + 2 ))"
echo "Outcome:"; [[ -n "$OT1" ]] && blk "$OT1" 1
echo "Body Part:"; [[ -n "$BP1" ]] && blk "$BP1" 1
echo "Delivery:"; [[ -n "$DT1" ]] && blk "$DT1" 1

hr "SHOTS — AWAY"
TM2=$(ln2 "^Time$")
OT2=$(aft "${TM2:-0}" "^Outcome ")
BP2=$(aft "${OT2:-$TM2}" "^Body Part ")
DT2=$(aft "${BP2:-$TM2}" "^Delivery Type ")
[[ -n "$TM2" && -n "$OT2" ]] && blk "$(( TM2 - 1 ))" "$(( OT2 - TM2 + 2 ))"
echo "Outcome:"; [[ -n "$OT2" ]] && blk "$OT2" 1
echo "Body Part:"; [[ -n "$BP2" ]] && blk "$BP2" 1
echo "Delivery:"; [[ -n "$DT2" ]] && blk "$DT2" 1

# ── SET PLAYS ────────────────────────────────────────────────────────────────
hr "SET PLAYS — HOME then AWAY"
echo "Rows: (number before label) TotalSetPlays | TotalFreeKicks | Penalties | TotalCorners | FK-type totals | ThrowIns | Corner sides"
grep -n "^Total Set Plays$" "$TXT" | while IFS=: read -r ln _; do
    blk "$(( ln - 1 ))" 24; echo "---"
done

# ── CROSSES ──────────────────────────────────────────────────────────────────
hr "CROSSES — HOME then AWAY  (Attempted / Completed / delivery types / topCrosser)"
CX1=$(ln1 "Crosses (Open Play)")
CX2=$(ln2 "Crosses (Open Play)")
[[ -n "$CX1" ]] && { blk "$CX1" 65; echo "---"; }
[[ -n "$CX2" && "$CX2" != "$CX1" ]] && { blk "$CX2" 35; echo "---"; }

# ── DEFENSIVE PRESSURE ───────────────────────────────────────────────────────
hr "DEFENSIVE PRESSURE"
echo "Values per team: TotalPressures | DirectPressures | AvgDuration_s | ForcedTurnovers | BallRecovery_s | PushingOnIntoPressing | Inside | Outside | (last number)"
PL=$(ln1 "Total Pressures Direct Pressures")
[[ -n "$PL" ]] && blk "$(( PL - 4 ))" 14

# ── GOALKEEPING ──────────────────────────────────────────────────────────────
hr "GOALKEEPING — HOME  (Total Involvements / AttemptsOnGoalFaced / Save% / SaveAndRetain / GKLineBreaks)"
IV1=$(ln1 "^Total Involvements$"); SV1=$(ln1 "^Save %$"); GB1=$(ln1 "^Goalkeeper Line Breaks$")
[[ -n "$IV1" ]] && { echo "Involvements:"; blk "$(( IV1 - 1 ))" 2; }
[[ -n "$SV1" ]] && { echo ""; blk "$(( SV1 - 5 ))" 12; }
[[ -n "$GB1" ]] && { echo "GK Line Breaks:"; blk "$GB1" 2; }

hr "GOALKEEPING — AWAY"
IV2=$(ln2 "^Total Involvements$"); SV2=$(ln2 "^Save %$"); GB2=$(ln2 "^Goalkeeper Line Breaks$")
[[ -n "$IV2" ]] && { echo "Involvements:"; blk "$(( IV2 - 1 ))" 2; }
[[ -n "$SV2" ]] && { echo ""; blk "$(( SV2 - 5 ))" 12; }
[[ -n "$GB2" ]] && { echo "GK Line Breaks:"; blk "$GB2" 2; }

# ── PHYSICAL DATA ────────────────────────────────────────────────────────────
# Player names are on ONE line. Distances = one-per-line columns. Sprints/TopSpeed = ONE line each.
PH=$(ln1 "INDIVIDUAL DATA PHYSICAL")

hr "PHYSICAL — HOME  (player order matches all value columns below)"
Z4H=$(aft "${PH:-0}" "^Zone 4: 20-25 km")
Z5H=$(aft "${Z4H:-0}" "^Zone 5: 25")
SH=$(ln1  "^Sprints (Zone 4 & 5)$")
TH=$(ln1  "^Top Speed (km/h)$")
[[ -n "$PH"  ]] && { echo "Players (in order):"; blk "$(( PH + 4 ))" 1; }
echo ""
echo "--- Zone 4 (20-25 km/h) m — one value per player ---"
[[ -n "$Z4H" ]] && blk "$Z4H" 18
echo ""
echo "--- Zone 5 (25+ km/h) m ---"
[[ -n "$Z5H" ]] && blk "$Z5H" 18
echo ""
echo "--- Sprints (all players, same order) ---"
[[ -n "$SH" ]] && blk "$(( SH + 1 ))" 1
echo "--- Top Speed km/h ---"
[[ -n "$TH" ]] && blk "$(( TH + 1 ))" 1

hr "PHYSICAL — AWAY"
PA=$(ln2 "^Physical Data$" 2>/dev/null || aft "${PH:-0}" "^Physical Data$")
Z4A=$(ln2  "^Zone 4: 20-25 km")
Z5A=$(ln2  "^Zone 5: 25")
SA=$(ln2  "^Sprints (Zone 4 & 5)$")
TA=$(ln2  "^Top Speed (km/h)$")
[[ -n "$PA"  ]] && { echo "Players (in order):"; blk "$(( PA + 1 ))" 1; }
echo ""
echo "--- Zone 4 m ---"
[[ -n "$Z4A" ]] && blk "$Z4A" 18
echo ""
echo "--- Zone 5 m ---"
[[ -n "$Z5A" ]] && blk "$Z5A" 18
echo ""
echo "--- Sprints ---"
[[ -n "$SA" ]] && blk "$(( SA + 1 ))" 1
echo "--- Top Speed km/h ---"
[[ -n "$TA" ]] && blk "$(( TA + 1 ))" 1

printf '\n\033[1;32m══ DONE — manual: phases-of-play counts · line heights · individual possession tables ══\033[0m\n'
