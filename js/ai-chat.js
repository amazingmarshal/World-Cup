// WC2026 AI Chat Widget — openmodel.ai / deepseek-v4-flash
(function () {
  'use strict';

  const AI_KEY      = window.OPENROUTER_KEY;
  const AI_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
  const AI_MODEL    = 'deepseek/deepseek-v4-flash';

  let history  = [];   // [{role,content}]
  let isOpen   = false;
  let ctxCache = null;

  // ── Build tournament context from local JSON data ───────────────────────
  async function buildContext() {
    if (ctxCache) return ctxCache;
    try {
      const idx = await fetch('data/index.json').then(r => r.json());

      const teamLines = [];
      await Promise.all((idx.teams || []).map(async t => {
        try {
          const td = await fetch(`data/teams/${t.id}.json`).then(r => r.json());
          const s  = td.stats || {};
          if ((s.matchesPlayed || 0) > 0) {
            teamLines.push(
              `${td.emoji||''} ${td.name} (Grp ${td.group}): ` +
              `${s.wins||0}W${s.draws||0}D${s.losses||0}L ${s.points||0}pts | ` +
              `GF:${s.goalsFor||0} GA:${s.goalsAgainst||0} | ` +
              `xG:${s.totalXG||0}/xGA:${s.xGAgainst||0} | ` +
              `Poss:${s.avgPossession||0}% Pass:${s.avgPassCompletion||0}% | ` +
              `Shots:${s.totalShots||0}(${s.shotsOnTarget||0}OT) | ` +
              `Press:${s.avgPressures||0}/g FT:${s.avgForcedTurnovers||0} | ` +
              `GKsave:${s.gkSavePercent||0}% | Dist:${s.avgTotalDistance_km||0}km | ` +
              `Form:${td.formation||'?'} Coach:${td.coach||'?'} | ` +
              `Results:${(td.matches||[]).map(m=>`${m.opponent} ${m.score}(${m.result})`).join(', ')}`
            );
          }
        } catch { /* ignore missing team */ }
      }));

      const results = (idx.matches || [])
        .map(m => `Grp${m.group} MD${m.matchDay} ${m.date}: ${m.home} ${m.scoreHome}-${m.scoreAway} ${m.away}`)
        .join('\n');

      ctxCache = `=== FIFA WORLD CUP 2026 — LIVE DATA ===

TEAM STATS (teams with ≥1 match):
${teamLines.join('\n')}

ALL MATCH RESULTS:
${results}`;
    } catch {
      ctxCache = '=== FIFA WORLD CUP 2026 ===\n(Match data unavailable — answer from general knowledge)';
    }
    return ctxCache;
  }

  // ── Minimal markdown render ──────────────────────────────────────────────
  function fmt(t) {
    return t
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>')
      .replace(/^[-•] (.+)$/gm, '• $1')
      .replace(/\n\n+/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  // ── Append a chat bubble ─────────────────────────────────────────────────
  function bubble(role, html) {
    const wrap = document.getElementById('wc-chat-msgs');
    if (!wrap) return null;
    const el = document.createElement('div');
    el.className = `wc-bubble wc-bubble-${role}`;
    el.innerHTML = html;
    wrap.appendChild(el);
    wrap.scrollTop = wrap.scrollHeight;
    return el;
  }

  // ── Send a message ───────────────────────────────────────────────────────
  async function send(text) {
    text = text.trim();
    if (!text) return;

    const input = document.getElementById('wc-chat-input');
    const btn   = document.getElementById('wc-chat-send');
    if (input) input.value = '';
    setInputEnabled(false);

    bubble('user', fmt(text));
    history.push({ role: 'user', content: text });

    const ctx     = await buildContext();
    const sysMsg  = `You are WC2026 AI Analyst — a sharp, data-driven football analyst for the FIFA World Cup 2026. You have real tournament stats.

${ctx}

Rules:
- Always cite specific stats when making claims
- For predictions: give a confident scoreline + reasoning
- Keep answers under 200 words unless asked for more
- No hedging — users want clear opinions`;

    const aiBubble = bubble('assistant', '<span class="wc-typing">●●●</span>');

    try {
      const resp = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: AI_MODEL,
          stream: true,
          max_tokens: 500,
          messages: [
            { role: 'system', content: sysMsg },
            ...history.slice(-12)
          ]
        })
      });

      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error?.message || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      let full     = '';
      let buf      = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const ev = JSON.parse(raw);
            // OpenAI/OpenRouter streaming: choices[0].delta.content
            const delta = ev.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              if (aiBubble) aiBubble.innerHTML = fmt(full);
              document.getElementById('wc-chat-msgs').scrollTop = 99999;
            }
          } catch { /* partial chunk */ }
        }
      }

      if (!full && aiBubble) aiBubble.innerHTML = fmt('(no response)');
      history.push({ role: 'assistant', content: full });

    } catch (err) {
      if (aiBubble) aiBubble.innerHTML =
        `<span style="color:#d63b1f">⚠ ${err.message}</span>`;
    }

    setInputEnabled(true);
    input?.focus();
  }

  function setInputEnabled(on) {
    const input = document.getElementById('wc-chat-input');
    const btn   = document.getElementById('wc-chat-send');
    if (input) input.disabled = !on;
    if (btn)   btn.disabled   = !on;
  }

  // ── Open / close panel ───────────────────────────────────────────────────
  function toggle() {
    const panel = document.getElementById('wc-chat-panel');
    const fab   = document.getElementById('wc-chat-fab');
    if (!panel) return;
    isOpen = !isOpen;
    panel.classList.toggle('wc-open', isOpen);
    if (fab) fab.innerHTML = isOpen ? '✕' : '🤖';

    if (isOpen) {
      const msgs = document.getElementById('wc-chat-msgs');
      if (msgs && !msgs.children.length) {
        bubble('assistant',
          '👋 <strong>WC2026 AI Analyst</strong><br><br>' +
          'Ask me anything about the tournament:<br>' +
          '• <em>"Predict Germany vs Spain"</em><br>' +
          '• <em>"Who wins Group B?"</em><br>' +
          '• <em>"Analyze Canada\'s defense"</em><br>' +
          '• <em>"Best GK so far?"</em>');
      }
      setTimeout(() => document.getElementById('wc-chat-input')?.focus(), 150);
      buildContext(); // warm up
    }
  }

  // ── Wire up DOM ──────────────────────────────────────────────────────────
  function init() {
    document.getElementById('wc-chat-fab')
      ?.addEventListener('click', toggle);
    document.getElementById('wc-chat-close')
      ?.addEventListener('click', toggle);
    document.getElementById('wc-chat-send')
      ?.addEventListener('click', () =>
        send(document.getElementById('wc-chat-input')?.value || ''));
    document.getElementById('wc-chat-input')
      ?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value); }
      });
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();
})();
