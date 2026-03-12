# AI Scientists Tracker

A dark-themed interactive dashboard tracking AI Scientist platforms — companies building autonomous AI agents for scientific research. Inspired by Topology VC's Scientific AI Map.

**Live site:** https://mattmargolis.github.io/ai-scientists-tracker/

---

## Features

- **KPI cards** — total platforms, total disclosed funding, full-stack/autonomous count, median founded year
- **4 charts** — breakdown by category, funding stage, domain, and HQ region
- **Capability landscape matrix** — companies vs. research lifecycle stages (literature mining, hypothesis generation, experiment design, code execution, wet lab, data analysis, paper writing)
- **Funding timeline** — major funding rounds sorted by date with round type tags
- **Key milestones** — landmark events in autonomous scientific research (2023–2026)
- **Filterable table** — full-text search + dropdowns for category, domain, and stage
- **Sortable columns** — click any column header to sort ascending/descending
- **Company detail modal** — click any row for the full company profile
- **CSV export** — download filtered data

## Categories Tracked

| Category | Description |
|---|---|
| Full-Stack AI Scientist | End-to-end autonomous research: hypothesis to paper |
| AI Research Agent | Copilots for literature review, synthesis, and analysis |
| AI Drug Discovery | AI-driven target identification and lead optimization |
| Autonomous Lab | AI + robotics for closed-loop experimental science |
| DeSci / Open Science | Decentralized or open-source AI research platforms |

## Data

Company data lives in [`data/companies.json`](data/companies.json). Each entry includes:

| Field | Description |
|---|---|
| `name`, `website`, `hq`, `founded` | Company basics |
| `category` | Full-Stack AI Scientist, AI Research Agent, AI Drug Discovery, Autonomous Lab, or DeSci / Open Science |
| `approach` | Technical approach or architecture |
| `domain` | Array: Biology, Chemistry, Materials Science, Drug Discovery, General |
| `capabilities` | Array: Literature synthesis, Hypothesis generation, Experiment design, Code execution, Wet lab, Data analysis, Paper/Report writing |
| `stage` | Pre-seed, Seed, Series A, Series B, Series C+, Public, or Nonprofit |
| `total_funding_usd_m` | Total disclosed funding in $M |
| `last_funding_date` | Date of most recent funding round |
| `key_investors` | Notable investors |
| `founders` | Founding team |
| `parent_org` | Parent organization if spun out |
| `notes` | Additional context |

Data is sourced from public filings, company websites, and press releases. Verify independently before use.

## Adding a Company

Edit `data/companies.json` and append a new object following the existing schema. Increment the `id` field. The dashboard is purely client-side — no build step required.

## Running Locally

```bash
cd ai-scientists-tracker
npx serve .
```

Then open [http://localhost:3000](http://localhost:3000).

> Note: a local server is required (rather than opening `index.html` directly) because the app fetches `data/companies.json` via `fetch()`.

## Tech Stack

- Vanilla HTML/CSS/JavaScript — no framework, no build step
- [Chart.js](https://www.chartjs.org/) for charts
- Dark theme with indigo/cyan/violet accent palette
- Hosted on GitHub Pages
