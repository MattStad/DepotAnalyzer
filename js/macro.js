/* Macro Dashboard — static reference data (Jun 2025) */
class MacroDashboard {
  constructor() { this.charts = {}; }

  init() {
    // Charts are rendered lazily by app.navigate('macro') so that
    // Chart.js sees a visible canvas with non-zero dimensions.
  }

  render() {
    this.renderCentralBankRates();
    this.renderCPI();
    this.renderYieldCurve();
    this.renderSentiment();
    this.renderGDP();
    this.renderCommodities();
    this.renderFX();
    this.renderCAPE();
  }

  renderCentralBankRates() {
    const rates = [
      { country: 'Fed (US)',    rate: '5.25–5.50', trend: '↓', trendColor: 'var(--green)', note: 'First cut expected Q4 2025' },
      { country: 'ECB',         rate: '3.75',       trend: '↓', trendColor: 'var(--green)', note: 'Cutting cycle underway' },
      { country: 'Bank of England', rate: '5.25',   trend: '→', trendColor: 'var(--yellow)', note: 'Holding, inflation sticky' },
      { country: 'Bank of Japan',   rate: '0.10',   trend: '↑', trendColor: 'var(--red)',    note: 'Normalisation in progress' },
      { country: 'SNB',         rate: '1.25',       trend: '↓', trendColor: 'var(--green)', note: 'Cut in March 2025' },
      { country: 'RBA',         rate: '4.35',       trend: '→', trendColor: 'var(--yellow)', note: 'Higher for longer' },
    ];
    document.getElementById('cb-rates').innerHTML = `<div class="rate-grid">
      ${rates.map(r => `<div class="rate-item">
        <div class="rate-country">${r.country}</div>
        <div class="rate-val">${r.rate}%</div>
        <div class="rate-trend" style="color:${r.trendColor}">${r.trend} ${r.note}</div>
      </div>`).join('')}
    </div>`;
  }

  renderCPI() {
    const ctx = document.getElementById('cpi-chart').getContext('2d');
    const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
    const us  = [6.4,6.0,5.0,4.9,4.0,3.0,3.2,3.7,3.7,3.2,3.1,3.4,3.1,3.2,3.5,3.4,3.3];
    const eu  = [8.6,8.5,6.9,7.0,6.1,5.5,5.3,5.2,4.3,2.9,2.4,2.9,2.8,2.6,2.4,2.4,2.6];
    const de  = [8.7,8.7,7.4,7.2,6.1,6.4,6.2,6.1,4.5,3.8,3.2,3.7,2.9,2.5,2.2,2.2,2.4];

    this.charts.cpi = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'US CPI',  data: us,  borderColor: '#3b82f6', fill: false, tension: 0.3, pointRadius: 2 },
        { label: 'Euro CPI',data: eu,  borderColor: '#10c980', fill: false, tension: 0.3, pointRadius: 2 },
        { label: 'DE CPI',  data: de,  borderColor: '#f59e0b', fill: false, tension: 0.3, pointRadius: 2, borderDash:[3,3] },
        { label: '2% Target',data: Array(labels.length).fill(2), borderColor: 'rgba(239,68,102,.5)', borderDash:[6,3], pointRadius:0, fill:false }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'#8899b8', boxWidth:12, font:{size:10} } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } }},
        scales: {
          x: { ticks: { color:'#4a6080', font:{size:9} }, grid: { color:'#1a2840' } },
          y: { ticks: { color:'#8899b8', font:{size:10}, callback: v => v+'%' }, grid: { color:'#1a2840' } }
        }
      }
    });
  }

  renderYieldCurve() {
    const ctx = document.getElementById('yield-chart').getContext('2d');
    const labels = ['1M','3M','6M','1Y','2Y','5Y','7Y','10Y','20Y','30Y'];
    const cur  = [5.28,5.35,5.31,5.18,4.88,4.42,4.38,4.28,4.52,4.34];
    const prev = [4.85,5.08,5.20,5.10,4.72,4.28,4.22,4.08,4.36,4.18];

    this.charts.yield = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Current',  data: cur,  borderColor: '#06c8d8', fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#06c8d8' },
        { label: '1Y Ago',   data: prev, borderColor: '#4a6080', fill: false, tension: 0.3, pointRadius: 2, borderDash: [4,3] }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'#8899b8', boxWidth:12, font:{size:10} } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}%` } }},
        scales: {
          x: { ticks: { color:'#4a6080', font:{size:9} }, grid: { color:'#1a2840' } },
          y: { ticks: { color:'#8899b8', font:{size:10}, callback: v => v.toFixed(1)+'%' }, grid: { color:'#1a2840' } }
        }
      }
    });
  }

  renderSentiment() {
    // Fear & Greed composite
    const value = 58; // 0–100
    const label = value > 75 ? 'Extreme Greed' : value > 55 ? 'Greed' : value > 45 ? 'Neutral' : value > 25 ? 'Fear' : 'Extreme Fear';
    const color = value > 75 ? '#10c980' : value > 55 ? '#84cc16' : value > 45 ? '#f59e0b' : value > 25 ? '#f97316' : '#ef4466';

    document.getElementById('sentiment-block').innerHTML = `
      <div class="sentiment-gauge">
        <div class="gauge-value" style="color:${color}">${value}</div>
        <div class="gauge-label" style="color:${color}">${label}</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Fear &amp; Greed Index</div>
        <div class="gauge-bar"></div>
        <div class="gauge-pointer"><div class="gauge-needle" style="left:${value}%"></div></div>
        <div class="gauge-sublabels"><span>Fear</span><span>Neutral</span><span>Greed</span></div>
        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[
            {label:'VIX',val:'14.8',chg:'-2.1',pos:false},
            {label:'S&P 500 (1M)',val:'+4.2%',chg:'',pos:true},
            {label:'Nasdaq (1M)',val:'+6.1%',chg:'',pos:true},
            {label:'Put/Call Ratio',val:'0.74',chg:'-0.08',pos:true},
          ].map(d => `<div class="data-row">
            <span class="label">${d.label}</span>
            <span class="val ${d.pos?'green':'red'}">${d.val}</span>
          </div>`).join('')}
        </div>
      </div>`;
  }

  renderGDP() {
    const ctx = document.getElementById('gdp-chart').getContext('2d');
    const labels = ['Q1 23','Q2 23','Q3 23','Q4 23','Q1 24','Q2 24','Q3 24','Q4 24','Q1 25'];
    const us  = [2.2,2.1,4.9,3.4,1.6,3.0,2.8,2.4,1.6];
    const eu  = [1.2,0.6,0.2,0.2,0.4,0.8,0.9,0.9,1.2];
    const de  = [-0.4,-0.3,-0.1,-0.3,-0.2,0.2,0.1,-0.2,0.4];

    this.charts.gdp = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'US',       data: us,  backgroundColor: '#3b82f6', borderRadius:3 },
        { label: 'Eurozone', data: eu,  backgroundColor: '#10c980', borderRadius:3 },
        { label: 'Germany',  data: de,  backgroundColor: '#f59e0b', borderRadius:3 }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'#8899b8', boxWidth:12, font:{size:10} } } },
        scales: {
          x: { ticks: { color:'#4a6080', font:{size:9} }, grid: { display:false } },
          y: { ticks: { color:'#8899b8', font:{size:10}, callback: v => v+'%' }, grid: { color:'#1a2840' } }
        }
      }
    });
  }

  renderCommodities() {
    const items = [
      {label:'Gold',    val:'$2,324',chg:'+12.4%',pos:true},
      {label:'Silver',  val:'$29.18', chg:'+24.1%',pos:true},
      {label:'WTI Oil', val:'$79.80', chg:'-4.2%', pos:false},
      {label:'Brent',   val:'$84.20', chg:'-3.8%', pos:false},
      {label:'Nat. Gas',val:'$2.42',  chg:'-28.4%',pos:false},
      {label:'Copper',  val:'$4.48',  chg:'+8.1%', pos:true},
      {label:'Wheat',   val:'$612',   chg:'-12.2%',pos:false},
      {label:'Corn',    val:'$447',   chg:'-18.4%',pos:false},
    ];
    document.getElementById('commodities-block').innerHTML = `<div class="commodity-grid">
      ${items.map(d => `<div class="data-row">
        <div><div class="label">${d.label}</div><div class="val">${d.val}</div></div>
        <span class="chg ${d.pos?'green':'red'}">${d.chg}</span>
      </div>`).join('')}
    </div>`;
  }

  renderFX() {
    const items = [
      {label:'EUR/USD',val:'1.0842',chg:'+0.8%', pos:true},
      {label:'USD/JPY',val:'157.82',chg:'-2.1%', pos:false},
      {label:'GBP/USD',val:'1.2724',chg:'+1.4%', pos:true},
      {label:'USD/CHF',val:'0.8914',chg:'-0.6%', pos:false},
      {label:'EUR/GBP',val:'0.8519',chg:'-0.5%', pos:false},
      {label:'DXY',    val:'104.18',chg:'-0.9%', pos:false},
      {label:'BTC/USD',val:'$67,420',chg:'+42.8%',pos:true},
      {label:'ETH/USD',val:'$3,580', chg:'+52.1%',pos:true},
    ];
    document.getElementById('fx-block').innerHTML = `<div class="fx-grid">
      ${items.map(d => `<div class="data-row">
        <div><div class="label">${d.label}</div><div class="val">${d.val}</div></div>
        <span class="chg ${d.pos?'green':'red'}">${d.chg}</span>
      </div>`).join('')}
    </div>`;
  }

  renderCAPE() {
    const ctx = document.getElementById('cape-chart').getContext('2d');
    const labels = ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025'];
    const sp500 = [26.1,27.9,33.3,28.4,30.8,32.6,38.5,28.4,30.1,34.2,35.1];
    const eu    = [16.2,17.1,18.8,15.9,18.2,22.1,24.8,16.2,15.8,17.1,17.8];
    const mean  = Array(labels.length).fill(17.0);

    this.charts.cape = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'S&P 500 CAPE', data: sp500, borderColor: '#06c8d8', fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor:'#06c8d8' },
        { label: 'Europe CAPE',  data: eu,    borderColor: '#10c980', fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor:'#10c980' },
        { label: 'Hist. Mean',   data: mean,  borderColor: '#4a6080', borderDash:[6,3], pointRadius:0, fill:false }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'#8899b8', boxWidth:12, font:{size:10} } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}x` } }},
        scales: {
          x: { ticks: { color:'#4a6080', font:{size:9} }, grid: { color:'#1a2840' } },
          y: { ticks: { color:'#8899b8', font:{size:10}, callback: v => v+'x' }, grid: { color:'#1a2840' } }
        }
      }
    });
  }
}

const macro = new MacroDashboard();
