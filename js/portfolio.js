/* Portfolio Manager — parse, analyse, render */

/* ── S&P 500 monthly close reference data (approximate) ── */
const SP500_MONTHLY = {
  '2015-01':1994,'2015-02':2105,'2015-03':2068,'2015-04':2086,'2015-05':2107,'2015-06':2063,
  '2015-07':2104,'2015-08':1972,'2015-09':1920,'2015-10':2080,'2015-11':2080,'2015-12':2044,
  '2016-01':1940,'2016-02':1932,'2016-03':2060,'2016-04':2066,'2016-05':2097,'2016-06':2099,
  '2016-07':2174,'2016-08':2171,'2016-09':2168,'2016-10':2126,'2016-11':2198,'2016-12':2239,
  '2017-01':2279,'2017-02':2364,'2017-03':2363,'2017-04':2384,'2017-05':2412,'2017-06':2423,
  '2017-07':2470,'2017-08':2472,'2017-09':2519,'2017-10':2575,'2017-11':2648,'2017-12':2674,
  '2018-01':2824,'2018-02':2714,'2018-03':2641,'2018-04':2648,'2018-05':2706,'2018-06':2718,
  '2018-07':2816,'2018-08':2902,'2018-09':2914,'2018-10':2712,'2018-11':2760,'2018-12':2507,
  '2019-01':2704,'2019-02':2784,'2019-03':2834,'2019-04':2946,'2019-05':2752,'2019-06':2942,
  '2019-07':3026,'2019-08':2926,'2019-09':2977,'2019-10':3037,'2019-11':3141,'2019-12':3231,
  '2020-01':3226,'2020-02':2954,'2020-03':2585,'2020-04':2912,'2020-05':3044,'2020-06':3100,
  '2020-07':3271,'2020-08':3500,'2020-09':3363,'2020-10':3269,'2020-11':3622,'2020-12':3756,
  '2021-01':3714,'2021-02':3811,'2021-03':3973,'2021-04':4181,'2021-05':4204,'2021-06':4298,
  '2021-07':4395,'2021-08':4523,'2021-09':4308,'2021-10':4605,'2021-11':4567,'2021-12':4766,
  '2022-01':4432,'2022-02':4374,'2022-03':4530,'2022-04':4132,'2022-05':4132,'2022-06':3785,
  '2022-07':4130,'2022-08':4010,'2022-09':3586,'2022-10':3901,'2022-11':4080,'2022-12':3840,
  '2023-01':4077,'2023-02':3951,'2023-03':4109,'2023-04':4169,'2023-05':4179,'2023-06':4450,
  '2023-07':4588,'2023-08':4508,'2023-09':4288,'2023-10':4194,'2023-11':4567,'2023-12':4769,
  '2024-01':4845,'2024-02':5137,'2024-03':5254,'2024-04':5036,'2024-05':5278,'2024-06':5460,
  '2024-07':5522,'2024-08':5648,'2024-09':5762,'2024-10':5705,'2024-11':5896,'2024-12':5882,
  '2025-01':5612,'2025-02':5843,'2025-03':5612,'2025-04':5035,'2025-05':5611,'2025-06':5460
};

/* EU CPI annual rate (%) for Realrendite calculation */
const EU_CPI = {
  2015:0.0,2016:0.2,2017:1.5,2018:1.8,2019:1.2,2020:0.3,
  2021:2.9,2022:8.4,2023:3.1,2024:2.2,2025:2.4
};

function getSP500AtDate(dateStr) {
  const ym = dateStr.substring(0, 7);
  if (SP500_MONTHLY[ym]) return SP500_MONTHLY[ym];
  const keys = Object.keys(SP500_MONTHLY).sort();
  const before = keys.filter(k => k <= ym).pop();
  const after  = keys.find(k => k >= ym);
  if (!before) return SP500_MONTHLY[after] || null;
  if (!after)  return SP500_MONTHLY[before];
  const d1 = new Date(before + '-01'), d2 = new Date(after + '-01'), d = new Date(ym + '-01');
  const t  = (d - d1) / (d2 - d1);
  return SP500_MONTHLY[before] * (1 - t) + SP500_MONTHLY[after] * t;
}

/* Estimate purchase date from P&L% using S&P 500 as market proxy.
   Logic: if a position gained X%, the market was ~X% lower when it was bought.
   We search SP500_MONTHLY for the closest level to SP500_now / (1+X) */
function estimatePurchaseDateFromPnL(pnlPct) {
  if (pnlPct == null || isNaN(pnlPct)) return null;
  const keys  = Object.keys(SP500_MONTHLY).sort();
  const nowSP = SP500_MONTHLY[keys[keys.length - 1]];
  const targetSP = nowSP / (1 + pnlPct / 100);
  let bestYM = null, bestDiff = Infinity;
  for (const [ym, val] of Object.entries(SP500_MONTHLY)) {
    const d = Math.abs(val - targetSP);
    if (d < bestDiff) { bestDiff = d; bestYM = ym; }
  }
  if (!bestYM) return null;
  const date    = new Date(bestYM + '-15');
  const minDate = new Date(); minDate.setFullYear(minDate.getFullYear() - 10);
  return date < minDate ? minDate : date;   // cap at 10 years back
}

function getCumulativeInflation(fromDate, toDate = new Date()) {
  const y0 = fromDate.getFullYear(), y1 = toDate.getFullYear();
  let factor = 1;
  for (let y = y0; y <= y1; y++) {
    const weight = y === y0 ? (1 - fromDate.getMonth() / 12) :
                   y === y1 ? (toDate.getMonth()   / 12) : 1;
    factor *= Math.pow(1 + (EU_CPI[y] || 2.0) / 100, weight);
  }
  return factor; // multiply portfolio value by (1/factor) to get real value
}

/* ── Robust number parser ── */
function parseNum(s) {
  if (s == null || s === '' || s === '-') return 0;
  let str = String(s).replace(/\s/g, '').replace(/"/g, '').replace(/'/g, '');
  if (!str || str === '-') return 0;
  const hasComma = str.includes(','), hasPeriod = str.includes('.');
  if (hasComma && hasPeriod) {
    str = str.lastIndexOf('.') > str.lastIndexOf(',')
      ? str.replace(/,/g, '')                      // US: 15,617.01
      : str.replace(/\./g, '').replace(',', '.');   // DE: 15.617,01
  } else if (hasComma) {
    const afterComma = str.split(',').pop() || '';
    str = afterComma.length === 3 && !isNaN(afterComma)
      ? str.replace(',', '')  // thousands
      : str.replace(',', '.'); // decimal
  }
  return parseFloat(str.replace(/[^0-9.\-]/g, '')) || 0;
}

function isSnapshotFormat(fields) {
  const f = fields.map(x => (x || '').toLowerCase().replace(/\s+/g, ' ').trim());
  return (f.some(x => x.includes('kurswert in eur') || x.includes('kurswert')) &&
          f.some(x => x.includes('einstandskurs') || x.includes('performance in eur')));
}

class PortfolioManager {
  constructor() {
    this.transactions = [];
    this.holdings     = [];
    this.allocChart   = null;
    this.perfChart    = null;
    this.allocMode    = 'type';
    this.isSnapshot   = false;
    this.inceptionDate = null;   // set by user for snapshot imports
    this._mappingResolve = null;
  }

  init() {
    const fi = document.getElementById('file-input');
    fi.addEventListener('change', e => this.handleFileInput(e.target));
    document.getElementById('load-sample-btn').addEventListener('click', () => this.loadSample());
    document.getElementById('sample-btn2').addEventListener('click',    () => this.loadSample());

    const ua = document.getElementById('upload-area');
    ua.addEventListener('dragover',  e => { e.preventDefault(); ua.classList.add('drag-over'); });
    ua.addEventListener('dragleave', ()  => ua.classList.remove('drag-over'));
    ua.addEventListener('drop', e => {
      e.preventDefault(); ua.classList.remove('drag-over');
      const f = e.dataTransfer.files[0]; if (f) this.processFile(f);
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
    this.processFile(f); input.value = '';
  }

  processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      const r = new FileReader();
      r.onload = e => this.parseCSV(e.target.result);
      r.readAsText(file, 'UTF-8');
    } else if (ext === 'xlsx' || ext === 'xls') {
      const r = new FileReader();
      r.onload = e => this.parseExcel(e.target.result);
      r.readAsArrayBuffer(file);
    } else { showToast('Unsupported format. Use CSV or Excel (.xlsx/.xls)', 'error'); }
  }

  parseCSV(text) {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const nC = (firstLine.match(/,/g) || []).length;
    const nS = (firstLine.match(/;/g) || []).length;
    const nT = (firstLine.match(/\t/g) || []).length;
    const delimiter = nS > nC && nS > nT ? ';' : nT > nC ? '\t' : ',';
    const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false, delimiter, transformHeader: h => h.trim() });
    if (!result.data.length) { showToast('File appears empty', 'error'); return; }
    this.processRows(result.data, result.meta.fields || Object.keys(result.data[0]));
  }

  parseExcel(buffer) {
    const wb  = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!raw.length) { showToast('Empty spreadsheet', 'error'); return; }
    const seen = {}, headers = raw[0].map(h => {
      const k = String(h || '').trim(); seen[k] = (seen[k] || 0) + 1;
      return seen[k] > 1 ? `${k}_${seen[k]}` : k;
    });
    const data = raw.slice(1).filter(r => r.some(c => c !== '')).map(r => {
      const obj = {}; headers.forEach((h, i) => { obj[h] = r[i] ?? ''; }); return obj;
    });
    if (!data.length) { showToast('No data rows in spreadsheet', 'error'); return; }
    this.processRows(data, headers);
  }

  processRows(rows, fields) {
    if (isSnapshotFormat(fields)) { this.importSnapshotFormat(rows, fields); return; }
    const mapping = this.detectMapping(fields);
    if (mapping.confidence < 3) {
      this.showMappingDialog(fields, mapping).then(m => { if (m) this.importWithMapping(rows, m); });
    } else { this.importWithMapping(rows, mapping); }
  }

  importSnapshotFormat(rows, fields) {
    this.isSnapshot = true;
    const f = fields.map(x => (x || '').toLowerCase().trim());
    const col = (...ps) => { for (const p of ps) { const i = f.findIndex(x => x.includes(p)); if (i !== -1) return fields[i]; } return null; };
    const C = {
      isin: col('isin'), name: col('titel','name','bezeichnung'),
      price: col('kurs'), shares: col('menge','anzahl','stück'),
      value: col('kurswert in eur','kurswert'), pnlEur: col('performance in eur','gewinn/verlust'),
      pnlPct: col('performance in %','rendite'), avgCost: col('einstandskurs'),
      dividends: col('erträge','ertraege'), fees: col('spesen','gebühren'),
    };
    const holdings = [];
    for (const row of rows) {
      const isin = String(row[C.isin] || '').trim().toUpperCase();
      const name = String(row[C.name] || '').trim();
      if (!isin && !name) continue;
      const curPrice  = parseNum(row[C.price]);
      const shares    = parseNum(row[C.shares]);
      const curValue  = parseNum(row[C.value]) || shares * curPrice;
      const pnlEur    = parseNum(row[C.pnlEur]);
      const pnlPct    = parseNum(row[C.pnlPct]);
      const avgCost   = parseNum(row[C.avgCost]) || (shares > 0 ? (curValue - pnlEur) / shares : 0);
      const dividends = parseNum(row[C.dividends]);
      const fees      = parseNum(row[C.fees]);
      const estimatedBuyDate = estimatePurchaseDateFromPnL(pnlPct);
      holdings.push({
        isin, name, shares, curPrice, curValue, avgCost, totalCost: shares * avgCost,
        pnl: pnlEur, pnlPct, dividends, fees, buys: [], estimatedBuyDate,
        type: this.guessType(isin, name), region: this.guessRegion(isin, name), sector: this.guessSector(isin, name),
      });
    }
    if (!holdings.length) { showToast('No holdings found', 'error'); return; }

    // Estimate portfolio inception date from weighted-average P&L before render()
    const totalCurVal = holdings.reduce((s,h) => s + h.curValue, 0);
    const avgPnL = totalCurVal > 0
      ? holdings.reduce((s,h) => s + h.pnlPct * h.curValue, 0) / totalCurVal
      : 0;
    this.inceptionDate = estimatePurchaseDateFromPnL(avgPnL) || new Date(new Date().getFullYear() - 3, 0, 1);

    this.transactions = [{ date: new Date(), type: 'buy', name: 'Portfolio snapshot', isin: '', shares: 0, price: 0,
      total: totalCurVal, fees: 0 }];
    this.holdings = holdings;
    this.render();
    showToast(`Imported ${holdings.length} positions from depot snapshot`, 'success');
  }

  detectMapping(fields) {
    const f = fields.map(x => (x || '').toLowerCase().trim());
    const find = (...ps) => { for (const p of ps) { const i = f.findIndex(x => x.includes(p)); if (i !== -1) return fields[i]; } return null; };
    const mapping = {
      date:  find('datum','date','buchungsdatum','valuta','time'),
      name:  find('name','bezeichnung','wertpapier','titel','security'),
      isin:  find('isin'),
      shares:find('anzahl','shares','stück','quantity','units','menge'),
      price: find('preis','kurs','price','einzelpreis','unit price'),
      total: find('gesamtwert','total','betrag','summe','wert','amount','value','gesamt'),
      type:  find('transaktion','typ','type','art','buchungsart'),
      fees:  find('gebühr','gebuhren','fees','kosten','provision','spesen'),
    };
    mapping.confidence = Object.entries(mapping).filter(([k,v]) => k !== 'confidence' && v != null).length;
    return mapping;
  }

  showMappingDialog(fields, suggested) {
    return new Promise(resolve => {
      const body = document.getElementById('mapping-body');
      const NEED = [
        {key:'date',label:'Transaction Date *'},{key:'name',label:'Asset Name *'},{key:'isin',label:'ISIN'},
        {key:'shares',label:'Shares / Units *'},{key:'price',label:'Price per Share'},
        {key:'total',label:'Total Amount *'},{key:'type',label:'Transaction Type'},{key:'fees',label:'Fees'},
      ];
      const opts = ['-- skip --',...fields].map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
      body.innerHTML = NEED.map(({key,label}) => `<div class="mapping-row"><label>${label}</label>
        <select class="select-input mapping-sel" data-key="${key}">${opts}</select></div>`).join('');
      body.querySelectorAll('.mapping-sel').forEach(sel => { const v = suggested[sel.dataset.key]; if (v) sel.value = v; });
      document.getElementById('mapping-modal').classList.remove('hidden');
      this._mappingResolve = resolve;
      document.getElementById('apply-mapping-btn').onclick = () => {
        const m = {}; body.querySelectorAll('.mapping-sel').forEach(sel => { if (sel.value !== '-- skip --') m[sel.dataset.key] = sel.value; });
        closeModal(); resolve(m);
      };
    });
  }

  importWithMapping(rows, map) {
    const txs = [];
    for (const row of rows) {
      const typeRaw = String(row[map.type] || '').toLowerCase().trim();
      let type = 'buy';
      if      (typeRaw.match(/verkauf|sell|ausbuchung/))                        type = 'sell';
      else if (typeRaw.match(/dividend|dividende|ausschüttung|kupon|zinsen/))   type = 'dividend';
      else if (typeRaw.match(/kauf|buy|einlage|einbuchung|sparplan/))           type = 'buy';
      else if (typeRaw.match(/gebühr|gebuhr|fee|kosten/))                       type = 'fee';

      const price  = parseNum(row[map.price]);
      const sharesRaw = parseNum(row[map.shares]);
      const totalRaw  = map.total ? parseNum(row[map.total]) : 0;
      const total     = totalRaw || Math.abs(sharesRaw) * Math.abs(price);
      let   shares    = sharesRaw || (price ? total / price : 0);
      if (type === 'sell') shares = -Math.abs(shares); else shares = Math.abs(shares);

      const date = this.parseDate(String(row[map.date] || ''));
      if (!date) continue;
      if (!shares && total === 0 && type !== 'dividend') continue;
      txs.push({ date, type, name: String(row[map.name]||'Unknown').trim(), isin: String(row[map.isin]||'').trim().toUpperCase(), shares, price: Math.abs(price), total: Math.abs(total), fees: parseNum(row[map.fees]) });
    }
    if (!txs.length) { showToast('Could not parse transactions — check column mapping', 'error'); return; }
    txs.sort((a,b) => a.date - b.date);
    this.transactions = txs;
    this.isSnapshot   = false;
    this.inceptionDate = txs[0].date;
    this.computeHoldings();
    this.render();
    showToast(`Imported ${txs.length} transactions`, 'success');
  }

  parseDate(s) {
    if (!s) return null;
    let d = new Date(s); if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d;
    const m  = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (m)  { d = new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`); if (!isNaN(d.getTime())) return d; }
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
      if      (tx.type === 'buy')      { h.shares += tx.shares; h.totalCost += tx.total; h.fees += tx.fees; h.buys.push(tx); }
      else if (tx.type === 'sell')     { const sold = Math.abs(tx.shares); const avg = h.shares > 0 ? h.totalCost/h.shares : 0; h.totalCost = Math.max(0, h.totalCost - avg*sold); h.shares = Math.max(0, h.shares - sold); h.fees += tx.fees; }
      else if (tx.type === 'dividend') { h.dividends += tx.total; }
      else if (tx.type === 'fee')      { h.fees += tx.total; }
    }
    this.holdings = Object.values(map).filter(h => h.shares > 0.0001).map(h => {
      const avgCost = h.shares > 0 ? h.totalCost / h.shares : 0;
      const curPrice = h.buys.length ? [...h.buys].reverse()[0].price : avgCost;
      const curValue = h.shares * curPrice;
      const pnl      = curValue - h.totalCost;
      const pnlPct   = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
      return { ...h, avgCost, curPrice, curValue, pnl, pnlPct, type: this.guessType(h.isin, h.name), region: this.guessRegion(h.isin, h.name), sector: this.guessSector(h.isin, h.name) };
    });
  }

  guessType(isin, name) {
    // 1. Check known ETF database first (ISIN-based, handles all abbreviations)
    if (isin && typeof ETF_LIST !== 'undefined' && ETF_LIST.find(e => e.isin === isin)) return 'ETF';
    const n = (name || '').toLowerCase().trim();
    // 2. ETF provider prefixes (case-insensitive)
    if (/^(ishs|xtr[\s(]|van\s|lyxr|spdr|amnd|ubs\s|bnp\s|invesco|fidelity|wisdomtree|vaneck|x\(ie\)|i\.m\.)/.test(n)) return 'ETF';
    // 3. ETF keywords and naming conventions (DLA/DLDIS = distributing ETF share classes)
    if (n.includes('etf') || n.includes('ucits') || n.includes('msci') || n.includes('stoxx') ||
        n.includes('ftse') || n.includes('index') || n.includes('swap') ||
        /\b(1c|dla|dld|dldis|dlh|acc|dist)\s*$/.test(n)) return 'ETF';
    // 4. Bond keywords
    if (n.includes('bond') || n.includes('anleihe') || n.includes('treasury') || n.includes('bund') || n.includes('kupon') || n.includes('notes')) return 'Bond';
    // 5. Fund keywords
    if (n.includes('fonds') || (n.includes('fund') && !n.includes('etf'))) return 'Fund';
    const cc = isin ? isin.substring(0, 2) : '';
    if (cc === 'AT' && !n.includes('etf')) return 'Fund';
    return 'Stock';
  }

  guessRegion(isin, name) {
    const n = (name || '').toLowerCase(), cc = isin ? isin.substring(0,2) : '';
    const ccMap = { US:'North America',CA:'North America',GB:'Europe',DE:'Europe',FR:'Europe',CH:'Europe',NL:'Europe',SE:'Europe',IT:'Europe',ES:'Europe',DK:'Europe',AT:'Europe',LU:'Europe',JP:'Japan',AU:'Pacific',NZ:'Pacific',HK:'Asia Pacific',SG:'Asia Pacific',KR:'Asia Pacific',CN:'Emerging Markets',IN:'Emerging Markets',BR:'Emerging Markets',TW:'Asia Pacific',ZA:'Emerging Markets',SA:'Emerging Markets' };
    if (ccMap[cc]) return ccMap[cc];
    if (n.includes('world') || n.includes('global') || n.includes('acwi') || n.includes('all-world')) return 'Global';
    if (n.includes('emerg') || n.includes(' em ') || n.includes('emi')) return 'Emerging Markets';
    if (n.includes('europe') || n.includes('euro') || n.includes('stoxx') || n.includes('dax')) return 'Europe';
    if (n.includes('us ') || n.includes('s&p') || n.includes('nasdaq') || n.includes('usa')) return 'North America';
    return 'Global';
  }

  guessSector(isin, name) {
    const n = (name || '').toLowerCase();
    if (n.includes('tech') || n.includes('software') || n.includes('semi') || n.match(/\bit\b/)) return 'Technology';
    if (n.includes('bank') || n.includes('financial') || n.includes('bnks')) return 'Financials';
    if (n.includes('health') || n.includes('pharma') || n.includes('bio')) return 'Healthcare';
    if (n.includes('energy') || n.includes('oil') || n.includes('gas') || n.includes('clean') || n.includes('solar')) return 'Energy';
    if (n.includes('commodit') || n.includes('material') || n.includes('metal') || n.includes('gold')) return 'Commodities';
    if (n.includes('defense') || n.includes('defence') || n.includes('dfns')) return 'Defence';
    if (n.includes('real estate') || n.includes('reit') || n.includes('immob')) return 'Real Estate';
    if (n.includes('bond') || n.includes('anleihe') || n.includes('treasury') || n.includes('fixed')) return 'Bonds';
    // Generic equity / mixed fund fallback — better than "Diversified"
    if (n.includes('stock') || n.includes('aktien') || n.includes('equity') || n.includes('akcji')) return 'Equities';
    if (n.includes('balanced') || n.includes('gemischt') || n.includes('multi')) return 'Mixed';
    return 'Diversified';
  }

  /* Returns stats for Monte Carlo pre-fill */
  getPortfolioStats() {
    const totalValue = this.holdings.reduce((s,h) => s + h.curValue, 0);
    if (!totalValue) return null;

    // Estimate μ/σ from asset mix (reference expected returns)
    const CLASS_PARAMS = {
      'ETF-Global':     { mu:7.0, sigma:15.0 }, 'ETF-US':    { mu:9.0, sigma:18.0 },
      'ETF-EM':         { mu:7.5, sigma:22.0 }, 'ETF-SC':    { mu:8.0, sigma:19.0 },
      'ETF-Tech':       { mu:10.0,sigma:24.0 }, 'ETF-Other': { mu:7.0, sigma:18.0 },
      'Stock':          { mu:8.0, sigma:25.0 }, 'Bond':      { mu:2.0, sigma: 6.0 },
      'Fund':           { mu:5.0, sigma:12.0 }, 'Commodities':{ mu:4.0,sigma:18.0 }
    };
    const classify = h => {
      if (h.type !== 'ETF') return h.type;
      const n = h.name.toLowerCase();
      if (n.includes('s&p') || n.includes('usa') || n.includes('us banks') || n.includes('banks')) return 'ETF-US';
      if (n.includes('emerg') || n.includes('emi') || n.includes('em ')) return 'ETF-EM';
      if (n.includes('small cap') || n.includes('sc ') || n.includes('acwi')) return 'ETF-SC';
      if (n.includes('tech') || n.includes('it ') || n.includes(' it') || n.includes('information technology')) return 'ETF-Tech';
      return 'ETF-Global';
    };

    let wMu = 0, wSigma2 = 0;
    for (const h of this.holdings) {
      const w = h.curValue / totalValue;
      const cls = classify(h);
      const p = CLASS_PARAMS[cls] || CLASS_PARAMS['ETF-Other'];
      wMu      += w * p.mu;
      wSigma2  += w * p.sigma * p.sigma;
    }

    // Avg monthly contribution (last 12 months of transaction history)
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentBuys = this.transactions.filter(t => t.type === 'buy' && t.date >= oneYearAgo);
    const monthlyContrib = recentBuys.length ? recentBuys.reduce((s,t) => s + t.total, 0) / 12 : 0;

    return {
      totalValue,
      mu:      Math.round(wMu * 2) / 2,
      sigma:   Math.round(Math.sqrt(wSigma2) * 2) / 2,
      monthly: Math.round(monthlyContrib / 50) * 50,
    };
  }

  render() {
    document.getElementById('upload-area').classList.add('hidden');
    document.getElementById('portfolio-dashboard').classList.remove('hidden');
    this.renderKPIs();
    this.renderAllocationChart();
    this.renderPerfChart('growth');
    this.renderHoldingsTable();
    this.renderTransactionTable();
    if (this.isSnapshot) this.injectInceptionDatePicker();
    etfAnalyzer.detectFromPortfolio(this.holdings);
  }

  injectInceptionDatePicker() {
    const header = document.querySelector('#perf-chart')?.closest('.card')?.querySelector('.card-header');
    if (!header || header.querySelector('#inception-date')) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text2)';
    wrap.innerHTML = `<span>Startdatum:</span><input type="month" id="inception-date" class="form-input" style="width:140px;padding:4px 8px;font-size:11px" value="${new Date().toISOString().substring(0,7)}">`;
    header.appendChild(wrap);
    document.getElementById('inception-date').addEventListener('change', e => {
      this.inceptionDate = new Date(e.target.value + '-01');
      this.renderHoldingsTable();
      this.renderPerfChart(document.querySelector('#perf-tabs .tab.active')?.dataset?.perf || 'growth');
    });
    // Use already-estimated inceptionDate (from P&L proxy) if available, else default 3y ago
    if (!this.inceptionDate) this.inceptionDate = new Date(new Date().getFullYear() - 3, 0, 1);
    document.getElementById('inception-date').value =
      this.inceptionDate.toISOString().substring(0, 7);
  }

  renderKPIs() {
    const totalValue    = this.holdings.reduce((s,h) => s + h.curValue, 0);
    const totalInvested = this.holdings.reduce((s,h) => s + h.totalCost, 0);
    const totalPnL      = totalValue - totalInvested;
    const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const totalDivs     = this.holdings.reduce((s,h) => s + (h.dividends||0), 0);
    const totalFees     = this.holdings.reduce((s,h) => s + (h.fees||0), 0);

    // Real return (inflation-adjusted)
    const startDate = this.inceptionDate || this.transactions[0]?.date || new Date(new Date().getFullYear() - 3, 0, 1);
    const inflFactor = getCumulativeInflation(startDate);
    const realReturn = ((1 + totalPnLPct/100) / inflFactor - 1) * 100;

    setText('kpi-value',      fmt(totalValue));
    setText('kpi-return',     fmtPnL(totalPnL));
    setText('kpi-return-pct', `${totalPnLPct >= 0?'+':''}${totalPnLPct.toFixed(2)}%`);
    setText('kpi-invested',   fmt(totalInvested));
    setText('kpi-positions',  String(this.holdings.length));
    setText('kpi-dividends',  fmt(totalDivs));
    setText('kpi-div-sub',    totalInvested > 0 ? `${((totalDivs/totalInvested)*100).toFixed(2)}% yield` : '');
    setText('kpi-fees',       fmt(totalFees));
    setText('kpi-real-return', `${realReturn >= 0?'+':''}${realReturn.toFixed(2)}%`);
    colorEl('kpi-real-return', realReturn >= 0);

    const deltaEl = document.getElementById('kpi-delta');
    if (deltaEl) { deltaEl.textContent = `${totalPnLPct>=0?'+':''}${totalPnLPct.toFixed(2)}% all time`; deltaEl.className = `kpi-delta ${totalPnL>=0?'green':'red'}`; }
    colorEl('kpi-return', totalPnL >= 0);
    colorEl('kpi-return-pct', totalPnL >= 0);
    setText('tx-count', `${this.transactions.length} transactions`);
  }

  renderAllocationChart() {
    const ctx = document.getElementById('alloc-chart').getContext('2d');
    if (this.allocChart) this.allocChart.destroy();
    const totalValue = this.holdings.reduce((s, h) => s + h.curValue, 0);
    const groups = {};

    // Normalize ETF_DB region names (country-level → broader region bucket)
    const REGION_NORM = {
      'United States':'North America','Canada':'North America',
      'United Kingdom':'Europe','France':'Europe','Germany':'Europe','Switzerland':'Europe',
      'Netherlands':'Europe','Sweden':'Europe','Denmark':'Europe','Spain':'Europe',
      'Italy':'Europe','Belgium':'Europe','Finland':'Europe','Norway':'Europe','Austria':'Europe',
      'China':'Emerging Markets','India':'Emerging Markets','South Korea':'Emerging Markets',
      'Brazil':'Emerging Markets','Taiwan':'Emerging Markets','Saudi Arabia':'Emerging Markets',
      'South Africa':'Emerging Markets','Mexico':'Emerging Markets','Indonesia':'Emerging Markets',
      'Thailand':'Emerging Markets','Poland':'Emerging Markets','Turkey':'Emerging Markets',
      'Pacific ex-JP':'Asia Pacific',
    };
    const normRegion = r => REGION_NORM[r] || r;

    for (const h of this.holdings) {
      if (this.allocMode === 'type') {
        groups[h.type] = (groups[h.type] || 0) + h.curValue;
      } else {
        // Use ETF_DB region/sector data when available — far more accurate than name-guessing
        const etfEntry = typeof ETF_DB !== 'undefined'
          ? Object.values(ETF_DB).find(e => e.isin === h.isin)
          : null;
        const distMap = etfEntry
          ? (this.allocMode === 'geo' ? etfEntry.regions : etfEntry.sectors)
          : null;

        if (distMap) {
          const pctTotal = Object.values(distMap).reduce((s, v) => s + v, 0) || 100;
          for (const [label, pct] of Object.entries(distMap)) {
            const key = this.allocMode === 'geo' ? normRegion(label) : label;
            groups[key] = (groups[key] || 0) + h.curValue * (pct / pctTotal);
          }
        } else {
          // Stock or unlisted ETF → fall back to guessed single label
          const key = this.allocMode === 'geo' ? h.region : h.sector;
          groups[key] = (groups[key] || 0) + h.curValue;
        }
      }
    }

    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([, v]) => +((v / totalValue) * 100).toFixed(2));

    const body = ctx.canvas.closest('.card-body');
    body.classList.add('donut-layout');
    // Set pixel dimensions explicitly before Chart.js reads them (avoids oval rendering)
    ctx.canvas.width  = 200;
    ctx.canvas.height = 200;
    ctx.canvas.style.cssText = 'width:200px;height:200px;position:static;flex-shrink:0;min-width:200px;min-height:200px';

    this.allocChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` } },
        },
      },
    });

    document.getElementById('alloc-legend').innerHTML = labels.map((l, i) => `
      <div class="legend-item"><div class="legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      <span class="legend-name">${l}</span><span class="legend-pct">${data[i]}%</span></div>`).join('');
  }

  renderPerfChart(mode) {
    const ctx = document.getElementById('perf-chart').getContext('2d');
    if (this.perfChart) this.perfChart.destroy();

    // Build timeline from transactions
    const byDate = {}, running = {};
    for (const tx of this.transactions) {
      const key = tx.isin || tx.name;
      if (!running[key]) running[key] = { shares: 0, cost: 0 };
      if      (tx.type === 'buy')  { running[key].shares += tx.shares; running[key].cost += tx.total; }
      else if (tx.type === 'sell') { running[key].shares -= Math.abs(tx.shares); }
      const dk = tx.date.toISOString().split('T')[0];
      byDate[dk] = JSON.parse(JSON.stringify(running));
    }
    let dates = Object.keys(byDate).sort();
    if (!dates.length) return;

    // For snapshot imports: build a realistic timeline using per-holding estimated buy dates
    // and S&P 500 market shape as a proxy for growth trajectory
    if (this.isSnapshot && dates.length === 1) {
      const endDate = new Date(dates[0]);
      // Find earliest estimated buy date across all holdings
      let earliestBuy = this.inceptionDate || new Date(endDate.getFullYear() - 3, endDate.getMonth(), 1);
      for (const h of this.holdings) {
        const bd = h.estimatedBuyDate || earliestBuy;
        if (bd < earliestBuy) earliestBuy = bd;
      }
      const startDate = earliestBuy;
      const synth = [];
      const months = Math.max(1, Math.round((endDate - startDate) / (30*24*3600*1000)));
      for (let i = 0; i <= months; i++) {
        const d = new Date(startDate); d.setMonth(d.getMonth() + i);
        if (d <= endDate) synth.push(d.toISOString().split('T')[0]);
      }
      // Ensure final date is included
      const lastSynth = synth[synth.length - 1];
      const endStr = endDate.toISOString().split('T')[0];
      if (lastSynth !== endStr) synth.push(endStr);
      dates = synth;
    }

    const hMap = {};
    for (const h of this.holdings) hMap[h.isin || h.name] = h;
    const totalCurValue = this.holdings.reduce((s,h) => s + h.curValue, 0);
    const totalCost     = this.holdings.reduce((s,h) => s + h.totalCost, 0);

    // Portfolio values along timeline
    const portfolioValues = dates.map((dk, i) => {
      if (this.isSnapshot) {
        // Per-holding: only include holdings whose estimated buy date <= current date
        // Use S&P 500 market shape to interpolate each holding's growth trajectory
        const curDate = new Date(dk);
        let totalVal = 0;
        for (const h of this.holdings) {
          const buyDate = h.estimatedBuyDate || this.inceptionDate || new Date(curDate.getFullYear() - 3, 0, 1);
          if (curDate < buyDate) continue; // holding not yet purchased
          // Use S&P 500 ratio between buy date and current date as growth proxy
          const spBuy = getSP500AtDate(buyDate.toISOString().split('T')[0]);
          const spNow = getSP500AtDate(dk);
          const spEnd = getSP500AtDate(dates[dates.length - 1]);
          if (spBuy && spNow && spEnd) {
            // Scale the holding's known P&L by the S&P market shape
            const marketGrowthToDate = (spNow / spBuy) - 1;
            const marketGrowthTotal  = (spEnd / spBuy) - 1;
            const holdingGrowthTotal = h.pnlPct / 100;
            // Scale: if market did X% by now out of Y% total, holding did proportional fraction
            const holdingProgressFrac = marketGrowthTotal !== 0
              ? marketGrowthToDate / marketGrowthTotal
              : (dates.length > 1 ? i / (dates.length - 1) : 1);
            const estimatedGrowth = holdingGrowthTotal * Math.max(0, Math.min(1.5, holdingProgressFrac));
            totalVal += h.totalCost * (1 + estimatedGrowth);
          } else {
            // Fallback: linear interpolation for this holding
            const holdMs = Math.max(1, new Date(dates[dates.length-1]) - buyDate);
            const elapsed = Math.max(0, curDate - buyDate);
            const progress = Math.min(1, elapsed / holdMs);
            totalVal += h.totalCost + (h.curValue - h.totalCost) * progress;
          }
        }
        return totalVal;
      }
      const snap = byDate[dk] || {};
      return Object.entries(snap).reduce((sum,[k,v]) => sum + (hMap[k] ? v.shares * hMap[k].avgCost : 0), 0);
    });
    const investedValues = dates.map((dk, i) => {
      if (this.isSnapshot) {
        // Invested capital steps up as each holding is "bought" at its estimated date
        const curDate = new Date(dk);
        let invested = 0;
        for (const h of this.holdings) {
          const buyDate = h.estimatedBuyDate || this.inceptionDate || new Date(curDate.getFullYear() - 3, 0, 1);
          if (curDate >= buyDate) invested += h.totalCost;
        }
        return invested;
      }
      const snap = byDate[dk] || {};
      return Object.entries(snap).reduce((s,[,v]) => s + v.cost, 0);
    });

    // S&P 500 benchmark — normalize to same starting value as portfolio
    const startSP = getSP500AtDate(dates[0]);
    const sp500Values = startSP ? dates.map(dk => {
      const sp = getSP500AtDate(dk);
      return sp ? (portfolioValues[0] || totalCost) * (sp / startSP) : null;
    }) : null;

    // Inflation cumulative factor per date
    const startDate = this.inceptionDate || new Date(dates[0]);
    const realValues = dates.map((dk, i) => {
      const inflFactor = getCumulativeInflation(startDate, new Date(dk));
      return portfolioValues[i] / inflFactor;
    });

    const datasets = [];
    if (mode === 'growth') {
      datasets.push({ label: 'Portfolio Value', data: portfolioValues, borderColor: CHART_COLORS[0], backgroundColor: 'rgba(6,200,216,.08)', fill: true, tension: 0.3, pointRadius: 0 });
      datasets.push({ label: 'Invested',        data: investedValues,  borderColor: CHART_COLORS[4], borderDash:[4,4], fill: false, tension: 0.1, pointRadius: 0 });
      if (sp500Values) datasets.push({ label: 'S&P 500 (benchmark)', data: sp500Values, borderColor: '#f59e0b', borderDash:[2,3], fill: false, tension: 0.2, pointRadius: 0, borderWidth: 1.5 });
      datasets.push({ label: 'Realwert (inflationsber.)', data: realValues, borderColor: '#8b5cf6', borderDash:[5,3], fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5 });
    } else {
      // Cumulative % mode — index everything to 0 at start
      const base = investedValues[0] || 1;
      const spBase = sp500Values ? sp500Values[0] || 1 : 1;
      datasets.push({ label: 'Portfolio %', data: portfolioValues.map((v,i) => investedValues[i] > 0 ? +((v - investedValues[i])/investedValues[i]*100).toFixed(2) : 0), borderColor: CHART_COLORS[0], backgroundColor: 'rgba(6,200,216,.08)', fill: true, tension: 0.3, pointRadius: 0 });
      if (sp500Values) datasets.push({ label: 'S&P 500 %', data: sp500Values.map(v => v ? +((v/spBase - 1)*100).toFixed(2) : null), borderColor: '#f59e0b', borderDash:[2,3], fill: false, tension: 0.2, pointRadius: 0 });
      datasets.push({ label: 'Realrendite %', data: realValues.map((v,i) => investedValues[i] > 0 ? +((v - investedValues[i])/investedValues[i]*100).toFixed(2) : 0), borderColor: '#8b5cf6', borderDash:[5,3], fill: false, tension: 0.3, pointRadius: 0 });
    }

    this.perfChart = new Chart(ctx, {
      type: 'line', data: { labels: dates, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#8899b8', boxWidth: 12, font: { size: 11 } } },
          tooltip: { backgroundColor: '#101828', borderColor: '#1a2840', borderWidth: 1,
            callbacks: { label: c => c.parsed.y != null ? ` ${c.dataset.label}: ${mode==='growth' ? fmt(c.parsed.y) : c.parsed.y.toFixed(2)+'%'}` : '' } }
        },
        scales: {
          x: { ticks: { color: '#4a6080', maxTicksLimit: 8, font:{size:10} }, grid:{color:'#1a2840'} },
          y: { ticks: { color: '#8899b8', font:{size:11}, callback: v => mode==='growth' ? fmt(v) : v.toFixed(1)+'%' }, grid:{color:'#1a2840'} }
        }
      }
    });
  }

  renderHoldingsTable() {
    const totalValue = this.holdings.reduce((s,h) => s + h.curValue, 0);
    const now = new Date();
    document.getElementById('holdings-tbody').innerHTML = [...this.holdings]
      .sort((a,b) => b.curValue - a.curValue)
      .map(h => {
        // CAGR: use first buy date, or per-holding estimated date (from P&L proxy), or global inception date
        let cagr = null, buyDate = null;
        if (h.buys && h.buys.length) {
          buyDate = h.buys[0].date;
        } else {
          buyDate = h.estimatedBuyDate || this.inceptionDate;
        }
        if (buyDate) {
          const years = (now - buyDate) / (365.25 * 24 * 3600 * 1000);
          if (years >= 0.25) cagr = (Math.pow(1 + h.pnlPct / 100, 1 / years) - 1) * 100;
        }
        const buyDateStr = buyDate ? buyDate.toLocaleDateString('de-DE', {year:'numeric',month:'short'}) : '';
        const estLabel   = h.estimatedBuyDate && !h.buys?.length ? ` title="Geschätztes Kaufdatum (S&P500-Proxy): ${buyDateStr}"` : '';
        const cagrStr = cagr != null
          ? `<span class="${cagr>=0?'green':'red'}"${estLabel}>${cagr>=0?'+':''}${cagr.toFixed(1)}%/yr${h.estimatedBuyDate && !h.buys?.length ? ' ~' : ''}</span>`
          : `<span style="color:var(--text3)">—</span>`;
        const typeBadge = h.type==='ETF'?'badge-blue':h.type==='Bond'?'badge-yellow':h.type==='Fund'?'badge-purple':'badge-green';
        return `<tr>
          <td class="name-cell">${esc(h.name)}</td>
          <td>${esc(h.isin)}</td>
          <td><span class="badge ${typeBadge}">${h.type}</span></td>
          <td class="num">${h.shares.toFixed(4)}</td>
          <td class="num">${fmt(h.avgCost)}</td>
          <td class="num">${fmt(h.curPrice)}</td>
          <td class="num">${fmt(h.curValue)}</td>
          <td class="num ${h.pnl>=0?'green':'red'}">${h.pnl>=0?'+':''}${fmt(h.pnl)}</td>
          <td class="num ${h.pnlPct>=0?'green':'red'}">${h.pnlPct>=0?'+':''}${h.pnlPct.toFixed(2)}%</td>
          <td class="num">${cagrStr}</td>
          <td class="num">${((h.curValue/totalValue)*100).toFixed(1)}%</td>
        </tr>`;
      }).join('');
  }

  renderTransactionTable() {
    const sorted = [...this.transactions].reverse().slice(0, 300);
    document.getElementById('tx-tbody').innerHTML = sorted.map(tx => {
      const cls = tx.type==='buy'?'badge-green':tx.type==='sell'?'badge-red':tx.type==='dividend'?'badge-blue':'badge-yellow';
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
  }

  filterHoldings(q) {
    const lq = q.toLowerCase();
    document.querySelectorAll('#holdings-tbody tr').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(lq) ? '' : 'none'; });
  }

  loadSample() {
    const d = (y,m,day) => new Date(y,m-1,day);
    const txs = [
      {date:d(2021,3,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:20,  price:82.40,  total:1648.00,fees:1.90},
      {date:d(2021,6,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:15,  price:89.12,  total:1336.80,fees:1.90},
      {date:d(2021,9,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:12,  price:95.44,  total:1145.28,fees:1.90},
      {date:d(2022,1,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:18,  price:99.20,  total:1785.60,fees:1.90},
      {date:d(2022,6,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:25,  price:80.15,  total:2003.75,fees:1.90},
      {date:d(2023,3,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:20,  price:88.70,  total:1774.00,fees:1.90},
      {date:d(2023,9,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:22,  price:97.30,  total:2140.60,fees:1.90},
      {date:d(2024,3,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:18,  price:108.40, total:1951.20,fees:1.90},
      {date:d(2024,9,15),type:'buy',      name:'Vanguard FTSE All-World',      isin:'IE00BK5BQT80',shares:15,  price:112.60, total:1689.00,fees:1.90},
      {date:d(2021,4,1), type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:8,   price:340.20, total:2721.60,fees:3.90},
      {date:d(2021,10,1),type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:5,   price:395.80, total:1979.00,fees:3.90},
      {date:d(2022,7,1), type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:10,  price:302.40, total:3024.00,fees:3.90},
      {date:d(2023,5,1), type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:6,   price:358.10, total:2148.60,fees:3.90},
      {date:d(2024,2,1), type:'buy',      name:'iShares Core S&P 500',         isin:'IE00B5BMR087', shares:4,   price:438.50, total:1754.00,fees:3.90},
      {date:d(2021,5,15),type:'buy',      name:'iShares Core MSCI EM IMI',     isin:'IE00BKM4GZ66', shares:50,  price:28.40,  total:1420.00,fees:1.90},
      {date:d(2022,4,15),type:'buy',      name:'iShares Core MSCI EM IMI',     isin:'IE00BKM4GZ66', shares:60,  price:24.80,  total:1488.00,fees:1.90},
      {date:d(2023,8,15),type:'buy',      name:'iShares Core MSCI EM IMI',     isin:'IE00BKM4GZ66', shares:40,  price:26.70,  total:1068.00,fees:1.90},
      {date:d(2022,2,1), type:'buy',      name:'iShares MSCI World Small Cap', isin:'IE00BF4RFH31', shares:30,  price:52.40,  total:1572.00,fees:1.90},
      {date:d(2023,2,1), type:'buy',      name:'iShares MSCI World Small Cap', isin:'IE00BF4RFH31', shares:25,  price:54.80,  total:1370.00,fees:1.90},
      {date:d(2022,10,15),type:'buy',     name:'SAP SE',                        isin:'DE0007164600', shares:15,  price:88.20,  total:1323.00,fees:5.90},
      {date:d(2023,4,15), type:'buy',     name:'SAP SE',                        isin:'DE0007164600', shares:10,  price:112.40, total:1124.00,fees:5.90},
      {date:d(2022,4,1),  type:'dividend',name:'Vanguard FTSE All-World',       isin:'IE00BK5BQT80', shares:0,   price:0,      total:98.40,  fees:0},
      {date:d(2023,4,1),  type:'dividend',name:'Vanguard FTSE All-World',       isin:'IE00BK5BQT80', shares:0,   price:0,      total:147.20, fees:0},
      {date:d(2024,4,1),  type:'dividend',name:'Vanguard FTSE All-World',       isin:'IE00BK5BQT80', shares:0,   price:0,      total:198.80, fees:0},
      {date:d(2023,6,1),  type:'dividend',name:'SAP SE',                        isin:'DE0007164600', shares:0,   price:0,      total:34.50,  fees:0},
      {date:d(2024,6,1),  type:'dividend',name:'SAP SE',                        isin:'DE0007164600', shares:0,   price:0,      total:42.50,  fees:0},
    ];
    txs.sort((a,b) => a.date - b.date);
    this.transactions = txs; this.isSnapshot = false;
    this.inceptionDate = txs[0].date;
    this.computeHoldings();
    const priceMap = { 'IE00BK5BQT80':121.40,'IE00B5BMR087':498.20,'IE00BKM4GZ66':28.80,'IE00BF4RFH31':61.40,'DE0007164600':194.80 };
    for (const h of this.holdings) if (priceMap[h.isin]) { h.curPrice=priceMap[h.isin]; h.curValue=h.shares*h.curPrice; h.pnl=h.curValue-h.totalCost; h.pnlPct=(h.pnl/h.totalCost)*100; }
    this.render();
    showToast('Sample portfolio loaded — 5 positions, 25 transactions', 'success');
  }
}

/* ── Shared utilities ── */
function fmt(v, decimals=2) {
  if (v==null||isNaN(v)) return '—';
  return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(v);
}
function fmtPnL(v)         { return (v>=0?'+':'-') + fmt(Math.abs(v)); }
function setText(id,val)   { const el=document.getElementById(id); if(el) el.textContent=val; }
function colorEl(id,pos)   { const el=document.getElementById(id); if(el){el.classList.toggle('green',pos);el.classList.toggle('red',!pos);} }
function esc(s)            { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function closeModal()      { document.getElementById('mapping-modal').classList.add('hidden'); }
function showToast(msg,type='info') {
  const c=document.getElementById('toast-container'),t=document.createElement('div');
  t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);
}

const portfolio = new PortfolioManager();
