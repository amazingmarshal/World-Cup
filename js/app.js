// app.js — WC2026 Analytics SPA

const App = {
  data: { index: null, matches: {}, teams: {} },

  async loadIndex() {
    if (this.data.index) return this.data.index;
    const r = await fetch(`data/index.json?v=${Date.now()}`);
    this.data.index = await r.json();
    return this.data.index;
  },

  async loadMatch(id) {
    if (this.data.matches[id]) return this.data.matches[id];
    try {
      const r = await fetch(`data/matches/${id}.json?v=${Date.now()}`);
      if (!r.ok) throw new Error('not found');
      this.data.matches[id] = await r.json();
      return this.data.matches[id];
    } catch { return null; }
  },

  async loadTeam(id) {
    if (this.data.teams[id]) return this.data.teams[id];
    try {
      const r = await fetch(`data/teams/${id}.json?v=${Date.now()}`);
      if (!r.ok) throw new Error('not found');
      this.data.teams[id] = await r.json();
      return this.data.teams[id];
    } catch { return null; }
  },

  navigate(hash) { window.location.hash = hash; },

  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    document.querySelectorAll('header nav a').forEach(a => {
      a.classList.toggle('active',
        a.getAttribute('href').slice(1) === hash ||
        (hash === '/' && a.getAttribute('href') === '#/'));
    });
    const content = document.getElementById('content');
    content.innerHTML = `<div class="loader">Loading...</div>`;
    try {
      if (hash === '/' || hash === '')       await this.renderDashboard();
      else if (hash.startsWith('/match/'))   await this.renderMatch(hash.slice(7));
      else if (hash.startsWith('/team/'))    await this.renderTeam(hash.slice(6));
      else if (hash === '/matches')          await this.renderMatches();
      else if (hash === '/teams')            await this.renderTeams();
      else if (hash === '/predictions')      await this.renderPredictions();
      else content.innerHTML = `<p class="error-msg">Page not found.</p>`;
    } catch (err) {
      content.innerHTML = `<p class="error-msg">Error loading page: ${err.message}</p>`;
      console.error('Route error:', err);
    }
  },

  renderMiniTable(title, rows) {
    if (!rows || !rows.length) return '';
    return `
      <div class="card" style="margin-top:14px;">
        <div class="section-title gap-12">${title}</div>
        <div class="mini-table">
          ${rows.map(r => `
            <div class="mini-row">
              <span>${r.label}</span>
              <strong>${r.value}</strong>
            </div>`).join('')}
        </div>
      </div>`;
  },

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  // Returns {starters:[], subs:[]} regardless of lineup format in JSON
  _parseLineup(raw) {
    if (!raw) return { starters: [], subs: [] };
    // Format A: flat array with starter:true/false
    if (Array.isArray(raw)) {
      return {
        starters: raw.filter(p => p.starter !== false),
        subs:     raw.filter(p => p.starter === false)
      };
    }
    // Format B: {starting:[], substitutes:[]}
    return {
      starters: raw.starting || raw.starters || [],
      subs:     raw.substitutes || raw.subs || []
    };
  },

  // Returns array of key players for a given teamId regardless of format
  _parseKeyPlayers(keyPlayers, teamId) {
    if (!keyPlayers) return [];
    // Format A: array [{team:'QAT', name, highlight}]
    if (Array.isArray(keyPlayers)) return keyPlayers.filter(p => p.team === teamId);
    // Format B: object {QAT:[...], SUI:[...]}
    return keyPlayers[teamId] || [];
  },

  // Returns {summary, strengths:[], weaknesses:[]} for a teamId
  _parseTactical(ta, teamId) {
    if (!ta) return {};
    // Format A: {QAT:{summary,strengths:[],weaknesses:[]}, SUI:{...}}
    if (ta[teamId] && (ta[teamId].summary !== undefined || ta[teamId].strengths !== undefined)) {
      const t = ta[teamId];
      return {
        summary:    t.summary || '',
        strengths:  Array.isArray(t.strengths)  ? t.strengths  : t.strengths  ? [t.strengths]  : [],
        weaknesses: Array.isArray(t.weaknesses) ? t.weaknesses : t.weaknesses ? [t.weaknesses] : []
      };
    }
    // Format B: {summary, strengths:{QAT:'...', SUI:'...'}, weaknesses:{...}}
    return {
      summary:    ta.summary || '',
      strengths:  ta.strengths?.[teamId]  ? [ta.strengths[teamId]]  : [],
      weaknesses: ta.weaknesses?.[teamId] ? [ta.weaknesses[teamId]] : []
    };
  },

  // Returns phases object for donut chart regardless of nesting
  _parsePhases(phasesOfPlay, teamId) {
    const p = phasesOfPlay?.[teamId];
    if (!p) return null;
    // Format A: nested {inPossession:{...}}
    if (p.inPossession) return p.inPossession;
    // Format B: flat object directly
    return p;
  },

  // Physical leaders — supports both field name conventions
  _physicalLeaders(playerPhysical, teamId) {
    return [...(playerPhysical?.[teamId] || [])]
      .sort((a, b) => (b.distance || b.totalDistance_m || 0) - (a.distance || a.totalDistance_m || 0))
      .slice(0, 5)
      .map(p => ({
        label: `${p.name}  (top ${p.topSpeed || p.topSpeed_kmh || '—'} km/h)`,
        value: `${Math.round(p.distance || p.totalDistance_m || 0)}m`
      }));
  },

  // Possession leaders
  _possessionLeaders(playerInPossession, teamId) {
    return [...(playerInPossession?.[teamId] || [])]
      .sort((a, b) => (b.passesCompleted || 0) - (a.passesCompleted || 0))
      .slice(0, 5)
      .map(p => ({ label: p.name, value: `${p.passesCompleted}/${p.passesAttempted} passes (${p.passCompletionPct}%)` }));
  },

  // ─── RICH SECTION RENDERERS ───────────────────────────────────────────────

  _shotOutcomeTag(outcome) {
    if (!outcome) return { label: '?', style: '' };
    if (outcome.includes('Goal'))      return { label: '⚽ GOAL',  style: 'color:var(--green);font-weight:700;' };
    if (outcome.includes('OnTarget'))  return { label: '🎯 Saved', style: 'color:var(--primary);font-weight:600;' };
    if (outcome.includes('Blocked'))   return { label: '🛡 Block', style: 'color:#c07000;' };
    return                                    { label: '✗ Off',    style: 'color:var(--text-faint);' };
  },

  _renderShotsSection(shotsDetail, hId, aId, hTeam, aTeam) {
    if (!shotsDetail) return '';
    const renderTable = (shots) => {
      if (!shots || !shots.length) return '<div class="text-muted text-sm">No shots.</div>';
      return `<table class="player-table">
        <thead><tr><th>Min</th><th>Player</th><th>Outcome</th><th>Body Part</th><th>Type</th></tr></thead>
        <tbody>${shots.map(s => {
          const tag = this._shotOutcomeTag(s.outcome);
          return `<tr>
            <td style="font-weight:700;">${s.minute}'</td>
            <td>${s.player || s.name}</td>
            <td style="${tag.style}">${tag.label}</td>
            <td>${s.bodyPart || ''}</td>
            <td>${s.deliveryType || ''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    };
    return `
      <div class="gap-28">
        <div class="section-title gap-12">Shots Detail</div>
        <div class="grid-2">
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:10px;">${hTeam.emoji} ${hTeam.name} — ${(shotsDetail[hId]||[]).length} shots</div>
            <div style="overflow-x:auto;">${renderTable(shotsDetail[hId])}</div>
          </div>
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:10px;">${aTeam.emoji} ${aTeam.name} — ${(shotsDetail[aId]||[]).length} shots</div>
            <div style="overflow-x:auto;">${renderTable(shotsDetail[aId])}</div>
          </div>
        </div>
      </div>`;
  },

  _renderLineHeightsSection(lineHeights, hId, aId, hTeam, aTeam) {
    if (!lineHeights) return '';
    const renderTeam = (lh) => {
      if (!lh) return '<div class="text-muted text-sm">No data.</div>';
      const rows = [];
      [['In Poss', lh.inPossession || {}], ['Out Poss', lh.outOfPossession || {}]].forEach(([label, phases]) => {
        Object.entries(phases).forEach(([phase, data]) => {
          const name = phase.replace(/([A-Z])/g, ' $1').trim();
          rows.push({ phase: label + ' — ' + name, line: data.lineHeight_m, len: data.teamLength_m, line2: data.secondLine_m });
        });
      });
      return `<table class="player-table">
        <thead><tr><th>Phase</th><th>1st Line (m)</th><th>Team Len (m)</th><th>2nd Line (m)</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${r.phase}</td>
          <td style="font-weight:700;">${r.line ?? '—'}</td>
          <td>${r.len ?? '—'}</td>
          <td style="color:var(--text-faint);">${r.line2 != null ? r.line2 : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    };
    return `
      <div class="gap-28">
        <div class="section-title gap-12">Line Heights</div>
        <div class="grid-2">
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:10px;">${hTeam.emoji} ${hTeam.name}</div>
            <div style="overflow-x:auto;">${renderTeam(lineHeights[hId])}</div>
          </div>
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:10px;">${aTeam.emoji} ${aTeam.name}</div>
            <div style="overflow-x:auto;">${renderTeam(lineHeights[aId])}</div>
          </div>
        </div>
      </div>`;
  },

  _renderSetPlaysSection(setPlays, hId, aId, hTeam, aTeam) {
    if (!setPlays) return '';
    const spH = setPlays[hId] || {};
    const spA = setPlays[aId] || {};
    const defs = [
      ['Total Set Plays',       spH.totalSetPlays,     spA.totalSetPlays],
      ['Free Kicks (Direct)',    spH.freeKicksDirect,   spA.freeKicksDirect],
      ['Free Kicks (Indirect)',  spH.freeKicksIndirect, spA.freeKicksIndirect],
      ['Corners',                spH.corners,           spA.corners],
      ['Corners from Left',      spH.cornersFromLeft,   spA.cornersFromLeft],
      ['Corners from Right',     spH.cornersFromRight,  spA.cornersFromRight],
      ['Throw-ins',              spH.throwIns,          spA.throwIns],
      ['Penalties',              spH.penalties,         spA.penalties],
    ].filter(([, h, a]) => h != null || a != null);
    if (!defs.length) return '';
    return `
      <div class="card gap-28">
        <div class="section-title gap-12">Set Plays Detail</div>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:8px;">
          <span style="color:var(--primary);">${hTeam.emoji} ${hTeam.name}</span>
          <span style="color:var(--accent);">${aTeam.name} ${aTeam.emoji}</span>
        </div>
        <div class="mini-table">
          ${defs.map(([label, hv, av]) => `
            <div class="mini-row" style="justify-content:unset;gap:0;">
              <strong style="color:var(--primary);min-width:40px;">${hv ?? '—'}</strong>
              <span style="flex:1;text-align:center;">${label}</span>
              <strong style="color:var(--accent);min-width:40px;text-align:right;">${av ?? '—'}</strong>
            </div>`).join('')}
        </div>
      </div>`;
  },

  _renderCrossesSection(crossesDetail, hId, aId, hTeam, aTeam) {
    if (!crossesDetail) return '';
    const cH = crossesDetail[hId] || {};
    const cA = crossesDetail[aId] || {};
    const dtKeys = ['inswing','outswing','driven','lofted','cutback','pushCross'];
    const dtLabel = { inswing:'Inswing', outswing:'Outswing', driven:'Driven', lofted:'Lofted', cutback:'Cutback', pushCross:'Push Cross' };
    const renderTeam = (c) => {
      if (!c || !Object.keys(c).length) return '<div class="text-muted text-sm">No data.</div>';
      const dtRows = dtKeys.filter(k => (c.deliveryTypes||{})[k] != null);
      return `<div class="mini-table">
        <div class="mini-row"><span>Attempted</span><strong>${c.attempted ?? '—'}</strong></div>
        <div class="mini-row"><span>Completed</span><strong>${c.completed ?? '—'}</strong></div>
        <div class="mini-row"><span>Success %</span><strong>${c.attempted ? Math.round((c.completed/c.attempted)*100)+'%' : '—'}</strong></div>
        ${c.topCrosser ? `<div class="mini-row"><span>Top Crosser</span><strong>${c.topCrosser} (${c.topCrosserAttempts})</strong></div>` : ''}
        ${dtRows.map(k => `<div class="mini-row" style="padding-left:20px;"><span style="color:var(--text-faint);">${dtLabel[k]}</span><strong>${c.deliveryTypes[k]}</strong></div>`).join('')}
      </div>`;
    };
    return `
      <div class="gap-28">
        <div class="section-title gap-12">Crosses Detail</div>
        <div class="grid-2">
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:10px;">${hTeam.emoji} ${hTeam.name}</div>
            ${renderTeam(cH)}
          </div>
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:10px;">${aTeam.emoji} ${aTeam.name}</div>
            ${renderTeam(cA)}
          </div>
        </div>
      </div>`;
  },

  _renderOfferingSection(offeringToReceive, hId, aId, hTeam, aTeam) {
    if (!offeringToReceive) return '';
    const oH = offeringToReceive[hId] || {};
    const oA = offeringToReceive[aId] || {};
    const defs = [
      ['Total Offers',        oH.totalOffers,            oA.totalOffers],
      ['Total Received',      oH.totalReceived,          oA.totalReceived],
      ['Receive Rate',
        oH.totalOffers ? Math.round((oH.totalReceived/oH.totalOffers)*100)+'%' : '—',
        oA.totalOffers ? Math.round((oA.totalReceived/oA.totalOffers)*100)+'%' : '—'],
      ['In Final Third',      oH.offersInFinalThird,     oA.offersInFinalThird],
      ['In Middle Third',     oH.offersInMiddleThird,    oA.offersInMiddleThird],
      ['In Defensive Third',  oH.offersInDefensiveThird, oA.offersInDefensiveThird],
      ['Inside Shape',        oH.offersInsideShape,      oA.offersInsideShape],
      ['Outside Shape',       oH.offersOutsideShape,     oA.offersOutsideShape],
    ].filter(([, h, a]) => h != null || a != null);
    if (!defs.length) return '';
    const topH = oH.topOfferMaker ? ` — Top: ${oH.topOfferMaker} (${oH.topOfferMakerCount})` : '';
    const topA = oA.topOfferMaker ? `Top: ${oA.topOfferMaker} (${oA.topOfferMakerCount}) — ` : '';
    return `
      <div class="card gap-28">
        <div class="section-title gap-12">Offering to Receive — Movement Off Ball</div>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:8px;">
          <span style="color:var(--primary);">${hTeam.emoji} ${hTeam.name}${topH}</span>
          <span style="color:var(--accent);">${topA}${aTeam.name} ${aTeam.emoji}</span>
        </div>
        <div class="mini-table">
          ${defs.map(([label, hv, av]) => `
            <div class="mini-row" style="justify-content:unset;gap:0;">
              <strong style="color:var(--primary);min-width:50px;">${hv ?? '—'}</strong>
              <span style="flex:1;text-align:center;">${label}</span>
              <strong style="color:var(--accent);min-width:50px;text-align:right;">${av ?? '—'}</strong>
            </div>`).join('')}
        </div>
      </div>`;
  },

  _renderPlayerPhysicalFull(playerPhysical, teamId, teamName, teamEmoji, color) {
    const players = playerPhysical?.[teamId] || [];
    if (!players.length) return '';
    const sorted = [...players].sort((a,b) => (b.totalDistance_m||b.distance||0) - (a.totalDistance_m||a.distance||0));
    return `
      <div class="card gap-28">
        <div class="section-title gap-12" style="color:${color};">${teamEmoji} ${teamName} — Full Physical Data</div>
        <div style="overflow-x:auto;">
          <table class="player-table">
            <thead><tr>
              <th>#</th><th>Player</th><th>Total (m)</th>
              <th title="Zone 1: 0-7 km/h">Z1</th>
              <th title="Zone 2: 7-15 km/h">Z2</th>
              <th title="Zone 3: 15-20 km/h">Z3</th>
              <th title="Zone 4: 20-25 km/h">Z4 ↑</th>
              <th title="Zone 5: 25+ km/h">Z5 🔥</th>
              <th>HSR</th><th>Spr</th><th>Top km/h</th>
            </tr></thead>
            <tbody>${sorted.map(p => `<tr>
              <td>#${p.number}</td>
              <td>${p.name}</td>
              <td style="font-weight:700;">${Math.round(p.totalDistance_m||p.distance||0)}</td>
              <td>${Math.round(p.zone1_m||0)}</td>
              <td>${Math.round(p.zone2_m||0)}</td>
              <td>${Math.round(p.zone3_m||0)}</td>
              <td style="color:var(--accent);">${Math.round(p.zone4_m||0)}</td>
              <td style="color:var(--accent);font-weight:700;">${Math.round(p.zone5_m||0)}</td>
              <td>${p.highSpeedRuns||0}</td>
              <td>${p.sprints||0}</td>
              <td style="font-weight:700;">${p.topSpeed_kmh||p.topSpeed||'—'}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  _renderPlayerInPossessionFull(playerInPossession, teamId, teamName, teamEmoji, color) {
    const players = playerInPossession?.[teamId] || [];
    if (!players.length) return '';
    const sorted = [...players].sort((a,b) => (b.passesAttempted||0) - (a.passesAttempted||0));
    return `
      <div class="card gap-28">
        <div class="section-title gap-12" style="color:${color};">${teamEmoji} ${teamName} — In Possession</div>
        <div style="overflow-x:auto;">
          <table class="player-table">
            <thead><tr>
              <th>#</th><th>Player</th>
              <th>Pass Att</th><th>Cmp</th><th>%</th>
              <th>LB Att</th><th>LB Cmp</th>
              <th>Shots</th><th>Goals</th>
            </tr></thead>
            <tbody>${sorted.map(p => `<tr>
              <td>#${p.number}</td>
              <td>${p.name}</td>
              <td>${p.passesAttempted||0}</td>
              <td>${p.passesCompleted||0}</td>
              <td style="font-weight:700;">${p.passCompletionPct||0}%</td>
              <td>${p.lineBreaksAttempted||0}</td>
              <td>${p.lineBreaksCompleted||0}</td>
              <td>${p.attemptsAtGoal||0}</td>
              <td style="font-weight:700;${p.goals ? 'color:var(--green);' : ''}">${p.goals||0}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  _renderPlayerDefFull(playerOutOfPossession, teamId, teamName, teamEmoji, color) {
    const players = playerOutOfPossession?.[teamId] || [];
    if (!players.length) return '';
    const sorted = [...players].sort((a,b) => (b.possessionRegains||0) - (a.possessionRegains||0));
    return `
      <div class="card gap-28">
        <div class="section-title gap-12" style="color:${color};">${teamEmoji} ${teamName} — Out of Possession</div>
        <div style="overflow-x:auto;">
          <table class="player-table">
            <thead><tr>
              <th>#</th><th>Player</th>
              <th>Tackles</th><th>Won</th><th>Blocks</th>
              <th>Int</th><th>Press</th><th>Regains</th>
            </tr></thead>
            <tbody>${sorted.map(p => `<tr>
              <td>#${p.number}</td>
              <td>${p.name}</td>
              <td>${p.tacklesMade||0}</td>
              <td>${p.tacklesWon||0}</td>
              <td>${p.blocks||0}</td>
              <td>${p.interceptions||0}</td>
              <td>${p.pressingDirect||0}</td>
              <td style="font-weight:700;">${p.possessionRegains||0}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  // ─── MATCHES PAGE ────────────────────────────────────────────────────────
  async renderMatches() {
    const idx = await this.loadIndex();
    const el  = document.getElementById('content');
    const groups = [...new Set(idx.matches.map(m => m.group))].sort();

    el.innerHTML = `
      <div class="page-title">Matches</div>
      <div class="search-bar-wrap">
        <input type="text" id="matchSearch" class="search-input"
               placeholder="Search by team, group, venue, date…" autocomplete="off">
      </div>
      <div class="filter-pills" id="groupFilter">
        <button class="pill active" data-group="">All Groups</button>
        ${groups.map(g => `<button class="pill" data-group="${g}">Group ${g}</button>`).join('')}
      </div>
      <div id="matchCount" style="font-size:12px;color:var(--text-faint);margin-bottom:10px;"></div>
      <div id="matchList" class="grid-2"></div>`;

    const renderList = (query, group) => {
      const q = query.trim().toLowerCase();
      const filtered = idx.matches.filter(m => {
        const t1 = idx.teams.find(t => t.id === m.home);
        const t2 = idx.teams.find(t => t.id === m.away);
        const txt = [m.home, m.away, t1?.name, t2?.name, `group ${m.group}`, m.venue, m.date].join(' ').toLowerCase();
        return (!q || txt.includes(q)) && (!group || m.group === group);
      });

      document.getElementById('matchCount').textContent =
        `${filtered.length} match${filtered.length !== 1 ? 'es' : ''}`;

      document.getElementById('matchList').innerHTML = filtered.length
        ? filtered.map(m => {
            const t1 = idx.teams.find(t => t.id === m.home);
            const t2 = idx.teams.find(t => t.id === m.away);
            const winner = m.scoreHome > m.scoreAway ? m.home
                         : m.scoreAway > m.scoreHome ? m.away : 'draw';
            return `
              <a class="match-card" href="#/match/${m.id}">
                <div class="match-meta">${m.date} &nbsp;·&nbsp; Group ${m.group} MD${m.matchDay} &nbsp;·&nbsp; ${m.venue || ''}</div>
                <div class="score-row">
                  <span class="team-name">${t1?.emoji || ''} ${t1?.name || m.home}</span>
                  <span class="score-box">${m.scoreHome} – ${m.scoreAway}</span>
                  <span class="team-name right">${t2?.name || m.away} ${t2?.emoji || ''}</span>
                </div>
                <div class="xg-row">
                  <span>${winner === m.home ? '✓ Win' : winner === 'draw' ? '— Draw' : '✗ Loss'}</span>
                  <span>${m.hasAnalysis ? '📊 Analysis' : ''}</span>
                  <span>${winner === m.away ? 'Win ✓' : winner === 'draw' ? 'Draw —' : 'Loss ✗'}</span>
                </div>
              </a>`;
          }).join('')
        : `<div class="card" style="padding:48px;text-align:center;color:var(--text-faint);grid-column:1/-1;">
             No matches found for "${query || ''}" ${group ? `in Group ${group}` : ''}.
           </div>`;
    };

    let activeGroup = '';
    renderList('', '');

    document.getElementById('matchSearch').addEventListener('input', e =>
      renderList(e.target.value, activeGroup));

    document.getElementById('groupFilter').addEventListener('click', e => {
      const btn = e.target.closest('[data-group]');
      if (!btn) return;
      activeGroup = btn.dataset.group;
      document.querySelectorAll('#groupFilter .pill').forEach(b =>
        b.classList.toggle('active', b === btn));
      renderList(document.getElementById('matchSearch').value, activeGroup);
    });
  },

  // ─── TEAMS PAGE ───────────────────────────────────────────────────────────
  async renderTeams() {
    const idx = await this.loadIndex();
    const el  = document.getElementById('content');
    const groups = [...new Set(idx.teams.map(t => t.group))].sort();

    // load all team stat files in parallel (graceful fail)
    const teamDataMap = {};
    await Promise.all(idx.teams.map(async t => {
      const data = await this.loadTeam(t.id);
      if (data) teamDataMap[t.id] = data;
    }));

    el.innerHTML = `
      <div class="page-title">Teams</div>
      <div class="search-bar-wrap">
        <input type="text" id="teamSearch" class="search-input"
               placeholder="Search by team name or group…" autocomplete="off">
      </div>
      <div class="filter-pills" id="teamGroupFilter">
        <button class="pill active" data-group="">All Groups</button>
        ${groups.map(g => `<button class="pill" data-group="${g}">Group ${g}</button>`).join('')}
      </div>
      <div id="teamCount" style="font-size:12px;color:var(--text-faint);margin-bottom:10px;"></div>
      <div id="teamGrid" class="grid-4"></div>`;

    const renderGrid = (query, group) => {
      const q = query.trim().toLowerCase();
      const filtered = idx.teams.filter(t => {
        const txt = [t.name, t.id, `group ${t.group}`].join(' ').toLowerCase();
        return (!q || txt.includes(q)) && (!group || t.group === group);
      });

      document.getElementById('teamCount').textContent =
        `${filtered.length} team${filtered.length !== 1 ? 's' : ''}`;

      document.getElementById('teamGrid').innerHTML = filtered.length
        ? filtered.map(t => {
            const d = teamDataMap[t.id];
            const s = d?.stats || {};
            const hasStats = s.matchesPlayed > 0;
            const record  = hasStats ? `${s.wins}W ${s.draws}D ${s.losses}L` : 'No matches yet';
            const pts     = hasStats ? `${s.points} pts` : '';
            const xgLine  = hasStats ? `xG ${s.totalXG} / xGA ${s.xGAgainst}` : '';
            const coach   = d?.coach ? `<div style="font-size:11px;color:var(--text-faint);margin-top:2px;">${d.coach}</div>` : '';
            return `
              <a class="team-list-card" href="#/team/${t.id}">
                <div style="font-size:32px;margin-bottom:6px;">${t.emoji}</div>
                <div style="font-weight:700;font-size:14px;">${t.name}</div>
                <div style="font-size:11px;color:var(--text-faint);margin-top:2px;">Group ${t.group}</div>
                ${coach}
                ${hasStats ? `
                  <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:12px;font-weight:700;">${record}</span>
                      <span class="badge ${s.points >= 3 ? 'badge-win' : s.points === 1 ? 'badge-draw' : 'badge-loss'}">${pts}</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-faint);margin-top:4px;">${xgLine}</div>
                  </div>` : `
                  <div style="margin-top:10px;font-size:11px;color:var(--text-faint);">${record}</div>`}
              </a>`;
          }).join('')
        : `<div style="grid-column:1/-1;padding:48px;text-align:center;color:var(--text-faint);">
             No teams found for "${query || ''}".
           </div>`;
    };

    let activeGroup = '';
    renderGrid('', '');

    document.getElementById('teamSearch').addEventListener('input', e =>
      renderGrid(e.target.value, activeGroup));

    document.getElementById('teamGroupFilter').addEventListener('click', e => {
      const btn = e.target.closest('[data-group]');
      if (!btn) return;
      activeGroup = btn.dataset.group;
      document.querySelectorAll('#teamGroupFilter .pill').forEach(b =>
        b.classList.toggle('active', b === btn));
      renderGrid(document.getElementById('teamSearch').value, activeGroup);
    });
  },

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  async renderDashboard() {
    const idx = await this.loadIndex();
    const el  = document.getElementById('content');

    const matchCards = (await Promise.all(idx.matches.map(async m => {
      const t1 = idx.teams.find(t => t.id === m.home);
      const t2 = idx.teams.find(t => t.id === m.away);
      const winner = m.scoreHome > m.scoreAway ? m.home
                   : m.scoreAway > m.scoreHome ? m.away : 'draw';
      return `
        <a class="match-card" href="#/match/${m.id}">
          <div class="match-meta">${m.date} &nbsp;·&nbsp; Group ${m.group} MD${m.matchDay} &nbsp;·&nbsp; ${m.venue || ''}</div>
          <div class="score-row">
            <span class="team-name">${t1?.emoji || ''} ${t1?.name || m.home}</span>
            <span class="score-box">${m.scoreHome} – ${m.scoreAway}</span>
            <span class="team-name right">${t2?.name || m.away} ${t2?.emoji || ''}</span>
          </div>
          <div class="xg-row">
            <span>${winner === m.home ? '✓ Win' : winner === 'draw' ? '— Draw' : '✗ Loss'}</span>
            <span>${m.hasAnalysis ? '📊 Analysis available' : ''}</span>
            <span>${winner === m.away ? 'Win ✓' : winner === 'draw' ? 'Draw —' : 'Loss ✗'}</span>
          </div>
        </a>`;
    }))).join('');

    const teamCards = idx.teams.map(t => `
      <a class="card-sm" href="#/team/${t.id}"
         style="display:block;text-decoration:none;color:inherit;cursor:pointer;transition:border-color 0.15s;"
         onmouseover="this.style.borderColor='#1a3a8f'" onmouseout="this.style.borderColor=''">
        <div style="font-size:28px;margin-bottom:6px;">${t.emoji}</div>
        <div style="font-weight:600;font-size:14px;">${t.name}</div>
        <div style="font-size:11px;color:var(--text-faint);">Group ${t.group}</div>
      </a>`).join('');

    const upcoming = (idx.upcomingMatches || []).length
      ? `<div class="gap-20">
          <div class="section-title">Upcoming Matches</div>
          <div class="grid-2">${idx.upcomingMatches.map(m => `
            <div class="card-sm">
              <div class="text-muted text-sm">${m.date} · Group ${m.group}</div>
              <div style="font-size:15px;font-weight:600;margin-top:4px;">${m.home} vs ${m.away}</div>
            </div>`).join('')}</div>
        </div>` : '';

    el.innerHTML = `
      <div class="page-title">WC2026 — Match Analytics</div>
      <div class="gap-28">
        <div class="section-title">Results</div>
        <div class="grid-2">${matchCards}</div>
      </div>
      <div class="gap-28">
        <div class="section-title">Teams</div>
        <div class="grid-4">${teamCards}</div>
      </div>
      ${upcoming}`;
  },

  // ─── MATCH PAGE ───────────────────────────────────────────────────────────
  async renderMatch(id) {
    const match = await this.loadMatch(id);
    const el    = document.getElementById('content');
    if (!match) { el.innerHTML = `<p class="error-msg">Match data not found: ${id}</p>`; return; }

    const hId = match.teams?.home || match.home;
    const aId = match.teams?.away || match.away;

    const hScore = match.score?.home ?? match.scoreHome ?? 0;
    const aScore = match.score?.away ?? match.scoreAway ?? 0;

    const hForm = match.formations?.[hId] || '';
    const aForm = match.formations?.[aId] || '';

    const idx   = await this.loadIndex();
    const hTeam = idx.teams.find(t => t.id === hId) || { name: hId, emoji: '' };
    const aTeam = idx.teams.find(t => t.id === aId) || { name: aId, emoji: '' };

    const hS = match.stats?.[hId] || {};
    const aS = match.stats?.[aId] || {};

    const setPlaysH = match.setPlays?.[hId] || {};
    const setPlaysA = match.setPlays?.[aId] || {};

    const gkH = match.goalkeeping?.[hId] || {};
    const gkA = match.goalkeeping?.[aId] || {};

    const defH = match.defensiveSummary?.[hId] || {};
    const defA = match.defensiveSummary?.[aId] || {};

    // ── Goals ──────────────────────────────────────────────────────────────
    const goalsHtml = (match.goals || []).map(g => `
      <div class="goal-item">
        <span class="minute ${g.team === aId ? 'away-goal' : ''}">${g.minute}'</span>
        <span style="font-size:11px;">⚽</span>
        <span class="player">${g.player}</span>
        <span class="detail">${g.bodyPart || ''} · ${g.deliveryType || ''}${g.type === 'penalty' ? ' · Penalty' : ''}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:600;color:${g.team === hId ? 'var(--primary)' : 'var(--accent)'};">${g.team}</span>
      </div>`).join('');

    // ── Stat bars ─────────────────────────────────────────────────────────
    const statDefs = [
      ['Possession %',     hS.possession,          aS.possession,          100],
      ['xG',               hS.xG,                  aS.xG,                  null],
      ['Shots',            hS.attemptsAtGoal,       aS.attemptsAtGoal,      null],
      ['On Target',        hS.attemptsOnTarget,     aS.attemptsOnTarget,    null],
      ['Corners',          setPlaysH.corners,       setPlaysA.corners,      null],
      ['Pass Accuracy %',  hS.passCompletionPct,    aS.passCompletionPct,   100],
      ['Line Breaks',      hS.completedLineBreaks,  aS.completedLineBreaks, null],
      ['Ball Progressions',hS.ballProgressions,     aS.ballProgressions,    null],
      ['Pressures',        hS.defensivePressures,   aS.defensivePressures,  null],
      ['2nd Balls',        hS.secondBalls,          aS.secondBalls,         null],
      ['Tackles',          defH.tackles,            defA.tackles,           null],
    ];

    const statRows = statDefs.map(([label, hv, av, fixedMax]) => {
      if (hv == null && av == null) return '';
      hv = hv || 0; av = av || 0;
      const m = fixedMax || Math.max(hv, av) * 1.2 || 1;
      const hPct = Math.max(4, Math.round((hv / m) * 100));
      const aPct = Math.max(4, Math.round((av / m) * 100));
      return `
        <div class="stat-compare-row">
          <span class="val left">${Number.isInteger(hv) ? hv : Number(hv).toFixed(2)}</span>
          <div class="bar-wrap"><div class="bar-fill left" style="width:${hPct}%"></div></div>
          <span class="label">${label}</span>
          <div class="bar-wrap"><div class="bar-fill right" style="width:${aPct}%"></div></div>
          <span class="val right">${Number.isInteger(av) ? av : Number(av).toFixed(2)}</span>
        </div>`;
    }).join('');

    // ── Lineups (handles flat array OR {starting,substitutes}) ────────────
    const lineupHtml = (teamId) => {
      const raw = match.lineups?.[teamId];
      if (!raw) return '<div class="text-muted text-sm">No lineup data.</div>';
      const { starters, subs } = this._parseLineup(raw);
      const renderPlayer = p => {
        let extra = '';
        if (p.subOn)      extra += ` · ▲${p.subOn}'`;
        if (p.subOff)     extra += ` · ▼${p.subOff}'`;
        if (p.yellowCard) extra += ` · 🟨`;
        if (p.redCard)    extra += ` · 🟥`;
        return `
          <div class="mini-row">
            <span>#${p.number} ${p.name}</span>
            <strong>${p.position}${extra}</strong>
          </div>`;
      };
      return `
        <div class="mini-table">
          <div class="mini-table-title">Starting XI</div>
          ${starters.map(renderPlayer).join('') || '<div class="text-muted text-sm" style="padding:4px 0;">—</div>'}
          <div class="mini-table-title" style="margin-top:10px;">Substitutes</div>
          ${subs.map(renderPlayer).join('') || '<div class="text-muted text-sm" style="padding:4px 0;">—</div>'}
        </div>`;
    };

    // ── Key Players (handles array OR object keyed by teamId) ─────────────
    const keyPlayersHtml = (teamId) => {
      const players = this._parseKeyPlayers(match.keyPlayers, teamId);
      if (!players.length) return '<div class="text-muted text-sm">No data.</div>';
      return players.map(p => `
        <div class="player-card">
          <div class="player-name">${p.name}</div>
          <div class="player-highlight">${p.highlights || p.highlight || ''}</div>
        </div>`).join('');
    };

    // ── Tactical Analysis (handles {teamId:{}} OR flat {strengths:{teamId:''}}) ─
    const hAnalysis = this._parseTactical(match.tacticalAnalysis, hId);
    const aAnalysis = this._parseTactical(match.tacticalAnalysis, aId);

    // ── Phases of Play (handles nested inPossession OR flat) ──────────────
    const hPhaseIn = this._parsePhases(match.phasesOfPlay, hId);
    const aPhaseIn = this._parsePhases(match.phasesOfPlay, aId);

    el.innerHTML = `
      <div class="match-header">
        <div class="stage">
          FIFA World Cup 2026 · Group ${match.group} · Match ${match.matchNumber || ''} · ${match.date}
        </div>
        <div class="teams-row">
          <div class="team left">${hTeam.emoji} ${hTeam.name}</div>
          <div class="score">${hScore} – ${aScore}</div>
          <div class="team right">${aTeam.name} ${aTeam.emoji}</div>
        </div>
        <div class="venue">${match.venue || ''} · ${match.kickOff || ''} KO</div>
        <div style="margin-top:10px;opacity:0.8;font-size:12px;">
          <span style="background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:4px;margin:3px;">${hForm}</span>
          <span style="opacity:0.5;font-size:11px;">vs</span>
          <span style="background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:4px;margin:3px;">${aForm}</span>
        </div>
      </div>

      <div class="grid-2 gap-28">
        <div>
          <div class="card">
            <div class="section-title gap-12">Key Stats</div>
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:8px;">
              <span style="color:var(--primary);">${hTeam.name}</span>
              <span style="color:var(--accent);">${aTeam.name}</span>
            </div>
            ${statRows}
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="section-title gap-12">Goalkeeping</div>
            <div class="mini-table">
              <div class="mini-row"><span>Shots on goal faced</span><strong>${gkH.attemptsOnGoalFaced || 0} vs ${gkA.attemptsOnGoalFaced || 0}</strong></div>
              <div class="mini-row"><span>Goals conceded</span><strong>${gkH.goalsConceded || 0} vs ${gkA.goalsConceded || 0}</strong></div>
              <div class="mini-row"><span>Save %</span><strong>${gkH.savePercent != null ? gkH.savePercent + '%' : '-'} vs ${gkA.savePercent != null ? gkA.savePercent + '%' : '-'}</strong></div>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="section-title gap-12">Goals</div>
            <div class="goals-list">${goalsHtml || '<div class="text-muted text-sm">No goals data.</div>'}</div>
          </div>

          ${(hPhaseIn || aPhaseIn) ? `
          <div class="card" style="margin-top:14px;">
            <div class="section-title gap-12">Phases of Play — In Possession</div>
            <div class="grid-2">
              ${hPhaseIn ? `<div>
                <div style="font-size:11px;color:var(--primary);font-weight:600;text-align:center;margin-bottom:6px;">${hTeam.name}</div>
                <div class="chart-wrap-sm"><canvas id="phaseHome"></canvas></div>
              </div>` : ''}
              ${aPhaseIn ? `<div>
                <div style="font-size:11px;color:var(--accent);font-weight:600;text-align:center;margin-bottom:6px;">${aTeam.name}</div>
                <div class="chart-wrap-sm"><canvas id="phaseAway"></canvas></div>
              </div>` : ''}
            </div>
          </div>` : ''}
        </div>
      </div>

      <div class="card gap-28">
        <div class="section-title gap-12">Defensive Pressure & Recoveries</div>
        <div class="chart-wrap"><canvas id="defChart"></canvas></div>
        <div class="mini-table" style="margin-top:12px;">
          <div class="mini-row"><span>Ball recovery time (s)</span><strong>${defH.ballRecoveryTimeSeconds || '-'} vs ${defA.ballRecoveryTimeSeconds || '-'}</strong></div>
          <div class="mini-row"><span>Possession regains</span><strong>${defH.possessionRegains || 0} vs ${defA.possessionRegains || 0}</strong></div>
          <div class="mini-row"><span>Interceptions</span><strong>${defH.interceptions || 0} vs ${defA.interceptions || 0}</strong></div>
        </div>
      </div>

      <div class="grid-2 gap-28">
        <div class="card">
          <div class="section-title gap-12">Lineups — ${hTeam.name}</div>
          ${lineupHtml(hId)}
        </div>
        <div class="card">
          <div class="section-title gap-12">Lineups — ${aTeam.name}</div>
          ${lineupHtml(aId)}
        </div>
      </div>

      <div class="grid-2 gap-28">
        ${this.renderMiniTable(`${hTeam.name} — Physical Leaders`, this._physicalLeaders(match.playerPhysical, hId))}
        ${this.renderMiniTable(`${aTeam.name} — Physical Leaders`, this._physicalLeaders(match.playerPhysical, aId))}
      </div>

      <div class="grid-2 gap-28">
        ${this.renderMiniTable(`${hTeam.name} — In Possession Leaders`, this._possessionLeaders(match.playerInPossession, hId))}
        ${this.renderMiniTable(`${aTeam.name} — In Possession Leaders`, this._possessionLeaders(match.playerInPossession, aId))}
      </div>

      <div class="grid-2 gap-28">
        <div class="gap-28">
          <div class="section-title gap-12">Key Players — ${hTeam.name}</div>
          <div class="player-grid">${keyPlayersHtml(hId)}</div>
        </div>
        <div class="gap-28">
          <div class="section-title gap-12">Key Players — ${aTeam.name}</div>
          <div class="player-grid">${keyPlayersHtml(aId)}</div>
        </div>
      </div>

      <div class="card gap-28">
        <div class="section-title gap-12">Tactical Analysis</div>
        <div class="grid-2">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:8px;">${hTeam.emoji} ${hTeam.name}</div>
            <div class="analysis-box" style="margin-bottom:12px;">${hAnalysis.summary || ''}</div>
            <div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:5px;">✓ Strengths</div>
            ${(hAnalysis.strengths || []).map(s => `<div class="strength-item">${s}</div>`).join('')}
            <div style="font-size:11px;font-weight:600;color:var(--accent);margin:10px 0 5px;">△ Weaknesses</div>
            ${(hAnalysis.weaknesses || []).map(s => `<div class="weakness-item">${s}</div>`).join('')}
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;">${aTeam.emoji} ${aTeam.name}</div>
            <div class="analysis-box" style="margin-bottom:12px;">${aAnalysis.summary || ''}</div>
            <div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:5px;">✓ Strengths</div>
            ${(aAnalysis.strengths || []).map(s => `<div class="strength-item">${s}</div>`).join('')}
            <div style="font-size:11px;font-weight:600;color:var(--accent);margin:10px 0 5px;">△ Weaknesses</div>
            ${(aAnalysis.weaknesses || []).map(s => `<div class="weakness-item">${s}</div>`).join('')}
          </div>
        </div>
      </div>

      ${this._renderShotsSection(match.shotsDetail, hId, aId, hTeam, aTeam)}
      ${this._renderLineHeightsSection(match.lineHeights, hId, aId, hTeam, aTeam)}
      ${this._renderSetPlaysSection(match.setPlays, hId, aId, hTeam, aTeam)}
      ${this._renderCrossesSection(match.crossesDetail, hId, aId, hTeam, aTeam)}
      ${this._renderOfferingSection(match.offeringToReceive, hId, aId, hTeam, aTeam)}

      <div class="grid-2 gap-28">
        ${this._renderPlayerPhysicalFull(match.playerPhysical, hId, hTeam.name, hTeam.emoji, 'var(--primary)')}
        ${this._renderPlayerPhysicalFull(match.playerPhysical, aId, aTeam.name, aTeam.emoji, 'var(--accent)')}
      </div>

      <div class="grid-2 gap-28">
        ${this._renderPlayerInPossessionFull(match.playerInPossession, hId, hTeam.name, hTeam.emoji, 'var(--primary)')}
        ${this._renderPlayerInPossessionFull(match.playerInPossession, aId, aTeam.name, aTeam.emoji, 'var(--accent)')}
      </div>

      <div class="grid-2 gap-28">
        ${this._renderPlayerDefFull(match.playerOutOfPossession, hId, hTeam.name, hTeam.emoji, 'var(--primary)')}
        ${this._renderPlayerDefFull(match.playerOutOfPossession, aId, aTeam.name, aTeam.emoji, 'var(--accent)')}
      </div>
    `;

    setTimeout(() => {
      if (hPhaseIn) renderPhasesDonut('phaseHome', hPhaseIn, 'home');
      if (aPhaseIn) renderPhasesDonut('phaseAway', aPhaseIn, 'away');
      renderDefenseBar('defChart',
        [hS.defensivePressures||0, hS.directPressures||0, hS.forcedTurnovers||0, hS.secondBalls||0, defH.tackles||0],
        [aS.defensivePressures||0, aS.directPressures||0, aS.forcedTurnovers||0, aS.secondBalls||0, defA.tackles||0]
      );
    }, 80);
  },

  // ─── TEAM PAGE ────────────────────────────────────────────────────────────
  async renderTeam(id) {
    const team = await this.loadTeam(id);
    const idx  = await this.loadIndex();
    const el   = document.getElementById('content');
    if (!team) { el.innerHTML = `<p class="error-msg">Team not found: ${id}</p>`; return; }

    const s = team.stats || {};

    const matchHistoryHtml = (await Promise.all((team.matches || []).map(async entry => {
      const mId = entry.matchId;
      const opp = idx.teams.find(t => t.id === entry.opponent) || { name: entry.opponent, emoji: '' };
      const res = entry.result === 'W' ? 'win' : entry.result === 'L' ? 'loss' : 'draw';
      return `
        <a class="card-sm" href="#/match/${mId}"
           style="display:block;text-decoration:none;color:inherit;margin-bottom:8px;">
          <div class="flex-between">
            <span style="font-size:12px;color:var(--text-muted);">${mId.slice(0,10)}</span>
            <span class="badge badge-${res}">${res.toUpperCase()}</span>
          </div>
          <div style="display:flex;align-items:center;margin-top:6px;gap:10px;">
            <span style="font-size:15px;font-weight:600;">${entry.score}</span>
            <span style="font-size:13px;">vs ${opp.emoji} ${opp.name}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--text-faint);">xG: ${entry.xG}</span>
          </div>
        </a>`;
    }))).join('');

    const miniRows = (defs) => defs
      .filter(([, v]) => v != null && v !== '—')
      .map(([l, v]) => `<div class="mini-row"><span>${l}</span><strong>${v}</strong></div>`)
      .join('');

    const attackRows = miniRows([
      ['xG / xGA',             `${s.totalXG||0} / ${s.xGAgainst||0}`],
      ['Shots / On Target',    s.totalShots != null ? `${s.totalShots} / ${s.shotsOnTarget||0}` : '—'],
      ['Shot Accuracy',        s.shotAccuracy != null ? s.shotAccuracy + '%' : '—'],
      ['Goals (Open / Set)',   s.goalsScoredOpenPlay != null ? `${s.goalsScoredOpenPlay} / ${s.goalsScoredFromSet||0}` : '—'],
      ['Completed Line Breaks',s.completedLineBreaks || '—'],
      ['Ball Progressions',    s.avgBallProgressions || '—'],
      ['Receptions — Final 3rd',s.avgReceptionsInFinalThird || '—'],
      ['Crosses (Att / Cmp)',  s.crossesAttempted != null ? `${s.crossesAttempted} / ${s.crossesCompleted||0}` : '—'],
    ]);

    const possRows = miniRows([
      ['Avg Possession',       (s.avgPossession || 0) + '%'],
      ['Pass Accuracy',        (s.avgPassCompletion || 0) + '%'],
      ['Passes (Cmp / Att)',   s.avgTotalPasses ? `${s.avgCompletedPasses||0} / ${s.avgTotalPasses}` : '—'],
      ['2nd Balls Won',        s.avgSecondBalls || '—'],
    ]);

    const defRows = miniRows([
      ['Pressures',            s.avgPressures || '—'],
      ['Direct Pressures',     s.avgDirectPressures || '—'],
      ['Forced Turnovers',     s.avgForcedTurnovers || '—'],
      ['Possession Regains',   s.avgPossessionRegains || '—'],
      ['Ball Recovery (s)',    s.avgBallRecoverySeconds || '—'],
      ['Pressure Duration (s)',s.avgPressureDuration_s || '—'],
      ['Tackles',              s.avgTackles || '—'],
      ['Blocks',               s.avgBlocks || '—'],
      ['Interceptions',        s.avgInterceptions || '—'],
      ['Aerial Duels',         s.avgAerialDuels || '—'],
    ]);

    const physRows = miniRows([
      ['Avg Distance (km)',    s.avgTotalDistance_km || '—'],
      ['Zone 4+ Distance (km)',s.avgZone4Distance_km || '—'],
      ['Top Speed (km/h)',     s.topSpeedKmh ? `${s.topSpeedKmh} — ${s.topSpeedPlayer||''}` : '—'],
    ]);

    const gkRows = miniRows([
      ['GK Save %',            s.gkSavePercent != null ? s.gkSavePercent + '%' : '—'],
      ['Shots on Goal Faced',  s.gkAttemptsOnGoalFaced || '—'],
      ['Clean Sheets',         s.cleanSheets != null ? s.cleanSheets : '—'],
    ]);

    const squadHtml = (team.squad || []).map(p => `
      <div class="mini-row">
        <span>#${p.number} ${p.name}</span>
        <strong>${p.position}</strong>
      </div>`).join('');

    el.innerHTML = `
      <div class="team-header">
        <div class="team-emoji">${team.emoji || ''}</div>
        <div>
          <h1>${team.name}</h1>
          <div class="sub">Group ${team.group} · Coach: ${team.coach || '—'} · Formation: ${team.formation || '—'}</div>
        </div>
      </div>

      <div class="grid-4 gap-28">
        <div class="metric-card">
          <div class="label">Record</div>
          <div class="value">${s.wins||0}–${s.draws||0}–${s.losses||0}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${s.points||0} pts · ${s.matchesPlayed||0} played</div>
        </div>
        <div class="metric-card">
          <div class="label">Goals For / Against</div>
          <div class="value">${s.goalsFor||0} / ${s.goalsAgainst||0}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">xG ${s.totalXG||0} / xGA ${s.xGAgainst||0}</div>
        </div>
        <div class="metric-card">
          <div class="label">Avg Possession</div>
          <div class="value">${s.avgPossession||0}%</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Pass acc. ${s.avgPassCompletion||0}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Pressures / Regains</div>
          <div class="value">${s.avgPressures||'—'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Regains: ${s.avgPossessionRegains||'—'}</div>
        </div>
      </div>

      <div class="grid-2 gap-28">
        <div>
          <div class="card">
            <div class="section-title gap-12">⚔️ Attack</div>
            <div class="mini-table">${attackRows || '<div class="text-muted text-sm">—</div>'}</div>
            <div class="section-title gap-12" style="margin-top:16px;">🏃 Possession</div>
            <div class="mini-table">${possRows || '<div class="text-muted text-sm">—</div>'}</div>
          </div>
          <div class="card" style="margin-top:14px;">
            <div class="section-title gap-12">🛡 Defense</div>
            <div class="mini-table">${defRows || '<div class="text-muted text-sm">—</div>'}</div>
          </div>
          <div class="card" style="margin-top:14px;">
            <div class="section-title gap-12">💨 Physical</div>
            <div class="mini-table">${physRows || '<div class="text-muted text-sm">—</div>'}</div>
            <div class="section-title gap-12" style="margin-top:16px;">🧤 Goalkeeper</div>
            <div class="mini-table">${gkRows || '<div class="text-muted text-sm">—</div>'}</div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="section-title gap-12">Style Radar</div>
            <div class="chart-wrap-sm"><canvas id="teamRadar"></canvas></div>
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="section-title gap-12">Match History</div>
            ${matchHistoryHtml || '<div class="text-muted text-sm">No matches yet.</div>'}
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="section-title gap-12">Squad (${(team.squad||[]).length} players)</div>
            <div class="mini-table">${squadHtml}</div>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const norm = (v, max) => Math.min(100, Math.round(((v||0) / max) * 100));
      renderStyleRadar('teamRadar',
        [
          norm(s.avgPossession, 70),
          norm(s.totalXG, 3),
          norm(s.avgPassCompletion, 95),
          norm(s.completedLineBreaks, 120),
          norm(s.avgPressures, 350),
          norm(s.avgTotalDistance_km, 115)
        ],
        [50, 50, 50, 50, 50, 50],
        team.name, 'League Avg',
        [
          s.avgPossession    || 0,
          s.totalXG          || 0,
          s.avgPassCompletion|| 0,
          s.completedLineBreaks || 0,
          s.avgPressures     || 0,
          s.avgTotalDistance_km || 0
        ]
      );
    }, 80);
  },

  // ─── PREDICTIONS ──────────────────────────────────────────────────────────
  async renderPredictions() {
    const idx = await this.loadIndex();
    const el  = document.getElementById('content');
    const upcoming = idx.upcomingMatches || [];

    if (!upcoming.length) {
      el.innerHTML = `
        <div class="page-title">Predictions</div>
        <div class="card" style="text-align:center;padding:48px 20px;">
          <div style="font-size:32px;margin-bottom:12px;">📋</div>
          <div style="font-weight:500;margin-bottom:6px;">No predictions yet</div>
          <div class="text-muted text-sm">Add upcoming matches to <code>data/index.json</code></div>
        </div>`;
      return;
    }

    const cards = await Promise.all(upcoming.map(async m => {
      let pred = null;
      try {
        const r = await fetch(`data/predictions/${m.home}-${m.away}.json?v=${Date.now()}`);
        if (r.ok) pred = await r.json();
      } catch {}
      return `
        <div class="card">
          <div class="text-muted text-sm gap-12">${m.date} · Group ${m.group}</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:14px;">${m.home} vs ${m.away}</div>
          ${pred ? this._renderPredictionBlock(pred) : '<div class="text-muted text-sm">No prediction file found yet.</div>'}
        </div>`;
    }));

    el.innerHTML = `<div class="page-title">Predictions</div><div class="grid-2">${cards.join('')}</div>`;
  },

  _renderPredictionBlock(p) {
    if (!p) return '';
    const confMap = { low: 25, medium: 55, high: 85 };
    const conf = confMap[p.confidence] || 50;
    return `
      <div class="predict-card gap-12">
        <div class="predict-label">Prediction</div>
        <div class="predict-score">${p.predictedScore?.home ?? '?'} – ${p.predictedScore?.away ?? '?'}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Confidence: <strong>${p.confidence}</strong></div>
        <div class="confidence-bar"><div class="fill" style="width:${conf}%"></div></div>
        ${p.tacticalPrediction ? `<div class="analysis-box" style="margin-top:12px;font-size:12px;">${p.tacticalPrediction}</div>` : ''}
        ${(p.keyMatchups||[]).length ? `
          <div style="margin-top:10px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:5px;">Key Matchups</div>
            ${p.keyMatchups.map(k => `<div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">· ${k}</div>`).join('')}
          </div>` : ''}
      </div>`;
  },

  async init() {
    await this.loadIndex();
    window.addEventListener('hashchange', () => this.handleRoute());
    await this.handleRoute();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
