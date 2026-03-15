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
  { key: 'Full-Stack AI Scientist', label: 'Full-Stack AI Scientist', chip: 'chip-fullstack', tag: 'tag-fullstack', color: '#6b8cce', dotColor: '#6b8cce' },
  { key: 'AI Research Agent',       label: 'AI Research Agent',       chip: 'chip-agent',     tag: 'tag-agent',     color: '#4ecdc4', dotColor: '#4ecdc4' },
  { key: 'AI Drug Discovery',       label: 'AI Drug Discovery',       chip: 'chip-drug',      tag: 'tag-drug',      color: '#e8a44a', dotColor: '#e8a44a' },
  { key: 'Autonomous Lab',          label: 'Autonomous Lab',          chip: 'chip-lab',       tag: 'tag-lab',       color: '#d4a843', dotColor: '#d4a843' },
  { key: 'DeSci / Open Science',    label: 'DeSci / Open Science',    chip: 'chip-desci',     tag: 'tag-desci',     color: '#b8a0d6', dotColor: '#b8a0d6' },
];

const CAT_MAP = {};
CATEGORIES.forEach(c => { CAT_MAP[c.key] = c; });

// Stage buckets for the map columns
const STAGE_BUCKETS = [
  { label: 'Pre-seed / Seed', stages: ['Pre-seed', 'Seed'] },
  { label: 'Series A',        stages: ['Series A'] },
  { label: 'Series B+ / Public', stages: ['Series B', 'Series C', 'Series C+', 'Public', 'Acquired'] },
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
  if (l.includes('japan') || l.includes('tokyo') || l.includes('india') || l.includes('hong kong') || l.includes('china') || l.includes('shenzhen')) return 'Asia';
  if (l.includes('uk') || l.includes('oxford') || l.includes('london') || l.includes('glasgow') || l.includes('switzerland') || l.includes('basel')) return 'Europe';
  if (l.includes('decentralized')) return 'Decentralized';
  const us = [', ca', ', ma', ', ny', ', tx', ', ct', ', ut', ', wa', ', pa', ', nj'];
  if (us.some(s => l.endsWith(s))) return 'USA';
  return 'Other';
}

function catTag(category) {
  const c = CAT_MAP[category];
  return c ? `<span class="tag ${c.tag}">${category}</span>` : `<span class="tag tag-other">${category || '—'}</span>`;
}

// ── Count-up Animation ──────────────────────────────────────────────────────

function animateCountUp(el, target, duration, prefix, suffix) {
  prefix = prefix || '';
  suffix = suffix || '';
  const start = performance.now();
  const from = 0;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const value = from + (target - from) * easeOutCubic(progress);

    if (suffix === 'B') {
      el.textContent = prefix + value.toFixed(1) + suffix;
    } else if (target > 100) {
      el.textContent = prefix + Math.round(value).toLocaleString() + suffix;
    } else {
      el.textContent = prefix + Math.round(value) + suffix;
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

let kpiAnimated = false;

function updateKPIs(data, animate) {
  const total = data.length;
  const funding = data.reduce((s, c) => s + (c.total_funding_usd_m || 0), 0);
  const fs = data.filter(c => c.category && (c.category.includes('Full-Stack') || c.category.includes('Autonomous'))).length;
  const years = data.map(c => c.founded).filter(Boolean).sort();
  const median = years.length
    ? (years.length % 2 ? years[Math.floor(years.length / 2)] : Math.round((years[Math.floor(years.length / 2) - 1] + years[Math.floor(years.length / 2)]) / 2))
    : 0;

  if (animate && !kpiAnimated) {
    kpiAnimated = true;
    animateCountUp(document.getElementById('kpi-total'), total, 1200, '', '');
    animateCountUp(document.getElementById('kpi-funding'), funding / 1000, 1400, '$', 'B');
    animateCountUp(document.getElementById('kpi-fullstack'), fs, 1000, '', '');
    animateCountUp(document.getElementById('kpi-median-year'), median, 1600, '', '');
  } else {
    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-funding').textContent = funding > 0 ? fmtMoney(funding) : '—';
    document.getElementById('kpi-fullstack').textContent = fs;
    document.getElementById('kpi-median-year').textContent = median || '—';
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

  updateKPIs(filtered, false);
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

// ── Chart.js (Stage + Region only) ──────────────────────────────────────────

const CHART_COLORS = ['#6b8cce', '#4ecdc4', '#b8a0d6', '#e8a44a', '#d4a843', '#ff6b6b', '#95e1a3', '#6b7a96'];
let chartInstances = {};

function makeChart(id, type, labels, values, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (chartInstances[id]) chartInstances[id].destroy();

  const isDoughnut = type === 'doughnut';

  chartInstances[id] = new Chart(ctx, {
    type: isDoughnut ? 'doughnut' : 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors || CHART_COLORS,
        borderColor: '#131a2e',
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: isDoughnut,
          position: 'bottom',
          labels: { color: '#6b7a96', font: { size: 10, family: 'Inter' }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          backgroundColor: '#1a2340',
          borderColor: '#2e3a60',
          borderWidth: 1,
          titleColor: '#e8ecf4',
          bodyColor: '#b0bdd0',
          titleFont: { family: 'Inter', size: 11 },
          bodyFont: { family: 'Inter', size: 11 },
        }
      },
      scales: isDoughnut ? {} : {
        x: { ticks: { color: '#6b7a96', font: { size: 9, family: 'Inter' } }, grid: { color: '#1a2340' }, beginAtZero: true },
        y: { ticks: { color: '#6b7a96', font: { size: 9, family: 'Inter' } }, grid: { color: '#1a2340' }, beginAtZero: true },
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
  const stageCounts = countBy(data, 'stage');
  makeChart('chart-stage', 'doughnut', Object.keys(stageCounts), Object.values(stageCounts));

  const regionCounts = {};
  data.forEach(c => { const r = hqRegion(c.hq); regionCounts[r] = (regionCounts[r] || 0) + 1; });
  makeChart('chart-region', 'doughnut', Object.keys(regionCounts), Object.values(regionCounts));
}

// ── D3 Bubble Chart ─────────────────────────────────────────────────────────

function renderBubbleChart(data) {
  const container = document.getElementById('bubble-chart-container');
  const svg = d3.select('#bubble-chart');
  svg.selectAll('*').remove();

  const width = container.clientWidth;
  const height = 400;
  svg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);

  // Create tooltip if not present
  let tooltip = d3.select('.d3-tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div').attr('class', 'd3-tooltip');
  }

  const funded = data.filter(c => c.total_funding_usd_m && c.total_funding_usd_m > 0);
  if (!funded.length) return;

  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(funded, d => d.total_funding_usd_m)])
    .range([8, 55]);

  const nodes = funded.map(d => ({
    ...d,
    r: radiusScale(d.total_funding_usd_m),
    cat: CAT_MAP[d.category],
  }));

  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(5))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.r + 2).strength(0.9))
    .force('x', d3.forceX(d => {
      const cats = CATEGORIES.map(c => c.key);
      const idx = cats.indexOf(d.category);
      return width * (idx + 1) / (cats.length + 1);
    }).strength(0.15))
    .force('y', d3.forceY(height / 2).strength(0.1))
    .stop();

  for (let i = 0; i < 200; i++) simulation.tick();

  const g = svg.append('g');

  const bubbles = g.selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 0)
    .attr('fill', d => d.cat ? d.cat.color : '#6b7a96')
    .attr('fill-opacity', 0.25)
    .attr('stroke', d => d.cat ? d.cat.color : '#6b7a96')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.6)
    .style('cursor', 'pointer');

  bubbles.transition()
    .duration(800)
    .delay((d, i) => i * 20)
    .attr('r', d => d.r);

  // Labels for larger bubbles
  g.selectAll('text')
    .data(nodes.filter(d => d.r > 22))
    .enter()
    .append('text')
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#e8ecf4')
    .attr('font-size', d => Math.min(d.r * 0.35, 11) + 'px')
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-weight', '600')
    .attr('pointer-events', 'none')
    .text(d => d.name.length > 12 ? d.name.slice(0, 11) + '…' : d.name)
    .attr('opacity', 0)
    .transition()
    .delay(800)
    .duration(400)
    .attr('opacity', 0.9);

  bubbles
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 0.45).attr('stroke-opacity', 1);
      tooltip.html(`
        <div class="tt-name" style="color:${d.cat ? d.cat.color : '#fff'}">${d.name}</div>
        <div class="tt-detail">${d.category} · ${d.stage}</div>
        <div class="tt-funding">${fmtMoney(d.total_funding_usd_m)}</div>
      `);
      tooltip.classed('visible', true);
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.clientX + 14) + 'px').style('top', (event.clientY - 10) + 'px');
    })
    .on('mouseleave', function() {
      d3.select(this).attr('fill-opacity', 0.25).attr('stroke-opacity', 0.6);
      tooltip.classed('visible', false);
    })
    .on('click', function(event, d) {
      if (d.website) window.open(d.website, '_blank');
    });

  // Category legend at bottom
  const legend = svg.append('g')
    .attr('transform', `translate(${width / 2 - CATEGORIES.length * 65}, ${height - 20})`);

  CATEGORIES.forEach((cat, i) => {
    const lg = legend.append('g').attr('transform', `translate(${i * 130}, 0)`);
    lg.append('circle').attr('r', 5).attr('fill', cat.color).attr('fill-opacity', 0.5);
    lg.append('text')
      .attr('x', 10).attr('y', 4)
      .attr('fill', '#6b7a96')
      .attr('font-size', '9px')
      .attr('font-family', 'Inter, sans-serif')
      .text(cat.label.replace('Full-Stack AI Scientist', 'Full-Stack').replace('DeSci / Open Science', 'DeSci'));
  });
}

// ── D3 Scatter Plot ─────────────────────────────────────────────────────────

function renderScatterPlot(data) {
  const container = document.getElementById('scatter-chart-container');
  const svg = d3.select('#scatter-chart');
  svg.selectAll('*').remove();

  const margin = { top: 24, right: 40, bottom: 48, left: 65 };
  const width = container.clientWidth;
  const height = 480;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  svg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);

  let tooltip = d3.select('.d3-tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div').attr('class', 'd3-tooltip');
  }

  const funded = data.filter(c => c.total_funding_usd_m && c.total_funding_usd_m > 0 && c.founded);
  if (!funded.length) return;

  const minFunding = d3.min(funded, d => d.total_funding_usd_m);
  const maxFunding = d3.max(funded, d => d.total_funding_usd_m);

  const xScale = d3.scaleLinear()
    .domain([d3.min(funded, d => d.founded) - 1, d3.max(funded, d => d.founded) + 1])
    .range([0, innerW]);

  const yScale = d3.scaleLog()
    .domain([Math.max(1, minFunding * 0.6), maxFunding * 1.5])
    .range([innerH, 0]);

  const rScale = d3.scaleSqrt()
    .domain([0, maxFunding])
    .range([5, 24]);

  // Pre-compute positions, then use force simulation to separate overlapping dots
  const nodes = funded.map(d => ({
    ...d,
    x: xScale(d.founded),
    y: yScale(d.total_funding_usd_m),
    r: rScale(d.total_funding_usd_m),
  }));

  const sim = d3.forceSimulation(nodes)
    .force('x', d3.forceX(d => xScale(d.founded)).strength(0.8))
    .force('y', d3.forceY(d => yScale(d.total_funding_usd_m)).strength(0.8))
    .force('collide', d3.forceCollide(d => d.r + 2).strength(0.7))
    .stop();

  for (let i = 0; i < 120; i++) sim.tick();

  // Clamp to chart bounds
  nodes.forEach(d => {
    d.x = Math.max(d.r, Math.min(innerW - d.r, d.x));
    d.y = Math.max(d.r, Math.min(innerH - d.r, d.y));
  });

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Grid lines
  const yTicks = [3, 5, 10, 20, 50, 100, 200, 500, 1000, 1500];
  const visibleYTicks = yTicks.filter(t => t >= minFunding * 0.6 && t <= maxFunding * 1.5);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(10))
    .call(g => g.select('.domain').attr('stroke', '#253054'))
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a2340'))
    .call(g => g.selectAll('.tick text').attr('fill', '#6b7a96').attr('font-size', '10px'));

  g.append('g')
    .call(d3.axisLeft(yScale)
      .tickValues(visibleYTicks)
      .tickFormat(d => {
        if (d >= 1000) return '$' + (d / 1000) + 'B';
        return '$' + d + 'M';
      }))
    .call(g => g.select('.domain').attr('stroke', '#253054'))
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a2340').clone().attr('x2', innerW).attr('stroke-opacity', 0.2))
    .call(g => g.selectAll('.tick text').attr('fill', '#6b7a96').attr('font-size', '10px'));

  // Axis labels
  svg.append('text')
    .attr('x', margin.left + innerW / 2)
    .attr('y', height - 6)
    .attr('text-anchor', 'middle')
    .attr('fill', '#6b7a96')
    .attr('font-size', '10px')
    .attr('font-family', 'Inter, sans-serif')
    .text('Founded Year');

  svg.append('text')
    .attr('transform', `translate(14,${margin.top + innerH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', '#6b7a96')
    .attr('font-size', '10px')
    .attr('font-family', 'Inter, sans-serif')
    .text('Total Funding (log scale)');

  // Dots (using force-separated positions)
  const dots = g.selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 0)
    .attr('fill', d => { const cat = CAT_MAP[d.category]; return cat ? cat.color : '#6b7a96'; })
    .attr('fill-opacity', 0.35)
    .attr('stroke', d => { const cat = CAT_MAP[d.category]; return cat ? cat.color : '#6b7a96'; })
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.7)
    .style('cursor', 'pointer');

  // Labels for dots large enough to read
  g.selectAll('.scatter-label')
    .data(nodes.filter(d => d.r >= 12))
    .enter()
    .append('text')
    .attr('class', 'scatter-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y + d.r + 12)
    .attr('text-anchor', 'middle')
    .attr('fill', '#b0bdd0')
    .attr('font-size', '8.5px')
    .attr('font-family', 'Inter, sans-serif')
    .attr('pointer-events', 'none')
    .text(d => d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name)
    .attr('opacity', 0)
    .transition()
    .delay(700)
    .duration(400)
    .attr('opacity', 0.7);

  dots.transition()
    .duration(600)
    .delay((d, i) => i * 25)
    .attr('r', d => rScale(d.total_funding_usd_m));

  dots
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('fill-opacity', 0.6).attr('stroke-opacity', 1).attr('stroke-width', 2.5);
      const cat = CAT_MAP[d.category];
      tooltip.html(`
        <div class="tt-name" style="color:${cat ? cat.color : '#fff'}">${d.name}</div>
        <div class="tt-detail">${d.category} · Founded ${d.founded}</div>
        <div class="tt-funding">${fmtMoney(d.total_funding_usd_m)}</div>
      `);
      tooltip.classed('visible', true);
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.clientX + 14) + 'px').style('top', (event.clientY - 10) + 'px');
    })
    .on('mouseleave', function() {
      d3.select(this).attr('fill-opacity', 0.35).attr('stroke-opacity', 0.7).attr('stroke-width', 1.5);
      tooltip.classed('visible', false);
    })
    .on('click', function(event, d) {
      if (d.website) window.open(d.website, '_blank');
    });
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
    html += `<tr><td style="color:${cat ? cat.color : '#b0bdd0'}">${c.name}</td>`;
    CAPS.forEach(cap => {
      const has = c.capabilities && (c.capabilities.includes(cap) || (cap === 'Paper/Report writing' && c.capabilities.includes('Report generation')));
      html += `<td><span class="cap-dot ${has ? 'yes' : 'no'}">${has ? '&#10003;' : '&mdash;'}</span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  t.innerHTML = html;
}

// ── Funding Bars (replaces card grid) ────────────────────────────────────────

function renderRounds(data) {
  const rounds = data
    .filter(c => c.total_funding_usd_m)
    .sort((a, b) => b.total_funding_usd_m - a.total_funding_usd_m)
    .slice(0, 8);

  const maxFunding = rounds.length ? rounds[0].total_funding_usd_m : 1;
  const container = document.getElementById('rounds-list');

  container.innerHTML = rounds.map((c, i) => {
    const cat = CAT_MAP[c.category];
    const color = cat ? cat.color : '#6b7a96';
    const pct = (c.total_funding_usd_m / maxFunding * 100).toFixed(1);
    return `
    <div class="funding-bar-row reveal">
      <span class="funding-bar-rank">${i + 1}</span>
      <span class="funding-bar-name" style="color:${color}">${c.name}</span>
      <div class="funding-bar-track">
        <div class="funding-bar-fill" style="background:${color}; opacity:0.3;" data-width="${pct}%"></div>
      </div>
      <span class="funding-bar-amount">${fmtMoney(c.total_funding_usd_m)}</span>
      <span class="funding-bar-meta">${c.stage} · ${(c.key_investors || []).slice(0, 1).join('')}</span>
    </div>`;
  }).join('');
}

// ── Key Milestones ───────────────────────────────────────────────────────────

const MILESTONES = [
  { date: 'Jan 2026', text: '<strong>Sakana AI</strong> receives Google strategic investment, valuation hits $2.65B' },
  { date: 'Nov 2025', text: '<strong>Edison Scientific</strong> (formerly FutureHouse) raises $70M seed round' },
  { date: 'Sep 2025', text: '<strong>Periodic Labs</strong> raises record $300M seed — largest for autonomous lab startup' },
  { date: 'Mar 2025', text: '<strong>Lila Sciences</strong> unveiled by Flagship Pioneering with $200M seed' },
  { date: 'Mar 2025', text: 'First fully AI-generated research paper accepted at a major ML conference' },
  { date: 'Aug 2024', text: '<strong>Sakana AI</strong> publishes "The AI Scientist" — first automated paper generation system' },
  { date: 'Aug 2024', text: '<strong>Recursion</strong> acquires Exscientia for ~$688M; partners with NVIDIA on BioNeMo' },
  { date: 'Jan 2023', text: '<strong>FutureHouse</strong> (now Edison Scientific) founded by Eric Schmidt to build open-source AI research tools' },
];

function renderMilestones() {
  const container = document.getElementById('milestones-list');
  container.innerHTML = MILESTONES.map(m => `
    <div class="milestone reveal">
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
    <div class="modal-name"><a href="${c.website}" target="_blank" rel="noopener" style="color:${cat ? cat.color : '#b0bdd0'}">${c.name} &#8599;</a></div>
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

// ── Scroll Reveal (IntersectionObserver) ─────────────────────────────────────

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        // Stagger siblings
        const parent = entry.target.parentElement;
        const siblings = parent ? Array.from(parent.querySelectorAll('.reveal')) : [];
        const sibIndex = siblings.indexOf(entry.target);
        const delay = sibIndex >= 0 ? sibIndex * 80 : 0;

        setTimeout(() => {
          entry.target.classList.add('revealed');

          // Animate funding bars when revealed
          const bars = entry.target.querySelectorAll('.funding-bar-fill');
          bars.forEach(bar => {
            const w = bar.dataset.width;
            if (w) {
              requestAnimationFrame(() => { bar.style.width = w; });
            }
          });
        }, delay);

        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

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
  updateKPIs(filtered, true);
  updateCharts(filtered);
  buildMap(filtered);
  renderCapMatrix(allCompanies);
  renderRounds(allCompanies);
  renderMilestones();
  renderTable(sortData(filtered));
  renderBubbleChart(allCompanies);
  renderScatterPlot(allCompanies);

  // Init scroll reveal after everything is rendered
  requestAnimationFrame(() => initScrollReveal());

  // Resize D3 charts
  window.addEventListener('resize', () => {
    renderBubbleChart(allCompanies);
    renderScatterPlot(allCompanies);
  });
}

init();
