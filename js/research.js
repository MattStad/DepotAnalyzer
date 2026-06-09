/* Stock Research — Alpha Vantage + rich mock fallback */
class StockResearch {
  constructor() {
    this.priceChart    = null;
    this.peerChart     = null;
    this.currentTicker = null;
  }

  init() {
    const input = document.getElementById('stock-search');
    const btn   = document.getElementById('stock-search-btn');
    btn.addEventListener('click', () => this.search(input.value.trim().toUpperCase()));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') this.search(input.value.trim().toUpperCase()); });

    // Restore saved API key
    const saved = localStorage.getItem('av_key');
    if (saved) document.getElementById('av-key-input').value = saved;
  }

  getApiKey() { return localStorage.getItem('av_key') || ''; }

  async search(ticker) {
    if (!ticker) return;
    this.currentTicker = ticker;
    document.getElementById('research-empty').classList.add('hidden');
    document.getElementById('research-content').classList.remove('hidden');

    // Show loading state
    setText('res-name', ticker);
    document.getElementById('stock-avatar').textContent = ticker.substring(0,2);

    const key = this.getApiKey();
    if (key) {
      await Promise.all([this.fetchOverview(ticker, key), this.fetchTimeSeries(ticker, key)]);
    } else {
      this.renderMockData(ticker);
    }
  }

  async fetchOverview(ticker, key) {
    try {
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${key}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.Symbol) { this.renderOverview(data); return; }
    } catch {}
    this.renderMockData(ticker);
  }

  async fetchTimeSeries(ticker, key) {
    try {
      const url  = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${ticker}&outputsize=compact&apikey=${key}`;
      const res  = await fetch(url);
      const data = await res.json();
      const ts   = data['Time Series (Daily)'];
      if (ts) { this.renderPriceChart(ts); return; }
    } catch {}
  }

  renderOverview(d) {
    setText('res-name', d.Name || d.Symbol);
    setText('res-ticker', d.Symbol);
    setText('res-exchange', d.Exchange || '');
    setText('res-sector', d.Sector || '');
    setText('res-industry', d.Industry || '');
    document.getElementById('stock-avatar').textContent = (d.Symbol||'').substring(0,2);

    const price  = parseFloat(d['50DayMovingAverage']) || 0;
    const target = parseFloat(d.AnalystTargetPrice) || 0;
    setText('res-price', price ? `$${parseFloat(d['52WeekHigh']).toFixed(2)}` : '—');
    setText('res-mktcap', d.MarketCapitalization ? `Market Cap: ${fmtLargeNum(d.MarketCapitalization)}` : '');

    // Valuation
    const metrics = [
      { label: 'P/E (TTM)',    val: d.PERatio },
      { label: 'P/E (Forward)',val: d.ForwardPE },
      { label: 'P/B',          val: d.PriceToBookRatio },
      { label: 'P/S',          val: d.PriceToSalesRatioTTM },
      { label: 'EV/EBITDA',    val: d.EVToEBITDA },
      { label: 'EV/Revenue',   val: d.EVToRevenue },
      { label: 'PEG',          val: d.PEGRatio },
      { label: 'Div Yield',    val: d.DividendYield ? (parseFloat(d.DividendYield)*100).toFixed(2)+'%' : 'N/A' },
    ];
    document.getElementById('valuation-grid').innerHTML = metrics.map(m =>
      `<div class="metric-item"><div class="metric-label">${m.label}</div>
       <div class="metric-value">${fmtMetric(m.val)}</div></div>`
    ).join('');

    // Analyst ratings (from recommendation mean)
    const rm = parseFloat(d.AnalystRatingStrongBuy || 0);
    this.renderAnalystRatings({
      strongBuy: parseInt(d.AnalystRatingStrongBuy)||0,
      buy:       parseInt(d.AnalystRatingBuy)||0,
      hold:      parseInt(d.AnalystRatingHold)||0,
      sell:      parseInt(d.AnalystRatingSell)||0,
      strongSell:parseInt(d.AnalystRatingStrongSell)||0,
    });

    // Price targets
    this.renderPriceTargets({
      low:     parseFloat(d['52WeekLow']),
      high:    parseFloat(d['52WeekHigh']),
      target:  parseFloat(d.AnalystTargetPrice) || 0,
      current: parseFloat(d['50DayMovingAverage']) || 0
    });

    // Financials
    const fins = [
      { label:'Revenue (TTM)',     val: fmtLargeNum(d.RevenueTTM) },
      { label:'Gross Profit',      val: fmtLargeNum(d.GrossProfitTTM) },
      { label:'EBITDA',            val: fmtLargeNum(d.EBITDA) },
      { label:'Net Income (TTM)',  val: fmtLargeNum(d.NetIncomeTTM) },
      { label:'EPS (Diluted)',     val: `$${parseFloat(d.DilutedEPSTTM||0).toFixed(2)}` },
      { label:'ROE',               val: d.ReturnOnEquityTTM ? (parseFloat(d.ReturnOnEquityTTM)*100).toFixed(1)+'%' : '—' },
      { label:'ROA',               val: d.ReturnOnAssetsTTM ? (parseFloat(d.ReturnOnAssetsTTM)*100).toFixed(1)+'%' : '—' },
      { label:'Profit Margin',     val: d.ProfitMargin ? (parseFloat(d.ProfitMargin)*100).toFixed(1)+'%' : '—' },
      { label:'Debt/Equity',       val: fmtMetric(d.DebtToEquityRatio) },
      { label:'Current Ratio',     val: fmtMetric(d.CurrentRatio) },
      { label:'Beta',              val: fmtMetric(d.Beta) },
      { label:'52W High',          val: `$${parseFloat(d['52WeekHigh']||0).toFixed(2)}` },
      { label:'52W Low',           val: `$${parseFloat(d['52WeekLow']||0).toFixed(2)}` },
      { label:'Shares Outstanding',val: fmtLargeNum(d.SharesOutstanding) },
    ];
    document.getElementById('financials-grid').innerHTML = fins.map(f =>
      `<div class="metric-card-large"><div class="label">${f.label}</div><div class="value">${f.val||'—'}</div></div>`
    ).join('');

    this.renderMockInsiders(d.Symbol);
    this.renderPeerChart(d.Symbol, d.Sector, parseFloat(d.PERatio)||0, parseFloat(d.PriceToBookRatio)||0);
  }

  renderPriceChart(ts) {
    const ctx = document.getElementById('res-price-chart').getContext('2d');
    if (this.priceChart) this.priceChart.destroy();

    const entries = Object.entries(ts).sort(([a],[b]) => a < b ? -1 : 1).slice(-252);
    const labels  = entries.map(([d]) => d);
    const closes  = entries.map(([,v]) => parseFloat(v['4. close']));
    const last    = closes[closes.length - 1];
    const first   = closes[0];
    const positive = last >= first;

    // Update displayed price
    setText('res-price', `$${last.toFixed(2)}`);
    const chgPct = ((last - first) / first * 100).toFixed(2);
    const el = document.getElementById('res-change');
    el.textContent = `${chgPct >= 0 ? '+' : ''}${chgPct}% (1Y)`;
    el.className = `stock-change ${chgPct >= 0 ? 'green' : 'red'}`;

    const color = positive ? '#10c980' : '#ef4466';
    this.priceChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: closes, borderColor: color,
        backgroundColor: positive ? 'rgba(16,201,128,.08)' : 'rgba(239,68,102,.08)',
        fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { backgroundColor: '#101828', borderColor: '#1a2840', borderWidth: 1,
            callbacks: { label: c => ` $${c.parsed.y.toFixed(2)}` }}},
        scales: {
          x: { ticks: { color: '#4a6080', maxTicksLimit: 8, font:{size:10} }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font:{size:11}, callback: v => '$'+v.toFixed(0) }, grid: { color: '#1a2840' } }
        }
      }
    });
  }

  renderAnalystRatings(counts) {
    const total = Object.values(counts).reduce((s,v) => s + v, 0) || 1;
    const bullish = (counts.strongBuy + counts.buy) / total;
    const consensus = bullish > 0.6 ? 'BUY' : bullish > 0.4 ? 'HOLD' : 'SELL';
    const cls = consensus === 'BUY' ? 'consensus-buy' : consensus === 'HOLD' ? 'consensus-hold' : 'consensus-sell';

    const bars = [
      { label: 'Strong Buy', count: counts.strongBuy, color: '#10c980' },
      { label: 'Buy',        count: counts.buy,       color: '#34d399' },
      { label: 'Hold',       count: counts.hold,      color: '#f59e0b' },
      { label: 'Sell',       count: counts.sell,      color: '#f97316' },
      { label: 'Strong Sell',count: counts.strongSell,color: '#ef4466' },
    ];

    document.getElementById('analyst-block').innerHTML = `
      <div class="analyst-wrapper">
        <span class="consensus-badge ${cls}">${consensus}</span>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">${total} analyst${total!==1?'s':''}</div>
        ${bars.map(b => `
          <div class="rating-bar-row">
            <div class="rating-bar-label">${b.label.replace(' ','<br>')}</div>
            <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${(b.count/total*100).toFixed(1)}%;background:${b.color}"></div></div>
            <div class="rating-bar-count">${b.count}</div>
          </div>`).join('')}
      </div>`;
  }

  renderPriceTargets({ low, high, target, current }) {
    if (!low || !high) { document.getElementById('price-target-block').innerHTML = '<p style="color:var(--text3)">No data</p>'; return; }
    const range = high - low || 1;
    const curPct = ((current - low) / range * 100).toFixed(1);
    const tgtPct = ((target  - low) / range * 100).toFixed(1);
    const upside = current ? ((target - current) / current * 100).toFixed(1) : null;

    document.getElementById('price-target-block').innerHTML = `
      <div class="pt-block">
        <div class="pt-line"><span class="pt-label">Current Price</span><span class="pt-val">$${current.toFixed(2)}</span></div>
        <div class="pt-line"><span class="pt-label">Analyst Target</span><span class="pt-val ${upside>=0?'green':'red'}">$${target.toFixed(2)} ${upside!=null?`(${upside>=0?'+':''}${upside}%)`:''}` +
          `</span></div>
        <div class="pt-line"><span class="pt-label">52W Range</span><span class="pt-val">$${low.toFixed(2)} – $${high.toFixed(2)}</span></div>
        <div class="pt-range-bar">
          <div class="pt-range-fill" style="left:0;width:100%"></div>
          <div class="pt-current-line" style="left:${curPct}%"></div>
          ${target ? `<div class="pt-target-dot" style="left:${tgtPct}%"></div>` : ''}
        </div>
        <div class="pt-line"><span class="pt-label" style="font-size:10px">▏ 52W Low</span><span class="pt-val" style="font-size:10px">52W High ▕</span></div>
      </div>`;
  }

  renderPeerChart(ticker, sector, pe, pb) {
    const ctx = document.getElementById('peer-chart').getContext('2d');
    if (this.peerChart) this.peerChart.destroy();

    const peers = SECTOR_PEERS[sector] || SECTOR_PEERS['Technology'];
    const labels = [ticker, ...peers.map(p => p.ticker)];
    const peData = [pe, ...peers.map(p => p.pe)];
    const pbData = [pb, ...peers.map(p => p.pb)];

    this.peerChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'P/E', data: peData, backgroundColor: CHART_COLORS[0] + 'cc', borderRadius: 3 },
          { label: 'P/B', data: pbData, backgroundColor: CHART_COLORS[4] + 'cc', borderRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8899b8', boxWidth: 12, font:{size:11} } },
          tooltip: { backgroundColor: '#101828', borderColor: '#1a2840', borderWidth: 1 }
        },
        scales: {
          x: { ticks: { color: '#8899b8', font:{size:10} }, grid: { display:false } },
          y: { ticks: { color: '#8899b8', font:{size:11} }, grid: { color: '#1a2840' } }
        }
      }
    });
  }

  renderMockInsiders(ticker) {
    const insiders = MOCK_INSIDERS[ticker] || generateMockInsiders(ticker);
    document.getElementById('insider-tbody').innerHTML = insiders.map(i => `<tr>
      <td>${i.date}</td>
      <td class="name-cell">${esc(i.name)}</td>
      <td style="color:var(--text2)">${esc(i.title)}</td>
      <td><span class="${i.type==='Buy'?'tx-buy':'tx-sell'}">${i.type}</span></td>
      <td class="num">${i.shares.toLocaleString()}</td>
      <td class="num">$${i.price.toFixed(2)}</td>
      <td class="num">$${(i.shares * i.price).toLocaleString('en',{maximumFractionDigits:0})}</td>
    </tr>`).join('');
  }

  renderMockData(ticker) {
    const mock = MOCK_STOCKS[ticker] || generateMockStock(ticker);
    setText('res-name',     mock.name);
    setText('res-ticker',   ticker);
    setText('res-exchange', mock.exchange);
    setText('res-sector',   mock.sector);
    setText('res-industry', mock.industry);
    document.getElementById('stock-avatar').textContent = ticker.substring(0,2);
    setText('res-price',    `$${mock.price.toFixed(2)}`);
    const el = document.getElementById('res-change');
    el.textContent = `${mock.changePct >= 0 ? '+' : ''}${mock.changePct.toFixed(2)}% (1Y)`;
    el.className = `stock-change ${mock.changePct >= 0 ? 'green' : 'red'}`;
    setText('res-mktcap', `Market Cap: ${mock.mktcap}`);

    document.getElementById('valuation-grid').innerHTML = mock.valuation.map(m =>
      `<div class="metric-item"><div class="metric-label">${m.label}</div><div class="metric-value">${m.val}</div></div>`
    ).join('');

    this.renderAnalystRatings(mock.ratings);
    this.renderPriceTargets(mock.priceTarget);
    this.renderMockPriceChart(mock);
    this.renderPeerChart(ticker, mock.sector, mock.pe, mock.pb);
    this.renderMockInsiders(ticker);

    document.getElementById('financials-grid').innerHTML = mock.financials.map(f =>
      `<div class="metric-card-large"><div class="label">${f.label}</div><div class="value">${f.val}</div></div>`
    ).join('');

    if (!this.getApiKey()) {
      showToast('Add an Alpha Vantage API key in Settings for live data', 'info');
    }
  }

  renderMockPriceChart(mock) {
    const ctx = document.getElementById('res-price-chart').getContext('2d');
    if (this.priceChart) this.priceChart.destroy();

    const n = 252;
    const prices = [mock.price * 0.75];
    const mu = mock.changePct / 100 / n;
    const sigma = 0.018;
    for (let i = 1; i < n; i++) {
      const r = (Math.random() - 0.5) * sigma + mu;
      prices.push(prices[i-1] * (1 + r));
    }
    prices[prices.length - 1] = mock.price;

    const today = new Date();
    const labels = Array.from({length: n}, (_,i) => {
      const d = new Date(today); d.setDate(d.getDate() - (n - i));
      return d.toISOString().split('T')[0];
    });

    const color = mock.changePct >= 0 ? '#10c980' : '#ef4466';
    this.priceChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: prices, borderColor: color,
        backgroundColor: mock.changePct >= 0 ? 'rgba(16,201,128,.08)' : 'rgba(239,68,102,.08)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { backgroundColor: '#101828', borderColor: '#1a2840', borderWidth: 1,
            callbacks: { label: c => ` $${c.parsed.y.toFixed(2)}` }}},
        scales: {
          x: { ticks: { color: '#4a6080', maxTicksLimit: 8, font:{size:10} }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font:{size:11}, callback: v => '$'+v.toFixed(0) }, grid: { color: '#1a2840' } }
        }
      }
    });
  }
}

/* ── Mock data ── */
const MOCK_STOCKS = {
  AAPL: { name:'Apple Inc.', exchange:'NASDAQ', sector:'Technology', industry:'Consumer Electronics', price:189.30, changePct:18.4, mktcap:'$2.9T', pe:28.4, pb:47.2,
    valuation:[{label:'P/E (TTM)',val:'28.4x'},{label:'P/E Fwd',val:'26.1x'},{label:'P/B',val:'47.2x'},{label:'P/S',val:'7.4x'},{label:'EV/EBITDA',val:'21.8x'},{label:'PEG',val:'2.3x'},{label:'Div Yield',val:'0.55%'},{label:'Beta',val:'1.28'}],
    ratings:{strongBuy:18,buy:12,hold:8,sell:2,strongSell:0},
    priceTarget:{low:155,high:250,target:218,current:189.3},
    financials:[{label:'Revenue',val:'$385.6B'},{label:'Gross Profit',val:'$169.1B'},{label:'Net Income',val:'$96.0B'},{label:'EPS Diluted',val:'$6.16'},{label:'ROE',val:'147.3%'},{label:'Profit Margin',val:'24.9%'},{label:'Debt/Equity',val:'1.52'},{label:'Free Cash Flow',val:'$92.1B'}]},
  MSFT: { name:'Microsoft Corp.', exchange:'NASDAQ', sector:'Technology', industry:'Software', price:415.60, changePct:22.8, mktcap:'$3.1T', pe:35.2, pb:13.8,
    valuation:[{label:'P/E (TTM)',val:'35.2x'},{label:'P/E Fwd',val:'29.8x'},{label:'P/B',val:'13.8x'},{label:'P/S',val:'13.2x'},{label:'EV/EBITDA',val:'26.4x'},{label:'PEG',val:'2.1x'},{label:'Div Yield',val:'0.72%'},{label:'Beta',val:'0.91'}],
    ratings:{strongBuy:25,buy:15,hold:4,sell:1,strongSell:0},
    priceTarget:{low:340,high:510,target:475,current:415.6},
    financials:[{label:'Revenue',val:'$232.6B'},{label:'Gross Profit',val:'$162.4B'},{label:'Net Income',val:'$88.1B'},{label:'EPS Diluted',val:'$11.80'},{label:'ROE',val:'36.8%'},{label:'Profit Margin',val:'36.4%'},{label:'Debt/Equity',val:'0.38'},{label:'Free Cash Flow',val:'$70.9B'}]},
  NVDA: { name:'NVIDIA Corporation', exchange:'NASDAQ', sector:'Technology', industry:'Semiconductors', price:875.40, changePct:184.2, mktcap:'$2.15T', pe:72.1, pb:47.8,
    valuation:[{label:'P/E (TTM)',val:'72.1x'},{label:'P/E Fwd',val:'38.4x'},{label:'P/B',val:'47.8x'},{label:'P/S',val:'24.8x'},{label:'EV/EBITDA',val:'58.2x'},{label:'PEG',val:'1.2x'},{label:'Div Yield',val:'0.04%'},{label:'Beta',val:'1.68'}],
    ratings:{strongBuy:32,buy:8,hold:4,sell:0,strongSell:0},
    priceTarget:{low:450,high:1200,target:1050,current:875.4},
    financials:[{label:'Revenue',val:'$79.8B'},{label:'Gross Profit',val:'$62.8B'},{label:'Net Income',val:'$29.6B'},{label:'EPS Diluted',val:'$11.93'},{label:'ROE',val:'91.4%'},{label:'Profit Margin',val:'55.1%'},{label:'Debt/Equity',val:'0.42'},{label:'Free Cash Flow',val:'$27.0B'}]},
  SAP: { name:'SAP SE', exchange:'XETRA', sector:'Technology', industry:'Enterprise Software', price:194.80, changePct:44.2, mktcap:'€238B', pe:42.1, pb:6.8,
    valuation:[{label:'P/E (TTM)',val:'42.1x'},{label:'P/E Fwd',val:'32.8x'},{label:'P/B',val:'6.8x'},{label:'P/S',val:'8.4x'},{label:'EV/EBITDA',val:'32.1x'},{label:'PEG',val:'1.8x'},{label:'Div Yield',val:'0.91%'},{label:'Beta',val:'0.82'}],
    ratings:{strongBuy:12,buy:18,hold:6,sell:2,strongSell:0},
    priceTarget:{low:145,high:230,target:212,current:194.8},
    financials:[{label:'Revenue',val:'€34.3B'},{label:'Cloud Revenue',val:'€17.1B'},{label:'Net Income',val:'€3.3B'},{label:'EPS Diluted',val:'€2.85'},{label:'ROE',val:'16.2%'},{label:'Profit Margin',val:'9.6%'},{label:'Debt/Equity',val:'0.28'},{label:'Employees',val:'107,000'}]},
  ASML: { name:'ASML Holding N.V.', exchange:'NASDAQ/AMS', sector:'Technology', industry:'Semiconductor Equipment', price:842.30, changePct:14.8, mktcap:'€330B', pe:38.4, pb:24.1,
    valuation:[{label:'P/E (TTM)',val:'38.4x'},{label:'P/E Fwd',val:'28.1x'},{label:'P/B',val:'24.1x'},{label:'P/S',val:'10.2x'},{label:'EV/EBITDA',val:'31.8x'},{label:'PEG',val:'1.4x'},{label:'Div Yield',val:'0.88%'},{label:'Beta',val:'1.32'}],
    ratings:{strongBuy:18,buy:10,hold:5,sell:1,strongSell:0},
    priceTarget:{low:620,high:1050,target:960,current:842.3},
    financials:[{label:'Revenue',val:'€27.6B'},{label:'Gross Profit',val:'€14.3B'},{label:'Net Income',val:'€7.8B'},{label:'EPS Diluted',val:'€20.12'},{label:'ROE',val:'72.4%'},{label:'Profit Margin',val:'28.2%'},{label:'Backlog',val:'€39.0B'},{label:'Employees',val:'42,000'}]}
};

const SECTOR_PEERS = {
  'Technology': [
    {ticker:'MSFT',pe:35.2,pb:13.8},{ticker:'GOOGL',pe:23.1,pb:7.2},{ticker:'META',pe:24.8,pb:9.1},{ticker:'AVGO',pe:31.2,pb:14.8}
  ],
  'Healthcare': [
    {ticker:'JNJ',pe:14.8,pb:5.2},{ticker:'LLY',pe:58.4,pb:22.1},{ticker:'ABBV',pe:28.1,pb:38.4},{ticker:'MRK',pe:16.2,pb:6.8}
  ],
  'Financials': [
    {ticker:'JPM',pe:11.2,pb:1.8},{ticker:'BAC',pe:10.8,pb:1.4},{ticker:'GS',pe:12.1,pb:1.6},{ticker:'MS',pe:14.8,pb:2.1}
  ],
  'Consumer Disc': [
    {ticker:'AMZN',pe:48.2,pb:8.4},{ticker:'TSLA',pe:62.1,pb:12.8},{ticker:'HD',pe:22.4,pb:58.1},{ticker:'MCD',pe:24.8,pb:48.2}
  ],
  'Energy': [
    {ticker:'CVX',pe:13.2,pb:1.8},{ticker:'BP',pe:8.4,pb:1.2},{ticker:'SLB',pe:18.1,pb:3.8},{ticker:'EOG',pe:11.4,pb:2.4}
  ]
};

const MOCK_INSIDERS = {
  AAPL: [
    {date:'2025-05-12',name:'Tim Cook',title:'CEO',type:'Sell',shares:120000,price:186.40},
    {date:'2025-04-28',name:'Luca Maestri',title:'CFO',type:'Sell',shares:80000,price:172.80},
    {date:'2025-03-15',name:'Jeff Williams',title:'COO',type:'Sell',shares:65000,price:168.20},
    {date:'2025-02-08',name:'Board Director',title:'Director',type:'Buy',shares:5000,price:185.60},
  ],
  NVDA: [
    {date:'2025-05-20',name:'Jensen Huang',title:'CEO & Co-Founder',type:'Sell',shares:600000,price:862.10},
    {date:'2025-04-15',name:'Colette Kress',title:'CFO',type:'Sell',shares:200000,price:798.40},
    {date:'2025-03-10',name:'Board Member',title:'Director',type:'Buy',shares:10000,price:820.50},
  ]
};

function generateMockInsiders(ticker) {
  const names = ['John Smith','Sarah Johnson','Michael Brown','Emily Davis','Robert Wilson'];
  const titles = ['CEO','CFO','COO','Director','SVP Finance'];
  const insiders = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.random()*90));
    const isBuy = Math.random() > 0.6;
    insiders.push({ date: d.toISOString().split('T')[0], name: names[i%names.length], title: titles[i%titles.length],
      type: isBuy ? 'Buy' : 'Sell', shares: Math.floor(Math.random()*50000+1000),
      price: 50 + Math.random()*400 });
  }
  return insiders.sort((a,b) => b.date.localeCompare(a.date));
}

function generateMockStock(ticker) {
  const price = 50 + Math.random()*500;
  return {
    name: ticker + ' Corp.', exchange: 'NYSE', sector: 'Technology', industry: 'Software', price,
    changePct: -20 + Math.random()*60, mktcap: fmtLargeNum(price * 1e9 * (1 + Math.random()*50)),
    pe: 15 + Math.random()*45, pb: 2 + Math.random()*15,
    valuation: [
      {label:'P/E (TTM)',  val:(15+Math.random()*45).toFixed(1)+'x'},
      {label:'P/B',        val:(2+Math.random()*15).toFixed(1)+'x'},
      {label:'P/S',        val:(2+Math.random()*12).toFixed(1)+'x'},
      {label:'EV/EBITDA',  val:(10+Math.random()*30).toFixed(1)+'x'},
      {label:'Div Yield',  val:(Math.random()*3).toFixed(2)+'%'},
      {label:'Beta',       val:(0.5+Math.random()*1.5).toFixed(2)},
      {label:'PEG',        val:(1+Math.random()*2).toFixed(1)+'x'},
      {label:'Profit Margin',val:(5+Math.random()*30).toFixed(1)+'%'},
    ],
    ratings:{strongBuy:Math.floor(Math.random()*20),buy:Math.floor(Math.random()*15),
      hold:Math.floor(Math.random()*10),sell:Math.floor(Math.random()*5),strongSell:Math.floor(Math.random()*3)},
    priceTarget:{low:price*0.8,high:price*1.5,target:price*1.15,current:price},
    financials:[
      {label:'Revenue',val:fmtLargeNum((1e8+Math.random()*1e11).toString())},
      {label:'Net Income',val:fmtLargeNum((1e7+Math.random()*1e10).toString())},
      {label:'ROE',val:(5+Math.random()*40).toFixed(1)+'%'},
      {label:'Debt/Equity',val:(Math.random()*2).toFixed(2)},
      {label:'Beta',val:(0.5+Math.random()*1.5).toFixed(2)},
    ]
  };
}

function fmtMetric(v) {
  const n = parseFloat(v);
  if (!v || isNaN(n) || v === 'None') return '—';
  return n.toFixed(2) + 'x';
}

function fmtLargeNum(v) {
  const n = parseFloat(v);
  if (!v || isNaN(n)) return '—';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n/1e6).toFixed(2) + 'M';
  return '$' + n.toFixed(0);
}

const research = new StockResearch();
