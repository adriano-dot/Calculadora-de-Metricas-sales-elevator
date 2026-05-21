/* ═══════════════════════════════════════════════════════
   SALES ELEVATOR — app.js
   Dashboard de Performance Comercial
═══════════════════════════════════════════════════════ */

'use strict';

/* ── Estado global ── */
const STATE = {
  leads: 1000,
  taxaContato: 60,
  taxaQualif: 40,
  taxaConv: 25,
  ticket: 2500,
  ciclo: 30,
  churnMensal: 5,
  upsell: 15,
  vendedores: 5,
  metaVendedor: 10,
  cenario: 'realista',
  modoAvancado: false,
  chart: null,
  chartPeriod: 6,
  teamData: [],   // [{ nome, metaEdit, realEdit }] — dados editáveis da equipe
};

/* ── Nomes de vendedores (até 20) ── */
const TEAM_NAMES = [
  'Ana Paula', 'Bruno Costa', 'Carlos Lima', 'Diana Rocha', 'Eduardo Neves',
  'Fernanda Luz', 'Gabriel Torres', 'Helena Melo', 'Igor Dias', 'Juliana Reis',
  'Lucas Barros', 'Marina Cruz', 'Nicolas Faria', 'Olivia Santos', 'Pedro Viana',
  'Renata Gomes', 'Samuel Neto', 'Tatiana Lopes', 'Ulisses Pinto', 'Vera Alves',
];

const TEAM_MULT = [
  1.2, 0.9, 1.05, 1.15, 0.8, 1.1, 0.95, 1.25, 1.0, 0.85,
  1.18, 1.03, 0.92, 1.08, 0.97, 1.22, 1.0, 0.88, 1.13, 1.05,
];

/* ── Limites de validação ── */
const LIMITS = {
  leads:        { min: 1,   max: 1000000 },
  ticket:       { min: 1,   max: 10000000 },
  ciclo:        { min: 1,   max: 730 },
  vendedores:   { min: 1,   max: 20 },
  metaVendedor: { min: 1,   max: 500 },
  churnMensal:  { min: 0,   max: 100 },
  upsell:       { min: 0,   max: 200 },
};

/* ── LocalStorage ── */
const LS_KEY = 'se-dashboard-v2';

function saveState() {
  try {
    const { chart, ...rest } = STATE;
    localStorage.setItem(LS_KEY, JSON.stringify(rest));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const keys = ['leads','taxaContato','taxaQualif','taxaConv','ticket','ciclo',
                  'churnMensal','upsell','vendedores','metaVendedor','cenario',
                  'modoAvancado','chartPeriod','teamData'];
    keys.forEach(k => { if (saved[k] !== undefined) STATE[k] = saved[k]; });
  } catch (e) {}
}

/* ── Utilitários ── */
const fmt = (n, d = 0) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

const fmtBRL = n =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n, d = 1) => `${fmt(n, d)}%`;

const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

const safeDivide = (a, b) => (b > 0 ? a / b : 0);

const escHtml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── Cálculos de funil ── */
function calcFunnel() {
  const mult     = STATE.cenario === 'pessimista' ? 0.7 : STATE.cenario === 'otimista' ? 1.35 : 1;
  const contatos  = Math.round(STATE.leads * (STATE.taxaContato / 100) * mult);
  const qualif    = Math.round(contatos    * (STATE.taxaQualif   / 100));
  const propostas = Math.round(qualif      * 0.80);
  const fechados  = Math.round(propostas   * (STATE.taxaConv     / 100));
  const receita   = fechados * STATE.ticket;
  return { leads: STATE.leads, contatos, qualif, propostas, fechados, receita };
}

function calcProjection(months) {
  const f          = calcFunnel();
  const churnRate  = STATE.churnMensal / 100;
  const upsellRate = STATE.upsell / 100;
  const data       = [];
  let base         = f.receita;
  for (let m = 0; m < months; m++) {
    const growth = 1 + (upsellRate / 12) - churnRate;
    base = base * growth + f.receita * 0.05;
    data.push(Math.round(base));
  }
  return data;
}

function calcScore() {
  let s = 0;
  if (STATE.taxaContato >= 70) s += 20; else if (STATE.taxaContato >= 50) s += 12; else s += 5;
  if (STATE.taxaQualif  >= 50) s += 20; else if (STATE.taxaQualif  >= 35) s += 12; else s += 5;
  if (STATE.taxaConv    >= 30) s += 25; else if (STATE.taxaConv    >= 20) s += 16; else s += 7;
  if (STATE.ticket   >= 5000)  s += 20; else if (STATE.ticket >= 2000)    s += 13; else s += 6;
  if (STATE.ciclo    <= 14)    s += 15; else if (STATE.ciclo  <= 30)      s += 9;  else s += 3;
  return Math.min(s, 100);
}

/* ── Atualiza UI completo ── */
function update() {
  const f     = calcFunnel();
  const score = calcScore();

  // KPI bar
  setEl('kpi-receita', fmtBRL(f.receita));
  setEl('kpi-fechados', fmt(f.fechados));
  setEl('kpi-conv', fmtPct(STATE.taxaConv));
  setEl('kpi-ticket', fmtBRL(STATE.ticket));

  // Cards de resultado
  setEl('mc-receita', fmtBRL(f.receita));
  setEl('mc-fechados', fmt(f.fechados));
  setEl('mc-qualif', fmt(f.qualif));
  setEl('mc-ticket', fmtBRL(STATE.ticket));

  updateFunnel(f);
  updateChart();
  updateProjectionSidebar(f);
  updateInsights(f, score);
  updateTeamTable(f);
  updateAdvanced(f);

  // Score
  const fill = document.getElementById('score-fill');
  const num  = document.getElementById('score-num');
  if (fill) fill.style.width = score + '%';
  if (num)  num.textContent  = score;

  animateNumbers();
  saveState();
}

/* ── Funil visual ── */
function updateFunnel(f) {
  const steps = [
    { id: 'fn-leads',    val: f.leads,     pct: 100 },
    { id: 'fn-contatos', val: f.contatos,  pct: f.leads > 0 ? Math.round(f.contatos  / f.leads * 100) : 0 },
    { id: 'fn-qualif',   val: f.qualif,    pct: f.leads > 0 ? Math.round(f.qualif    / f.leads * 100) : 0 },
    { id: 'fn-propos',   val: f.propostas, pct: f.leads > 0 ? Math.round(f.propostas / f.leads * 100) : 0 },
    { id: 'fn-fechados', val: f.fechados,  pct: f.leads > 0 ? Math.round(f.fechados  / f.leads * 100) : 0 },
  ];
  steps.forEach(({ id, val, pct }) => {
    const bar = document.getElementById(id + '-bar');
    const ve  = document.getElementById(id + '-val');
    const pe  = document.getElementById(id + '-pct');
    if (bar) bar.style.width = Math.max(pct, 4) + '%';
    if (ve)  ve.textContent  = fmt(val);
    if (pe)  pe.textContent  = pct + '% do total';
  });
}

/* ── Chart.js ── */
function updateChart() {
  const months = STATE.chartPeriod;
  const labels = Array.from({ length: months }, (_, i) => `Mês ${i + 1}`);
  const proj   = calcProjection(months);
  const base   = Array(months).fill(calcFunnel().receita);
  const ctx    = document.getElementById('mainChart');
  if (!ctx) return;

  if (STATE.chart) {
    STATE.chart.data.labels          = labels;
    STATE.chart.data.datasets[0].data = proj;
    STATE.chart.data.datasets[1].data = base;
    STATE.chart.update('active');
    return;
  }

  STATE.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Projeção',
          data: proj,
          borderColor: '#F96500',
          backgroundColor: 'rgba(249,101,0,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#F96500',
          pointRadius: 3,
          pointHoverRadius: 6,
        },
        {
          label: 'Base Atual',
          data: base,
          borderColor: '#3B82F6',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#A0A4AD',
            font: { family: 'Manrope', size: 11, weight: '600' },
            boxWidth: 12, usePointStyle: true, pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: '#181819',
          borderColor: '#2E3033',
          borderWidth: 1,
          titleColor: '#F2F2F2',
          bodyColor: '#A0A4AD',
          callbacks: { label: c => ` ${c.dataset.label}: ${fmtBRL(c.raw)}` },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5C606A', font: { family: 'Manrope', size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5C606A',
            font: { family: 'Manrope', size: 10 },
            callback: v => fmtBRL(v),
          },
        },
      },
    },
  });
}

/* ── Sidebar de projeção ── */
function updateProjectionSidebar(f) {
  if (!f) f = calcFunnel();
  const proj12 = calcProjection(12);
  const q1     = proj12.slice(0, 3).reduce((a, b) => a + b, 0);
  const q2     = proj12.slice(3, 6).reduce((a, b) => a + b, 0);
  const s1     = proj12.slice(0, 6).reduce((a, b) => a + b, 0);
  const anual  = proj12.reduce((a, b) => a + b, 0);
  const growPct = f.receita > 0 ? Math.round((proj12[11] - f.receita) / f.receita * 100) : 0;

  const vnd  = (total) => fmt(Math.round(safeDivide(total, STATE.ticket)));
  const pvd  = (total) => fmt(Math.round(safeDivide(total, STATE.ticket * STATE.vendedores)));

  setEl('proj-q1-rec', fmtBRL(q1));   setEl('proj-q1-vnd', vnd(q1));   setEl('proj-q1-pvd', pvd(q1));
  setEl('proj-q2-rec', fmtBRL(q2));   setEl('proj-q2-vnd', vnd(q2));   setEl('proj-q2-pvd', pvd(q2));
  setEl('proj-s1-rec', fmtBRL(s1));   setEl('proj-s1-vnd', vnd(s1));   setEl('proj-s1-pvd', pvd(s1));
  setEl('proj-an-rec', fmtBRL(anual)); setEl('proj-an-vnd', vnd(anual)); setEl('proj-an-pvd', pvd(anual));

  const metaTotal = STATE.vendedores * STATE.metaVendedor;
  setEl('meta-total', `${metaTotal} vendas`);
  setEl('meta-rec', `= ${fmtBRL(metaTotal * STATE.ticket)}/mês`);

  // Break-even estimado: custo da equipe ≈ 30% da receita gerada
  const custoEstimado = STATE.vendedores * STATE.ticket * 0.3;
  const beVendas = STATE.ticket > 0 ? Math.ceil(safeDivide(custoEstimado, STATE.ticket)) : 0;
  setEl('be-vendas', `${beVendas} contratos`);
  setEl('be-12m', fmtBRL(anual));
  setEl('be-grow', growPct >= 0 ? `+${growPct}%` : `${growPct}%`);
}

/* ── Insights IA ── */
function updateInsights(f, score) {
  const ins = [];

  if (STATE.taxaContato < 50) {
    ins.push({ ic: 'var(--warning)', ii: '📞', ttl: 'Taxa de Contato Baixa',
      txt: `Apenas ${fmtPct(STATE.taxaContato)} dos leads são contactados. Revise a cadência de tentativas e os canais de outreach.` });
  } else if (STATE.taxaContato >= 70) {
    ins.push({ ic: 'var(--success)', ii: '✓', ttl: 'Excelente Taxa de Contato',
      txt: `${fmtPct(STATE.taxaContato)} de taxa de contato é acima do benchmark. Mantenha a qualidade da lista de leads.` });
  }

  if (STATE.taxaConv < 20) {
    ins.push({ ic: 'var(--danger)', ii: '⚠', ttl: 'Taxa de Conversão Crítica',
      txt: `${fmtPct(STATE.taxaConv)} está abaixo do benchmark de mercado (25–35%). Revise o processo de discovery e qualificação de objeções.` });
  } else if (STATE.taxaConv >= 30) {
    ins.push({ ic: 'var(--success)', ii: '✓', ttl: 'Conversão Excelente',
      txt: `${fmtPct(STATE.taxaConv)} de conversão está acima do benchmark. Documente o playbook atual e replique para toda a equipe.` });
  }

  if (STATE.ciclo > 45) {
    ins.push({ ic: 'var(--warning)', ii: '⏱', ttl: 'Ciclo de Vendas Longo',
      txt: `${STATE.ciclo} dias de ciclo reduz o fluxo de caixa. Implemente MEDDICC ou BANT para acelerar decisões.` });
  }

  if (STATE.modoAvancado && STATE.churnMensal > 8) {
    ins.push({ ic: 'var(--danger)', ii: '↓', ttl: 'Churn Elevado',
      txt: `${fmtPct(STATE.churnMensal)} de churn mensal corrói a receita recorrente. Priorize onboarding e CS proativo nos primeiros 90 dias.` });
  }

  if (f.receita > 100000) {
    ins.push({ ic: 'var(--success)', ii: '↑', ttl: 'Receita Mensal Sólida',
      txt: `${fmtBRL(f.receita)}/mês representa uma operação escalável. Hora de estruturar pré-vendas dedicado.` });
  }

  if (ins.length === 0) {
    ins.push({ ic: 'var(--info)', ii: 'i', ttl: 'Métricas Equilibradas',
      txt: 'Seus indicadores estão dentro dos parâmetros saudáveis. Foque em aumentar o volume de leads no topo do funil.' });
  }

  const list = document.getElementById('insights-list');
  if (!list) return;
  list.innerHTML = ins.map(i => `
    <div class="insight" style="--ic:${i.ic}">
      <div class="ii">${i.ii}</div>
      <div>
        <div class="ib-ttl">${i.ttl}</div>
        <div class="ib-txt">${i.txt}</div>
      </div>
    </div>
  `).join('');
}

/* ── Tabela de equipe (editável) ── */

/** Garante que teamData tem o tamanho correto */
function ensureTeamData(count) {
  if (!Array.isArray(STATE.teamData)) STATE.teamData = [];
  if (STATE.teamData.length !== count) {
    const prev = STATE.teamData.slice();
    STATE.teamData = Array.from({ length: count }, (_, i) => ({
      nome:     prev[i]?.nome     ?? TEAM_NAMES[i],
      metaEdit: prev[i]?.metaEdit ?? null,   // null = usa cálculo automático
      realEdit: prev[i]?.realEdit ?? null,   // null = usa cálculo automático
    }));
  }
}

/** Calcula os valores de uma linha da equipe */
function getTeamRow(i, f) {
  const td   = STATE.teamData[i] || {};
  const mult = TEAM_MULT[i % TEAM_MULT.length];
  const meta = (td.metaEdit !== null && td.metaEdit !== undefined)
    ? td.metaEdit
    : Math.round(STATE.metaVendedor * mult);
  const real = (td.realEdit !== null && td.realEdit !== undefined)
    ? td.realEdit
    : (STATE.vendedores > 0 ? Math.round(f.fechados / STATE.vendedores * mult) : 0);
  const pct   = meta > 0 ? Math.round(real / meta * 100) : 0;
  const rec   = real * STATE.ticket;
  const cls   = pct >= 100 ? 'g' : pct >= 80 ? 'o' : 'r';
  const badge = pct >= 100 ? '<span class="badge bg">Meta</span>'
              : pct >= 80  ? '<span class="badge bo">Perto</span>'
              :              '<span class="badge br">Abaixo</span>';
  return { meta, real, pct, rec, cls, badge };
}

function updateTeamTable(f) {
  const tbody = document.getElementById('team-tbody');
  if (!tbody) return;
  const count = Math.min(STATE.vendedores, TEAM_NAMES.length);
  ensureTeamData(count);

  const existingRows = tbody.querySelectorAll('tr[data-team-row]');

  if (existingRows.length !== count) {
    /* ── Rebuild completo ── */
    tbody.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const r  = getTeamRow(i, f);
      const td = STATE.teamData[i];
      const tr = document.createElement('tr');
      tr.dataset.teamRow = i;
      tr.innerHTML = `
        <td class="team-cell-edit" data-idx="${i}" data-field="nome"
            contenteditable="true" spellcheck="false">${escHtml(td.nome)}</td>
        <td class="team-cell-edit" data-idx="${i}" data-field="metaEdit"
            contenteditable="true" spellcheck="false">${r.meta}</td>
        <td class="team-cell-edit ${r.cls}" data-idx="${i}" data-field="realEdit"
            contenteditable="true" spellcheck="false">${r.real}</td>
        <td class="${r.cls} team-cell-ro">${r.pct}%</td>
        <td class="team-cell-ro">${fmtBRL(r.rec)}</td>
        <td class="team-cell-ro">${r.badge}</td>`;
      tbody.appendChild(tr);
    }
    /* Total placeholder */
    const totTr = document.createElement('tr');
    totTr.className = 'team-total';
    tbody.appendChild(totTr);
    bindTeamEditing(tbody);
  } else {
    /* ── Atualiza apenas colunas derivadas (preserva edições ativas) ── */
    existingRows.forEach((tr, i) => {
      if (i >= count) return;
      const td    = STATE.teamData[i];
      const r     = getTeamRow(i, f);
      const cells = tr.querySelectorAll('td');
      if (td.metaEdit === null && document.activeElement !== cells[1])
        cells[1].textContent = r.meta;
      if (td.realEdit === null && document.activeElement !== cells[2]) {
        cells[2].className = `team-cell-edit ${r.cls}`;
        cells[2].textContent = r.real;
      }
      if (cells[3]) { cells[3].className = `${r.cls} team-cell-ro`; cells[3].textContent = r.pct + '%'; }
      if (cells[4]) { cells[4].className = 'team-cell-ro'; cells[4].textContent = fmtBRL(r.rec); }
      if (cells[5]) { cells[5].className = 'team-cell-ro'; cells[5].innerHTML = r.badge; }
    });
  }

  /* ── Linha de totais ── */
  let totMeta = 0, totReal = 0, totRec = 0;
  for (let i = 0; i < count; i++) {
    const r = getTeamRow(i, f);
    totMeta += r.meta; totReal += r.real; totRec += r.rec;
  }
  const totPct = totMeta > 0 ? Math.round(totReal / totMeta * 100) : 0;
  const totCls = totPct >= 100 ? 'g' : totPct >= 80 ? 'o' : 'r';
  const totRow = tbody.querySelector('.team-total');
  if (totRow) totRow.innerHTML = `
    <td>Total Equipe</td>
    <td>${fmt(totMeta)}</td>
    <td class="${totCls}">${fmt(totReal)}</td>
    <td class="${totCls}">${totPct}%</td>
    <td class="g">${fmtBRL(totRec)}</td>
    <td></td>`;
}

/* ── Bind de edição inline ── */
function bindTeamEditing(tbody) {
  tbody.querySelectorAll('.team-cell-edit').forEach(cell => {
    /* Seleciona tudo ao focar */
    cell.addEventListener('focus', () => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    });
    /* Bloqueia não-dígitos em campos numéricos */
    cell.addEventListener('keypress', e => {
      if (cell.dataset.field !== 'nome' && !/[\d]/.test(e.key)) e.preventDefault();
    });
    /* Enter confirma, Escape cancela */
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); restoreTeamCell(cell); cell.blur(); }
    });
    /* Salva ao sair */
    cell.addEventListener('blur', () => saveTeamCell(cell));
  });
}

function restoreTeamCell(cell) {
  const i     = parseInt(cell.dataset.idx);
  const field = cell.dataset.field;
  const td    = STATE.teamData[i] || {};
  const f     = calcFunnel();
  const mult  = TEAM_MULT[i % TEAM_MULT.length];
  if (field === 'nome') {
    cell.textContent = td.nome || TEAM_NAMES[i];
  } else if (field === 'metaEdit') {
    cell.textContent = td.metaEdit !== null ? td.metaEdit : Math.round(STATE.metaVendedor * mult);
  } else if (field === 'realEdit') {
    cell.textContent = td.realEdit !== null ? td.realEdit
      : (STATE.vendedores > 0 ? Math.round(f.fechados / STATE.vendedores * mult) : 0);
  }
}

function saveTeamCell(cell) {
  const i     = parseInt(cell.dataset.idx);
  const field = cell.dataset.field;
  if (!STATE.teamData[i]) return;
  const raw   = cell.textContent.trim();
  const mult  = TEAM_MULT[i % TEAM_MULT.length];
  const f     = calcFunnel();

  if (field === 'nome') {
    STATE.teamData[i].nome = raw || TEAM_NAMES[i];
    if (!raw) cell.textContent = TEAM_NAMES[i];
  } else if (field === 'metaEdit') {
    const num = parseInt(raw.replace(/\D/g, ''));
    STATE.teamData[i].metaEdit = (!isNaN(num) && num > 0) ? num : null;
    cell.textContent = STATE.teamData[i].metaEdit !== null
      ? STATE.teamData[i].metaEdit : Math.round(STATE.metaVendedor * mult);
  } else if (field === 'realEdit') {
    const num = parseInt(raw.replace(/\D/g, ''));
    STATE.teamData[i].realEdit = (!isNaN(num) && num >= 0) ? num : null;
    cell.textContent = STATE.teamData[i].realEdit !== null ? STATE.teamData[i].realEdit
      : (STATE.vendedores > 0 ? Math.round(f.fechados / STATE.vendedores * mult) : 0);
  }

  saveState();

  /* Atualiza colunas derivadas da mesma linha */
  const tr = cell.closest('tr');
  if (tr) {
    const r     = getTeamRow(i, f);
    const cells = tr.querySelectorAll('td');
    if (field === 'metaEdit' && cells[2]) cells[2].className = `team-cell-edit ${r.cls}`;
    if (field === 'realEdit' && cells[2]) cells[2].className = `team-cell-edit ${r.cls}`;
    if (cells[3]) { cells[3].className = `${r.cls} team-cell-ro`; cells[3].textContent = r.pct + '%'; }
    if (cells[4]) { cells[4].className = 'team-cell-ro'; cells[4].textContent = fmtBRL(r.rec); }
    if (cells[5]) { cells[5].className = 'team-cell-ro'; cells[5].innerHTML = r.badge; }
  }

  /* Recalcula totais */
  const count = Math.min(STATE.vendedores, TEAM_NAMES.length);
  let totMeta = 0, totReal = 0, totRec = 0;
  for (let j = 0; j < count; j++) {
    const r = getTeamRow(j, f);
    totMeta += r.meta; totReal += r.real; totRec += r.rec;
  }
  const totPct = totMeta > 0 ? Math.round(totReal / totMeta * 100) : 0;
  const totCls = totPct >= 100 ? 'g' : totPct >= 80 ? 'o' : 'r';
  const totRow = document.querySelector('#team-tbody .team-total');
  if (totRow) {
    const tc = totRow.querySelectorAll('td');
    if (tc[1]) tc[1].textContent = fmt(totMeta);
    if (tc[2]) { tc[2].className = totCls; tc[2].textContent = fmt(totReal); }
    if (tc[3]) { tc[3].className = totCls; tc[3].textContent = totPct + '%'; }
    if (tc[4]) { tc[4].className = 'g'; tc[4].textContent = fmtBRL(totRec); }
  }
}

/* ── Métricas avançadas ── */
function updateAdvanced(f) {
  const ltv   = STATE.churnMensal > 0 ? Math.round(STATE.ticket / (STATE.churnMensal / 100)) : 0;
  const mrr   = f.fechados * STATE.ticket;
  const arr   = mrr * 12;
  const cac   = STATE.ticket * 0.3;
  const ratio = cac > 0 ? ltv / cac : 0;
  setEl('adv-ltv',   ltv > 0 ? fmtBRL(ltv) : '—');
  setEl('adv-mrr',   fmtBRL(mrr));
  setEl('adv-arr',   fmtBRL(arr));
  setEl('adv-ratio', `${fmt(ratio, 1)}x`);
}

/* ── Exportar CSV ── */
function exportCSV() {
  const f      = calcFunnel();
  const proj12 = calcProjection(12);
  const score  = calcScore();

  let csv = 'sep=;\n';
  csv += 'SALES ELEVATOR — DASHBOARD EXPORT\n\n';
  csv += 'FUNIL DE VENDAS\n';
  csv += 'Métrica;Valor\n';
  csv += `Leads / Mês;${f.leads}\n`;
  csv += `Contatos;${f.contatos}\n`;
  csv += `Qualificados;${f.qualif}\n`;
  csv += `Propostas;${f.propostas}\n`;
  csv += `Fechados;${f.fechados}\n`;
  csv += `Receita Mensal;${f.receita}\n`;
  csv += `Taxa de Contato;${STATE.taxaContato}%\n`;
  csv += `Taxa de Qualificação;${STATE.taxaQualif}%\n`;
  csv += `Taxa de Conversão;${STATE.taxaConv}%\n`;
  csv += `Ticket Médio;${STATE.ticket}\n`;
  csv += `Ciclo de Vendas (dias);${STATE.ciclo}\n`;
  csv += `Score do Funil;${score}\n`;
  csv += `Cenário;${STATE.cenario}\n\n`;

  csv += 'PROJEÇÃO 12 MESES\n';
  csv += 'Mês;Receita Projetada\n';
  proj12.forEach((v, i) => { csv += `Mês ${i + 1};${v}\n`; });
  csv += '\n';

  csv += 'EQUIPE DE VENDAS\n';
  csv += 'Vendedor;Meta;Realizado;Atingimento (%);Receita\n';
  const count = Math.min(STATE.vendedores, TEAM_NAMES.length);
  ensureTeamData(count);
  for (let i = 0; i < count; i++) {
    const r    = getTeamRow(i, f);
    const nome = STATE.teamData[i]?.nome || TEAM_NAMES[i];
    csv += `${nome};${r.meta};${r.real};${r.pct}%;${r.rec}\n`;
  }

  if (STATE.modoAvancado) {
    const ltv = STATE.churnMensal > 0 ? Math.round(STATE.ticket / (STATE.churnMensal / 100)) : 0;
    csv += '\nMÉTRICAS AVANÇADAS\n';
    csv += `LTV Estimado;${ltv}\n`;
    csv += `MRR;${f.fechados * STATE.ticket}\n`;
    csv += `ARR;${f.fechados * STATE.ticket * 12}\n`;
    csv += `Churn Mensal;${STATE.churnMensal}%\n`;
    csv += `Upsell / Expansão;${STATE.upsell}%\n`;
  }

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sales-elevator-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Exportar PDF ── */
function exportPDF() {
  window.print();
}

/* ── Resetar estado ── */
function resetState() {
  if (!confirm('Resetar todos os parâmetros para os valores padrão?')) return;
  Object.assign(STATE, {
    leads: 1000, taxaContato: 60, taxaQualif: 40, taxaConv: 25,
    ticket: 2500, ciclo: 30, churnMensal: 5, upsell: 15,
    vendedores: 5, metaVendedor: 10, cenario: 'realista', modoAvancado: false,
    teamData: [],
  });
  if (STATE.chart) { STATE.chart.destroy(); STATE.chart = null; }
  syncInputsFromState();
  update();
}

/* ── Sincronizar inputs com STATE ── */
function syncInputsFromState() {
  const setVal    = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setSlider = (id, vid, v) => {
    const sl = document.getElementById(id);
    const dv = document.getElementById(vid);
    if (!sl) return;
    sl.value = v;
    const pct = ((v - parseFloat(sl.min)) / (parseFloat(sl.max) - parseFloat(sl.min))) * 100;
    sl.style.setProperty('--pct', pct + '%');
    if (dv) dv.textContent = v + '%';
  };

  setVal('inp-leads',      STATE.leads);
  setVal('inp-ticket',     STATE.ticket);
  setVal('inp-ciclo',      STATE.ciclo);
  setVal('inp-vendedores', STATE.vendedores);
  setVal('inp-meta',       STATE.metaVendedor);
  setVal('inp-churn',      STATE.churnMensal);
  setVal('inp-upsell',     STATE.upsell);
  setSlider('sl-contato', 'sl-contato-val', STATE.taxaContato);
  setSlider('sl-qualif',  'sl-qualif-val',  STATE.taxaQualif);
  setSlider('sl-conv',    'sl-conv-val',    STATE.taxaConv);

  document.querySelectorAll('.sc-card').forEach(c => {
    c.classList.toggle('active', c.dataset.cenario === STATE.cenario);
  });
  document.querySelectorAll('.chart-tab').forEach(t => {
    t.classList.toggle('active', parseInt(t.dataset.period) === STATE.chartPeriod);
  });

  const tog     = document.getElementById('tog-avancado');
  const avBlock = document.getElementById('bloco-avancado');
  if (tog)     tog.checked = STATE.modoAvancado;
  if (avBlock) avBlock.classList.toggle('hidden', !STATE.modoAvancado);
}

/* ── Animação de números ── */
function animateNumbers() {
  document.querySelectorAll('.mc-val').forEach(el => {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'fadeUp 0.3s ease forwards';
  });
}

/* ── Bind inputs numéricos ── */
function bindInput(id, key, parse) {
  const el = document.getElementById(id);
  if (!el) return;

  const applyVal = (raw) => {
    let v = parse ? parse(raw) : parseFloat(raw);
    if (isNaN(v)) return;
    const lim = LIMITS[key];
    if (lim) v = Math.min(Math.max(v, lim.min), lim.max);
    STATE[key] = v;
    update();
  };

  el.addEventListener('input', () => applyVal(el.value));
  el.addEventListener('blur',  () => {
    const lim = LIMITS[key];
    if (!lim) return;
    let v = parse ? parse(el.value) : parseFloat(el.value);
    if (isNaN(v) || v < lim.min) { el.value = lim.min; STATE[key] = lim.min; update(); }
    else if (v > lim.max)        { el.value = lim.max; STATE[key] = lim.max; update(); }
  });
}

/* ── Bind sliders ── */
function bindSlider(id, key, displayId) {
  const sl = document.getElementById(id);
  const dv = document.getElementById(displayId);
  if (!sl) return;
  sl.addEventListener('input', () => {
    const v = parseFloat(sl.value);
    STATE[key] = v;
    if (dv) dv.textContent = v + '%';
    const pct = ((v - parseFloat(sl.min)) / (parseFloat(sl.max) - parseFloat(sl.min))) * 100;
    sl.style.setProperty('--pct', pct + '%');
    update();
  });
  const pct = ((parseFloat(sl.value) - parseFloat(sl.min)) / (parseFloat(sl.max) - parseFloat(sl.min))) * 100;
  sl.style.setProperty('--pct', pct + '%');
}

/* ── Tabs ── */
function initTabs() {
  const activateTab = (target) => {
    document.querySelectorAll('.nb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
    document.querySelectorAll('.mobile-tabs .nb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('tab-' + target);
    if (panel) {
      panel.classList.add('active', 'fade-up');
      setTimeout(() => panel.classList.remove('fade-up'), 400);
    }
  };

  document.querySelectorAll('.nb-tab, .mobile-tabs .nb-tab').forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });
}

/* ── Cenários ── */
function initScenarios() {
  document.querySelectorAll('.sc-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.sc-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      STATE.cenario = card.dataset.cenario;
      update();
    });
  });
}

/* ── Modo avançado ── */
function initModoAvancado() {
  const tog = document.getElementById('tog-avancado');
  if (!tog) return;
  tog.addEventListener('change', () => {
    STATE.modoAvancado = tog.checked;
    const av = document.getElementById('bloco-avancado');
    if (av) av.classList.toggle('hidden', !STATE.modoAvancado);
    update();
  });
}

/* ── Chart period tabs ── */
function initChartTabs() {
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      STATE.chartPeriod = parseInt(tab.dataset.period);
      if (STATE.chart) { STATE.chart.destroy(); STATE.chart = null; }
      updateChart();
    });
  });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTabs();
  initScenarios();
  initModoAvancado();
  initChartTabs();

  bindInput('inp-leads',      'leads',        v => parseInt(v));
  bindInput('inp-ticket',     'ticket',       v => parseFloat(v));
  bindInput('inp-ciclo',      'ciclo',        v => parseInt(v));
  bindInput('inp-vendedores', 'vendedores',   v => parseInt(v));
  bindInput('inp-meta',       'metaVendedor', v => parseInt(v));
  bindInput('inp-churn',      'churnMensal',  v => parseFloat(v));
  bindInput('inp-upsell',     'upsell',       v => parseFloat(v));

  bindSlider('sl-contato', 'taxaContato', 'sl-contato-val');
  bindSlider('sl-qualif',  'taxaQualif',  'sl-qualif-val');
  bindSlider('sl-conv',    'taxaConv',    'sl-conv-val');

  document.getElementById('btn-exportar')?.addEventListener('click', exportPDF);
  document.getElementById('btn-exportar-csv')?.addEventListener('click', exportCSV);
  document.getElementById('btn-resetar')?.addEventListener('click', resetState);

  syncInputsFromState();
  update();

  // Animação inicial das barras
  setTimeout(() => {
    document.querySelectorAll('.fn-bar-fill').forEach(el => {
      const w = el.style.width;
      el.style.width = '0%';
      requestAnimationFrame(() => { el.style.width = w; });
    });
  }, 120);
});
