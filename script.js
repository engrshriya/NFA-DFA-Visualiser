/* ============================================================
   AutomataLearn — NFA to DFA Converter
   Beautiful SVG Graph Rendering (no drag)
   ============================================================ */

let nfa = { states: [], alphabet: [], start: '', accept: new Set(), delta: {} };
let dfa = { states: [], alphabet: [], start: '', accept: new Set(), delta: {}, stateMap: {} };
let dfaComputed = false;

// ── Presets ───────────────────────────────────────────────────
const PRESETS = {
  strings_ending_1: {
    states: 'q0,q1', alphabet: '0,1', accept: 'q1',
    transitions: { 'q0': { '0': 'q0', '1': 'q0,q1' }, 'q1': { '0': '', '1': '' } }
  },
  contains_ab: {
    states: 'q0,q1,q2', alphabet: 'a,b', accept: 'q2',
    transitions: { 'q0': { 'a': 'q0,q1', 'b': 'q0' }, 'q1': { 'a': '', 'b': 'q2' }, 'q2': { 'a': 'q2', 'b': 'q2' } }
  },
  epsilon: {
    states: 'q0,q1,q2', alphabet: 'a,b', accept: 'q2',
    transitions: { 'q0': { 'a': 'q1', 'b': '', 'ε': 'q2' }, 'q1': { 'a': '', 'b': 'q2', 'ε': '' }, 'q2': { 'a': '', 'b': '', 'ε': '' } }
  }
};

function loadPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  document.getElementById('statesInput').value = p.states;
  document.getElementById('alphabetInput').value = p.alphabet;
  document.getElementById('acceptInput').value = p.accept;
  buildTransitionGrid(p.transitions);
  readNFA();
  renderNFASVG();
}

// ── Transition Grid ───────────────────────────────────────────
function buildTransitionGrid(prefill = null) {
  const states = parseCSV(document.getElementById('statesInput').value);
  const alpha  = parseCSV(document.getElementById('alphabetInput').value);
  const cont   = document.getElementById('transitionInputs');
  cont.innerHTML = '';
  if (!states.length || !alpha.length) return;

  const hdr = document.createElement('div');
  hdr.className = 't-header';
  hdr.style.gridTemplateColumns = `90px repeat(${alpha.length}, 1fr)`;
  hdr.innerHTML = `<span>State \\ In</span>` + alpha.map(a => `<span>${a}</span>`).join('');
  cont.appendChild(hdr);

  states.forEach(state => {
    const row = document.createElement('div');
    row.className = 't-row';
    row.style.gridTemplateColumns = `90px repeat(${alpha.length}, 1fr)`;
    const lbl = document.createElement('label');
    lbl.textContent = state;
    row.appendChild(lbl);
    alpha.forEach(sym => {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.dataset.state = state; inp.dataset.sym = sym; inp.placeholder = '∅';
      if (prefill && prefill[state] && prefill[state][sym] !== undefined) inp.value = prefill[state][sym];
      inp.addEventListener('input', () => { readNFA(); renderNFASVG(); });
      row.appendChild(inp);
    });
    cont.appendChild(row);
  });
}

function parseCSV(str) { return str.split(',').map(s => s.trim()).filter(Boolean); }

function readNFA() {
  const states  = parseCSV(document.getElementById('statesInput').value);
  const alpha   = parseCSV(document.getElementById('alphabetInput').value);
  const accepts = new Set(parseCSV(document.getElementById('acceptInput').value));
  const delta   = {};
  states.forEach(s => { delta[s] = {}; alpha.forEach(a => { delta[s][a] = new Set(); }); });
  document.querySelectorAll('#transitionInputs input').forEach(inp => {
    const s = inp.dataset.state, sym = inp.dataset.sym;
    if (!delta[s]) delta[s] = {};
    if (!delta[s][sym]) delta[s][sym] = new Set();
    parseCSV(inp.value).forEach(t => { if (states.includes(t)) delta[s][sym].add(t); });
  });
  nfa = { states, alphabet: alpha, start: states[0] || '', accept: accepts, delta };
}

// ── Epsilon closure & move ────────────────────────────────────
function epsilonClosure(stateSet) {
  if (!nfa.alphabet.includes('ε')) return new Set(stateSet);
  const closure = new Set(stateSet), stack = [...stateSet];
  while (stack.length) {
    const s   = stack.pop();
    const eps = nfa.delta[s]?.['ε'] ?? new Set();
    eps.forEach(t => { if (!closure.has(t)) { closure.add(t); stack.push(t); } });
  }
  return closure;
}

function move(stateSet, sym) {
  const result = new Set();
  stateSet.forEach(s => { nfa.delta[s]?.[sym]?.forEach(t => result.add(t)); });
  return result;
}

// ── Subset Construction ───────────────────────────────────────
function subsetConstruction() {
  const realAlpha  = nfa.alphabet.filter(a => a !== 'ε');
  const startSet   = epsilonClosure(new Set([nfa.start]));
  const startLabel = setLabel(startSet);
  const stateMap   = { [startLabel]: [...startSet].sort() };
  const queue      = [startSet];
  const visited    = new Set([startLabel]);
  const dfaDelta   = {};
  const workLog    = [];

  while (queue.length) {
    const current  = queue.shift();
    const curLabel = setLabel(current);
    dfaDelta[curLabel] = {};
    realAlpha.forEach(sym => {
      const moved     = move(current, sym);
      const closed    = epsilonClosure(moved);
      const nextLabel = setLabel(closed);
      dfaDelta[curLabel][sym] = nextLabel;
      workLog.push({ from: curLabel, sym, to: nextLabel, moved: [...moved].sort(), closed: [...closed].sort() });
      if (!visited.has(nextLabel)) {
        visited.add(nextLabel);
        stateMap[nextLabel] = [...closed].sort();
        queue.push(closed);
      }
    });
  }

  const dfaAccept = new Set();
  Object.keys(stateMap).forEach(label => {
    if (stateMap[label].some(s => nfa.accept.has(s))) dfaAccept.add(label);
  });

  dfa = { states: Object.keys(stateMap), alphabet: realAlpha, start: startLabel, accept: dfaAccept, delta: dfaDelta, stateMap };
  return workLog;
}

function setLabel(stateSet) {
  const arr = [...stateSet].sort();
  return arr.length === 0 ? '∅' : '{' + arr.join(',') + '}';
}

// ── Main Conversion ───────────────────────────────────────────
function runConversion() {
  readNFA(); buildTransitionGrid(); readNFA();
  if (!nfa.states.length) { alert('Please add states!'); return; }
  const workLog = subsetConstruction();
  dfaComputed = true;
  renderStep1(); renderStep2(); renderStep3(workLog); renderStep4();
  ['step1','step2','step3','step4'].forEach(id => document.getElementById(id).classList.add('active'));
  document.getElementById('steps').scrollIntoView({ behavior: 'smooth' });
}

// ══════════════════════════════════════════════════════════════
//   BEAUTIFUL SVG GRAPH ENGINE
// ══════════════════════════════════════════════════════════════

/* Node layout — evenly around a circle, or linear for small sets */
function computeLayout(states, W, H) {
  const n  = states.length;
  const cx = W / 2, cy = H / 2;

  if (n === 1) return [{ label: states[0], x: cx, y: cy }];
  if (n === 2) return [
    { label: states[0], x: cx - W * 0.26, y: cy },
    { label: states[1], x: cx + W * 0.26, y: cy }
  ];
  if (n === 3) {
    const r = Math.min(W, H) * 0.30;
    return states.map((s, i) => {
      const angle = (2 * Math.PI * i / 3) - Math.PI / 2;
      return { label: s, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }

  const r = Math.min(W * 0.37, H * 0.37);
  return states.map((s, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    return { label: s, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

/* Merge parallel edges (same src+dst, different symbols) */
function collectEdgesNFA(states, alphabet, delta) {
  const map = {};
  states.forEach(s => {
    alphabet.forEach(a => {
      const targets = delta[s]?.[a];
      if (!targets) return;
      [...targets].forEach(t => {
        const key = `${s}|||${t}`;
        if (!map[key]) map[key] = { from: s, to: t, labels: [] };
        map[key].labels.push(a);
      });
    });
  });
  return Object.values(map);
}

function collectEdgesDFA(states, alphabet, delta) {
  const map = {};
  states.forEach(s => {
    alphabet.forEach(a => {
      const t = delta[s]?.[a];
      if (!t) return;
      const key = `${s}|||${t}`;
      if (!map[key]) map[key] = { from: s, to: t, labels: [] };
      map[key].labels.push(a);
    });
  });
  return Object.values(map);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── SVG: full NFA render ──────────────────────────────────────
function renderNFASVG() {
  if (!nfa.states.length) return;
  const W = 520, H = 340, R = 30;
  const nodes   = computeLayout(nfa.states, W, H);
  const nodeMap = Object.fromEntries(nodes.map(n => [n.label, n]));
  const edges   = collectEdgesNFA(nfa.states, nfa.alphabet, nfa.delta);
  // index of reverse edges for curvature decision
  const reverseSet = new Set(edges.filter(e => edges.some(f => f.from === e.to && f.to === e.from)).map(e => `${e.from}|||${e.to}`));

  const svg = [
    svgOpen(W, H),
    svgDefs(W, H, 'nfa', '#6366f1', '#8b5cf6', '#7c3aed', '#f59e0b'),
    svgBackground(W, H),
    ...edges.map(e => svgEdge(e, nodeMap, R, reverseSet, 'nfa')),
    ...nodes.map(n => svgNode(n, R, n.label === nfa.start, nfa.accept.has(n.label), false, 'nfa')),
    '</svg>'
  ].join('\n');

  document.getElementById('nfaSVGContainer').innerHTML = svg;
}

// ── SVG: full DFA render ──────────────────────────────────────
function renderDFASVG() {
  const W = 680, H = 420;
  const n = dfa.states.length;
  const R = Math.max(22, Math.min(34, 110 / Math.max(n, 1)));
  const nodes   = computeLayout(dfa.states, W, H);
  const nodeMap = Object.fromEntries(nodes.map(nd => [nd.label, nd]));
  const edges   = collectEdgesDFA(dfa.states, dfa.alphabet, dfa.delta);
  const reverseSet = new Set(edges.filter(e => edges.some(f => f.from === e.to && f.to === e.from)).map(e => `${e.from}|||${e.to}`));

  const svg = [
    svgOpen(W, H),
    svgDefs(W, H, 'dfa', '#0891b2', '#06b6d4', '#0891b2', '#10b981'),
    svgBackground(W, H),
    ...edges.map(e => svgEdge(e, nodeMap, R, reverseSet, 'dfa')),
    ...nodes.map(nd => svgNode(nd, R, nd.label === dfa.start, dfa.accept.has(nd.label), nd.label === '∅', 'dfa')),
    '</svg>'
  ].join('\n');

  document.getElementById('dfaSVGContainer').innerHTML = svg;
}

// ── SVG primitives ────────────────────────────────────────────

function svgOpen(W, H) {
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;font-family:'JetBrains Mono',monospace;overflow:visible">`;
}

function svgDefs(W, H, id, edgeA, edgeB, nodeStroke, acceptStroke) {
  return `<defs>
    <marker id="ah-${id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${edgeA}"/>
    </marker>
    <marker id="ah-start-${id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#10b981"/>
    </marker>

    <radialGradient id="ng-${id}" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${id==='nfa'?'#c4b5fd':'#a5f3fc'}"/>
    </radialGradient>
    <radialGradient id="ag-${id}" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="100%" stop-color="${id==='nfa'?'#fde68a':'#a7f3d0'}"/>
    </radialGradient>
    <radialGradient id="dg-${id}" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fff1f2"/>
      <stop offset="100%" stop-color="#fecdd3"/>
    </radialGradient>

    <filter id="glow-${id}">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="aglow-${id}">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow-${id}">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="${nodeStroke}" flood-opacity="0.22"/>
    </filter>
    <filter id="lbl-shadow">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#1e1b4b" flood-opacity="0.12"/>
    </filter>

    <linearGradient id="eg-${id}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${edgeA}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${edgeB}" stop-opacity="0.95"/>
    </linearGradient>
  </defs>`;
}

function svgBackground(W, H) {
  let dots = '';
  for (let x = 20; x < W; x += 30)
    for (let y = 20; y < H; y += 30)
      dots += `<circle cx="${x}" cy="${y}" r="1.2" fill="#6366f1" opacity="0.06"/>`;
  return `<g>${dots}</g>`;
}

function svgNode(node, R, isStart, isAccept, isDead, id) {
  const { x, y, label } = node;
  const strokeColor = isDead ? '#ef4444' : isAccept ? (id==='nfa'?'#d97706':'#059669') : (id==='nfa'?'#7c3aed':'#0891b2');
  const gradId = isDead ? `dg-${id}` : isAccept ? `ag-${id}` : `ng-${id}`;
  const glowId = isAccept ? `aglow-${id}` : `glow-${id}`;
  const fontSize = label.length > 8 ? 8 : label.length > 5 ? 9 : label.length > 3 ? 11 : 13;

  let out = '';

  // Start entry arrow
  if (isStart) {
    const arrowLen = 50;
    out += `
      <line x1="${x - R - arrowLen}" y1="${y}" x2="${x - R - 1}" y2="${y}"
        stroke="#10b981" stroke-width="2.5" marker-end="url(#ah-start-${id})"/>
      <text x="${x - R - arrowLen * 0.5}" y="${y - 9}"
        text-anchor="middle" font-size="9" font-weight="800" fill="#10b981" opacity="0.85">start</text>`;
  }

  // Accept: glowing dashed outer ring
  if (isAccept) {
    out += `
      <circle cx="${x}" cy="${y}" r="${R + 9}" fill="none"
        stroke="${id==='nfa'?'#f59e0b':'#10b981'}" stroke-width="2.2"
        stroke-dasharray="6 3" opacity="0.7" filter="url(#aglow-${id})"/>
      <circle cx="${x}" cy="${y}" r="${R + 5}" fill="none"
        stroke="${id==='nfa'?'#fbbf24':'#34d399'}" stroke-width="1.8" opacity="0.85"/>`;
  }

  // Drop shadow disc
  out += `<circle cx="${x}" cy="${y+4}" r="${R}" fill="rgba(0,0,0,0.10)"/>`;

  // Main circle
  out += `
    <circle cx="${x}" cy="${y}" r="${R}"
      fill="url(#${gradId})"
      stroke="${strokeColor}" stroke-width="2.8"
      filter="url(#shadow-${id})"/>`;

  // Specular highlight
  out += `<ellipse cx="${x - R*0.22}" cy="${y - R*0.28}" rx="${R*0.38}" ry="${R*0.22}" fill="white" opacity="0.55"/>`;

  // Label text
  out += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
    font-size="${fontSize}" font-weight="800" fill="${strokeColor}" filter="url(#lbl-shadow)">${esc(label)}</text>`;

  return out;
}

function svgEdge(edge, nodeMap, R, reverseSet, id) {
  const { from, to, labels } = edge;
  const src = nodeMap[from], dst = nodeMap[to];
  if (!src || !dst) return '';
  const label = labels.join(', ');
  const edgeColor = id === 'nfa' ? '#818cf8' : '#22d3ee';
  const arrowColor = id === 'nfa' ? '#6366f1' : '#0891b2';

  if (from === to) return svgSelfLoop(src, R, label, id, arrowColor, edgeColor);

  const dx = dst.x - src.x, dy = dst.y - src.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const ux = dx/dist, uy = dy/dist;
  const nx = -uy, ny = ux; // normal

  // If a reverse edge exists, curve outward; else subtle curve
  const hasRev = reverseSet.has(`${from}|||${to}`) && reverseSet.has(`${to}|||${from}`);
  const curveAmt = hasRev ? 60 : 24;

  const sx = src.x + ux * (R + 1),     sy = src.y + uy * (R + 1);
  const ex = dst.x - ux * (R + 3),     ey = dst.y - uy * (R + 3);
  const qx = (sx + ex)/2 + nx * curveAmt, qy = (sy + ey)/2 + ny * curveAmt;

  // Label midpoint on quadratic bezier at t=0.5
  const lx = 0.25*sx + 0.5*qx + 0.25*ex;
  const ly = 0.25*sy + 0.5*qy + 0.25*ey;

  const labelW = label.length * 7.5 + 14;
  const out = `
    <path d="M${sx},${sy} Q${qx},${qy} ${ex},${ey}"
      fill="none" stroke="url(#eg-${id})" stroke-width="2.2" stroke-linecap="round"
      marker-end="url(#ah-${id})"/>
    <rect x="${lx - labelW/2}" y="${ly - 10}" width="${labelW}" height="19" rx="6"
      fill="white" stroke="${edgeColor}" stroke-width="1.4" opacity="0.96" filter="url(#lbl-shadow)"/>
    <text x="${lx}" y="${ly + 4}" text-anchor="middle"
      font-size="11" font-weight="800" fill="${arrowColor}">${esc(label)}</text>`;
  return out;
}

function svgSelfLoop(node, R, label, id, arrowColor, edgeColor) {
  const { x, y } = node;
  const loopH = 42, loopW = 30;
  const p1x = x - R * 0.55, p1y = y - R * 0.84;
  const p2x = x + R * 0.55, p2y = y - R * 0.84;
  const c1x = x - loopW, c1y = y - R - loopH;
  const c2x = x + loopW, c2y = y - R - loopH;
  const lx = x, ly = y - R - loopH * 0.62;
  const labelW = label.length * 7.5 + 14;

  return `
    <path d="M${p1x},${p1y} C${c1x},${c1y} ${c2x},${c2y} ${p2x},${p2y}"
      fill="none" stroke="url(#eg-${id})" stroke-width="2.2" stroke-linecap="round"
      marker-end="url(#ah-${id})"/>
    <rect x="${lx - labelW/2}" y="${ly - 10}" width="${labelW}" height="19" rx="6"
      fill="white" stroke="${edgeColor}" stroke-width="1.4" opacity="0.96" filter="url(#lbl-shadow)"/>
    <text x="${lx}" y="${ly + 4}" text-anchor="middle"
      font-size="11" font-weight="800" fill="${arrowColor}">${esc(label)}</text>`;
}

// ── Step Renderers ────────────────────────────────────────────
function renderStep1() {
  const c = document.getElementById('step1Content');
  c.style.display = 'block';
  document.querySelector('#step1 .step-placeholder').style.display = 'none';
  c.innerHTML = `
    <div class="math-def">
      <span class="math-line"><span class="label">NFA M</span> = (Q, Σ, δ, q₀, F)</span>
      <span class="math-line"><span class="label">Q</span>  = {${nfa.states.join(', ')}} — all states</span>
      <span class="math-line"><span class="label">Σ</span>  = {${nfa.alphabet.join(', ')}} — input alphabet</span>
      <span class="math-line"><span class="label">q₀</span> = ${nfa.start} — start state</span>
      <span class="math-line"><span class="label">F</span>  = {${[...nfa.accept].join(', ')}} — accept states</span>
      <span class="math-line"><span class="label">δ</span>  : Q × Σ → 2<sup>Q</sup> — maps to a <em>set</em> of states</span>
    </div>
    <div class="math-note">🧠 <strong>Key insight:</strong> In an NFA, δ returns a <em>set</em> of possible next states (2<sup>Q</sup>). The machine can be in multiple states at once!</div>`;
}

function renderStep2() {
  const c = document.getElementById('step2Content');
  c.style.display = 'block';
  document.getElementById('step2ph').style.display = 'none';
  let html = `<div class="math-note" style="margin-bottom:1rem;">Each cell can have <strong>multiple target states</strong> or be empty (∅).</div>
    <div class="table-wrap"><table class="trans-table"><thead><tr><th>State</th>${nfa.alphabet.map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>`;
  nfa.states.forEach(s => {
    const iS = s === nfa.start, iA = nfa.accept.has(s);
    html += `<tr><td class="${iS?'start-state':''} ${iA?'accept-state-cell':''}">${iS?'→ ':''}${iA?'* ':''}${s}</td>`;
    nfa.alphabet.forEach(a => {
      const v = nfa.delta[s]?.[a] ? [...nfa.delta[s][a]].join(',') : '∅';
      html += `<td>${v||'∅'}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div><div class="table-note">→ = start state &nbsp;|&nbsp; * = accept state &nbsp;|&nbsp; ∅ = no transition</div>`;
  c.innerHTML = html;
}

function renderStep3(workLog) {
  const c = document.getElementById('step3Content');
  c.style.display = 'block';
  document.getElementById('step3ph').style.display = 'none';

  let stepsHtml = `<div class="subset-steps"><strong style="font-size:.9rem;color:var(--primary);">🔍 Subset Construction — each computation:</strong><br/><br/>`;
  const shown = new Set();
  workLog.forEach((entry, i) => {
    const key = `${entry.from}|${entry.sym}`;
    if (shown.has(key)) return;
    shown.add(key);
    const movedStr = entry.moved.length ? '{' + entry.moved.join(',') + '}' : '∅';
    const isEps = nfa.alphabet.includes('ε');
    stepsHtml += `<div class="subset-step new-row" style="animation-delay:${shown.size*0.04}s">
      <div class="ss-num">${shown.size}</div>
      <div class="ss-text">δ'(${entry.from}, ${entry.sym}) = ε-closure(move(${entry.from}, ${entry.sym}))${isEps?`<br/>= ε-closure(${movedStr}) = <strong>${entry.to}</strong>`:`<br/>= ${movedStr} = <strong>${entry.to}</strong>`}</div>
    </div>`;
  });
  stepsHtml += '</div>';

  let tbl = `<div class="math-note" style="margin-bottom:1rem;">Formula: <code style="background:#eef2ff;padding:2px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;">δ'(S,a) = ε-closure( ∪ δ(q,a) for q ∈ S )</code></div>
    ${stepsHtml}
    <div class="table-wrap" style="margin-top:1.5rem;"><table class="trans-table"><thead><tr><th>DFA State</th>${dfa.alphabet.map(a=>`<th>${a}</th>`).join('')}<th>Accept?</th></tr></thead><tbody>`;
  dfa.states.forEach((label, idx) => {
    const iS = label===dfa.start, iA = dfa.accept.has(label);
    tbl += `<tr class="new-row" style="animation-delay:${idx*0.06}s"><td class="${iS?'start-state':''} new-dfa-state">${iS?'→ ':''}${iA?'* ':''}${label}</td>`;
    dfa.alphabet.forEach(a => { tbl += `<td>${dfa.delta[label]?.[a]??'∅'}</td>`; });
    tbl += `<td>${iA?'✅ Yes':'❌ No'}</td></tr>`;
  });
  tbl += `</tbody></table></div><div class="table-note">∅ = dead/trap state. Accept if any included NFA state is an accept state.</div>`;
  c.innerHTML = tbl;
}

function renderStep4() {
  const c = document.getElementById('step4Content');
  c.style.display = 'block';
  document.getElementById('step4ph').style.display = 'none';
  document.getElementById('dfaSummary').innerHTML = `
    <strong>DFA M' = (Q', Σ, δ', q₀', F')</strong><br/>
    Q' = {${dfa.states.join(', ')}}<br/>
    Σ  = {${dfa.alphabet.join(', ')}}<br/>
    q₀' = ${dfa.start}<br/>
    F'  = {${[...dfa.accept].join(', ')||'∅'}}<br/><br/>
    ✅ This DFA recognises exactly the same language as the NFA!`;
  renderDFASVG();
}

// ── Test String ───────────────────────────────────────────────
function testString() {
  if (!dfaComputed) { alert('Please convert the NFA to DFA first!'); return; }
  const input   = document.getElementById('testString').value.trim();
  const resEl   = document.getElementById('testResult');
  const traceEl = document.getElementById('testTrace');
  let current   = dfa.start;
  const trace   = [`Start: ${current}`];

  for (const ch of input) {
    if (!dfa.alphabet.includes(ch)) {
      resEl.style.display = 'block'; resEl.className = 'test-result rejected';
      resEl.textContent = `❌ Symbol "${ch}" not in alphabet!`; traceEl.style.display = 'none'; return;
    }
    const next = dfa.delta[current]?.[ch] ?? '∅';
    trace.push(`Read '${ch}': ${current} → ${next}`);
    current = next;
  }

  const accepted = dfa.accept.has(current);
  resEl.style.display = 'block';
  resEl.className = 'test-result ' + (accepted ? 'accepted' : 'rejected');
  resEl.textContent = accepted
    ? `✅ "${input}" is ACCEPTED! (ended in accept state ${current})`
    : `❌ "${input}" is REJECTED. (ended in ${current}, not an accept state)`;
  traceEl.style.display = 'block';
  traceEl.innerHTML = `<strong style="color:#c7d2fe">Simulation trace:</strong><br/>` + trace.join('<br/>');
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadPreset('strings_ending_1');
});