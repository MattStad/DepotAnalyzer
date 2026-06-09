/* Portfolio Manager — parse, analyse, render */

/* ── Robust number parser (handles DE and US formats) ── */
function parseNum(s) {
  if (s == null || s === '' || s === '-') return 0;
  let str = String(s).replace(/\s/g, '').replace(/"/g, '').replace(/'/g, '');
  if (!str || str === '-') return 0;

  const hasComma  = str.includes(',');
  const hasPeriod = str.includes('.');

  if (hasComma && hasPeriod) {
    const lastComma  = str.lastIndexOf(',');
    const lastPeriod = str.lastIndexOf('.');
    if (lastPeriod > lastComma) {
      // US format: 15,617.01  — commas are thousands separators
      str = str.replace(/,/g, '');
    } else {
      // German format: 15.617,01 — periods are thousands separators
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    const afterComma = str.split(',').pop() || '';
    // If exactly 3 digits after comma, treat as thousands (1,000 → 1000)
    if (afterComma.length === 3 && !isNaN(afterComma)) {
      str = str.replace(',', '');
    } else {
      str = str.replace(',', '.'); // German decimal (24,25 → 24.25)
    }
  }

  return parseFloat(str.replace(/[^0-9.\-]/g, '')) || 0;
}

/* ── Detect snapshot vs transaction format ── */
function isSnapshotFormat(fields) {
  const f = fields.map(x => (x || '').toLowerCase().replace(/\s+/g, ' ').trim());
  return (
    f.some(x => x.includes('kurswert in eur') || x.includes('kurswert')) &&
    f.some(x => x.includes('einstandskurs') || x.includes('performance in eur') || x.includes('performance in %'))
  );
}

/* ── Detect finanzfluss transaction format ── */
function isFinanzflussFormat(fields) {
  const f = fields.map(x => (x || '').toLowerCase());
  return f.some(x => x === 'transaktion') && f.some(x => x === 'preis') && f.some(x => x === 'anzahl');
}

class PortfolioManager {
  constructor() {
    this.transactions = [];
    this.holdings     = [];
    this.allocChart   = null;
    this.perfChart    = null;
    this.allocMode    = 'type';
    this._mappingResolve = null;
  }

  init() {
    const fi = document.getElementById('file-input');
    fi.addEventListener('change', e => this.handleFileInput(e.target));
    document.getElementById('load-sample-btn').addEventListener('click', () => this.loadSample());
    document.getElementById('sample-btn2').addEventListener('click',    () => this.loadSample());

    // Drag & drop
    const ua = document.getElementById('upload-area');
    ua.addEventListener('dragover',  e => { e.preventDefault(); ua.classList.add('drag-over'); });
    ua.addEventListener('dragleave', ()  => ua.classList.remove('drag-over'));
    ua.addEventListener('drop', e => {
      e.preventDefault(); ua.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) this.processFile(f);
    });

    document.getElementById('holdings-search').addEventListener('input', e => this.filterHoldings(e.target.value));

    document.getElementById('alloc-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.tab'); if (!btn) return;
      document.querySelectorAll('#alloc-tabs .tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.allocMode = btn.dataset.alloc;
      this.renderAllocationChart();
    });

    document.getElementById('perf-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.tab'); if (!btn) return;
      document.querySelectorAll('#perf-tabs .tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.renderPerfChart(btn.dataset.perf);
    });
  }

  handleFileInput(input) {
    const f = input.files?.[0]; if (!f) return;
    this.processFile(f);
    input.value = ''; // reset so same file can be re-uploaded
  }

  processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      const reader = new FileReader();
      reader.onload = e => this.parseCSV(e.target.result);
      reader.readAsText(file, 'UTF-8');
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = e => this.parseExcel(e.target.result);
      reader.readAsArrayBuffer(file);
    } else {
      showToast('Unsupported format. Use CSV or Excel (.xlsx/.xls)', 'error');
    }
  }

  parseCSV(text) {
    // Auto-detect delimiter (PapaParse default is ','; override if semicolons dominate)
    const firstLine = text.split(/\r?\n/)[0] || '';
    const nCommas   = (firstLine.match(/,/g)  || []).length;
    const nSemis    = (firstLine.match(/;/g)  || []).length;
    const nTabs     = (firstLine.match(/\t/g) || []).length;
    let delimiter   = ',';
    if (nSemis > nCommas && nSemis > nTabs)   delimiter = ';';
    else if (nTabs > nCommas && nTabs > nSemis) delimiter = '\t';

    const result = Papa.parse(text, {
      header: true, skipEmptyLines: true,
      dynamicTyping: false, delimiter,
      transformHeader: h => h.trim()
    });

    if (!result.data.length) { showToast('File appears empty', 'error'); return; }
    this.processRows(result.data, result.meta.fields || Object.keys(result.data[0]));
  }

  parseExcel(buffer) {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Use raw rows (header:1) so duplicate column names don't collide
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawRows.length) { showToast('Empty spreadsheet', 'error'); return; }

    // Convert to header-keyed objects, deduplicating column names
    const headerRow = rawRows[0].map(h => String(h || '').trim());
    const seen = {};
    const headers = headerRow.map(h => {
      seen[h] = (seen[h] || 0) + 1;
      return seen[h] > 1 ? `${h}_${seen[h]}` : h;
    });

    const data = rawRows.slice(1).filter(row => row.some(c => c !== '')).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
      return obj;
    });

    if (!data.length) { showToast('No data rows in spreadsheet', 'error'); return; }
    this.processRows(data, headers);
  }

  processRows(rows, fields) {
    // Try snapshot format first (depot export with current prices)
    if (isSnapshotFormat(fields)) {
      this.importSnapshotFormat(rows, fields);
      return;
    }

    // Otherwise treat as transaction history
    const mapping = this.detectMapping(fields);
    if (mapping.confidence < 3) {
      this.showMappingDialog(fields, mapping).then(m => {
        if (m) this.importWithMapping(rows, m);
      });
    } else {
      this.importWithMapping(rows, mapping);
    }
  }

  /* ── Snapshot import (securities_export, depot export) ── */
  importSnapshotFormat(rows, fields) {
    const f = fields.map(x => (x || '').toLowerCase().trim());

    const col = (...patterns) => {
      for (const p of patterns) {
        const idx = f.findIndex(x => x.includes(p));
        if (idx !== -1) return fields[idx];
      }
      return null;
    };

    const C = {
      isin:      col('isin'),
      name:      col('titel','name','bezeichnung','wertpapier'),
      price:     col('kurs'),
      shares:    col('menge','anzahl','stück'),
      value:     col('kurswert in eur','kurswert'),
      pnlEur:    col('performance in eur','gewinn/verlust','p&l'),
      pnlPct:    col('performance in %','rendite in %','gewinn/verlust in %'),
      avgCost:   col('einstandskurs','durchschnittlicher einstandskurs','einstandspreis'),
      dividends: col('erträge','ertraege','dividenden'),
      fees:      col('spesen','gebühren','kosten'),
    };

    const holdings = [];
    for (const row of rows) {
      const isin = String(row[C.isin] || '').trim().toUpperCase();
      const name = String(row[C.name] || '').trim();
      if (!isin && !name) continue;

      const curPrice  = parseNum(row[C.price]);
      const shares    = parseNum(row[C.shares]);
      const curValue  = parseNum(row[C.value])  || shares * curPrice;
      const pnlEur    = parseNum(row[C.pnlEur]);
      const pnlPct    = parseNum(row[C.pnlPct]);
      const avgCost   = parseNum(row[C.avgCost]) || (shares > 0 ? (curValue - pnlEur) / shares : 0);
      const dividends = parseNum(row[C.dividends]);
      const fees      = parseNum(row[C.fees]);
      const totalCost = shares * avgCost;

      holdings.push({
        isin, name, shares, curPrice, curValue, avgCost, totalCost,
        pnl: pnlEur, pnlPct,
        dividends, fees, buys: [],
        type:   this.guessType(isin, name),
        region: this.guessRegion(isin, name),
        sector: this.guessSector(isin, name),
      });
    }

    if (!holdings.length) { showToast('No holdings found in file', 'error'); return; }

    // Build synthetic transactions for the transaction table
    this.transactions = holdings.map(h => ({
      date: new Date(), type: 'buy', name: h.name, isin: h.isin,
      shares: h.shares, price: h.avgCost, total: h.totalCost, fees: h.fees
    }));

    this.holdings = holdings;
    this.render();
    showToast(`Imported ${holdings.length} positions from depot snapshot`, 'success');
  }

  detectMapping(fields) {
    const f = fields.map(x => (x || '').toLowerCase().trim());
    const find = (...patterns) => {
      for (const p of patterns) {
        const idx = f.findIndex(x => x.includes(p));
        if (idx !== -1) return fields[idx];
      }
      return null;
    };

    const mapping = {
      date:     find('datum','date','buchungsdatum','valuta','time','trade date'),
      name:     find('name','bezeichnung','wertpapier','titel','security','description'),
      isin:     find('isin'),
      shares:   find('anzahl','shares','stück','quantity','units','menge','volume'),
      price:    find('preis','kurs','price','einzelpreis','unit price','stückpreis'),
      total:    find('gesamtwert','total','betrag','summe','wert','amount','value','gesamt','transaction value'),
      type:     find('transaktion','typ','type','art','buchungsart','transaction type','order type'),
      fees:     find('gebühr','gebuhren','fees','kosten','provision','spesen','commission'),
      currency: find('währung','currency'),
    };

    mapping.confidence = Object.entries(mapping).filter(([k,v]) => k !== 'confidence' && v != null).length;
    return mapping;
  }

  showMappingDialog(fields, suggested) {
    return new Promise(resolve => {
      const body  = document.getElementById('mapping-body');
      const NEED  = [
        { key:'date',   label:'Transaction Date *' },
        { key:'name',   label:'Asset Name *' },
        { key:'isin',   label:'ISIN' },
        { key:'shares', label:'Shares / Units *' },
        { key:'price',  label:'Price per Share' },
        { key:'total',  label:'Total Amount *' },
        { key:'type',   label:'Transaction Type (Kauf/Verkauf/…)' },
        { key:'fees',   label:'Fees' },
      ];
      const opts = ['-- skip --', ...fields].map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
      body.innerHTML = NEED.map(({key, label}) => `
        <div class="mapping-row">
          <label>${label}</label>
          <select class="select-input mapping-sel" data-key="${key}">${opts}</select>
        </div>`).join('');

      body.querySelectorAll('.mapping-sel').forEach(sel => {
        const v = suggested[sel.dataset.key];
        if (v) sel.value = v;
      });

      document.getElementById('mapping-modal').classList.remove('hidden');
      this._mappingResolve = resolve;

      document.getElementById('apply-mapping-btn').onclick = () => {
        const m = {};
        body.querySelectorAll('.mapping-sel').forEach(sel => {
          if (sel.value !== '-- skip --') m[sel.dataset.key] = sel.value;
        });
        closeModal();
        resolve(m);
      };
    });
  }

  importWithMapping(rows, map) {
    const txs = [];
    for (const row of rows) {
      const typeRaw = String(row[map.type] || '').toLowerCase().trim();
      let type = 'buy';
      if      (typeRaw.includes('verkauf') || typeRaw.includes('sell') || typeRaw.includes('ausbuchung')) type = 'sell';
      else if (typeRaw.includes('dividend') || typeRaw.includes('dividende') || typeRaw.includes('ausschüttung') || typeRaw.includes('kupon')) type = 'dividend';
      else if (typeRaw.includes('kauf') || typeRaw.includes('buy') || typeRaw.includes('einlage') || typeRaw.includes('einbuchung') || typeRaw.includes('sparplan')) type = 'buy';
      else if (typeRaw.includes('gebühr') || typeRaw.includes('gebuhr') || typeRaw.includes('fee')) type = 'fee';

      const price   = parseNum(row[map.price]);
      const sharesRaw = parseNum(row[map.shares]);
      const totalRaw  = map.total ? parseNum(row[map.total]) : 0;
      const total     = totalRaw || Math.abs(sharesRaw) * Math.abs(price);
      let   shares    = sharesRaw || (price ? total / price : 0);

      if (type === 'sell') shares = -Math.abs(shares);
      else shares = Math.abs(shares);

      const dateRaw = row[map.date] || '';
      const date    = this.parseDate(String(dateRaw));
      if (!date) continue;

      // Skip rows with no useful data
      if (!shares && total === 0 && type !== 'dividend') continue;

      txs.push({
        date, type,
        name:  String(row[map.name]  || 'Unknown').trim(),
        isin:  String(row[map.isin]  || '').trim().toUpperCase(),
        shares,
        price: Math.abs(price),
        total: Math.abs(total),
        fees:  parseNum(row[map.fees]),
      });
    }

    if (!txs.length) {
      showToast('Could not parse any transactions — check column mapping', 'error');
      return;
    }
    txs.sort((a, b) => a.date - b.date);
    this.transactions = txs;
    this.computeHoldings();
    this.render();
    showToast(`Imported ${txs.length} transactions`, 'success');
  }

  parseDate(s) {
    if (!s) return null;
    // ISO
    let d = new Date(s);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d;
    // DD.MM.YYYY or DD/MM/YYYY
    const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (m) { d = new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`); if (!isNaN(d.getTime())) return d; }
    // YYYY.MM.DD
    const m2 = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
    if (m2) { d = new Date(`${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`); if (!isNaN(d.getTime())) return d; }
    return null;
  }

  computeHoldings() {
    const map = {};
    for (const tx of this.transactions) {
      const key = tx.isin || tx.name;
      if (!map[key]) map[key] = { name: tx.name, isin: tx.isin, shares: 0, totalCost: 0, dividends: 0, fees: 0, buys: [] };
      const h = map[key];
      if (tx.type === 'buy') {
        h.shares    += tx.shares;
        h.totalCost += tx.total;
        h.fees      += tx.fees;
        h.buys.push(tx);
      } else if (tx.type === 'sell') {
        const sold    = Math.abs(tx.shares);
        const avgCost = h.shares > 0 ? h.totalCost / h.shares : 0;
        h.totalCost   = Math.max(0, h.totalCost - avgCost * sold);
        h.shares      = Math.max(0, h.shares - sold);
        h.fees       += tx.fees;
      } else if (tx.type === 'dividend') {
        h.dividends += tx.total;
      } else if (tx.type === 'fee') {
        h.fees += tx.total;
      }
    }

    this.holdings = Object.values(map).filter(h => h.shares > 0.0001).map(h => {
      const avgCost  = h.shares > 0 ? h.totalCost / h.shares : 0;
      const lastBuy  = [...h.buys].reverse()[0];
      const curPrice = lastBuy ? lastBuy.price : avgCost;
      const curValue = h.shares * curPrice;
      const pnl      = curValue - h.totalCost;
      const pnlPct   = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
      return {
        ...h, avgCost, curPrice, curValue, pnl, pnlPct,
        type:   this.guessType(h.isin, h.name),
        region: this.guessRegion(h.isin, h.name),
        sector: this.guessSector(h.isin, h.name),
      };
    });
  }

  guessType(isin, name) {
    const n = (name || '').toLowerCase();
    if (n.includes('etf') || n.includes('index') || n.includes('msci') || n.includes('s&p') ||
        n.includes('stoxx') || n.includes('ftse') || n.includes('dax') || n.includes('swap')) return 'ETF';
    if (n.includes('bond') || n.includes('anleihe') || n.includes('treasury') || n.includes('bund') ||
        n.includes('kupon') || n.includes('notes')) return 'Bond';
    if (n.includes('fonds') || n.includes('fund') && !n.includes('etf')) return 'Fund';
    // Austrian/German funds by ISIN prefix
    if (isin && (isin.startsWith('AT') || isin.startsWith('LU')) && !n.includes('xtr') && !n.includes('ish') && !n.includes('van')) return 'Fund';
    return 'Stock';
  }

  guessRegion(isin, name) {
    const n = (name || '').toLowerCase();
    const cc = isin ? isin.substring(0,2) : '';
    const ccMap = {
      US:'North America', CA:'North America',
      GB:'Europe', DE:'Europe', FR:'Europe', CH:'Europe', NL:'Europe',
      SE:'Europe', IT:'Europe', ES:'Europe', DK:'Europe', AT:'Europe', LU:'Europe',
      JP:'Japan', AU:'Pacific', NZ:'Pacific',
      HK:'Asia Pacific', SG:'Asia Pacific', KR:'Asia Pacific',
      CN:'Emerging Markets', IN:'Emerging Markets', BR:'Emerging Markets',
      TW:'Asia Pacific', ZA:'Emerging Markets', SA:'Emerging Markets',
    };
    if (ccMap[cc]) return ccMap[cc];
    if (n.includes('world') || n.includes('global') || n.includes('acwi') || n.includes('all-world')) return 'Global';
    if (n.includes('emerg') || n.includes(' em ') || n.includes('emi')) return 'Emerging Markets';
    if (n.includes('europe') || n.includes('euro') || n.includes('stoxx') || n.includes('dax')) return 'Europe';
    if (n.includes('us ') || n.includes('s&p') || n.includes('nasdaq') || n.includes('usa')) return 'North America';
    if (n.includes('japan') || n.includes('nikkei')) return 'Japan';
    return 'Global';
  }

  guessSector(isin, name) {
    const n = (name || '').toLowerCase();
    if (n.includes('tech') || n.includes('software') || n.includes('semi') || n.includes('it ') || n.includes(' it')) return 'Technology';
    if (n.includes('bank') || n.includes('financial') || n.includes('versich')) return 'Financials';
    if (n.includes('health') || n.includes('pharma') || n.includes('bio') || n.includes('med')) return 'Healthcare';
    if (n.includes('energy') || n.includes('oil') || n.includes('gas') || n.includes('clean')) return 'Energy';
    if (n.includes('consumer') || n.includes('retail')) return 'Consumer';
    if (n.includes('commodit') || n.includes('material') || n.includes('metal') || n.includes('gold')) return 'Commodities';
    if (n.includes('defense') || n.includes('defence') || n.includes('dfns')) return 'Defence';
    if (n.includes('industri')) return 'Industrials';
    return 'Diversified';
  }

  render() {
    document.getElementById('upload-area').classList.add('hidden');
    document.getElementById('portfolio-dashboard').classList.remove('hidden');
    this.renderKPIs();
    this.renderAllocationChart();
    this.renderPerfChart('growth');
    this.renderHoldingsTable();
    this.renderTransactionTable();
    etfAnalyzer.detectFromPortfolio(this.holdings);
  }

  renderKPIs() {
    const totalValue    = this.holdings.reduce((s, h) => s + h.curValue, 0);
    const totalInvested = this.holdings.reduce((s, h) => s + h.totalCost, 0);
    const totalPnL      = totalValue - totalInvested;
    const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const totalDivs     = this.holdings.reduce((s, h) => s + (h.dividends || 0), 0);
    const totalFees     = this.holdings.reduce((s, h) => s + (h.fees || 0), 0);

    setText('kpi-value',      fmt(totalValue));
    setText('kpi-return',     fmtPnL(totalPnL));
    setText('kpi-return-pct', `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`);
    setText('kpi-invested',   fmt(totalInvested));
    setText('kpi-positions',  String(this.holdings.length));
    setText('kpi-dividends',  fmt(totalDivs));
    setText('kpi-div-sub',    totalInvested > 0 ? `${((totalDivs / totalInvested) * 100).toFixed(2)}% yield` : '');
    setText('kpi-fees',       fmt(totalFees));

    const deltaEl = document.getElementById('kpi-delta');
    if (deltaEl) {
      deltaEl.textContent = `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}% all time`;
      deltaEl.className   = `kpi-delta ${totalPnL >= 0 ? 'green' : 'red'}`;
    }
    colorEl('kpi-return',     totalPnL >= 0);
    colorEl('kpi-return-pct', totalPnL >= 0);
    setText('tx-count', `${this.transactions.length} transactions`);
  }

  renderAllocationChart() {
    const ctx  = document.getElementById('alloc-chart').getContext('2d');
    if (this.allocChart) this.allocChart.destroy();

    const totalValue = this.holdings.reduce((s, h) => s + h.curValue, 0);
    const groups = {};
    for (const h of this.holdings) {
      const key = this.allocMode === 'type' ? h.type : this.allocMode === 'geo' ? h.region : h.sector;
      groups[key] = (groups[key] || 0) + h.curValue;
    }

    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([, v]) => +((v / totalValue) * 100).toFixed(2));

    const body = ctx.canvas.closest('.card-body');
    body.classList.add('donut-layout');
    ctx.canvas.style.cssText = 'width:200px;height:200px;position:static;flex-shrink:0';

    this.allocChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: false, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` } }
        }
      }
    });

    document.getElementById('alloc-legend').innerHTML = labels.map((l, i) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
        <span class="legend-name">${l}</span>
        <span class="legend-pct">${data[i]}%</span>
      </div>`).join('');
  }

  renderPerfChart(mode) {
    const ctx = document.getElementById('perf-chart').getContext('2d');
    if (this.perfChart) this.perfChart.destroy();

    // Build timeline
    const byDate = {};
    const running = {};
    for (const tx of this.transactions) {
      const key = tx.isin || tx.name;
      if (!running[key]) running[key] = { shares: 0, cost: 0 };
      if (tx.type === 'buy') {
        running[key].shares += tx.shares;
        running[key].cost   += tx.total;
      } else if (tx.type === 'sell') {
        running[key].shares -= Math.abs(tx.shares);
      }
      const dk = tx.date.toISOString().split('T')[0];
      byDate[dk] = JSON.parse(JSON.stringify(running));
    }

    const dates = Object.keys(byDate).sort();
    if (!dates.length) return;

    const hMap = {};
    for (const h of this.holdings) hMap[h.isin || h.name] = h;

    const values   = dates.map(dk => Object.entries(byDate[dk]).reduce((sum, [k, v]) => sum + (hMap[k] ? v.shares * (hMap[k].avgCost) : 0), 0));
    const invested = dates.map(dk => Object.entries(byDate[dk]).reduce((s, [, v]) => s + v.cost, 0));

    const datasets = mode === 'growth' ? [
      { label: 'Portfolio Value', data: values, borderColor: CHART_COLORS[0], backgroundColor: 'rgba(6,200,216,.10)', fill: true, tension: 0.3, pointRadius: 0 },
      { label: 'Invested',        data: invested, borderColor: CHART_COLORS[4], borderDash: [4, 4], fill: false, tension: 0.1, pointRadius: 0 }
    ] : [{
      label: 'Total Return %',
      data:  values.map((v, i) => invested[i] > 0 ? +((v - invested[i]) / invested[i] * 100).toFixed(2) : 0),
      borderColor: CHART_COLORS[2], backgroundColor: 'rgba(16,201,128,.10)', fill: true, tension: 0.3, pointRadius: 0
    }];

    this.perfChart = new Chart(ctx, {
      type: 'line',
      data: { labels: dates, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#8899b8', boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            backgroundColor: '#101828', borderColor: '#1a2840', borderWidth: 1,
            callbacks: { label: c => ` ${c.dataset.label}: ${mode === 'growth' ? fmt(c.parsed.y) : c.parsed.y.toFixed(2) + '%'}` }
          }
        },
        scales: {
          x: { ticks: { color: '#4a6080', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font: { size: 11 }, callback: v => mode === 'growth' ? fmt(v) : v.toFixed(1) + '%' }, grid: { color: '#1a2840' } }
        }
      }
    });
  }

  renderHoldingsTable() {
    const totalValue = this.holdings.reduce((s, h) => s + h.curValue, 0);
    document.getElementById('holdings-tbody').innerHTML = [...this.holdings]
      .sort((a, b) => b.curValue - a.curValue)
      .map(h => `<tr>
        <td class="name-cell">${esc(h.name)}</td>
        <td>${esc(h.isin)}</td>
        <td><span class="badge ${h.type === 'ETF' ? 'badge-blue' : h.type === 'Bond' ? 'badge-yellow' : h.type === 'Fund' ? 'badge-purple' : 'badge-green'}">${h.type}</span></td>
        <td class="num">${h.shares.toFixed(4)}</td>
        <td class="num">${fmt(h.avgCost)}</td>
        <td class="num">${fmt(h.curPrice)}</td>
        <td class="num">${fmt(h.curValue)}</td>
        <td class="num ${h.pnl >= 0 ? 'green' : 'red'}">${h.pnl >= 0 ? '+' : ''}${fmt(h.pnl)}</td>
        <td class="num ${h.pnlPct >= 0 ? 'green' : 'red'}">${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%</td>
        <td class="num">${((h.curValue / totalValue) * 100).toFixed(1)}%</td>
      </tr>`).join('');
  }

  renderTransactionTable() {
    const sorted = [...this.transactions].reverse().slice(0, 300);
    document.getElementById('tx-tbody').innerHTML = sorted.map(tx => {
      const cls = tx.type === 'buy' ? 'badge-green' : tx.type === 'sell' ? 'badge-red' : tx.type === 'dividend' ? 'badge-blue' : 'badge-yellow';
      return `<tr>
        <td>${tx.date.toLocaleDateString('de-DE')}</td>
        <td><span class="badge ${cls}">${tx.type.toUpperCase()}</span></td>
        <td class="name-cell">${esc(tx.name)}</td>
        <td>${esc(tx.isin)}</td>
        <td class="num">${Math.abs(tx.shares).toFixed(4)}</td>
        <td class="num">${fmt(tx.price)}</td>
        <td class="num">${fmt(tx.total)}</td>
        <td class="num">${fmt(tx.fees)}</td>
      </tr>`;
    }).join('');
    if (this.transactions.length > 300) {
      document.getElementById('tx-tbody').innerHTML +=
        `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:12px">Showing 300 of ${this.transactions.length} transactions</td></tr>`;
    }
  }

  filterHoldings(q) {
    const lq = q.toLowerCase();
    document.querySelectorAll('#holdings-tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(lq) ? '' : 'none';
    });
  }

  loadSample() {
    const d = (y, m, day) => new Date(y, m - 1, day);
    const txs = [
      { date:d(2021,3,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:20,  price:82.40,   total:1648.00, fees:1.90 },
      { date:d(2021,6,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:15,  price:89.12,   total:1336.80, fees:1.90 },
      { date:d(2021,9,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:12,  price:95.44,   total:1145.28, fees:1.90 },
      { date:d(2022,1,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:18,  price:99.20,   total:1785.60, fees:1.90 },
      { date:d(2022,6,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:25,  price:80.15,   total:2003.75, fees:1.90 },
      { date:d(2023,3,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:20,  price:88.70,   total:1774.00, fees:1.90 },
      { date:d(2023,9,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:22,  price:97.30,   total:2140.60, fees:1.90 },
      { date:d(2024,3,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:18,  price:108.40,  total:1951.20, fees:1.90 },
      { date:d(2024,9,15), type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80', shares:15,  price:112.60,  total:1689.00, fees:1.90 },
      { date:d(2021,4,1),  type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:8,   price:340.20,  total:2721.60, fees:3.90 },
      { date:d(2021,10,1), type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:5,   price:395.80,  total:1979.00, fees:3.90 },
      { date:d(2022,7,1),  type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:10,  price:302.40,  total:3024.00, fees:3.90 },
      { date:d(2023,5,1),  type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:6,   price:358.10,  total:2148.60, fees:3.90 },
      { date:d(2024,2,1),  type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:4,   price:438.50,  total:1754.00, fees:3.90 },
      { date:d(2021,5,15), type:'buy',      name:'iShares Core MSCI EM IMI',     isin:'IE00BKM4GZ66', shares:50,  price:28.40,   total:1420.00, fees:1.90 },
      { date:d(2022,4,15), type:'buy',      name:'iShares Core MSCI EM IMI',     isin:'IE00BKM4GZ66', shares:60,  price:24.80,   total:1488.00, fees:1.90 },
      { date:d(2023,8,15), type:'buy',      name:'iShares Core MSCI EM IMI',     isin:'IE00BKM4GZ66', shares:40,  price:26.70,   total:1068.00, fees:1.90 },
      { date:d(2022,2,1),  type:'buy',      name:'iShares MSCI World Small Cap', isin:'IE00BF4RFH31', shares:30,  price:52.40,   total:1572.00, fees:1.90 },
      { date:d(2023,2,1),  type:'buy',      name:'iShares MSCI World Small Cap', isin:'IE00BF4RFH31', shares:25,  price:54.80,   total:1370.00, fees:1.90 },
      { date:d(2022,10,15),type:'buy',      name:'SAP SE',                        isin:'DE0007164600', shares:15,  price:88.20,   total:1323.00, fees:5.90 },
      { date:d(2023,4,15), type:'buy',      name:'SAP SE',                        isin:'DE0007164600', shares:10,  price:112.40,  total:1124.00, fees:5.90 },
      { date:d(2022,4,1),  type:'dividend', name:'Vanguard FTSE All-World',       isin:'IE00BK5BQT80', shares:0,   price:0,       total:98.40,   fees:0 },
      { date:d(2023,4,1),  type:'dividend', name:'Vanguard FTSE All-World',       isin:'IE00BK5BQT80', shares:0,   price:0,       total:147.20,  fees:0 },
      { date:d(2024,4,1),  type:'dividend', name:'Vanguard FTSE All-World',       isin:'IE00BK5BQT80', shares:0,   price:0,       total:198.80,  fees:0 },
      { date:d(2023,6,1),  type:'dividend', name:'SAP SE',                        isin:'DE0007164600', shares:0,   price:0,       total:34.50,   fees:0 },
      { date:d(2024,6,1),  type:'dividend', name:'SAP SE',                        isin:'DE0007164600', shares:0,   price:0,       total:42.50,   fees:0 },
    ];
    txs.sort((a, b) => a.date - b.date);
    this.transactions = txs;
    this.computeHoldings();

    // Override current prices with realistic values
    const priceMap = {
      'IE00BK5BQT80': 121.40,
      'IE00B5BMR087': 498.20,
      'IE00BKM4GZ66':  28.80,
      'IE00BF4RFH31':  61.40,
      'DE0007164600': 194.80,
    };
    for (const h of this.holdings) {
      if (priceMap[h.isin]) {
        h.curPrice = priceMap[h.isin];
        h.curValue = h.shares * h.curPrice;
        h.pnl      = h.curValue - h.totalCost;
        h.pnlPct   = (h.pnl / h.totalCost) * 100;
      }
    }

    this.render();
    showToast('Sample portfolio loaded — 5 positions, 25 transactions', 'success');
  }
}

/* ── Shared utilities ── */
function fmt(v, decimals = 2) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  }).format(v);
}
function fmtPnL(v) { const s = fmt(Math.abs(v)); return (v >= 0 ? '+' : '-') + s; }
function setText(id, val)      { const el = document.getElementById(id); if (el) el.textContent = val; }
function colorEl(id, positive) { const el = document.getElementById(id); if (el) { el.classList.toggle('green', positive); el.classList.toggle('red', !positive); } }
function esc(s)                { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function closeModal()          { document.getElementById('mapping-modal').classList.add('hidden'); }
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

const portfolio = new PortfolioManager();
