/* ── AI Scientists Tracker — app.js ── */

const DATA_URL = 'data/companies.json';
const META_URL = 'data/meta.json';

let allCompanies = [];
let filtered = [];
let sortCol = 'total_funding_usd_m';
let sortDir = 'desc';
let activeDomain = '';

// ── Category config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'Full-Stack AI Scientist', label: 'Full-Stack AI Scientist', chip: 'chip-fullstack', tag: 'tag-fullstack', color: '#818cf8', dotColor: '#6366f1' },
  { key: 'AI Research Agent',       label: 'AI Research Agent',       chip: 'chip-agent',     tag: 'tag-agent',     color: '#22d3ee', dotColor: '#22d3ee' },
  { key: 'AI Drug Discovery',       label: 'AI Drug Discovery',       chip: 'chip-drug',      tag: 'tag-drug',      color: '#34d399', dotColor: '#34d399' },
  { key: 'Autonomous Lab',          label: 'Autonomous Lab',          chip: 'chip-lab',       tag: 'tag-lab',       color: '#fbbf24', dotColor: '#fbbf24' },
  { key: 'DeSci / Open Science',    label: 'DeSci / Open Science',    chip: 'chip-desci',     tag: 'tag-desci',     color: '#c084fc', dotColor: '#c084fc' },
];

const CAT_MAP = {};
CATEGORIES.forEach(c => { CAT_MAP[c.key] = c; });

// Stage buckets for the map columns
const STAGE_BUCKETS = [
  { label: 'Pre-seed / Seed', stages: ['Pre-seed', 'Seed'] },
  { label: 'Series A',        stages: ['Series A'] },
  { label: 'Series B+ / Public', stages: ['Series B', 'Series C+', 'Public'] },
  { label: 'Nonprofit',       stages: ['Nonprofit'] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v) {
  if (!v) return null;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${v}M`;
}

function hqRegion(hq) {
  if (!hq) return 'Other';
  const l = hq.toLowerCase();
  if (l.includes('japan') || l.includes('tokyo') || l.includes('india')) return 'Asia';
  if (l.includes('decentralized')) return 'Decentralized';
  const us = [', ca', ', ma', ', ny', ', tx', ', ct', ', ut', ', wa', ', pa', ', nj'];
  if (us.some(s => l.endsWith(s))) return 'USA';
  return 'Other';
}

function catTag(category) {
  const c = CAT_MAP[category];
  return c ? `<span class="tag ${c.tag}">${category}</span>` : `<span class="tag tag-other">${category || '—'}</span>`;
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

function updateKPIs(data) {
  document.getElementById('kpi-total').textContent = data.length;

  const total = data.reduce((s, c) => s + (c.total_funding_usd_m || 0), 0);
  document.getElementById('kpi-funding').textContent = total > 0 ? fmtMoney(total) : '—';

  const fs = data.filter(c => c.category && (c.category.includes('Full-Stack') || c.category.includes('Autonomous'))).length;
  document.getElementById('kpi-fullstack').textContent = fs;

  const years = data.map(c => c.founded).filter(Boolean).sort();
  if (years.length) {
    const mid = Math.floor(years.length / 2);
    document.getElementById('kpi-median-year').textContent =
      years.length % 2 ? years[mid] : Math.round((years[mid - 1] + years[mid]) / 2);
  }
}

// ── MAP VIEW ─────────────────────────────────────────────────────────────────

function buildMap(data) {
  const grid = document.getElementById('map-grid');

  // Column headers
  let html = '<div class="map-col-hdr"></div>';
  STAGE_BUCKETS.forEach(b => { html += `<div class="map-col-hdr">${b.label}</div>`; });

  // One row per category
  CATEGORIES.forEach(cat => {
    // Row label
    html += `<div class="map-row-label">
      <span class="map-row-dot" style="background:${cat.dotColor}"></span>
      <span class="map-row-name">${cat.label}</span>
    </div>`;

    // Cells
    STAGE_BUCKETS.forEach(bucket => {
      const companies = data.filter(c => c.category === cat.key && bucket.stages.includes(c.stage));
      html += '<div class="map-cell">';
      companies.forEach(c => {
        const funding = c.total_funding_usd_m ? fmtMoney(c.total_funding_usd_m) : '';
        const dimmed = activeDomain && (!c.domain || !c.domain.includes(activeDomain)) ? ' chip-dimmed' : '';
        html += `<div class="company-chip ${cat.chip}${dimmed}" data-id="${c.id}">
          <span class="chip-name">${c.name}</span>
          ${funding ? `<span class="chip-funding">${funding}</span>` : ''}
        </div>`;
      });
      html += '</div>';
    });
  });

  grid.innerHTML = html;
  attachChipEvents();
}

// ── Popover ──────────────────────────────────────────────────────────────────

const popover = document.getElementById('popover');
const popContent = document.getElementById('popover-content');
let popTimeout = null;

function showPopover(c, rect) {
  const cat = CAT_MAP[c.category];
  const catColor = cat ? cat.color : '#888';

  popContent.innerHTML = `
    <div class="pop-name" style="color:${catColor}">${c.name}</div>
    <div class="pop-meta">${c.hq || ''} ${c.founded ? '&bull; Founded ' + c.founded : ''} ${c.stage ? '&bull; ' + c.stage : ''}</div>
    <div class="pop-desc">${c.description || ''}</div>
    <div class="pop-row"><span class="pop-label">Approach</span><span class="pop-value">${c.approach || '—'}</span></div>
    <div class="pop-row"><span class="pop-label">Domain</span><span class="pop-value">${(c.domain || []).join(', ') || '—'}</span></div>
    ${c.key_investors && c.key_investors.length ? `<div class="pop-row"><span class="pop-label">Investors</span><span class="pop-value">${c.key_investors.join(', ')}</span></div>` : ''}
    ${c.founders && c.founders.length ? `<div class="pop-row"><span class="pop-label">Founders</span><span class="pop-value">${c.founders.join(', ')}</span></div>` : ''}
    ${c.capabilities && c.capabilities.length ? `<div class="pop-tags">${c.capabilities.map(cap => `<span class="pop-tag">${cap}</span>`).join('')}</div>` : ''}
    ${c.total_funding_usd_m ? `<div class="pop-funding"><span class="pop-funding-val">${fmtMoney(c.total_funding_usd_m)}</span><span class="pop-funding-lbl">total raised</span></div>` : ''}
  `;

  // Position: prefer right of chip, fall back to left
  const pw = 340;
  const ph = popover.offsetHeight || 300;
  let left = rect.right + 12;
  let top = rect.top - 20;

  if (left + pw > window.innerWidth - 16) {
    left = rect.left - pw - 12;
  }
  if (left < 8) left = 8;
  if (top + ph > window.innerHeight - 16) {
    top = window.innerHeight - ph - 16;
  }
  if (top < 8) top = 8;

  popover.style.left = left + 'px';
  popover.style.top = top + 'px';
  popover.classList.remove('hidden');

  // Small delay for opacity transition
  requestAnimationFrame(() => popover.classList.add('visible'));
}

function hidePopover() {
  popover.classList.remove('visible');
  popTimeout = setTimeout(() => popover.classList.add('hidden'), 150);
}

function attachChipEvents() {
  document.querySelectorAll('.company-chip').forEach(chip => {
    chip.addEventListener('mouseenter', (e) => {
      clearTimeout(popTimeout);
      const id = parseInt(chip.dataset.id);
      const c = allCompanies.find(x => x.id === id);
      if (c) showPopover(c, chip.getBoundingClientRect());
    });
    chip.addEventListener('mouseleave', () => {
      hidePopover();
    });
    chip.addEventListener('click', () => {
      const id = parseInt(chip.dataset.id);
      const c = allCompanies.find(x => x.id === id);
      if (c && c.website) window.open(c.website, '_blank');
    });
  });
}

// ── Domain filter chips ──────────────────────────────────────────────────────

function buildDomainFilters(data) {
  const domains = [...new Set(data.flatMap(c => c.domain || []))].sort();
  const container = document.getElementById('domain-filters');
  container.innerHTML = domains.map(d =>
    `<span class="filter-chip" data-domain="${d}">${d}</span>`
  ).join('');

  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const d = chip.dataset.domain;
      if (activeDomain === d) {
        activeDomain = '';
        chip.classList.remove('active');
      } else {
        activeDomain = d;
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
      applyFilters();
    });
  });
}

// ── Search + Filters ─────────────────────────────────────────────────────────

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase().trim();

  filtered = allCompanies.filter(c => {
    if (activeDomain && (!c.domain || !c.domain.includes(activeDomain))) return false;
    if (search) {
      const hay = [c.name, c.hq, c.description, c.approach, c.category, c.stage,
        ...(c.domain || []), ...(c.capabilities || []), ...(c.key_investors || []),
        c.notes, c.parent_org].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  updateKPIs(filtered);
  updateCharts(filtered);
  buildMap(filtered);
  renderTable(sortData(filtered));
}

document.getElementById('search-input').addEventListener('input', applyFilters);

// ── View Toggle ──────────────────────────────────────────────────────────────

document.getElementById('view-toggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.view-btn');
  if (!btn) return;
  const view = btn.dataset.view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('map-view').classList.toggle('hidden', view !== 'map');
  document.getElementById('table-view').classList.toggle('hidden', view !== 'table');
});

// ── Charts ───────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#38bdf8'];
let chartInstances = {};

function makeChart(id, type, labels, values, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (chartInstances[id]) chartInstances[id].destroy();

  const isHBar = type === 'bar' && id === 'chart-category';
  const isDoughnut = type === 'doughnut';

  chartInstances[id] = new Chart(ctx, {
    type: isDoughnut ? 'doughnut' : 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors || CHART_COLORS,
        borderColor: '#0e0e0e',
        borderWidth: 2,
      }]
    },
    options: {
      indexAxis: isHBar ? 'y' : 'x',
      responsive: true,
      plugins: {
        legend: {
          display: isDoughnut,
          position: 'bottom',
          labels: { color: '#777', font: { size: 10, family: 'Inter' }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          backgroundColor: '#161616',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#bbb',
          titleFont: { family: 'Inter', size: 11 },
          bodyFont: { family: 'Inter', size: 11 },
        }
      },
      scales: isDoughnut ? {} : {
        x: { ticks: { color: '#555', font: { size: 9, family: 'Inter' } }, grid: { color: '#1a1a1a' }, beginAtZero: !isHBar },
        y: { ticks: { color: '#555', font: { size: 9, family: 'Inter' } }, grid: { color: '#1a1a1a' }, beginAtZero: isHBar },
      }
    }
  });
}

function countBy(data, key) {
  const c = {};
  data.forEach(d => { const v = d[key] || 'Unknown'; c[v] = (c[v] || 0) + 1; });
  return c;
}

function updateCharts(data) {
  const catCounts = countBy(data, 'category');
  const catLabels = CATEGORIES.map(c => c.key).filter(k => catCounts[k]);
  const catColors = catLabels.map(k => CAT_MAP[k].color);
  makeChart('chart-category', 'bar', catLabels.map(k => k.replace('Full-Stack AI Scientist', 'Full-Stack').replace('DeSci / Open Science', 'DeSci')), catLabels.map(k => catCounts[k]), catColors);

  const stageCounts = countBy(data, 'stage');
  makeChart('chart-stage', 'doughnut', Object.keys(stageCounts), Object.values(stageCounts));

  const domainCounts = {};
  data.forEach(d => { (d.domain || []).forEach(v => { domainCounts[v] = (domainCounts[v] || 0) + 1; }); });
  makeChart('chart-domain', 'bar', Object.keys(domainCounts), Object.values(domainCounts));

  const regionCounts = {};
  data.forEach(c => { const r = hqRegion(c.hq); regionCounts[r] = (regionCounts[r] || 0) + 1; });
  makeChart('chart-region', 'doughnut', Object.keys(regionCounts), Object.values(regionCounts));
}

// ── Capability Matrix ────────────────────────────────────────────────────────

const CAPS = [
  'Literature synthesis', 'Hypothesis generation', 'Experiment design',
  'Code execution', 'Wet lab', 'Data analysis', 'Paper/Report writing'
];
const CAP_SHORT = {
  'Literature synthesis': 'Lit. Mining',
  'Hypothesis generation': 'Hypothesis',
  'Experiment design': 'Exp. Design',
  'Code execution': 'Code Exec',
  'Wet lab': 'Wet Lab',
  'Data analysis': 'Data Analysis',
  'Paper/Report writing': 'Paper Writing',
};

function renderCapMatrix(data) {
  const t = document.getElementById('capability-table');
  let html = '<thead><tr><th>Company</th>';
  CAPS.forEach(c => { html += `<th>${CAP_SHORT[c] || c}</th>`; });
  html += '</tr></thead><tbody>';

  data.forEach(c => {
    const cat = CAT_MAP[c.category];
    html += `<tr><td style="color:${cat ? cat.color : '#bbb'}">${c.name}</td>`;
    CAPS.forEach(cap => {
      const has = c.capabilities && (c.capabilities.includes(cap) || (cap === 'Paper/Report writing' && c.capabilities.includes('Report generation')));
      html += `<td><span class="cap-dot ${has ? 'yes' : 'no'}">${has ? '&#10003;' : '&mdash;'}</span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  t.innerHTML = html;
}

// ── Largest Rounds ───────────────────────────────────────────────────────────

function renderRounds(data) {
  const rounds = data
    .filter(c => c.total_funding_usd_m)
    .sort((a, b) => b.total_funding_usd_m - a.total_funding_usd_m)
    .slice(0, 6);

  const container = document.getElementById('rounds-list');
  container.innerHTML = rounds.map((c, i) => {
    const cat = CAT_MAP[c.category];
    return `
    <div class="round-card">
      <div class="round-rank">${i + 1}</div>
      <div class="round-info">
        <div class="round-company" style="color:${cat ? cat.color : '#bbb'}">${c.name}</div>
        <div class="round-meta">${c.stage} &bull; ${c.last_funding_date || '—'} &bull; ${(c.key_investors || []).slice(0, 2).join(', ')}</div>
      </div>
      <div class="round-amount">${fmtMoney(c.total_funding_usd_m)}</div>
    </div>`;
  }).join('');
}

// ── Key Milestones ───────────────────────────────────────────────────────────

const MILESTONES = [
  { date: 'Jan 2026', text: '<strong>Sakana AI</strong> receives Google strategic investment, valuation hits $2.65B' },
  { date: 'Nov 2025', text: '<strong>Edison Scientific</strong> spins out of FutureHouse with $70M seed round' },
  { date: 'Sep 2025', text: '<strong>Periodic Labs</strong> raises record $300M seed — largest for autonomous lab startup' },
  { date: 'Mar 2025', text: '<strong>Lila Sciences</strong> unveiled by Flagship Pioneering with $200M seed' },
  { date: 'Mar 2025', text: 'First fully AI-generated research paper accepted at a major ML conference' },
  { date: 'Aug 2024', text: '<strong>Sakana AI</strong> publishes "The AI Scientist" — first automated paper generation system' },
  { date: 'Aug 2024', text: '<strong>Recursion</strong> partners with NVIDIA on BioNeMo drug discovery platform' },
  { date: 'Jan 2023', text: '<strong>FutureHouse</strong> founded by Eric Schmidt to build open-source AI research tools' },
];

function renderMilestones() {
  const container = document.getElementById('milestones-list');
  container.innerHTML = MILESTONES.map(m => `
    <div class="milestone">
      <div class="milestone-date">${m.date}</div>
      <div class="milestone-text">${m.text}</div>
    </div>
  `).join('');
}

// ── Table ────────────────────────────────────────────────────────────────────

function renderTable(data) {
  const tbody = document.getElementById('table-body');
  document.getElementById('row-count').textContent = `${data.length} compan${data.length === 1 ? 'y' : 'ies'}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)">No matches.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr data-id="${c.id}">
      <td class="tbl-name"><a href="${c.website}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${c.name}</a></td>
      <td class="tbl-hq">${c.hq || '—'}</td>
      <td class="tbl-year">${c.founded || '—'}</td>
      <td>${catTag(c.category)}</td>
      <td>${(c.domain || []).map(d => `<span class="domain-chip">${d}</span>`).join(' ')}</td>
      <td>${c.stage || '—'}</td>
      <td class="tbl-funding">${c.total_funding_usd_m ? fmtMoney(c.total_funding_usd_m) : '—'}</td>
      <td class="investors-cell">${(c.key_investors || []).join(', ') || '—'}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const c = allCompanies.find(x => x.id === parseInt(row.dataset.id));
      if (c) openModal(c);
    });
  });
}

function sortData(data) {
  return [...data].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (av == null) av = sortCol === 'total_funding_usd_m' ? -1 : '';
    if (bv == null) bv = sortCol === 'total_funding_usd_m' ? -1 : '';
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

document.querySelectorAll('#companies-table thead th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
    else { sortCol = col; sortDir = col === 'total_funding_usd_m' ? 'desc' : 'asc'; }
    document.querySelectorAll('#companies-table thead th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    renderTable(sortData(filtered));
  });
});

// ── Export CSV ────────────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', () => {
  const cols = ['name','hq','founded','category','domain','approach','stage','total_funding_usd_m','key_investors','capabilities','notes'];
  const headers = ['Company','HQ','Founded','Category','Domain','Approach','Stage','Raised ($M)','Investors','Capabilities','Notes'];
  const esc = v => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('; ') : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = [headers.join(',')];
  (filtered.length ? filtered : allCompanies).forEach(c => { rows.push(cols.map(col => esc(c[col])).join(',')); });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai_scientists_companies.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Modal ────────────────────────────────────────────────────────────────────

function openModal(c) {
  const content = document.getElementById('modal-content');
  const cat = CAT_MAP[c.category];
  content.innerHTML = `
    <div class="modal-name"><a href="${c.website}" target="_blank" rel="noopener" style="color:${cat ? cat.color : '#bbb'}">${c.name} &#8599;</a></div>
    <div class="modal-meta">${c.hq || ''} ${c.founded ? '&bull; Founded ' + c.founded : ''}</div>
    <div class="modal-tags">${catTag(c.category)} <span class="tag tag-other">${c.stage}</span></div>

    <div class="modal-section">
      <div class="modal-section-title">Description</div>
      <div class="modal-section-body">${c.description || '—'}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Approach</div>
      <div class="modal-section-body">${c.approach || '—'}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Domain</div>
      <div class="modal-section-body">${(c.domain || []).join(', ') || '—'}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Capabilities</div>
      <div class="modal-section-body">${(c.capabilities || []).map(p => '&bull; ' + p).join('<br>') || '—'}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Funding</div>
      <div class="modal-section-body">
        ${c.total_funding_usd_m ? `<strong>Total raised:</strong> ${fmtMoney(c.total_funding_usd_m)}<br>` : ''}
        ${c.last_funding_date ? `<strong>Last round:</strong> ${c.last_funding_date}<br>` : ''}
        ${c.key_investors && c.key_investors.length ? `<strong>Investors:</strong> ${c.key_investors.join(', ')}` : ''}
      </div>
    </div>
    ${c.founders && c.founders.length ? `<div class="modal-section"><div class="modal-section-title">Founders</div><div class="modal-section-body">${c.founders.join(', ')}</div></div>` : ''}
    ${c.parent_org ? `<div class="modal-section"><div class="modal-section-title">Parent Org</div><div class="modal-section-body">${c.parent_org}</div></div>` : ''}
    ${c.notes ? `<div class="modal-section"><div class="modal-section-title">Notes</div><div class="modal-section-body">${c.notes}</div></div>` : ''}
    <a class="modal-link" href="${c.website}" target="_blank" rel="noopener">Visit website &#8599;</a>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('modal-overlay').classList.add('hidden');
});

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const meta = await (await fetch(META_URL)).json();
    document.getElementById('disclaimer-date').textContent = meta.last_updated || '—';
    document.getElementById('footer-date').textContent = meta.last_updated || '—';
  } catch {}

  allCompanies = await (await fetch(DATA_URL)).json();
  filtered = [...allCompanies];

  buildDomainFilters(allCompanies);
  updateKPIs(filtered);
  updateCharts(filtered);
  buildMap(filtered);
  renderCapMatrix(allCompanies);
  renderRounds(allCompanies);
  renderMilestones();
  renderTable(sortData(filtered));
}

init();
