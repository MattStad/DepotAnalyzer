/* ETF Overlap Analyzer */
class ETFAnalyzer {
  constructor() {
    this.selected = [];   // list of ETF tickers
    this.exposureChart = null;
  }

  init() {
    // Populate dropdown
    const sel = document.getElementById('add-etf-select');
    ETF_LIST.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.ticker;
      opt.textContent = `${e.ticker} — ${e.name}`;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      if (sel.value) { this.addETF(sel.value); sel.value = ''; }
    });
  }

  detectFromPortfolio(holdings) {
    this.selected = [];
    for (const h of holdings) {
      // 1. Exact ISIN match (most reliable — abbreviations in CSV don't matter)
      let match = ETF_LIST.find(e => e.isin && e.isin === h.isin);

      // 2. Fuzzy name match as fallback
      if (!match) {
        const hn = h.name.toLowerCase();
        match = ETF_LIST.find(e => {
          const en = e.name.toLowerCase();
          return hn.includes(e.ticker.toLowerCase()) ||
            en.split(' ').some(w => w.length > 5 && hn.includes(w));
        });
      }

      if (match && !this.selected.includes(match.ticker)) {
        this.selected.push(match.ticker);
      }
    }
    if (this.selected.length) this.render();
    else {
      // Show empty state with message
      document.getElementById('etf-chips').innerHTML =
        '<span style="color:var(--text3);font-size:12px">No ETFs detected — add them manually using the dropdown above</span>';
    }
  }

  addETF(ticker) {
    if (!this.selected.includes(ticker)) {
      this.selected.push(ticker);
      this.render();
    }
  }

  removeETF(ticker) {
    this.selected = this.selected.filter(t => t !== ticker);
    this.render();
  }

  render() {
    // Chips
    const chips = document.getElementById('etf-chips');
    chips.innerHTML = this.selected.map(t => {
      const e = ETF_DB[t];
      return `<div class="etf-chip">
        <span>${t}</span>
        <span style="color:var(--text2);font-size:11px;font-weight:400">${e?.name || ''}</span>
        <button class="chip-rm" onclick="etfAnalyzer.removeETF('${t}')">&times;</button>
      </div>`;
    }).join('');

    if (!this.selected.length) return;
    this.renderOverlapMatrix();
    this.renderExposureChart();
    this.renderEffectiveHoldings();
  }

  getOverlap(a, b) {
    const ha = ETF_DB[a]?.holdings || {};
    const hb = ETF_DB[b]?.holdings || {};
    let overlap = 0;
    for (const [ticker, wa] of Object.entries(ha)) {
      if (hb[ticker] != null) overlap += Math.min(wa, hb[ticker]);
    }
    return overlap; // in percentage points
  }

  renderOverlapMatrix() {
    const n = this.selected.length;
    if (n < 2) {
      document.getElementById('overlap-matrix').innerHTML =
        '<p style="color:var(--text3);padding:20px;text-align:center">Add at least 2 ETFs to see overlap</p>';
      return;
    }

    let html = '<div class="overlap-matrix"><table><thead><tr><th></th>';
    this.selected.forEach(t => html += `<th>${t}</th>`);
    html += '</tr></thead><tbody>';

    for (let i = 0; i < n; i++) {
      html += `<tr><th>${this.selected[i]}</th>`;
      for (let j = 0; j < n; j++) {
        if (i === j) {
          html += '<td style="background:var(--bg4);color:var(--text3)">—</td>';
        } else {
          const pct = this.getOverlap(this.selected[i], this.selected[j]);
          const intensity = Math.min(pct / 30, 1);
          const bg = `rgba(239,68,102,${(intensity * 0.6).toFixed(2)})`;
          const color = intensity > 0.5 ? '#fff' : 'var(--text1)';
          html += `<td class="overlap-cell" style="background:${bg};color:${color}">${pct.toFixed(1)}%</td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    document.getElementById('overlap-matrix').innerHTML = html;
  }

  renderExposureChart() {
    const ctx = document.getElementById('exposure-chart').getContext('2d');
    if (this.exposureChart) this.exposureChart.destroy();

    // Aggregate regions weighted equally across selected ETFs
    const combined = {};
    for (const t of this.selected) {
      const regions = ETF_DB[t]?.regions || {};
      const weight  = 1 / this.selected.length;
      for (const [region, pct] of Object.entries(regions)) {
        combined[region] = (combined[region] || 0) + pct * weight;
      }
    }

    const sorted = Object.entries(combined).sort((a,b) => b[1]-a[1]);
    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([,v]) => +v.toFixed(1));

    this.exposureChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Effective Exposure %', data, backgroundColor: CHART_COLORS, borderWidth: 0, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.parsed.x.toFixed(1)}%` } }},
        scales: {
          x: { ticks: { color: '#8899b8', font:{size:10}, callback: v => v+'%' }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font:{size:11} }, grid: { display: false } }
        }
      }
    });
  }

  renderEffectiveHoldings() {
    // Merge all holdings, weighted by 1/n
    const merged = {};
    const n = this.selected.length;
    for (const t of this.selected) {
      const holdings = ETF_DB[t]?.holdings || {};
      for (const [ticker, w] of Object.entries(holdings)) {
        if (!merged[ticker]) merged[ticker] = { tickers: [], totalW: 0 };
        merged[ticker].tickers.push(t);
        merged[ticker].totalW += w;
      }
    }

    const sorted = Object.entries(merged)
      .map(([ticker, d]) => ({ ticker, etfs: d.tickers, avgW: d.totalW / d.tickers.length, effectiveW: d.totalW / n }))
      .sort((a,b) => b.effectiveW - a.effectiveW)
      .slice(0, 30);

    const SECTOR_MAP = {
      'AAPL':'Technology','MSFT':'Technology','NVDA':'Technology','AMZN':'Consumer Disc','META':'Communication',
      'GOOGL':'Communication','GOOG':'Communication','AVGO':'Technology','TSLA':'Consumer Disc','LLY':'Healthcare',
      'BRK.B':'Financials','JPM':'Financials','WMT':'Consumer Staples','V':'Financials','UNH':'Healthcare',
      'XOM':'Energy','MA':'Financials','JNJ':'Healthcare','HD':'Consumer Disc','PG':'Consumer Staples',
      'ASML':'Technology','SAP':'Technology','NVO':'Healthcare','NOVO-B':'Healthcare','NESN':'Consumer Staples',
      '2330.TW':'Technology','005930.KS':'Technology','700.HK':'Communication','9988.HK':'Consumer Disc'
    };
    const COUNTRY_MAP = {
      'AAPL':'US','MSFT':'US','NVDA':'US','AMZN':'US','META':'US','GOOGL':'US','GOOG':'US','AVGO':'US',
      'TSLA':'US','LLY':'US','BRK.B':'US','JPM':'US','WMT':'US','V':'US','UNH':'US','XOM':'US','MA':'US',
      'ASML':'NL','SAP':'DE','NVO':'DK','NOVO-B':'DK','NESN':'CH',
      '2330.TW':'TW','005930.KS':'KR','700.HK':'CN','9988.HK':'CN'
    };

    const tbody = document.getElementById('overlap-holdings-tbody');
    tbody.innerHTML = sorted.map(h => `<tr>
      <td class="name-cell">${esc(h.ticker)}</td>
      <td>${h.etfs.map(t => `<span class="badge badge-blue" style="margin-right:3px">${t}</span>`).join('')}</td>
      <td>${esc(SECTOR_MAP[h.ticker] || '—')}</td>
      <td>${esc(COUNTRY_MAP[h.ticker] || '—')}</td>
      <td class="num">${h.avgW.toFixed(2)}%</td>
      <td class="num"><strong>${h.effectiveW.toFixed(2)}%</strong></td>
    </tr>`).join('');
  }
}

const etfAnalyzer = new ETFAnalyzer();
