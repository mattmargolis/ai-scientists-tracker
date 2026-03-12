/* ── AI Scientists Tracker — app.js ── */

const DATA_URL = 'data/companies.json';
const META_URL = 'data/meta.json';

let allCompanies = [];
let filtered = [];
let sortCol = 'name';
let sortDir = 'asc';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined || v === '') return '<span style="color:var(--text-dim)">&mdash;</span>';
  return v;
}

function fmtFunding(v) {
  if (v === null || v === undefined) return '<span style="color:var(--text-dim)">&mdash;</span>';
  return `<span class="funding-value">$${Number(v).toLocaleString()}M</span>`;
}

function categoryTag(c) {
  const map = {
    'Full-Stack AI Scientist': 'tag-fullstack',
    'AI Research Agent':       'tag-agent',
    'AI Drug Discovery':       'tag-drug',
    'Autonomous Lab':          'tag-lab',
    'DeSci / Open Science':    'tag-desci',
  };
  const cls = map[c] || 'tag-other';
  return `<span class="tag ${cls}">${c || '&mdash;'}</span>`;
}

function stageTag(s) {
  const map = {
    'Pre-seed':   'tag-preseed',
    'Seed':       'tag-seed',
    'Series A':   'tag-seriesa',
    'Series B':   'tag-seriesb',
    'Series C+':  'tag-seriesc',
    'Public':     'tag-public',
    'Nonprofit':  'tag-stage-nonprofit',
  };
  const cls = map[s] || 'tag-other';
  return `<span class="tag ${cls}">${s || '&mdash;'}</span>`;
}

function catChipClass(category) {
  const map = {
    'Full-Stack AI Scientist': 'cat-fullstack',
    'AI Research Agent':       'cat-agent',
    'AI Drug Discovery':       'cat-drug',
    'Autonomous Lab':          'cat-lab',
    'DeSci / Open Science':    'cat-desci',
  };
  return map[category] || '';
}

function hqRegion(hq) {
  if (!hq) return 'Other';
  const lower = hq.toLowerCase();
  if (lower.includes('japan') || lower.includes('tokyo')) return 'Asia';
  if (lower.includes('india')) return 'Asia';
  if (lower.includes('decentralized')) return 'Decentralized';
  const usStates = [', ca', ', ma', ', ny', ', tx', ', ct', ', ut', ', wa', ', pa', ', nj'];
  if (usStates.some(s => lower.endsWith(s))) return 'USA';
  return 'Other';
}

function domainChips(domains) {
  if (!domains || !domains.length) return '<span style="color:var(--text-dim)">&mdash;</span>';
  return `<div class="cell-domain">${domains.map(d => `<span class="domain-chip">${d}</span>`).join('')}</div>`;
}

function listCells(arr) {
  if (!arr || !arr.length) return '<span style="color:var(--text-dim)">&mdash;</span>';
  return `<div class="cell-list">${arr.map(i => `<span class="cell-list-item">${i}</span>`).join('')}</div>`;
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

function updateKPIs(data) {
  document.getElementById('kpi-total').textContent = data.length;

  const totalFunding = data.reduce((s, c) => s + (c.total_funding_usd_m || 0), 0);
  document.getElementById('kpi-funding').textContent =
    totalFunding > 0 ? `$${(totalFunding / 1000).toFixed(1)}B` : '—';

  const fullstack = data.filter(c =>
    c.category && (c.category.includes('Full-Stack') || c.category.includes('Autonomous Lab'))
  ).length;
  document.getElementById('kpi-fullstack').textContent = fullstack;

  const years = data.map(c => c.founded).filter(Boolean).sort();
  if (years.length > 0) {
    const mid = Math.floor(years.length / 2);
    const median = years.length % 2 === 0
      ? Math.round((years[mid - 1] + years[mid]) / 2)
      : years[mid];
    document.getElementById('kpi-median-year').textContent = median;
  } else {
    document.getElementById('kpi-median-year').textContent = '—';
  }
}

// ── Charts ───────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#6366f1', '#22d3ee', '#a78bfa', '#34d399', '#fbbf24',
  '#f87171', '#fb923c', '#38bdf8', '#c084fc', '#4ade80'
];

let chartInstances = {};

function countBy(data, key) {
  const counts = {};
  data.forEach(d => {
    const val = d[key] || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  return counts;
}

function countByArray(data, key) {
  const counts = {};
  data.forEach(d => {
    const arr = d[key];
    if (Array.isArray(arr)) {
      arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    }
  });
  return counts;
}

function makeChart(id, type, labels, values, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (chartInstances[id]) chartInstances[id].destroy();

  const isDoughnut = type === 'doughnut';
  const isHorizontal = type === 'bar' && id === 'chart-category';

  chartInstances[id] = new Chart(ctx, {
    type: type === 'bar' ? 'bar' : type,
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors || CHART_COLORS,
        borderColor: '#0a0a0a',
        borderWidth: 2,
      }]
    },
    options: {
      indexAxis: isHorizontal ? 'y' : 'x',
      responsive: true,
      plugins: {
        legend: {
          display: isDoughnut,
          position: 'bottom',
          labels: {
            color: '#888',
            font: { size: 11, family: 'Inter' },
            boxWidth: 12,
            padding: 10,
          }
        },
        tooltip: {
          backgroundColor: '#111',
          borderColor: '#222',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#aaa',
          titleFont: { family: 'Inter' },
          bodyFont: { family: 'Inter' },
        }
      },
      scales: !isDoughnut ? {
        x: {
          ticks: { color: '#888', font: { size: 10, family: 'Inter' } },
          grid: { color: '#1a1a1a' },
          beginAtZero: !isHorizontal,
        },
        y: {
          ticks: { color: '#888', font: { size: 10, family: 'Inter' } },
          grid: { color: '#1a1a1a' },
          beginAtZero: isHorizontal,
        }
      } : {}
    }
  });
}

function updateCharts(data) {
  // Category — horizontal bar
  const catCounts = countBy(data, 'category');
  makeChart('chart-category', 'bar', Object.keys(catCounts), Object.values(catCounts));

  // Stage — doughnut
  const stageCounts = countBy(data, 'stage');
  makeChart('chart-stage', 'doughnut', Object.keys(stageCounts), Object.values(stageCounts));

  // Domain — bar
  const domainCounts = countByArray(data, 'domain');
  makeChart('chart-domain', 'bar', Object.keys(domainCounts), Object.values(domainCounts));

  // Region — doughnut
  const regionCounts = {};
  data.forEach(c => {
    const r = hqRegion(c.hq);
    regionCounts[r] = (regionCounts[r] || 0) + 1;
  });
  makeChart('chart-region', 'doughnut', Object.keys(regionCounts), Object.values(regionCounts));
}

// ── Capability Landscape Matrix ──────────────────────────────────────────────

const CAPABILITIES = [
  'Literature synthesis',
  'Hypothesis generation',
  'Experiment design',
  'Code execution',
  'Wet lab',
  'Data analysis',
  'Paper/Report writing'
];

const CAP_SHORT = {
  'Literature synthesis': 'Lit. Mining',
  'Hypothesis generation': 'Hypothesis Gen',
  'Experiment design': 'Exp. Design',
  'Code execution': 'Code Exec',
  'Wet lab': 'Wet Lab',
  'Data analysis': 'Data Analysis',
  'Paper/Report writing': 'Paper Writing',
  'Report generation': 'Paper Writing',
};

function renderCapabilityMatrix(data) {
  const table = document.getElementById('capability-table');

  let html = '<thead><tr><th>Company</th>';
  CAPABILITIES.forEach(cap => {
    html += `<th>${CAP_SHORT[cap] || cap}</th>`;
  });
  html += '</tr></thead><tbody>';

  data.forEach(c => {
    const chipCls = catChipClass(c.category);
    html += `<tr><td>${c.name}</td>`;
    CAPABILITIES.forEach(cap => {
      const has = c.capabilities && (
        c.capabilities.includes(cap) ||
        (cap === 'Paper/Report writing' && c.capabilities.includes('Report generation'))
      );
      if (has) {
        html += `<td><span class="cap-chip cap-yes ${chipCls}" title="${c.category}">&#10003;</span></td>`;
      } else {
        html += `<td><span class="cap-no">&mdash;</span></td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody>';
  table.innerHTML = html;
}

// ── Funding Timeline ─────────────────────────────────────────────────────────

function renderFundingTimeline(data) {
  const container = document.getElementById('funding-timeline');

  const rounds = data
    .filter(c => c.total_funding_usd_m && c.last_funding_date)
    .map(c => ({
      date: c.last_funding_date,
      company: c.name,
      amount: c.total_funding_usd_m,
      stage: c.stage,
      investors: c.key_investors || [],
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  function roundClass(stage) {
    const s = (stage || '').toLowerCase();
    if (s.includes('seed') || s.includes('pre-seed')) return 'round-seed';
    if (s.includes('series a')) return 'round-seriesa';
    if (s.includes('series b')) return 'round-seriesb';
    if (s.includes('public')) return 'round-public';
    return 'round-other';
  }

  container.innerHTML = `
    <div class="funding-timeline-inner">
      <div class="funding-timeline-header">
        <div>Date</div>
        <div>Company</div>
        <div>Round</div>
        <div>Amount</div>
        <div>Key Investors</div>
      </div>
      ${rounds.map(r => `
        <div class="funding-row">
          <div class="funding-date">${r.date}</div>
          <div class="funding-company">${r.company}</div>
          <div><span class="funding-round-tag ${roundClass(r.stage)}">${r.stage}</span></div>
          <div class="funding-amount">$${r.amount.toLocaleString()}M</div>
          <div class="funding-investors">${r.investors.join(', ') || '—'}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Key Milestones ───────────────────────────────────────────────────────────

const MILESTONES = [
  { date: '2026-01', text: '<strong>Sakana AI</strong> receives Google strategic investment, valuation hits $2.65B' },
  { date: '2025-11', text: '<strong>Edison Scientific</strong> spins out of FutureHouse with $70M seed round' },
  { date: '2025-09', text: '<strong>Periodic Labs</strong> raises record $300M seed — largest for autonomous lab startup' },
  { date: '2025-03', text: '<strong>Lila Sciences</strong> unveiled by Flagship Pioneering with $200M seed' },
  { date: '2025-03', text: 'First fully AI-generated research paper accepted at a major ML conference' },
  { date: '2024-08', text: '<strong>Sakana AI</strong> publishes "The AI Scientist" — first fully automated scientific paper generation system' },
  { date: '2024-08', text: '<strong>Recursion Pharmaceuticals</strong> partners with NVIDIA on BioNeMo drug discovery platform' },
  { date: '2023-01', text: '<strong>FutureHouse</strong> founded by Eric Schmidt to build open-source AI research tools' },
];

function renderMilestones() {
  const container = document.getElementById('milestones-timeline');
  container.innerHTML = MILESTONES.map(m => `
    <div class="milestone-row">
      <div class="milestone-date">${m.date}</div>
      <div class="milestone-content"><span class="milestone-dot"></span>${m.text}</div>
    </div>
  `).join('');
}

// ── Filters / Dropdowns ──────────────────────────────────────────────────────

function populateDropdown(id, values) {
  const sel = document.getElementById(id);
  values.sort().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

// ── Table ────────────────────────────────────────────────────────────────────

function renderTable(data) {
  const tbody = document.getElementById('table-body');
  document.getElementById('row-count').textContent =
    `Showing ${data.length} compan${data.length === 1 ? 'y' : 'ies'}`;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-dim)">No companies match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr data-id="${c.id}">
      <td class="cell-name">
        <a href="${c.website}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${c.name}</a>
      </td>
      <td class="cell-hq">${fmt(c.hq)}</td>
      <td class="cell-founded">${fmt(c.founded)}</td>
      <td>${categoryTag(c.category)}</td>
      <td>${domainChips(c.domain)}</td>
      <td>${stageTag(c.stage)}</td>
      <td>${fmtFunding(c.total_funding_usd_m)}</td>
      <td>${listCells(c.key_investors)}</td>
      <td class="cell-notes">
        <div class="cell-notes-text">${c.notes || '—'}</div>
        ${c.notes ? `<div class="cell-notes-popover">${c.notes}</div>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const id = parseInt(row.dataset.id);
      openModal(allCompanies.find(c => c.id === id));
    });
  });
}

// ── Sorting ──────────────────────────────────────────────────────────────────

function sortData(data) {
  return [...data].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (av === null || av === undefined) av = '';
    if (bv === null || bv === undefined) bv = '';
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

document.querySelectorAll('thead th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    document.querySelectorAll('thead th').forEach(h => {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    applyFilters();
  });
});

// ── Filter Logic ─────────────────────────────────────────────────────────────

function applyFilters() {
  const search   = document.getElementById('search-input').value.toLowerCase().trim();
  const category = document.getElementById('filter-category').value;
  const domain   = document.getElementById('filter-domain').value;
  const stage    = document.getElementById('filter-stage').value;

  filtered = allCompanies.filter(c => {
    if (category && c.category !== category) return false;
    if (stage && c.stage !== stage) return false;
    if (domain && (!c.domain || !c.domain.includes(domain))) return false;
    if (search) {
      const haystack = [
        c.name, c.hq, c.description, c.approach, c.category,
        c.stage, ...(c.domain || []), ...(c.capabilities || []),
        ...(c.key_investors || []), c.notes, c.parent_org
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderTable(sortData(filtered));
  updateKPIs(filtered);
  updateCharts(filtered);
}

document.getElementById('search-input').addEventListener('input', applyFilters);
document.getElementById('filter-category').addEventListener('change', applyFilters);
document.getElementById('filter-domain').addEventListener('change', applyFilters);
document.getElementById('filter-stage').addEventListener('change', applyFilters);
document.getElementById('btn-reset').addEventListener('click', () => {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-domain').value = '';
  document.getElementById('filter-stage').value = '';
  applyFilters();
});

// ── Export CSV ────────────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', () => {
  const cols = ['name','hq','founded','category','domain','approach','stage',
                'total_funding_usd_m','key_investors','capabilities','notes'];
  const headers = ['Company','HQ','Founded','Category','Domain','Approach','Stage',
                   'Total Raised ($M)','Key Investors','Capabilities','Notes'];
  const esc = v => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('; ') : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = [headers.join(',')];
  (filtered.length ? filtered : allCompanies).forEach(c => {
    rows.push(cols.map(col => esc(c[col])).join(','));
  });
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
  if (!c) return;
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-company-name"><a href="${c.website}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${c.name} &#8599;</a></div>
    <div class="modal-company-meta">${c.hq || ''} ${c.founded ? '&bull; Founded ' + c.founded : ''}</div>
    <div class="modal-tags">
      ${categoryTag(c.category)}
      ${stageTag(c.stage)}
    </div>

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
      <div class="modal-section-body">${c.domain && c.domain.length ? c.domain.join(', ') : '—'}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Capabilities</div>
      <div class="modal-section-body">${c.capabilities && c.capabilities.length ? c.capabilities.map(p => '&bull; ' + p).join('<br>') : '—'}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Funding</div>
      <div class="modal-section-body">
        ${c.total_funding_usd_m ? `<strong>Total raised:</strong> $${c.total_funding_usd_m}M<br>` : ''}
        ${c.last_funding_date ? `<strong>Last round:</strong> ${c.last_funding_date}<br>` : ''}
        ${c.key_investors && c.key_investors.length ? `<strong>Investors:</strong> ${c.key_investors.join(', ')}` : ''}
      </div>
    </div>

    ${c.founders && c.founders.length ? `
    <div class="modal-section">
      <div class="modal-section-title">Founders</div>
      <div class="modal-section-body">${c.founders.join(', ')}</div>
    </div>` : ''}

    ${c.parent_org ? `
    <div class="modal-section">
      <div class="modal-section-title">Parent Organization</div>
      <div class="modal-section-body">${c.parent_org}</div>
    </div>` : ''}

    ${c.notes ? `
    <div class="modal-section">
      <div class="modal-section-title">Notes</div>
      <div class="modal-section-body">${c.notes}</div>
    </div>` : ''}

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

async function loadMeta() {
  try {
    const res = await fetch(META_URL);
    const meta = await res.json();
    document.getElementById('disclaimer-date').textContent = meta.last_updated || '—';
    const footerDate = document.getElementById('footer-date');
    if (footerDate) footerDate.textContent = meta.last_updated || '—';
  } catch {
    // meta.json missing or malformed — leave defaults
  }
}

async function init() {
  await loadMeta();

  const res = await fetch(DATA_URL);
  allCompanies = await res.json();
  filtered = [...allCompanies];

  // Populate dropdowns
  const categories = [...new Set(allCompanies.map(c => c.category).filter(Boolean))];
  populateDropdown('filter-category', categories);

  const domains = [...new Set(allCompanies.flatMap(c => c.domain || []))];
  populateDropdown('filter-domain', domains);

  const stages = [...new Set(allCompanies.map(c => c.stage).filter(Boolean))];
  populateDropdown('filter-stage', stages);

  updateKPIs(filtered);
  updateCharts(filtered);
  renderCapabilityMatrix(allCompanies);
  renderFundingTimeline(allCompanies);
  renderMilestones();
  renderTable(sortData(filtered));
}

init();
