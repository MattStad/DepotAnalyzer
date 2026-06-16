/* ETF Overlap Analyzer — portfolio-centric overlap detection */
class ETFAnalyzer {
  constructor() {
    this.selected = [];
    this.portfolioWeights = {};
    this.exposureChart = null;
    this.sectorChart = null;
    this.sectorBreakdownChart = null;
    this.selectedPair = null;
    this.selectedSingle = null;
    this._holdingsSort = { key: 'effectiveW', asc: false }; // default: eff. weight desc
  }

  init() {
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

    // Wire up sortable holdings table headers
    document.getElementById('holdings-sort-header')?.addEventListener('click', e => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (this._holdingsSort.key === key) {
        this._holdingsSort.asc = !this._holdingsSort.asc;
      } else {
        this._holdingsSort.key = key;
        // Text columns sort A→Z by default, numeric columns sort large→small
        this._holdingsSort.asc = ['ticker', 'sector', 'country', 'etfs'].includes(key);
      }
      this.renderEffectiveHoldings();
    });
  }

  detectFromPortfolio(holdings) {
    this.selected = [];
    this.portfolioWeights = {};
    const totalValue = holdings.reduce((s, h) => s + h.curValue, 0);
    for (const h of holdings) {
      let match = ETF_LIST.find(e => e.isin && e.isin === h.isin);
      if (!match) {
        const hn = h.name.toLowerCase();
        match = ETF_LIST.find(e => {
          if (hn.includes(e.ticker.toLowerCase())) return true;
          const en = e.name.toLowerCase();
          // Require ≥2 long words (≥7 chars) to match, OR 1 very long word (≥11 chars)
          // Avoids single-word false positives like "world", "amundi", "msci"
          const longWords = en.split(/\s+/).filter(w => w.length >= 7);
          const hits = longWords.filter(w => hn.includes(w));
          return hits.length >= 2 || hits.some(w => w.length >= 11);
        });
      }
      if (match && !this.selected.includes(match.ticker)) {
        this.selected.push(match.ticker);
        this.portfolioWeights[match.ticker] = totalValue > 0 ? h.curValue / totalValue : 0;
      }
    }
    this.render();
  }

  _getDisplayWeights() {
    const totalPortW = this.selected.reduce((s, t) => s + (this.portfolioWeights[t] || 0), 0);
    const weights = {};
    this.selected.forEach(t => {
      weights[t] = this.portfolioWeights[t] !== undefined
        ? (this.portfolioWeights[t] || 0)
        : (totalPortW > 0 ? totalPortW / this.selected.length : 1 / this.selected.length);
    });
    const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
    this.selected.forEach(t => weights[t] /= total);
    return weights;
  }

  addETF(ticker) {
    if (!this.selected.includes(ticker)) {
      this.selected.push(ticker);
      this.render();
    }
  }

  removeETF(ticker) {
    this.selected = this.selected.filter(t => t !== ticker);
    if (this.selectedPair && (this.selectedPair[0] === ticker || this.selectedPair[1] === ticker)) {
      this.closeDetail();
    }
    if (this.selectedSingle === ticker) this.closeSingleDetail();
    this.render();
  }

  render() {
    this._updateChips();
    if (!this.selected.length) {
      document.getElementById('etf-kpis').innerHTML = '';
      return;
    }
    const section = document.getElementById('section-etf');
    if (section && section.style.display !== 'none') this._renderCharts();
  }

  _updateChips() {
    const chips = document.getElementById('etf-chips');
    if (!this.selected.length) {
      chips.innerHTML = '<span style="color:var(--text3);font-size:12px">Keine ETFs erkannt — importiere dein Portfolio oder füge ETFs manuell hinzu</span>';
      return;
    }
    chips.innerHTML = this.selected.map(t => {
      const e = ETF_DB[t];
      const w = this.portfolioWeights[t];
      const wLabel = w != null ? `<span style="color:var(--accent-cyan);font-size:10px;margin-left:4px">${(w * 100).toFixed(1)}%</span>` : '';
      const holdingCount = Object.keys(e?.holdings || {}).length;
      return `<div class="etf-chip" style="cursor:pointer" onclick="etfAnalyzer.showSingleETF('${t}')" title="Klicken um ${holdingCount} Holdings zu sehen">
        <span>${t}</span>${wLabel}
        <span style="color:var(--text2);font-size:11px;font-weight:400">${e?.name || ''}</span>
        <span style="color:var(--text3);font-size:10px">(${holdingCount})</span>
        <button class="chip-rm" onclick="event.stopPropagation();etfAnalyzer.removeETF('${t}')">&times;</button>
      </div>`;
    }).join('');
  }

  _renderCharts() {
    this.renderKPIs();
    this.renderOverlapMatrix();
    this.renderExposureChart();
    this.renderSectorCharts();
    this.renderEffectiveHoldings();
    if (this.selectedPair) this.renderOverlapDetail(this.selectedPair[0], this.selectedPair[1]);
    if (this.selectedSingle) this.renderSingleETFDetail(this.selectedSingle);
  }

  /* ── Portfolio Stats ── */
  _getPortfolioStats() {
    const allStocks = {};
    const displayWeights = this._getDisplayWeights();

    for (const t of this.selected) {
      const holdings = ETF_DB[t]?.holdings || {};
      for (const [ticker, w] of Object.entries(holdings)) {
        if (!allStocks[ticker]) allStocks[ticker] = { etfs: [], effectiveW: 0 };
        allStocks[ticker].etfs.push(t);
        allStocks[ticker].effectiveW += w * displayWeights[t];
      }
    }

    const totalStocks = Object.keys(allStocks).length;
    const overlapping = Object.values(allStocks).filter(s => s.etfs.length > 1);
    const overlappingCount = overlapping.length;

    const totalEffective = Object.values(allStocks).reduce((s, v) => s + v.effectiveW, 0);
    const overlapEffective = overlapping.reduce((s, v) => s + v.effectiveW, 0);
    const overlapScore = totalEffective > 0 ? (overlapEffective / totalEffective * 100) : 0;

    let maxPair = { a: '—', b: '—', pct: 0 };
    for (let i = 0; i < this.selected.length; i++) {
      for (let j = i + 1; j < this.selected.length; j++) {
        const pct = this.getOverlap(this.selected[i], this.selected[j]);
        if (pct > maxPair.pct) maxPair = { a: this.selected[i], b: this.selected[j], pct };
      }
    }

    return { totalStocks, overlappingCount, overlapScore, maxPair, etfCount: this.selected.length };
  }

  /* ── KPI Cards ── */
  renderKPIs() {
    const el = document.getElementById('etf-kpis');
    if (this.selected.length < 2) { el.innerHTML = ''; return; }

    const s = this._getPortfolioStats();
    const scoreColor = s.overlapScore > 60 ? 'var(--red)' : s.overlapScore > 30 ? 'var(--yellow)' : 'var(--green)';

    el.innerHTML = `<div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">ETFs im Portfolio</div>
        <div class="kpi-value">${s.etfCount}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Einzigartige Aktien</div>
        <div class="kpi-value">${s.totalStocks}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Aktien in 2+ ETFs</div>
        <div class="kpi-value" style="color:${s.overlappingCount > 0 ? 'var(--yellow)' : 'var(--green)'}">${s.overlappingCount}</div>
        <div class="kpi-delta">${s.totalStocks > 0 ? (s.overlappingCount / s.totalStocks * 100).toFixed(0) : 0}% aller Aktien</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Overlap Score</div>
        <div class="kpi-value" style="color:${scoreColor}">${s.overlapScore.toFixed(1)}%</div>
        <div class="kpi-delta">Anteil eff. Gewicht in überlappenden Aktien</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Höchster Overlap</div>
        <div class="kpi-value" style="font-size:16px">${s.maxPair.a} ↔ ${s.maxPair.b}</div>
        <div class="kpi-delta">${s.maxPair.pct.toFixed(1)}% gemeinsame Holdings</div>
      </div>
    </div>`;
  }

  /* ── Overlap Calculation ── */
  getOverlap(a, b) {
    const ha = ETF_DB[a]?.holdings || {};
    const hb = ETF_DB[b]?.holdings || {};
    let overlap = 0;
    for (const [ticker, wa] of Object.entries(ha)) {
      if (hb[ticker] != null) overlap += Math.min(wa, hb[ticker]);
    }
    return overlap;
  }

  getOverlapDetails(a, b) {
    const ha = ETF_DB[a]?.holdings || {};
    const hb = ETF_DB[b]?.holdings || {};
    const common = [];
    for (const [ticker, wa] of Object.entries(ha)) {
      if (hb[ticker] != null) {
        common.push({ ticker, weightA: wa, weightB: hb[ticker], overlap: Math.min(wa, hb[ticker]) });
      }
    }
    common.sort((x, y) => y.overlap - x.overlap);
    return common;
  }

  /* ── Overlap Matrix ── */
  renderOverlapMatrix() {
    const n = this.selected.length;
    if (n < 2) {
      document.getElementById('overlap-matrix').innerHTML =
        '<p style="color:var(--text3);padding:20px;text-align:center">Mindestens 2 ETFs nötig für Overlap-Analyse</p>';
      return;
    }

    let html = '<div class="overlap-matrix"><table><thead><tr><th></th>';
    this.selected.forEach(t => html += `<th>${t}</th>`);
    html += '</tr></thead><tbody>';

    for (let i = 0; i < n; i++) {
      html += `<tr><th>${this.selected[i]}</th>`;
      for (let j = 0; j < n; j++) {
        if (i === j) {
          const ticker = this.selected[i];
          const etfHoldings = ETF_DB[ticker]?.holdings || {};
          const count = Object.keys(etfHoldings).length;
          const firstKey = Object.keys(etfHoldings)[0] || '';
          const isCommodity = COMMODITY_TICKERS.has(firstKey);
          const label = isCommodity ? 'Komponenten ›' : 'Aktien ›';
          html += `<td class="overlap-cell" style="background:var(--bg4);color:var(--cyan);cursor:pointer;font-size:10px"
            onclick="etfAnalyzer.showSingleETF('${ticker}')" title="Klicken um alle Holdings zu sehen">
            <div style="font-size:13px;font-weight:700">${count}</div>
            <div style="font-size:9px">${label}</div>
          </td>`;
        } else {
          const pct = this.getOverlap(this.selected[i], this.selected[j]);
          const details = this.getOverlapDetails(this.selected[i], this.selected[j]);
          const intensity = Math.min(pct / 30, 1);
          const bg = `rgba(239,68,102,${(intensity * 0.6).toFixed(2)})`;
          const color = intensity > 0.5 ? '#fff' : 'var(--text1)';
          const a = this.selected[i], b = this.selected[j];
          html += `<td class="overlap-cell" style="background:${bg};color:${color};cursor:pointer"
            onclick="etfAnalyzer.showDetail('${a}','${b}')" title="${details.length} gemeinsame Aktien — klicken für Details">
            <div style="font-size:14px;font-weight:700">${pct.toFixed(1)}%</div>
            <div style="font-size:9px;opacity:.7">${details.length} Aktien</div>
          </td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    document.getElementById('overlap-matrix').innerHTML = html;
  }

  /* ── Single ETF Holdings Detail ── */
  showSingleETF(ticker) {
    this.selectedSingle = ticker;
    this.selectedPair = null;
    document.getElementById('overlap-detail').style.display = 'none';
    this.renderSingleETFDetail(ticker);
  }

  closeSingleDetail() {
    this.selectedSingle = null;
    const panel = document.getElementById('overlap-detail');
    panel.style.display = 'none';
  }

  renderSingleETFDetail(ticker) {
    const etf = ETF_DB[ticker];
    if (!etf) return;
    const panel = document.getElementById('overlap-detail');
    const holdings = Object.entries(etf.holdings || {}).sort((a, b) => b[1] - a[1]);
    const totalHoldingW = holdings.reduce((s, [, w]) => s + w, 0);
    const displayWeights = this._getDisplayWeights();
    const portfolioW = displayWeights[ticker] || 0;

    // Find which other selected ETFs also hold each stock
    const otherETFs = this.selected.filter(t => t !== ticker);
    const overlapMap = {};
    for (const [stock] of holdings) {
      overlapMap[stock] = otherETFs.filter(t => (ETF_DB[t]?.holdings || {})[stock] != null);
    }

    document.getElementById('overlap-detail-title').innerHTML =
      `<span class="badge-blue badge">${ticker}</span> <span style="margin:0 6px;color:var(--text2)">—</span> ${esc(etf.name)}`;
    document.getElementById('overlap-detail-colA').textContent = 'Gewicht im ETF';
    document.getElementById('overlap-detail-colB').textContent = 'Eff. Portfolio-Gewicht';

    const summaryEl = document.getElementById('overlap-detail-summary');
    summaryEl.innerHTML = `<div style="display:flex;gap:24px;margin-bottom:12px;flex-wrap:wrap">
      <div><span style="color:var(--text3);font-size:11px">Enthaltene Aktien</span><br><strong style="font-size:18px">${holdings.length}</strong></div>
      <div><span style="color:var(--text3);font-size:11px">Top-Holdings Coverage</span><br><strong style="font-size:18px">${totalHoldingW.toFixed(1)}%</strong></div>
      <div><span style="color:var(--text3);font-size:11px">Portfolio-Anteil</span><br><strong style="font-size:18px;color:var(--cyan)">${(portfolioW * 100).toFixed(1)}%</strong></div>
      <div><span style="color:var(--text3);font-size:11px">TER</span><br><strong style="font-size:18px">${etf.ter}%</strong></div>
      <div><span style="color:var(--text3);font-size:11px">Volumen</span><br><strong style="font-size:18px">${etf.aum ? (etf.aum >= 1000 ? (etf.aum/1000).toFixed(0) + ' Mrd' : etf.aum + ' Mio') : '—'} ${etf.currency || ''}</strong></div>
    </div>
    ${etf.description ? `<div style="color:var(--text2);font-size:12px;margin-bottom:12px">${esc(etf.description)}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      ${Object.entries(etf.regions || {}).sort((a,b) => b[1]-a[1]).map(([r,p]) =>
        `<span class="badge badge-blue" style="font-size:10px">${esc(r)} ${p.toFixed(1)}%</span>`).join('')}
    </div>`;

    // Commodity ETFs: scale bars relative to largest component
    const isCommodityETF = holdings.length > 0 && COMMODITY_TICKERS.has(holdings[0][0]);
    const maxWeight = holdings.length > 0 ? holdings[0][1] : 8; // already sorted desc

    const tbody = document.getElementById('overlap-detail-tbody');
    tbody.innerHTML = holdings.map(([stock, weight]) => {
      const barScale = isCommodityETF ? maxWeight * 1.1 : 8;
      const barW = Math.min(weight / barScale * 100, 100);
      const effW = weight * portfolioW;
      const effBarScale = isCommodityETF ? maxWeight * portfolioW * 1.1 : 4;
      const effBar = Math.min(effW / effBarScale * 100, 100);
      const alsoIn = isCommodityETF ? [] : (overlapMap[stock] || []);
      const sectorInfo = STOCK_SECTOR_MAP[stock] || '—';
      const countryInfo = STOCK_COUNTRY_MAP[stock] || '—';
      const overlapBadges = alsoIn.length > 0
        ? alsoIn.map(t => `<span class="badge badge-yellow" style="font-size:8px;margin-left:2px">${t}</span>`).join('')
        : '';
      return `<tr${alsoIn.length > 0 ? ' style="background:rgba(245,158,11,.04)"' : ''}>
        <td class="name-cell">
          <strong>${esc(stock)}</strong>
          ${overlapBadges}
          <span style="color:var(--text3);font-size:10px;margin-left:4px">${esc(sectorInfo)} · ${esc(countryInfo)}</span>
        </td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
            <div style="width:60px;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
              <div style="width:${barW}%;height:100%;background:var(--cyan);border-radius:3px"></div>
            </div>
            ${weight.toFixed(2)}%
          </div>
        </td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
            <div style="width:60px;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
              <div style="width:${effBar}%;height:100%;background:var(--blue);border-radius:3px"></div>
            </div>
            ${effW.toFixed(3)}%
          </div>
        </td>
        <td class="num">${isCommodityETF
          ? `<span style="color:var(--text3)">Futures</span>`
          : alsoIn.length > 0
            ? `<span style="color:var(--yellow)">${alsoIn.length} ETF${alsoIn.length>1?'s':''}</span>`
            : `<span style="color:var(--green)">Einzigartig</span>`}</td>
      </tr>`;
    }).join('');

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── Overlap Detail Panel (two ETFs) ── */
  showDetail(a, b) {
    this.selectedPair = [a, b];
    this.selectedSingle = null;
    this.renderOverlapDetail(a, b);
  }

  closeDetail() {
    this.selectedPair = null;
    this.selectedSingle = null;
    document.getElementById('overlap-detail').style.display = 'none';
  }

  renderOverlapDetail(a, b) {
    const panel = document.getElementById('overlap-detail');
    const details = this.getOverlapDetails(a, b);
    const totalOverlap = details.reduce((s, d) => s + d.overlap, 0);
    const displayWeights = this._getDisplayWeights();
    const wA = displayWeights[a] || 0;
    const wB = displayWeights[b] || 0;

    document.getElementById('overlap-detail-title').innerHTML =
      `<span class="badge-blue badge">${a}</span> <span style="margin:0 6px;color:var(--text3)">↔</span> <span class="badge-blue badge">${b}</span> Overlap Detail`;
    document.getElementById('overlap-detail-colA').textContent = `In ${a}`;
    document.getElementById('overlap-detail-colB').textContent = `In ${b}`;

    const summaryEl = document.getElementById('overlap-detail-summary');
    summaryEl.innerHTML = `<div style="display:flex;gap:24px;margin-bottom:12px;flex-wrap:wrap">
      <div><span style="color:var(--text3);font-size:11px">Gemeinsame Aktien</span><br><strong style="font-size:18px">${details.length}</strong></div>
      <div><span style="color:var(--text3);font-size:11px">Gesamt-Overlap</span><br><strong style="font-size:18px;color:var(--red)">${totalOverlap.toFixed(1)}%</strong></div>
      <div><span style="color:var(--text3);font-size:11px">${a} Portfolio-Anteil</span><br><strong style="font-size:18px">${(wA * 100).toFixed(1)}%</strong></div>
      <div><span style="color:var(--text3);font-size:11px">${b} Portfolio-Anteil</span><br><strong style="font-size:18px">${(wB * 100).toFixed(1)}%</strong></div>
      <div><span style="color:var(--text3);font-size:11px">Eff. Portfolio-Overlap</span><br><strong style="font-size:18px;color:var(--yellow)">${(totalOverlap * Math.min(wA, wB) * 2).toFixed(2)}%</strong></div>
    </div>`;

    const tbody = document.getElementById('overlap-detail-tbody');
    tbody.innerHTML = details.map(d => {
      const barA = Math.min(d.weightA / 8 * 100, 100);
      const barB = Math.min(d.weightB / 8 * 100, 100);
      return `<tr>
        <td class="name-cell">${esc(d.ticker)}</td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
            <div style="width:60px;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
              <div style="width:${barA}%;height:100%;background:var(--cyan);border-radius:3px"></div>
            </div>
            ${d.weightA.toFixed(2)}%
          </div>
        </td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
            <div style="width:60px;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
              <div style="width:${barB}%;height:100%;background:var(--blue);border-radius:3px"></div>
            </div>
            ${d.weightB.toFixed(2)}%
          </div>
        </td>
        <td class="num"><strong>${d.overlap.toFixed(2)}%</strong></td>
      </tr>`;
    }).join('');

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── Region Exposure Chart ── */
  renderExposureChart() {
    const ctx = document.getElementById('exposure-chart').getContext('2d');
    if (this.exposureChart) this.exposureChart.destroy();

    const displayWeights = this._getDisplayWeights();
    const combined = {};
    for (const t of this.selected) {
      const regions = ETF_DB[t]?.regions || {};
      const weight = displayWeights[t];
      for (const [region, pct] of Object.entries(regions)) {
        combined[region] = (combined[region] || 0) + pct * weight;
      }
    }

    const sorted = Object.entries(combined).sort((a, b) => b[1] - a[1]);
    this.exposureChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{ label: 'Effektive Exposure %', data: sorted.map(([, v]) => +v.toFixed(1)), backgroundColor: CHART_COLORS, borderWidth: 0, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.x.toFixed(1)}%` } } },
        scales: {
          x: { ticks: { color: '#8899b8', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  }

  /* ── Sector Charts ── */
  renderSectorCharts() {
    const displayWeights = this._getDisplayWeights();

    const combined = {};
    for (const t of this.selected) {
      const sectors = ETF_DB[t]?.sectors || {};
      const weight = displayWeights[t];
      for (const [sector, pct] of Object.entries(sectors)) {
        combined[sector] = (combined[sector] || 0) + pct * weight;
      }
    }
    const sorted = Object.entries(combined).sort((a, b) => b[1] - a[1]);

    const ctx1 = document.getElementById('sector-chart').getContext('2d');
    if (this.sectorChart) this.sectorChart.destroy();
    this.sectorChart = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{ data: sorted.map(([, v]) => +v.toFixed(1)), backgroundColor: CHART_COLORS, borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { color: '#8899b8', font: { size: 10 }, boxWidth: 10, padding: 6 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` } }
        }
      }
    });

    const allSectors = [...new Set(this.selected.flatMap(t => Object.keys(ETF_DB[t]?.sectors || {})))];
    const datasets = allSectors.map((sector, i) => ({
      label: sector,
      data: this.selected.map(t => ETF_DB[t]?.sectors?.[sector] || 0),
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
      borderWidth: 0
    }));

    const ctx2 = document.getElementById('sector-breakdown-chart').getContext('2d');
    if (this.sectorBreakdownChart) this.sectorBreakdownChart.destroy();
    this.sectorBreakdownChart = new Chart(ctx2, {
      type: 'bar',
      data: { labels: this.selected, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: {
          x: { stacked: true, ticks: { color: '#8899b8', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#1a2840' }, max: 100 },
          y: { stacked: true, ticks: { color: '#8899b8', font: { size: 11 } }, grid: { display: false } }
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8899b8', font: { size: 9 }, boxWidth: 8, padding: 4 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` } }
        }
      }
    });
  }

  /* ── Effective Holdings Table ── */
  renderEffectiveHoldings() {
    const merged = {};
    const displayWeights = this._getDisplayWeights();
    for (const t of this.selected) {
      const holdings = ETF_DB[t]?.holdings || {};
      const etfW = displayWeights[t];
      for (const [ticker, w] of Object.entries(holdings)) {
        if (!merged[ticker]) merged[ticker] = { tickers: [], totalW: 0, effectiveW: 0 };
        merged[ticker].tickers.push(t);
        merged[ticker].totalW += w;
        merged[ticker].effectiveW += w * etfW;
      }
    }

    const rows = Object.entries(merged).map(([ticker, d]) => ({
      ticker,
      etfs: d.tickers,
      avgW: d.totalW / d.tickers.length,
      effectiveW: d.effectiveW,
      overlapCount: d.tickers.length,
      sector: STOCK_SECTOR_MAP[ticker] || '—',
      country: STOCK_COUNTRY_MAP[ticker] || '—',
    }));

    // Apply sort
    const { key, asc } = this._holdingsSort;
    rows.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key === 'etfs') { va = a.etfs.join(','); vb = b.etfs.join(','); }
      if (typeof va === 'string') {
        // Always push '—' to the end regardless of sort direction
        if (va === '—' && vb !== '—') return 1;
        if (vb === '—' && va !== '—') return -1;
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return asc ? va - vb : vb - va;
    });
    const displayed = rows.slice(0, 40);

    // Update header sort indicators
    document.querySelectorAll('#holdings-sort-header th[data-sort]').forEach(th => {
      const isActive = th.dataset.sort === key;
      const arrow = isActive ? (asc ? ' ↑' : ' ↓') : '';
      // Strip old arrow and re-apply
      th.textContent = th.textContent.replace(/ [↑↓]$/, '') + arrow;
      th.style.color = isActive ? 'var(--cyan)' : '';
      th.style.cursor = 'pointer';
    });

    const tbody = document.getElementById('overlap-holdings-tbody');
    tbody.innerHTML = displayed.map(h => {
      const overlapBadge = h.overlapCount > 1
        ? `<span class="badge-red badge" style="font-size:9px">${h.overlapCount}×</span>`
        : `<span class="badge-green badge" style="font-size:9px">1×</span>`;
      const rowStyle = h.overlapCount > 2 ? 'background:rgba(239,68,102,.06)' : h.overlapCount > 1 ? 'background:rgba(245,158,11,.04)' : '';
      const tkAttr = esc(h.ticker).replace(/'/g, "\\'");
      return `<tr style="${rowStyle}">
        <td class="name-cell"><strong class="ticker-link" style="cursor:pointer;color:var(--accent-cyan)"
            onclick="etfAnalyzer.researchHolding('${tkAttr}')" title="Im Stock Research öffnen">${esc(h.ticker)}</strong></td>
        <td>${h.etfs.map(t => `<span class="badge badge-blue" style="margin-right:3px">${t}</span>`).join('')}</td>
        <td class="num">${overlapBadge}</td>
        <td>${esc(h.sector)}</td>
        <td>${esc(h.country)}</td>
        <td class="num">${h.avgW.toFixed(2)}%</td>
        <td class="num"><strong>${h.effectiveW.toFixed(2)}%</strong></td>
      </tr>`;
    }).join('');
  }

  /* Open a holding (stock OR commodity component) in Stock Research.
     Commodity names like "Gold (GC)" are mapped to their Yahoo futures symbol;
     plain stock tickers are passed straight through. */
  researchHolding(raw) {
    let query = raw;
    const m = raw.match(/\(([^)]+)\)\s*$/);          // commodity code in parentheses
    if (m && COMMODITY_YH[m[1].trim()]) {
      query = COMMODITY_YH[m[1].trim()];
    } else if (COMMODITY_YH[raw]) {                   // e.g. "HRW Wheat"
      query = COMMODITY_YH[raw];
    }
    if (typeof app !== 'undefined') app.navigate('research');
    const input = document.getElementById('stock-search');
    if (input) input.value = query;
    if (typeof research !== 'undefined') research.search(query);
  }
}

/* Commodity component → Yahoo Finance futures symbol (for research click-through) */
const COMMODITY_YH = {
  'GC': 'GC=F', 'SI': 'SI=F', 'CL': 'CL=F', 'CO': 'BZ=F', 'NG': 'NG=F',
  'HG': 'HG=F', 'S': 'ZS=F', 'C': 'ZC=F', 'W': 'ZW=F', 'KW': 'KE=F',
  'BO': 'ZL=F', 'SM': 'ZM=F', 'SB': 'SB=F', 'KC': 'KC=F', 'CT': 'CT=F',
  'CC': 'CC=F', 'LC': 'LE=F', 'LH': 'HE=F', 'LA': 'ALI=F',
  'HRW Wheat': 'KE=F',
};

/* ── Shared stock metadata maps (used by ETF detail views) ── */
const COMMODITY_TICKERS = new Set([
  'Gold (GC)','Rohöl WTI (CL)','Brent Crude (CO)','Kupfer (HG)','Erdgas (NG)',
  'Soybeans (S)','Corn (C)','Aluminium (LA)','Silber (SI)','Zucker (SB)',
  'Live Cattle (LC)','Weizen (W)','Soybean Oil (BO)','Zink (LX)','Kaffee (KC)',
  'Lean Hogs (LH)','Kansas Wheat (KW)','Baumwolle (CT)','Nickel (LN)','Blei (LL)',
  'HRW Wheat','Sojamehl (SM)','Kakao (CC)'
]);

const STOCK_SECTOR_MAP = {
  'AAPL':'Technology','MSFT':'Technology','NVDA':'Technology','AMZN':'Consumer Disc','META':'Communication',
  'GOOGL':'Communication','GOOG':'Communication','AVGO':'Technology','TSLA':'Consumer Disc','LLY':'Healthcare',
  'BRK.B':'Financials','JPM':'Financials','WMT':'Consumer Staples','V':'Financials','UNH':'Healthcare',
  'XOM':'Energy','MA':'Financials','JNJ':'Healthcare','HD':'Consumer Disc','PG':'Consumer Staples',
  'ASML':'Technology','SAP':'Technology','NVO':'Healthcare','NOVO-B':'Healthcare','NESN':'Consumer Staples',
  '2330.TW':'Technology','005930.KS':'Technology','700.HK':'Communication','9988.HK':'Consumer Disc',
  'COST':'Consumer Staples','ORCL':'Technology','CRM':'Technology','NFLX':'Communication','BAC':'Financials',
  'TM':'Consumer Disc','AMD':'Technology','INTU':'Technology','ACN':'Technology','ADBE':'Technology',
  'SIE':'Industrials','ALV':'Financials','DTE':'Communication','AIR':'Industrials','VOW3':'Consumer Disc',
  'BMW':'Consumer Disc','BAYN':'Healthcare','DBK':'Financials','BAS':'Materials','RWE':'Utilities',
  'INFY':'Technology','RELIANCE.BO':'Energy','ENPH':'Energy','NEE':'Utilities','RTX':'Industrials',
  'LMT':'Industrials','NOC':'Industrials','GD':'Industrials','BA':'Industrials',
  // Commodity futures
  'Gold (GC)':'Edelmetalle','Silber (SI)':'Edelmetalle',
  'Rohöl WTI (CL)':'Energie','Brent Crude (CO)':'Energie','Erdgas (NG)':'Energie',
  'Kupfer (HG)':'Industriemetalle','Aluminium (LA)':'Industriemetalle','Zink (LX)':'Industriemetalle',
  'Nickel (LN)':'Industriemetalle','Blei (LL)':'Industriemetalle',
  'Soybeans (S)':'Agrar','Corn (C)':'Agrar','Weizen (W)':'Agrar','Soybean Oil (BO)':'Agrar',
  'Zucker (SB)':'Agrar','Kaffee (KC)':'Agrar','Kansas Wheat (KW)':'Agrar',
  'Baumwolle (CT)':'Agrar','HRW Wheat':'Agrar','Sojamehl (SM)':'Agrar','Kakao (CC)':'Agrar',
  'Live Cattle (LC)':'Vieh','Lean Hogs (LH)':'Vieh',
  'NESN':'Consumer Staples','NOVN':'Healthcare','ROG':'Healthcare','LSEG':'Financials','SHEL':'Energy',
  'AZN':'Healthcare','MC.PA':'Consumer Disc','INGA':'Financials','BNP':'Financials','TTE':'Energy',
  'HSBA':'Financials','MUV2':'Financials','ADS':'Consumer Disc','HEI':'Industrials','CON':'Consumer Disc',
  'MBG':'Consumer Disc','ENR':'Energy','DHL':'Industrials','MRK.DE':'Healthcare',
  'SMCI':'Technology','IBKR':'Financials','SBIN.BO':'Financials','HDFC.BO':'Financials',
  'VALE3.SA':'Materials','BIDU':'Communication','JD':'Consumer Disc','ITUB4.SA':'Financials',
  'NPN.JO':'Communication','LVMH':'Consumer Disc','ENEL':'Utilities','ENI':'Energy','SAN':'Financials',
  'WFC':'Financials','GS':'Financials','MS':'Financials','C':'Financials','USB':'Financials',
  'FSLR':'Technology','ORSTED':'Utilities','VESTAS':'Industrials','EDP':'Utilities','IBERDROLA':'Utilities',
  'L3H':'Industrials','LHX':'Industrials','HII':'Industrials','LDOS':'Technology','BAH':'Technology',
  'RHM.DE':'Industrials','BA.L':'Industrials','SAAB-B':'Industrials',
  // BNKS — additional US regional banks
  'TFC':'Financials','PNC':'Financials','SCHW':'Financials','COF':'Financials','BK':'Financials',
  'STT':'Financials','KEY':'Financials','FITB':'Financials','MTB':'Financials','HBAN':'Financials',
  'RF':'Financials','CFG':'Financials','NTRS':'Financials','FHN':'Financials','ZION':'Financials',
  'CMA':'Financials','WTFC':'Financials','WAL':'Financials','WBS':'Financials','BOKF':'Financials',
  'CBSH':'Financials','BFH':'Financials','GBCI':'Financials','FFIN':'Financials','FULT':'Financials',
  'HWC':'Financials','WAFD':'Financials','FNB':'Financials','COLB':'Financials','SFBS':'Financials',
  'EBC':'Financials','WSFS':'Financials','NBT':'Financials','BANR':'Financials','IBCP':'Financials',
  'BUSE':'Financials','BCAL':'Financials','SBCF':'Financials','PFIS':'Financials',
  // XDWT — additional global IT
  'CDNS':'Technology','PANW':'Technology','KLAC':'Technology','MRVL':'Technology','MU':'Technology',
  'FTNT':'Technology','MSI':'Technology','ANSS':'Technology','KEYS':'Technology','EPAM':'Technology',
  'TEL':'Technology','GLW':'Technology','HPQ':'Technology','STX':'Technology','WDC':'Technology',
  'CTSH':'Technology','JNPR':'Technology','IT':'Technology','GDDY':'Technology','VRSN':'Technology',
  'ANET':'Technology','ZS':'Technology','CRWD':'Technology','OKTA':'Technology','SNOW':'Technology',
  'DDOG':'Technology','NET':'Technology','MDB':'Technology','TEAM':'Technology',
  '6758.T':'Technology','6861.T':'Technology','9432.T':'Communication','6954.T':'Technology','8035.T':'Technology',
  '000660.KS':'Technology','035420.KS':'Communication','2454.TW':'Technology','2308.TW':'Technology','3008.TW':'Technology',
  'CAP.PA':'Technology','NOKIA.HE':'Technology','ERICB.ST':'Technology',
  // INRG — additional clean energy
  'RUN':'Energy','BEP':'Utilities','AES':'Utilities','SEDG':'Technology','PLUG':'Energy',
  'BEPC':'Utilities','ORA':'Utilities','CWEN':'Utilities','BLX':'Utilities','CSIQ':'Energy',
  'JKS':'Energy','DQ':'Energy','NOVA':'Energy','ARRY':'Technology','SHLS':'Technology',
  'HASI':'Financials','AZRE':'Utilities','SPWR':'Energy','CEG':'Energy',
  // DFNS — additional defence
  'TXT':'Industrials','HEICO':'Industrials','HWM':'Industrials','AXON':'Technology','KTOS':'Industrials',
  'MOOG':'Industrials','DRS':'Industrials','CACI':'Technology','SAIC':'Technology',
  'AVAV':'Industrials','LEI.PA':'Industrials','DASSAULT':'Industrials'
};
const STOCK_COUNTRY_MAP = {
  'AAPL':'US','MSFT':'US','NVDA':'US','AMZN':'US','META':'US','GOOGL':'US','GOOG':'US','AVGO':'US',
  'TSLA':'US','LLY':'US','BRK.B':'US','JPM':'US','WMT':'US','V':'US','UNH':'US','XOM':'US','MA':'US',
  'ASML':'NL','SAP':'DE','NVO':'DK','NOVO-B':'DK','NESN':'CH',
  '2330.TW':'TW','005930.KS':'KR','700.HK':'CN','9988.HK':'CN',
  'COST':'US','ORCL':'US','CRM':'US','NFLX':'US','BAC':'US','TM':'JP','JNJ':'US','HD':'US','PG':'US',
  'AMD':'US','INTU':'US','ACN':'IE','ADBE':'US',
  'SIE':'DE','ALV':'DE','DTE':'DE','AIR':'FR','VOW3':'DE','BMW':'DE','BAYN':'DE','DBK':'DE',
  'BAS':'DE','RWE':'DE','INFY':'IN','RELIANCE.BO':'IN','ENPH':'US','NEE':'US',
  'RTX':'US','LMT':'US','NOC':'US','GD':'US','BA':'US',
  'NOVN':'CH','ROG':'CH','LSEG':'GB','SHEL':'GB','AZN':'GB','MC.PA':'FR','INGA':'NL','BNP':'FR',
  'TTE':'FR','HSBA':'GB','MUV2':'DE','ADS':'DE','HEI':'DE','CON':'DE','MBG':'DE','ENR':'DE','DHL':'DE','MRK.DE':'DE',
  'SMCI':'US','IBKR':'US','SBIN.BO':'IN','HDFC.BO':'IN','VALE3.SA':'BR','BIDU':'CN','JD':'CN',
  'ITUB4.SA':'BR','NPN.JO':'ZA','LVMH':'FR','ENEL':'IT','ENI':'IT','SAN':'ES',
  'WFC':'US','GS':'US','MS':'US','C':'US','USB':'US',
  'FSLR':'US','ORSTED':'DK','VESTAS':'DK','EDP':'PT','IBERDROLA':'ES',
  'L3H':'US','LHX':'US','HII':'US','LDOS':'US','BAH':'US',
  'RHM.DE':'DE','BA.L':'GB','SAAB-B':'SE',
  // BNKS regional banks
  'TFC':'US','PNC':'US','SCHW':'US','COF':'US','BK':'US','STT':'US','KEY':'US','FITB':'US',
  'MTB':'US','HBAN':'US','RF':'US','CFG':'US','NTRS':'US','FHN':'US','ZION':'US','CMA':'US',
  'WTFC':'US','WAL':'US','WBS':'US','BOKF':'US','CBSH':'US','BFH':'US','GBCI':'US','FFIN':'US',
  'FULT':'US','HWC':'US','WAFD':'US','FNB':'US','COLB':'US','SFBS':'US','EBC':'US','WSFS':'US',
  'NBT':'US','BANR':'US','IBCP':'US','BUSE':'US','BCAL':'US','SBCF':'US','PFIS':'US',
  // XDWT additional IT
  'CDNS':'US','PANW':'US','KLAC':'US','MRVL':'US','MU':'US','FTNT':'US','MSI':'US',
  'ANSS':'US','KEYS':'US','EPAM':'US','TEL':'US','GLW':'US','HPQ':'US','STX':'US',
  'WDC':'US','CTSH':'US','JNPR':'US','IT':'US','GDDY':'US','VRSN':'US','ANET':'US',
  'ZS':'US','CRWD':'US','OKTA':'US','SNOW':'US','DDOG':'US','NET':'US','MDB':'US','TEAM':'AU',
  '6758.T':'JP','6861.T':'JP','9432.T':'JP','6954.T':'JP','8035.T':'JP',
  '000660.KS':'KR','035420.KS':'KR','2454.TW':'TW','2308.TW':'TW','3008.TW':'TW',
  'CAP.PA':'FR','NOKIA.HE':'FI','ERICB.ST':'SE',
  // INRG clean energy
  'RUN':'US','BEP':'CA','AES':'US','SEDG':'US','PLUG':'US','BEPC':'CA',
  'ORA':'US','CWEN':'US','BLX':'MX','CSIQ':'CA','JKS':'CN','DQ':'CN',
  'NOVA':'US','ARRY':'US','SHLS':'US','HASI':'US','AZRE':'CN','SPWR':'US','CEG':'US',
  // DFNS defence
  'TXT':'US','HEICO':'US','HWM':'US','AXON':'US','KTOS':'US','MOOG':'US',
  'DRS':'US','CACI':'US','SAIC':'US','AVAV':'US','LEI.PA':'FR','DASSAULT':'FR',
  // Commodity futures — global markets
  'Gold (GC)':'Global','Silber (SI)':'Global','Rohöl WTI (CL)':'Global',
  'Brent Crude (CO)':'Global','Erdgas (NG)':'Global','Kupfer (HG)':'Global',
  'Aluminium (LA)':'Global','Zink (LX)':'Global','Nickel (LN)':'Global','Blei (LL)':'Global',
  'Soybeans (S)':'Global','Corn (C)':'Global','Weizen (W)':'Global','Soybean Oil (BO)':'Global',
  'Zucker (SB)':'Global','Kaffee (KC)':'Global','Kansas Wheat (KW)':'Global',
  'Baumwolle (CT)':'Global','HRW Wheat':'Global','Sojamehl (SM)':'Global','Kakao (CC)':'Global',
  'Live Cattle (LC)':'Global','Lean Hogs (LH)':'Global'
};

const etfAnalyzer = new ETFAnalyzer();
