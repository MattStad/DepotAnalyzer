/* Portfolio Manager — parse, analyse, render */
class PortfolioManager {
  constructor() {
    this.transactions = [];
    this.holdings     = [];
    this.allocChart   = null;
    this.perfChart    = null;
    this.allocMode    = 'type';
    this.detectedFormat = null;
    this._mappingResolve = null;
  }

  init() {
    const fi = document.getElementById('file-input');
    fi.addEventListener('change', e => this.handleFileInput(e.target));

    document.getElementById('load-sample-btn').addEventListener('click', () => this.loadSample());
    document.getElementById('sample-btn2').addEventListener('click',    () => this.loadSample());

    // Drag & drop
    const ua = document.getElementById('upload-area');
    ua.addEventListener('dragover', e => { e.preventDefault(); ua.classList.add('drag-over'); });
    ua.addEventListener('dragleave', () => ua.classList.remove('drag-over'));
    ua.addEventListener('drop', e => {
      e.preventDefault(); ua.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) this.processFile(f);
    });

    // Search
    document.getElementById('holdings-search').addEventListener('input', e => this.filterHoldings(e.target.value));

    // Allocation tabs
    document.getElementById('alloc-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.tab'); if (!btn) return;
      document.querySelectorAll('#alloc-tabs .tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.allocMode = btn.dataset.alloc;
      this.renderAllocationChart();
    });

    // Performance tabs
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
  }

  processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = e => this.parseCSV(e.target.result);
      reader.readAsText(file, 'UTF-8');
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = e => this.parseExcel(e.target.result);
      reader.readAsArrayBuffer(file);
    } else {
      showToast('Unsupported file format. Please use CSV or Excel.', 'error');
    }
  }

  parseCSV(text) {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
    if (!result.data.length) { showToast('File appears empty', 'error'); return; }
    this.processRows(result.data, result.meta.fields);
  }

  parseExcel(buffer) {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const fields = data.length ? Object.keys(data[0]) : [];
    this.processRows(data, fields);
  }

  processRows(rows, fields) {
    const mapping = this.detectMapping(fields);
    if (mapping.confidence < 3) {
      // Show manual mapping dialog
      this.showMappingDialog(fields, mapping).then(m => {
        if (m) this.importWithMapping(rows, m);
      });
    } else {
      this.importWithMapping(rows, mapping);
    }
  }

  detectMapping(fields) {
    const f = fields.map(x => x.toLowerCase().trim());
    const find = (...patterns) => {
      for (const p of patterns) {
        const idx = f.findIndex(x => x.includes(p));
        if (idx !== -1) return fields[idx];
      }
      return null;
    };

    const mapping = {
      date:     find('datum','date','buchungsdatum','valuta','time'),
      name:     find('name','bezeichnung','wertpapier','titel','beschreibung'),
      isin:     find('isin'),
      shares:   find('anzahl','shares','stück','stucke','menge','quantity','units'),
      price:    find('kurs','price','kurs (eur)','einzelpreis','stückpreis'),
      total:    find('gesamtwert','total','betrag','summe','wert','amount','value','gesamt'),
      type:     find('typ','type','transaktion','art','buchungsart','transaction'),
      fees:     find('gebühr','gebuhren','fees','kosten','provision','transaktionskosten'),
      currency: find('währung','wahrung','currency'),
      confidence: 0
    };

    // Count matched fields
    mapping.confidence = Object.values(mapping).filter(v => v && v !== 'confidence').length;
    return mapping;
  }

  showMappingDialog(fields, suggested) {
    return new Promise(resolve => {
      const body = document.getElementById('mapping-body');
      const FIELDS_NEEDED = [
        { key:'date',   label:'Transaction Date *' },
        { key:'name',   label:'Asset Name *' },
        { key:'isin',   label:'ISIN' },
        { key:'shares', label:'Shares / Units *' },
        { key:'price',  label:'Price per Share' },
        { key:'total',  label:'Total Amount *' },
        { key:'type',   label:'Transaction Type' },
        { key:'fees',   label:'Fees' },
      ];
      const opts = ['-- skip --', ...fields].map(f => `<option value="${f}">${f}</option>`).join('');
      body.innerHTML = FIELDS_NEEDED.map(({key, label}) => `
        <div class="mapping-row">
          <label>${label}</label>
          <select class="select-input mapping-sel" data-key="${key}">${opts}</select>
        </div>`).join('');

      // Pre-fill with detected values
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
      const typeRaw = (row[map.type] || '').toLowerCase();
      let type = 'buy';
      if (typeRaw.includes('verkauf') || typeRaw.includes('sell')) type = 'sell';
      else if (typeRaw.includes('dividend') || typeRaw.includes('dividende') || typeRaw.includes('ausschüttung')) type = 'dividend';
      else if (typeRaw.includes('kauf') || typeRaw.includes('buy') || typeRaw.includes('einlage')) type = 'buy';
      else if (typeRaw.includes('gebühr') || typeRaw.includes('fee')) type = 'fee';
      else if (typeRaw.includes('spar') || typeRaw.includes('sparplan')) type = 'buy';

      const total = parseFloat(String(row[map.total] || '0').replace(',','.').replace(/[^0-9.\-]/g,'')) || 0;
      const price = parseFloat(String(row[map.price] || '0').replace(',','.').replace(/[^0-9.\-]/g,'')) || 0;
      let shares  = parseFloat(String(row[map.shares]|| '0').replace(',','.').replace(/[^0-9.\-]/g,'')) || 0;
      if (!shares && price && total) shares = Math.abs(total) / price;

      const dateRaw = row[map.date] || '';
      const date = this.parseDate(String(dateRaw));
      if (!date) continue;

      txs.push({
        date, type,
        name: String(row[map.name]   || 'Unknown').trim(),
        isin: String(row[map.isin]   || '').trim().toUpperCase(),
        shares: type === 'sell' ? -Math.abs(shares) : Math.abs(shares),
        price,
        total: Math.abs(total),
        fees:  parseFloat(String(row[map.fees] || '0').replace(',','.').replace(/[^0-9.\-]/g,'')) || 0
      });
    }

    if (!txs.length) { showToast('Could not parse any transactions — check column mapping', 'error'); return; }
    txs.sort((a,b) => a.date - b.date);
    this.transactions = txs;
    this.computeHoldings();
    this.render();
    showToast(`Imported ${txs.length} transactions`, 'success');
  }

  parseDate(s) {
    if (!s) return null;
    // Try ISO
    let d = new Date(s);
    if (!isNaN(d)) return d;
    // DD.MM.YYYY
    const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
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
        const soldShares = Math.abs(tx.shares);
        const avgCost    = h.shares > 0 ? h.totalCost / h.shares : 0;
        h.totalCost -= avgCost * soldShares;
        h.shares    -= soldShares;
        h.fees      += tx.fees;
      } else if (tx.type === 'dividend') {
        h.dividends += tx.total;
      } else if (tx.type === 'fee') {
        h.fees += tx.total;
      }
    }

    this.holdings = Object.values(map).filter(h => h.shares > 0.0001).map(h => ({
      ...h,
      avgCost:   h.shares > 0 ? h.totalCost / h.shares : 0,
      type:      this.guessType(h.isin, h.name),
      curPrice:  null, // will be filled by live data if available
      region:    this.guessRegion(h.isin, h.name),
      sector:    this.guessSector(h.isin, h.name),
    }));

    // Estimate current value using last transaction price
    for (const h of this.holdings) {
      const lastBuy = [...h.buys].reverse()[0];
      h.curPrice = lastBuy ? lastBuy.price : h.avgCost;
      h.curValue = h.shares * h.curPrice;
      h.pnl      = h.curValue - h.totalCost;
      h.pnlPct   = h.totalCost > 0 ? (h.pnl / h.totalCost) * 100 : 0;
    }
  }

  guessType(isin, name) {
    const n = (name || '').toLowerCase();
    if (n.includes('etf') || n.includes('index') || n.includes('msci') || n.includes('s&p') || n.includes('stoxx')) return 'ETF';
    if (n.includes('anleihe') || n.includes('bond') || n.includes('treasury') || n.includes('bund')) return 'Bond';
    if (isin && isin.startsWith('DE000') && !n.includes('etf')) return 'Stock';
    if (n.includes('fonds') || n.includes('fund')) return 'Fund';
    return 'Stock';
  }

  guessRegion(isin, name) {
    const n = (name || '').toLowerCase();
    const country = isin ? isin.substring(0,2) : '';
    const map = { US:'North America', CA:'North America', GB:'Europe', DE:'Europe', FR:'Europe',
      CH:'Europe', NL:'Europe', SE:'Europe', IT:'Europe', ES:'Europe', DK:'Europe',
      JP:'Japan', AU:'Pacific', HK:'Asia Pacific', SG:'Asia Pacific', KR:'Asia Pacific',
      CN:'Emerging Markets', IN:'Emerging Markets', BR:'Emerging Markets', TW:'Asia Pacific' };
    if (map[country]) return map[country];
    if (n.includes('world') || n.includes('global')) return 'Global';
    if (n.includes('emerg') || n.includes('em ')) return 'Emerging Markets';
    if (n.includes('europe') || n.includes('euro')) return 'Europe';
    return 'Global';
  }

  guessSector(isin, name) {
    const n = (name || '').toLowerCase();
    if (n.includes('tech') || n.includes('software') || n.includes('semi')) return 'Technology';
    if (n.includes('bank') || n.includes('financial') || n.includes('versich')) return 'Financials';
    if (n.includes('health') || n.includes('pharma') || n.includes('bio')) return 'Healthcare';
    if (n.includes('energy') || n.includes('oil') || n.includes('gas')) return 'Energy';
    if (n.includes('consumer') || n.includes('retail')) return 'Consumer';
    if (n.includes('industrial') || n.includes('industry')) return 'Industrials';
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
    // Pass ETFs to ETF analyzer
    etfAnalyzer.detectFromPortfolio(this.holdings);
  }

  renderKPIs() {
    const totalValue    = this.holdings.reduce((s,h) => s + h.curValue, 0);
    const totalInvested = this.holdings.reduce((s,h) => s + h.totalCost, 0);
    const totalPnL      = totalValue - totalInvested;
    const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const totalDivs     = this.holdings.reduce((s,h) => s + h.dividends, 0);
    const totalFees     = this.transactions.reduce((s,t) => s + (t.fees||0), 0);
    const best          = this.holdings.reduce((b,h) => h.pnlPct > (b?.pnlPct || -Infinity) ? h : b, null);

    setText('kpi-value',       fmt(totalValue));
    setText('kpi-return',      fmtPnL(totalPnL));
    setText('kpi-return-pct',  `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`);
    setText('kpi-invested',    fmt(totalInvested));
    setText('kpi-positions',   this.holdings.length.toString());
    setText('kpi-dividends',   fmt(totalDivs));
    setText('kpi-div-sub',     totalInvested > 0 ? `${((totalDivs/totalInvested)*100).toFixed(2)}% yield` : '');
    setText('kpi-fees',        fmt(totalFees));

    const delta = document.getElementById('kpi-delta');
    if (delta) { delta.textContent = `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}% all time`; delta.className = 'kpi-delta ' + (totalPnL >= 0 ? 'green' : 'red'); }
    colorEl('kpi-return', totalPnL >= 0);
    colorEl('kpi-return-pct', totalPnL >= 0);

    setText('tx-count', `${this.transactions.length} transactions`);
  }

  renderAllocationChart() {
    const ctx = document.getElementById('alloc-chart').getContext('2d');
    if (this.allocChart) this.allocChart.destroy();

    const totalValue = this.holdings.reduce((s,h) => s + h.curValue, 0);
    let groups = {};
    for (const h of this.holdings) {
      const key = this.allocMode === 'type' ? h.type : this.allocMode === 'geo' ? h.region : h.sector;
      groups[key] = (groups[key] || 0) + h.curValue;
    }

    const sorted = Object.entries(groups).sort((a,b) => b[1]-a[1]);
    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([,v]) => +((v/totalValue)*100).toFixed(2));

    // Make chart-body layout work for donut
    const body = ctx.canvas.closest('.card-body');
    body.classList.add('donut-layout');
    ctx.canvas.style.width  = '200px';
    ctx.canvas.style.height = '200px';
    ctx.canvas.style.position = 'static';

    this.allocChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: false, cutout: '68%',
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` }
        }}
      }
    });

    // Legend
    const legend = document.getElementById('alloc-legend');
    legend.innerHTML = labels.map((l,i) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${CHART_COLORS[i]}"></div>
        <span class="legend-name">${l}</span>
        <span class="legend-pct">${data[i]}%</span>
      </div>`).join('');
  }

  renderPerfChart(mode) {
    const ctx = document.getElementById('perf-chart').getContext('2d');
    if (this.perfChart) this.perfChart.destroy();

    // Build timeline from transactions
    const byDate = {};
    let running = {};
    for (const tx of this.transactions) {
      const key = tx.isin || tx.name;
      if (!running[key]) running[key] = { shares: 0, cost: 0 };
      if (tx.type === 'buy') { running[key].shares += tx.shares; running[key].cost += tx.total; }
      else if (tx.type === 'sell') { running[key].shares -= Math.abs(tx.shares); }

      const dk = tx.date.toISOString().split('T')[0];
      byDate[dk] = JSON.parse(JSON.stringify(running));
    }

    const dates = Object.keys(byDate).sort();
    if (!dates.length) return;

    // Estimate portfolio value on each date
    const hMap = {};
    for (const h of this.holdings) hMap[h.isin || h.name] = h;

    const values = dates.map(dk => {
      const snap = byDate[dk];
      return Object.entries(snap).reduce((sum, [k, v]) => {
        const h = hMap[k];
        return sum + (h ? v.shares * h.avgCost : 0);
      }, 0);
    });

    const invested = dates.map(dk => {
      const snap = byDate[dk];
      return Object.entries(snap).reduce((s, [,v]) => s + v.cost, 0);
    });

    const labels = dates;
    const datasets = mode === 'growth' ? [
      { label: 'Portfolio Value', data: values, borderColor: CHART_COLORS[0], backgroundColor: 'rgba(6,200,216,.1)', fill: true, tension: 0.3, pointRadius: 0 },
      { label: 'Invested', data: invested, borderColor: CHART_COLORS[4], borderDash: [4,4], fill: false, tension: 0.1, pointRadius: 0 }
    ] : [{
      label: 'Total Return %',
      data: values.map((v,i) => invested[i] > 0 ? +((v - invested[i]) / invested[i] * 100).toFixed(2) : 0),
      borderColor: CHART_COLORS[2], backgroundColor: 'rgba(16,201,128,.1)', fill: true, tension: 0.3, pointRadius: 0
    }];

    this.perfChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#8899b8', boxWidth: 12, font: { size: 11 } } },
          tooltip: { backgroundColor: '#101828', borderColor: '#1a2840', borderWidth: 1,
            callbacks: { label: c => ` ${c.dataset.label}: ${mode === 'growth' ? fmt(c.parsed.y) : c.parsed.y.toFixed(2) + '%'}` }}},
        scales: {
          x: { ticks: { color: '#4a6080', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font: { size: 11 },
            callback: v => mode === 'growth' ? fmt(v) : v.toFixed(1) + '%' }, grid: { color: '#1a2840' } }
        }
      }
    });
  }

  renderHoldingsTable() {
    const totalValue = this.holdings.reduce((s,h) => s + h.curValue, 0);
    const tbody = document.getElementById('holdings-tbody');
    tbody.innerHTML = this.holdings.sort((a,b) => b.curValue - a.curValue).map(h => `
      <tr>
        <td class="name-cell">${esc(h.name)}</td>
        <td>${esc(h.isin)}</td>
        <td><span class="badge ${h.type==='ETF'?'badge-blue':h.type==='Bond'?'badge-yellow':'badge-green'}">${h.type}</span></td>
        <td class="num">${h.shares.toFixed(4)}</td>
        <td class="num">${fmt(h.avgCost)}</td>
        <td class="num">${fmt(h.curPrice)}</td>
        <td class="num">${fmt(h.curValue)}</td>
        <td class="num ${h.pnl>=0?'green':'red'}">${h.pnl>=0?'+':''}${fmt(h.pnl)}</td>
        <td class="num ${h.pnlPct>=0?'green':'red'}">${h.pnlPct>=0?'+':''}${h.pnlPct.toFixed(2)}%</td>
        <td class="num">${((h.curValue/totalValue)*100).toFixed(1)}%</td>
      </tr>`).join('');
  }

  renderTransactionTable() {
    const tbody = document.getElementById('tx-tbody');
    const sorted = [...this.transactions].reverse();
    tbody.innerHTML = sorted.slice(0, 200).map(tx => {
      const typeClass = tx.type==='buy'?'badge-green':tx.type==='sell'?'badge-red':tx.type==='dividend'?'badge-blue':'badge-yellow';
      return `<tr>
        <td>${tx.date.toLocaleDateString('de-DE')}</td>
        <td><span class="badge ${typeClass}">${tx.type.toUpperCase()}</span></td>
        <td class="name-cell">${esc(tx.name)}</td>
        <td>${esc(tx.isin)}</td>
        <td class="num">${Math.abs(tx.shares).toFixed(4)}</td>
        <td class="num">${fmt(tx.price)}</td>
        <td class="num">${fmt(tx.total)}</td>
        <td class="num">${fmt(tx.fees)}</td>
      </tr>`;
    }).join('');
    if (sorted.length > 200) {
      tbody.innerHTML += `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:12px">Showing first 200 of ${sorted.length} transactions</td></tr>`;
    }
  }

  filterHoldings(q) {
    const rows = document.querySelectorAll('#holdings-tbody tr');
    const lq = q.toLowerCase();
    rows.forEach(r => { r.style.display = r.textContent.toLowerCase().includes(lq) ? '' : 'none'; });
  }

  loadSample() {
    const today = new Date();
    const d = (y,m,day) => new Date(y,m-1,day);
    const txs = [
      // VWCE buys
      {date:d(2021,3,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:20, price:82.40, total:1648.00, fees:1.90},
      {date:d(2021,6,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:15, price:89.12, total:1336.80, fees:1.90},
      {date:d(2021,9,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:12, price:95.44, total:1145.28, fees:1.90},
      {date:d(2022,1,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:18, price:99.20, total:1785.60, fees:1.90},
      {date:d(2022,6,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:25, price:80.15, total:2003.75, fees:1.90},
      {date:d(2023,3,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:20, price:88.70, total:1774.00, fees:1.90},
      {date:d(2023,9,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:22, price:97.30, total:2140.60, fees:1.90},
      {date:d(2024,3,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:18, price:108.40, total:1951.20, fees:1.90},
      {date:d(2024,9,15), type:'buy', name:'Vanguard FTSE All-World', isin:'IE00BK5BQT80', shares:15, price:112.60, total:1689.00, fees:1.90},
      // iShares Core S&P 500
      {date:d(2021,4,1),  type:'buy', name:'iShares Core S&P 500',   isin:'IE00B5BMR087', shares:8,  price:340.20, total:2721.60, fees:3.90},
      {date:d(2021,10,1), type:'buy', name:'iShares Core S&P 500',   isin:'IE00B5BMR087', shares:5,  price:395.80, total:1979.00, fees:3.90},
      {date:d(2022,7,1),  type:'buy', name:'iShares Core S&P 500',   isin:'IE00B5BMR087', shares:10, price:302.40, total:3024.00, fees:3.90},
      {date:d(2023,5,1),  type:'buy', name:'iShares Core S&P 500',   isin:'IE00B5BMR087', shares:6,  price:358.10, total:2148.60, fees:3.90},
      {date:d(2024,2,1),  type:'buy', name:'iShares Core S&P 500',   isin:'IE00B5BMR087', shares:4,  price:438.50, total:1754.00, fees:3.90},
      // Emerging Markets
      {date:d(2021,5,15), type:'buy', name:'iShares Core MSCI EM IMI',isin:'IE00BKM4GZ66', shares:50, price:28.40, total:1420.00, fees:1.90},
      {date:d(2022,4,15), type:'buy', name:'iShares Core MSCI EM IMI',isin:'IE00BKM4GZ66', shares:60, price:24.80, total:1488.00, fees:1.90},
      {date:d(2023,8,15), type:'buy', name:'iShares Core MSCI EM IMI',isin:'IE00BKM4GZ66', shares:40, price:26.70, total:1068.00, fees:1.90},
      // MSCI World Small Cap
      {date:d(2022,2,1),  type:'buy', name:'iShares MSCI World Small Cap',isin:'IE00BF4RFH31', shares:30, price:52.40, total:1572.00, fees:1.90},
      {date:d(2023,2,1),  type:'buy', name:'iShares MSCI World Small Cap',isin:'IE00BF4RFH31', shares:25, price:54.80, total:1370.00, fees:1.90},
      // SAP SE individual stock
      {date:d(2022,10,15),type:'buy', name:'SAP SE',                  isin:'DE0007164600',  shares:15, price:88.20, total:1323.00, fees:5.90},
      {date:d(2023,4,15), type:'buy', name:'SAP SE',                  isin:'DE0007164600',  shares:10, price:112.40,total:1124.00, fees:5.90},
      // Dividends
      {date:d(2022,4,1),  type:'dividend',name:'Vanguard FTSE All-World',isin:'IE00BK5BQT80',shares:0,price:0,total:98.40,fees:0},
      {date:d(2023,4,1),  type:'dividend',name:'Vanguard FTSE All-World',isin:'IE00BK5BQT80',shares:0,price:0,total:147.20,fees:0},
      {date:d(2024,4,1),  type:'dividend',name:'Vanguard FTSE All-World',isin:'IE00BK5BQT80',shares:0,price:0,total:198.80,fees:0},
      {date:d(2023,6,1),  type:'dividend',name:'SAP SE',              isin:'DE0007164600',  shares:0,price:0,total:34.50,fees:0},
      {date:d(2024,6,1),  type:'dividend',name:'SAP SE',              isin:'DE0007164600',  shares:0,price:0,total:42.50,fees:0},
    ];
    txs.sort((a,b) => a.date - b.date);
    this.transactions = txs;

    // Manually set current prices for sample
    this.computeHoldings();
    const priceMap = { 'IE00BK5BQT80': 121.40, 'IE00B5BMR087': 498.20, 'IE00BKM4GZ66': 28.80, 'IE00BF4RFH31': 61.40, 'DE0007164600': 194.80 };
    for (const h of this.holdings) {
      if (priceMap[h.isin]) { h.curPrice = priceMap[h.isin]; h.curValue = h.shares * h.curPrice; h.pnl = h.curValue - h.totalCost; h.pnlPct = (h.pnl/h.totalCost)*100; }
    }

    this.render();
    showToast('Sample portfolio loaded with 5 positions', 'success');
  }
}

/* ── Utilities ── */
function fmt(v, decimals = 2) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}
function fmtPnL(v) {
  const s = fmt(Math.abs(v));
  return (v >= 0 ? '+' : '-') + s;
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function colorEl(id, positive) { const el = document.getElementById(id); if (el) { el.classList.toggle('green', positive); el.classList.toggle('red', !positive); }}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function closeModal() { document.getElementById('mapping-modal').classList.add('hidden'); }
function showToast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

const portfolio = new PortfolioManager();
