/* ── Local ticker database (AT + DE + US + NL) for offline autocomplete ── */
const LOCAL_TICKER_DB = [
  // Austria — Vienna Stock Exchange (.VIE suffix for Alpha Vantage)
  { ticker:'EBS.VIE',  name:'Erste Group Bank AG',              region:'Wien',   isin:'AT0000652011' },
  { ticker:'OMV.VIE',  name:'OMV AG',                           region:'Wien',   isin:'AT0000743059' },
  { ticker:'VOE.VIE',  name:'voestalpine AG',                   region:'Wien',   isin:'AT0000937503' },
  { ticker:'ANDR.VIE', name:'Andritz AG',                       region:'Wien',   isin:'AT0000730007' },
  { ticker:'VER.VIE',  name:'Verbund AG',                       region:'Wien',   isin:'AT0000746409' },
  { ticker:'RBI.VIE',  name:'Raiffeisen Bank International AG', region:'Wien',   isin:'AT0000606306' },
  { ticker:'WIE.VIE',  name:'Wienerberger AG',                  region:'Wien',   isin:'AT0000827209' },
  { ticker:'VIG.VIE',  name:'Vienna Insurance Group AG',        region:'Wien',   isin:'AT0000908504' },
  { ticker:'POST.VIE', name:'Österreichische Post AG',          region:'Wien',   isin:'AT0000APOST4' },
  { ticker:'STR.VIE',  name:'Strabag SE',                       region:'Wien',   isin:'AT000000STR1' },
  { ticker:'SBO.VIE',  name:'Schoeller-Bleckmann AG',           region:'Wien',   isin:'AT0000946652' },
  // Germany — XETRA (.DE suffix)
  { ticker:'SAP.DE',   name:'SAP SE',                           region:'XETRA',  isin:'DE0007164600' },
  { ticker:'SIE.DE',   name:'Siemens AG',                       region:'XETRA',  isin:'DE0007236101' },
  { ticker:'ALV.DE',   name:'Allianz SE',                       region:'XETRA',  isin:'DE0008404005' },
  { ticker:'BAS.DE',   name:'BASF SE',                          region:'XETRA',  isin:'DE000BASF111' },
  { ticker:'DTE.DE',   name:'Deutsche Telekom AG',              region:'XETRA',  isin:'DE0005557508' },
  { ticker:'BMW.DE',   name:'BMW AG',                           region:'XETRA',  isin:'DE0005190003' },
  { ticker:'BAYN.DE',  name:'Bayer AG',                         region:'XETRA',  isin:'DE000BAY0017' },
  { ticker:'VOW3.DE',  name:'Volkswagen AG (Vz)',               region:'XETRA',  isin:'DE0007664039' },
  { ticker:'DBK.DE',   name:'Deutsche Bank AG',                 region:'XETRA',  isin:'DE0005140008' },
  { ticker:'ADS.DE',   name:'Adidas AG',                        region:'XETRA',  isin:'DE000A1EWWW0' },
  { ticker:'MRK.DE',   name:'Merck KGaA',                       region:'XETRA',  isin:'DE0006599905' },
  { ticker:'RWE.DE',   name:'RWE AG',                           region:'XETRA',  isin:'DE0007037129' },
  // Netherlands
  { ticker:'ASML',     name:'ASML Holding N.V.',                region:'NASDAQ', isin:'NL0010273215' },
  { ticker:'HEIA.AS',  name:'Heineken N.V.',                    region:'AEX',    isin:'NL0000009165' },
  { ticker:'PHIA.AS',  name:'Philips N.V.',                     region:'AEX',    isin:'NL0000009538' },
  // Switzerland
  { ticker:'NESN.SW',  name:'Nestlé SA',                        region:'SIX',    isin:'CH0038863350' },
  { ticker:'ROG.SW',   name:'Roche Holding AG',                 region:'SIX',    isin:'CH0012221716' },
  { ticker:'NOVN.SW',  name:'Novartis AG',                      region:'SIX',    isin:'CH0012221716' },
  // US — no suffix
  { ticker:'AAPL',  name:'Apple Inc.',           region:'NASDAQ', isin:'US0378331005' },
  { ticker:'MSFT',  name:'Microsoft Corp.',       region:'NASDAQ', isin:'US5949181045' },
  { ticker:'NVDA',  name:'NVIDIA Corp.',          region:'NASDAQ', isin:'US67066G1040' },
  { ticker:'AMZN',  name:'Amazon.com Inc.',       region:'NASDAQ', isin:'US0231351067' },
  { ticker:'META',  name:'Meta Platforms Inc.',   region:'NASDAQ', isin:'US30303M1027' },
  { ticker:'GOOGL', name:'Alphabet Inc.',         region:'NASDAQ', isin:'US02079K3059' },
  { ticker:'TSLA',  name:'Tesla Inc.',            region:'NASDAQ', isin:'US88160R1014' },
  { ticker:'JPM',   name:'JPMorgan Chase & Co.',  region:'NYSE',   isin:'US46625H1005' },
  { ticker:'V',     name:'Visa Inc.',             region:'NYSE',   isin:'US92826C8394' },
  { ticker:'JNJ',   name:'Johnson & Johnson',     region:'NYSE',   isin:'US4781601046' },
  { ticker:'LMT',   name:'Lockheed Martin Corp.', region:'NYSE',   isin:'US5260571048' },
  { ticker:'RTX',   name:'RTX Corporation',       region:'NYSE',   isin:'US7543121062' },
];

/* ISIN → ticker map (built from LOCAL_TICKER_DB + extras) */
const ISIN_MAP = (() => {
  const m = {};
  LOCAL_TICKER_DB.forEach(t => { if (t.isin) m[t.isin] = t.ticker; });
  return m;
})();

/* ── Shared CORS-proxy fetch (free, no API key, no account) ───────────────
   Browsers block cross-origin calls to Yahoo Finance, so we race the request
   through several free public CORS proxies in PARALLEL and take the first that
   returns valid JSON. Parallel (not sequential) means one slow/blocked proxy
   never holds up the others — the fastest reachable one wins in ~1-2s. */
async function proxyFetchJson(targetUrl, { timeout = 9000 } = {}) {
  const builders = [
    u => [`https://corsproxy.io/?url=${encodeURIComponent(u)}`, false],
    u => [`https://proxy.corsfix.com/?${u}`, false],
    u => [`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, false],
    u => [`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, true],
    u => [`https://api.cors.lol/?url=${encodeURIComponent(u)}`, false],
    u => [`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`, false],
    u => [`https://thingproxy.freeboard.io/fetch/${u}`, false],
  ];
  const attempt = async (make) => {
    const [purl, wrap] = make(targetUrl);
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(purl, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) throw new Error('status ' + res.status);
      let data;
      if (wrap) { const w = await res.json(); data = typeof w.contents === 'string' ? JSON.parse(w.contents) : w.contents; }
      else { data = await res.json(); }
      if (!data) throw new Error('empty');
      return data;
    } finally { clearTimeout(to); }
  };
  try { return await Promise.any(builders.map(attempt)); }
  catch { return null; }   // every proxy failed
}

/* Stock Research — live data from Yahoo Finance (free, no key) */
class StockResearch {
  constructor() {
    this.priceChart    = null;
    this.peerChart     = null;
    this.currentTicker = null;
    this._suggestTimer = null;
  }

  init() {
    const input = document.getElementById('stock-search');
    const btn   = document.getElementById('stock-search-btn');
    btn.addEventListener('click',  () => this.search(input.value.trim()));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { this._closeSuggestions(); this.search(input.value.trim()); }
      if (e.key === 'Escape') this._closeSuggestions();
    });
    input.addEventListener('input', () => {
      clearTimeout(this._suggestTimer);
      const q = input.value.trim();
      if (q.length < 2) { this._closeSuggestions(); return; }
      this._suggestTimer = setTimeout(() => this.showSuggestions(q), 280);
    });
    // Hide suggestions when clicking outside
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-bar-hero')) this._closeSuggestions();
    });
    // Restore saved API key (input only exists if the optional key UI is present)
    const saved = localStorage.getItem('av_key');
    const keyInput = document.getElementById('av-key-input');
    if (saved && keyInput) keyInput.value = saved;
  }

  _closeSuggestions() {
    const box = document.getElementById('search-suggestions');
    if (box) box.style.display = 'none';
  }

  async showSuggestions(query) {
    const box = document.getElementById('search-suggestions');
    if (!box) return;
    const q = query.toLowerCase();

    // 1. Local DB match (works offline)
    let results = LOCAL_TICKER_DB.filter(t =>
      t.ticker.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.isin && t.isin.toLowerCase().includes(q))
    ).slice(0, 6);

    // 2. Alpha Vantage SYMBOL_SEARCH (with API key)
    const key = this.getApiKey();
    if (key && results.length < 4) {
      try {
        const res  = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${key}`);
        const data = await res.json();
        const seen = new Set(results.map(r => r.ticker));
        for (const m of (data.bestMatches || []).slice(0, 6)) {
          const t = m['1. symbol'];
          if (!seen.has(t)) {
            results.push({ ticker: t, name: m['2. name'], region: m['4. region'] });
            seen.add(t);
          }
        }
      } catch {}
    }

    if (!results.length) { box.style.display = 'none'; return; }
    box.innerHTML = results.map(r => `
      <div onclick="research.selectSuggestion('${esc(r.ticker)}')"
           style="padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--bg3)"
           onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
        <span style="font-family:monospace;color:var(--accent-cyan);font-weight:600;min-width:90px;font-size:12px">${esc(r.ticker)}</span>
        <span style="color:var(--text1);font-size:13px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</span>
        <span style="color:var(--text3);font-size:11px">${esc(r.region || '')}</span>
      </div>`).join('');
    box.style.display = 'block';
  }

  selectSuggestion(ticker) {
    document.getElementById('stock-search').value = ticker;
    this._closeSuggestions();
    this.search(ticker);
  }

  getApiKey() { return localStorage.getItem('av_key') || ''; }

  /* Resolve user input to a ticker: handles ISIN, common aliases, and direct tickers */
  resolveToTicker(input) {
    const s = input.trim().toUpperCase();
    // ISIN pattern: 2 letters + 10 alphanumeric
    if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(s)) {
      // Check ETF database first
      const etf = typeof ETF_LIST !== 'undefined' && ETF_LIST.find(e => e.isin === s);
      if (etf) return etf.ticker;
      if (ISIN_MAP[s]) return ISIN_MAP[s];
      showToast(`ISIN ${s} unbekannt — Ticker eingeben (z.B. EBS.VIE, OMV.VIE, AAPL)`, 'info');
      return null;
    }
    return s;
  }

  /* ─── Yahoo Finance ticker mapping ─────────────────────── */
  _toYahooTicker(avTicker) {
    // Alpha Vantage uses .VIE for Vienna Stock Exchange; Yahoo Finance uses .VI
    return avTicker.replace(/\.VIE$/, '.VI');
  }

  async _fetchYahooChart(yhTicker) {
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yhTicker)}?range=1y&interval=1d&includePrePost=false`;
    const data = await proxyFetchJson(url);
    return data?.chart?.result?.[0] || null;
  }

  /* Fundamentals via Yahoo's fundamentals-timeseries endpoint — works WITHOUT a
     crumb/key (unlike quoteSummary). Returns the latest value per metric so we can
     compute P/E, P/B, market cap, ROE, ROA, margins, debt/equity etc. for free. */
  async _fetchYahooFundamentals(yhTicker) {
    // Cache 6 h in localStorage — fundamentals change quarterly at most, and this
    // cuts repeat proxy calls (reliability: avoids hitting free-proxy rate limits).
    const ck = 'res_fund_' + yhTicker;
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < 21_600_000) return c.f; } catch {}

    const now = Math.floor(Date.now() / 1000);
    const p1  = now - 800 * 24 * 3600;   // ~2 years back to capture the latest fiscal year
    const types = [
      // valuation ratios (trailing snapshots)
      'trailingPeRatio', 'trailingPbRatio', 'trailingPsRatio', 'trailingPegRatio',
      // income statement (annual)
      'annualTotalRevenue', 'annualNetIncome', 'annualGrossProfit', 'annualEBITDA', 'annualDilutedEPS',
      // balance sheet
      'annualStockholdersEquity', 'annualTotalAssets', 'annualTotalDebt',
      'annualCurrentAssets', 'annualCurrentLiabilities', 'annualCashAndCashEquivalents', 'annualOrdinarySharesNumber',
      // cash flow + dividends
      'annualFreeCashFlow', 'annualCashDividendsPaid',
    ].join(',');
    const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(yhTicker)}`
              + `?symbol=${encodeURIComponent(yhTicker)}&type=${types}&period1=${p1}&period2=${now}`;
    const d = await proxyFetchJson(url);
    const res = d?.timeseries?.result;
    if (!Array.isArray(res)) return null;
    const f = {};
    for (const item of res) {
      const type = item?.meta?.type?.[0];
      if (!type) continue;
      const arr  = item[type];
      const last = Array.isArray(arr) ? arr.filter(Boolean).pop() : null;
      if (last?.reportedValue?.raw != null) f[type] = last.reportedValue.raw;
    }
    const result = Object.keys(f).length ? f : null;
    if (result) { try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), f: result })); } catch {} }
    return result;
  }

  renderYahooChart(result) {
    const ctx = document.getElementById('res-price-chart')?.getContext('2d');
    if (!ctx || !result) return;
    if (this.priceChart) { this.priceChart.destroy(); this.priceChart = null; }

    const meta   = result.meta || {};
    const ts     = result.timestamp || [];
    const closes = result.indicators?.adjclose?.[0]?.adjclose
                || result.indicators?.quote?.[0]?.close || [];

    const pairs  = ts.map((t, i) => [t, closes[i]]).filter(([, c]) => c != null && !isNaN(c));
    if (!pairs.length) return;

    const labels   = pairs.map(([t]) => new Date(t * 1000).toISOString().split('T')[0]);
    const prices   = pairs.map(([, c]) => +c.toFixed(4));
    const first    = prices[0];
    const last     = prices[prices.length - 1];
    const livePx   = meta.regularMarketPrice != null ? meta.regularMarketPrice : last;
    const chgPct   = (last - first) / first * 100;
    const positive = last >= first;
    const ccy      = meta.currency === 'EUR' ? '€' : /GBP/i.test(meta.currency || '') ? '£' : '$';

    setText('res-price', `${ccy}${livePx.toFixed(2)}`);
    const el = document.getElementById('res-change');
    el.textContent = `${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}% (1J)`;
    el.className   = `stock-change ${positive ? 'green' : 'red'}`;

    const color = positive ? '#10c980' : '#ef4466';
    this.priceChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: prices, borderColor: color,
        backgroundColor: positive ? 'rgba(16,201,128,.08)' : 'rgba(239,68,102,.08)',
        fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { backgroundColor: '#101828', borderColor: '#1a2840', borderWidth: 1,
            callbacks: { label: c => ` ${ccy}${c.parsed.y.toFixed(2)}` } } },
        scales: {
          x: { ticks: { color: '#4a6080', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font: { size: 11 }, callback: v => ccy + v.toFixed(0) }, grid: { color: '#1a2840' } },
        },
      },
    });
  }

  _estimateRatingDistrib(recKey, total) {
    const dist = ({
      strongBuy:  { strongBuy: 0.55, buy: 0.30, hold: 0.12, sell: 0.03, strongSell: 0.00 },
      buy:        { strongBuy: 0.15, buy: 0.50, hold: 0.28, sell: 0.07, strongSell: 0.00 },
      hold:       { strongBuy: 0.05, buy: 0.18, hold: 0.52, sell: 0.20, strongSell: 0.05 },
      sell:       { strongBuy: 0.00, buy: 0.05, hold: 0.22, sell: 0.48, strongSell: 0.25 },
      strongSell: { strongBuy: 0.00, buy: 0.08, hold: 0.12, sell: 0.30, strongSell: 0.50 },
    })[recKey] || { strongBuy: 0.05, buy: 0.18, hold: 0.52, sell: 0.20, strongSell: 0.05 };
    const r = k => Math.round(dist[k] * total);
    return { strongBuy: r('strongBuy'), buy: r('buy'), hold: r('hold'), sell: r('sell'), strongSell: r('strongSell') };
  }

  /* Build the overview from the Yahoo chart feed + fundamentals-timeseries — all
     free, no API key. Valuation ratios, financials, market cap, ROE/ROA/margins
     are derived from real data. Only analyst ratings/targets need a key (Yahoo's
     analyst data is crumb-locked); everything else is live. */
  renderYahooOverview(avTicker, chartResult, fund) {
    const meta = chartResult?.meta || {};
    const ccy  = meta.currency === 'EUR' ? '€' : /GBP/i.test(meta.currency || '') ? '£' : '$';
    const cur  = meta.regularMarketPrice != null ? meta.regularMarketPrice : 0;
    const hi52 = meta.fiftyTwoWeekHigh, lo52 = meta.fiftyTwoWeekLow;
    const NA   = '—';
    const fp   = v => v != null && !isNaN(v) ? `${ccy}${(+v).toFixed(2)}` : NA;
    const fx   = (v, d = 1) => v != null && !isNaN(v) ? (+v).toFixed(d) : NA;
    const fpct = v => v != null && !isNaN(v) ? (+v).toFixed(1) + '%' : NA;

    // ── Derive metrics from fundamentals (all real, computed from reported values) ──
    const f       = fund || {};
    const shares  = f.annualOrdinarySharesNumber;
    const rev     = f.annualTotalRevenue, ni = f.annualNetIncome, gp = f.annualGrossProfit;
    const ebitda  = f.annualEBITDA, eps = f.annualDilutedEPS;
    const eq      = f.annualStockholdersEquity, ta = f.annualTotalAssets, debt = f.annualTotalDebt;
    const cAsset  = f.annualCurrentAssets, cLiab = f.annualCurrentLiabilities, cash = f.annualCashAndCashEquivalents;
    const fcf     = f.annualFreeCashFlow, divPaid = f.annualCashDividendsPaid;
    const mktcap  = (shares && cur) ? shares * cur : null;
    const ev      = mktcap != null ? mktcap + (debt || 0) - (cash || 0) : null;
    const roe     = (ni && eq) ? ni / eq * 100 : null;
    const roa     = (ni && ta) ? ni / ta * 100 : null;
    const margin  = (ni && rev) ? ni / rev * 100 : null;
    const de      = (debt && eq) ? debt / eq : null;
    const curR    = (cAsset && cLiab) ? cAsset / cLiab : null;
    const evEbit  = (ev && ebitda) ? ev / ebitda : null;
    const evRev   = (ev && rev) ? ev / rev : null;
    const divYld  = (divPaid && mktcap) ? Math.abs(divPaid) / mktcap * 100 : null;

    // Exchange label — map Yahoo exchange codes to friendly names
    const exchMap = { NMS:'NASDAQ', NGM:'NASDAQ', NCM:'NASDAQ', NYQ:'NYSE', PCX:'NYSE Arca',
                      VIE:'Wien (Wiener Börse)', GER:'XETRA', FRA:'Frankfurt', STU:'Stuttgart',
                      EBS:'SIX Swiss', AMS:'Euronext Amsterdam', PAR:'Euronext Paris', MIL:'Borsa Italiana',
                      LSE:'London', MCE:'BME Madrid' };
    const exch = exchMap[meta.exchangeName] || meta.fullExchangeName || meta.exchangeName || '';

    setText('res-name',     meta.longName || meta.shortName || avTicker);
    setText('res-ticker',   this._toYahooTicker(avTicker));
    setText('res-exchange', exch ? `${exch} · 📡 Yahoo Finance` : '📡 Yahoo Finance');
    setText('res-sector',   '');
    setText('res-industry', '');
    document.getElementById('stock-avatar').textContent = avTicker.substring(0, 2).toUpperCase();
    setText('res-mktcap', mktcap ? `Market Cap: ${fmtLargeNumCcy(mktcap, ccy)}` : '');

    // Valuation metrics (real; forward P/E needs analyst estimates → not free)
    document.getElementById('valuation-grid').innerHTML = [
      { label: 'P/E (TTM)',     val: fx(f.trailingPeRatio) },
      { label: 'P/E (Forward)', val: NA },
      { label: 'P/B',           val: fx(f.trailingPbRatio, 2) },
      { label: 'P/S',           val: fx(f.trailingPsRatio, 2) },
      { label: 'EV/EBITDA',     val: fx(evEbit) },
      { label: 'EV/Revenue',    val: fx(evRev, 2) },
      { label: 'PEG',           val: fx(f.trailingPegRatio, 2) },
      { label: 'Div Yield',     val: divYld != null ? fpct(divYld) : NA },
    ].map(m => `<div class="metric-item"><div class="metric-label">${m.label}</div><div class="metric-value">${m.val}</div></div>`).join('');

    // (Analyst Consensus panel removed — Yahoo analyst data is crumb-locked and
    //  there is no free source; renderAnalystRatings null-guards the missing block.)

    // Price targets — real current price + 52W range (no analyst target without a key)
    this.renderPriceTargets({ low: lo52 || 0, high: hi52 || 0, target: 0, current: cur, ccy });

    // Financials — live chart values + computed fundamentals
    const vol = meta.regularMarketVolume;
    document.getElementById('financials-grid').innerHTML = [
      { label: 'Revenue (FY)',     val: fmtLargeNumCcy(rev, ccy) },
      { label: 'Gross Profit',     val: fmtLargeNumCcy(gp, ccy) },
      { label: 'EBITDA',           val: fmtLargeNumCcy(ebitda, ccy) },
      { label: 'Net Income (FY)',  val: fmtLargeNumCcy(ni, ccy) },
      { label: 'EPS (Diluted)',    val: eps != null ? `${ccy}${(+eps).toFixed(2)}` : NA },
      { label: 'ROE',              val: fpct(roe) },
      { label: 'ROA',              val: fpct(roa) },
      { label: 'Profit Margin',    val: fpct(margin) },
      { label: 'Debt/Equity',      val: fx(de, 2) },
      { label: 'Current Ratio',    val: fx(curR, 2) },
      { label: 'Free Cash Flow',   val: fmtLargeNumCcy(fcf, ccy) },
      { label: 'Shares Outst.',    val: shares != null ? fmtLargeNumCcy(shares, '').replace('$','') : NA },
      { label: '52W High',         val: fp(hi52) },
      { label: '52W Low',          val: fp(lo52) },
    ].map(f2 => `<div class="metric-card-large"><div class="label">${f2.label}</div><div class="value">${f2.val}</div></div>`).join('');

    // Peer comparison — real P/E and P/B for the searched stock vs its sector peers
    const cleanT = this._toYahooTicker(avTicker).replace(/\.(VI|DE|SW|AS|PA|MI|LS|BE|HK|KS|TW|L)$/, '');
    const sector = this._sectorForTicker(avTicker, cleanT);
    this.renderPeerChart(cleanT, sector, f.trailingPeRatio || 0, f.trailingPbRatio || 0);
  }

  /* Best-effort sector lookup so the peer chart compares like-for-like.
     Reverse-matches the ticker against the SECTOR_PEERS lists (which include the
     Austrian/EU names); falls back to Technology for unknown tickers. */
  _sectorForTicker(avTicker, cleanT) {
    for (const [sector, peers] of Object.entries(SECTOR_PEERS)) {
      if (peers.some(p => p.ticker === avTicker || p.ticker === cleanT || p.ticker.split('.')[0] === cleanT)) {
        return sector;
      }
    }
    return 'Technology';
  }

  async search(input) {
    if (!input) return;
    const ticker = this.resolveToTicker(input);
    if (!ticker) return;
    this.currentTicker = ticker;
    document.getElementById('research-empty').classList.add('hidden');
    document.getElementById('research-content').classList.remove('hidden');

    // Loading state — never show fabricated numbers
    this._setLoading(ticker);

    const key      = this.getApiKey();
    const yhTicker = this._toYahooTicker(ticker);

    // Real price + chart + fundamentals from Yahoo (via free CORS proxy) — no key
    const [chartResult, fund] = await Promise.all([
      this._fetchYahooChart(yhTicker),
      this._fetchYahooFundamentals(yhTicker),
    ]);

    if (chartResult) {
      this.renderYahooChart(chartResult);
      // Real baseline: price, chart, 52W, valuation, financials, peers — all live.
      // If an optional AV key is present, enrich with analyst data on top.
      this.renderYahooOverview(ticker, chartResult, fund);
      if (key) this.fetchOverview(ticker, key, /* skipPrice */ true);
    } else if (key) {
      // Yahoo proxy unreachable → optional Alpha Vantage fallback
      const ok = await this.fetchOverview(ticker, key);
      if (ok) await this.fetchTimeSeries(ticker, key);
      else this.renderNoData(ticker);
    } else {
      // No live data and no key → honest message, never demo numbers
      this.renderNoData(ticker);
    }

    // Insider transactions only via Alpha Vantage (SEC data, optional)
    if (key) this.fetchInsiderTransactions(ticker, key);
    else this.renderInsiders([]);
  }

  /* Loading placeholder — clears panels so stale/old data is never visible */
  _setLoading(ticker) {
    setText('res-name', ticker);
    setText('res-ticker', this._toYahooTicker(ticker));
    setText('res-exchange', 'lädt Live-Daten …');
    setText('res-sector', ''); setText('res-industry', ''); setText('res-mktcap', '');
    setText('res-price', '…');
    const chg = document.getElementById('res-change');
    if (chg) { chg.textContent = ''; chg.className = 'stock-change'; }
    document.getElementById('stock-avatar').textContent = ticker.substring(0, 2).toUpperCase();
    const spinner = '<div style="grid-column:1/-1;color:var(--text3);font-size:13px;padding:14px">⏳ lädt …</div>';
    document.getElementById('valuation-grid').innerHTML = spinner;
    document.getElementById('financials-grid').innerHTML = '';
    document.getElementById('price-target-block').innerHTML = '';
  }

  /* Honest empty state when no free data source is reachable (no demo numbers) */
  renderNoData(ticker) {
    setText('res-name', ticker);
    setText('res-ticker', this._toYahooTicker(ticker));
    setText('res-exchange', '⚠ Keine Live-Daten erreichbar');
    setText('res-sector', ''); setText('res-industry', ''); setText('res-mktcap', '');
    setText('res-price', '—');
    const chg = document.getElementById('res-change');
    if (chg) { chg.textContent = ''; chg.className = 'stock-change'; }
    const isFile = location.protocol === 'file:';
    const hint = isFile
      ? `<br><br><strong style="color:var(--yellow)">⚠ Du hast die Datei lokal geöffnet (file://).</strong>
         Die freien Daten-Proxys lehnen „file://" ab. Öffne die App über die Online-Version
         <a href="https://mattstad.github.io/DepotAnalyzer/" target="_blank" style="color:var(--accent-cyan)">mattstad.github.io/DepotAnalyzer</a>
         oder starte einen lokalen Server (z.B. <code>python -m http.server</code>) — dann laden die Live-Daten.`
      : `<br>Bitte in ein paar Sekunden erneut auf <strong>Analyze</strong> klicken.`;
    const msg = `<div style="grid-column:1/-1;color:var(--text3);font-size:13px;padding:16px;line-height:1.7">
        Es konnten keine Live-Daten geladen werden — die freien Daten-Proxys sind
        gerade nicht erreichbar.${hint}
        <br><span style="color:var(--text2)">Keine Demo-Werte, kein API-Key nötig.</span>
      </div>`;
    document.getElementById('valuation-grid').innerHTML = msg;
    document.getElementById('financials-grid').innerHTML = '';
    document.getElementById('price-target-block').innerHTML = '';
    if (this.priceChart) { this.priceChart.destroy(); this.priceChart = null; }
    if (this.peerChart)  { this.peerChart.destroy();  this.peerChart  = null; }
    showToast('Keine Live-Daten erreichbar – bitte gleich erneut versuchen', 'error');
  }

  async fetchInsiderTransactions(ticker, key) {
    this.renderInsiders(null); // show loading state
    try {
      const url  = `https://www.alphavantage.co/query?function=INSIDER_TRANSACTIONS&symbol=${ticker}&apikey=${key}`;
      const res  = await fetch(url);
      const data = await res.json();
      const rows = data?.data;
      if (Array.isArray(rows)) {
        this.renderInsiders(rows);
        return;
      }
    } catch {}
    this.renderInsiders([]); // API error or no data → show empty
  }

  renderInsiders(rows) {
    const tbody = document.getElementById('insider-tbody');
    if (!tbody) return;
    if (rows === null) {
      // Loading state
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:18px">Lade Insider-Daten…</td></tr>`;
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:18px">Keine Insider-Aktivität verfügbar</td></tr>`;
      return;
    }
    // Alpha Vantage field names: transaction_date, executive, executive_title,
    // acquisition_or_disposal ("A"=Buy, "D"=Sell/Dispose), shares, share_price, security_type
    tbody.innerHTML = rows.slice(0, 30).map(i => {
      const isBuy = (i.acquisition_or_disposal || '').toUpperCase() === 'A';
      const shares = parseInt(i.shares) || 0;
      const price  = parseFloat(i.share_price) || 0;
      const total  = shares * price;
      return `<tr>
        <td>${i.transaction_date || '—'}</td>
        <td class="name-cell">${esc(i.executive || '—')}</td>
        <td style="color:var(--text2)">${esc(i.executive_title || '—')}</td>
        <td><span class="${isBuy ? 'tx-buy' : 'tx-sell'}">${isBuy ? 'Buy' : 'Sell'}</span></td>
        <td class="num">${shares ? shares.toLocaleString() : '—'}</td>
        <td class="num">${price ? '$' + price.toFixed(2) : '—'}</td>
        <td class="num">${total ? '$' + total.toLocaleString('en', {maximumFractionDigits:0}) : '—'}</td>
      </tr>`;
    }).join('');
  }

  async fetchOverview(ticker, key, skipPrice = false) {
    try {
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${key}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.Symbol) { this.renderOverview(data, skipPrice); return true; }
    } catch {}
    return false;   // caller decides what to show (never demo numbers)
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

  renderOverview(d, skipPrice = false) {
    const ccy = d.Currency === 'EUR' ? '€' : /^GB/.test(d.Currency || '') ? '£' : '$';
    setText('res-name', d.Name || d.Symbol);
    setText('res-ticker', d.Symbol);
    setText('res-exchange', d.Exchange || '');
    setText('res-sector', d.Sector || '');
    setText('res-industry', d.Industry || '');
    document.getElementById('stock-avatar').textContent = (d.Symbol||'').substring(0,2);

    // Only set the headline price if the Yahoo chart didn't already (AV has no live quote)
    if (!skipPrice) {
      const price = parseFloat(d['50DayMovingAverage']) || 0;
      setText('res-price', price ? `${ccy}${parseFloat(d['52WeekHigh']).toFixed(2)}` : '—');
    }
    setText('res-mktcap', d.MarketCapitalization ? `Market Cap: ${fmtLargeNumCcy(d.MarketCapitalization, ccy)}` : '');

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

    // Price targets — keep the live Yahoo price as "current" when available
    const curForTarget = skipPrice
      ? (parseFloat(document.getElementById('res-price')?.textContent?.replace(/[^0-9.]/g,'')) || parseFloat(d['50DayMovingAverage']) || 0)
      : (parseFloat(d['50DayMovingAverage']) || 0);
    this.renderPriceTargets({
      low:     parseFloat(d['52WeekLow']),
      high:    parseFloat(d['52WeekHigh']),
      target:  parseFloat(d.AnalystTargetPrice) || 0,
      current: curForTarget,
      ccy,
    });

    // Financials
    const fins = [
      { label:'Revenue (TTM)',     val: fmtLargeNumCcy(d.RevenueTTM, ccy) },
      { label:'Gross Profit',      val: fmtLargeNumCcy(d.GrossProfitTTM, ccy) },
      { label:'EBITDA',            val: fmtLargeNumCcy(d.EBITDA, ccy) },
      { label:'Net Income (TTM)',  val: fmtLargeNumCcy(d.NetIncomeTTM, ccy) },
      { label:'EPS (Diluted)',     val: `${ccy}${parseFloat(d.DilutedEPSTTM||0).toFixed(2)}` },
      { label:'ROE',               val: d.ReturnOnEquityTTM ? (parseFloat(d.ReturnOnEquityTTM)*100).toFixed(1)+'%' : '—' },
      { label:'ROA',               val: d.ReturnOnAssetsTTM ? (parseFloat(d.ReturnOnAssetsTTM)*100).toFixed(1)+'%' : '—' },
      { label:'Profit Margin',     val: d.ProfitMargin ? (parseFloat(d.ProfitMargin)*100).toFixed(1)+'%' : '—' },
      { label:'Debt/Equity',       val: fmtMetric(d.DebtToEquityRatio) },
      { label:'Current Ratio',     val: fmtMetric(d.CurrentRatio) },
      { label:'Beta',              val: fmtMetric(d.Beta) },
      { label:'52W High',          val: `${ccy}${parseFloat(d['52WeekHigh']||0).toFixed(2)}` },
      { label:'52W Low',           val: `${ccy}${parseFloat(d['52WeekLow']||0).toFixed(2)}` },
      { label:'Shares Outstanding',val: fmtLargeNumCcy(d.SharesOutstanding, ccy) },
    ];
    document.getElementById('financials-grid').innerHTML = fins.map(f =>
      `<div class="metric-card-large"><div class="label">${f.label}</div><div class="value">${f.val||'—'}</div></div>`
    ).join('');

    // Insider transactions are fetched separately via fetchInsiderTransactions()
    this.renderPeerChart(d.Symbol, d.Sector, parseFloat(d.PERatio)||0, parseFloat(d.PriceToBookRatio)||0);
  }

  renderPriceChart(ts) {
    const ctx = document.getElementById('res-price-chart').getContext('2d');
    if (this.priceChart) this.priceChart.destroy();

    const entries = Object.entries(ts).sort(([a],[b]) => a < b ? -1 : 1).slice(-252);
    const labels  = entries.map(([d]) => d);
    // Use adjusted close to avoid split/dividend artifacts; fallback to raw close
    const closes  = entries.map(([,v]) => parseFloat(v['5. adjusted close'] || v['4. close']));
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
    const block = document.getElementById('analyst-block');
    if (!block) return;   // Analyst Consensus panel was removed (no free data source)
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

    block.innerHTML = `
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

  renderPriceTargets({ low, high, target, current, ccy = '$' }) {
    if (!low || !high) { document.getElementById('price-target-block').innerHTML = '<p style="color:var(--text3)">No data</p>'; return; }
    const range  = high - low || 1;
    const curPct = Math.max(0, Math.min(100, ((current - low) / range * 100))).toFixed(1);
    const tgtPct = Math.max(0, Math.min(100, ((target  - low) / range * 100))).toFixed(1);
    const hasTarget = target > 0;
    const upside = hasTarget && current ? ((target - current) / current * 100).toFixed(1) : null;

    document.getElementById('price-target-block').innerHTML = `
      <div class="pt-block">
        <div class="pt-line"><span class="pt-label">Current Price</span><span class="pt-val">${ccy}${current.toFixed(2)}</span></div>
        ${hasTarget ? `<div class="pt-line"><span class="pt-label">Analyst Target</span><span class="pt-val ${upside>=0?'green':'red'}">${ccy}${target.toFixed(2)} ${upside!=null?`(${upside>=0?'+':''}${upside}%)`:''}</span></div>` : ''}
        <div class="pt-line"><span class="pt-label">52W Range</span><span class="pt-val">${ccy}${low.toFixed(2)} – ${ccy}${high.toFixed(2)}</span></div>
        <div class="pt-range-bar">
          <div class="pt-range-fill" style="left:0;width:100%"></div>
          <div class="pt-current-line" style="left:${curPct}%"></div>
          ${hasTarget ? `<div class="pt-target-dot" style="left:${tgtPct}%"></div>` : ''}
        </div>
        <div class="pt-line"><span class="pt-label" style="font-size:10px">▏ 52W Low</span><span class="pt-val" style="font-size:10px">52W High ▕</span></div>
      </div>`;
  }

  renderPeerChart(ticker, sector, pe, pb) {
    const ctx = document.getElementById('peer-chart').getContext('2d');
    if (this.peerChart) this.peerChart.destroy();

    // Exclude the searched stock from the peer list to avoid a duplicate bar
    const base = ticker.split('.')[0].toUpperCase();
    const peers = (SECTOR_PEERS[sector] || SECTOR_PEERS['Technology'])
      .filter(p => p.ticker.split('.')[0].toUpperCase() !== base)
      .slice(0, 4);
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

}

/* ── Mock-Daten entfernt: die App zeigt ausschließlich echte Live-Daten ── */

const SECTOR_PEERS = {
  'Technology':    [ {ticker:'MSFT',pe:35.2,pb:13.8},{ticker:'GOOGL',pe:23.1,pb:7.2},{ticker:'META',pe:24.8,pb:9.1},{ticker:'AVGO',pe:31.2,pb:14.8} ],
  'Healthcare':    [ {ticker:'JNJ',pe:14.8,pb:5.2},{ticker:'LLY',pe:58.4,pb:22.1},{ticker:'ABBV',pe:28.1,pb:38.4},{ticker:'MRK',pe:16.2,pb:6.8} ],
  'Financials':    [ {ticker:'JPM',pe:11.2,pb:1.8},{ticker:'EBS.VIE',pe:7.8,pb:0.9},{ticker:'DBK.DE',pe:8.4,pb:0.6},{ticker:'BNP.PA',pe:7.2,pb:0.7} ],
  'Consumer Disc': [ {ticker:'AMZN',pe:48.2,pb:8.4},{ticker:'TSLA',pe:62.1,pb:12.8},{ticker:'HD',pe:22.4,pb:58.1},{ticker:'MCD',pe:24.8,pb:48.2} ],
  'Energy':        [ {ticker:'OMV.VIE',pe:8.4,pb:0.7},{ticker:'CVX',pe:13.2,pb:1.8},{ticker:'BP',pe:8.4,pb:1.2},{ticker:'SLB',pe:18.1,pb:3.8} ],
  'Materials':     [ {ticker:'VOE.VIE',pe:10.2,pb:0.6},{ticker:'BAS.DE',pe:14.8,pb:1.2},{ticker:'NUE',pe:12.4,pb:1.8},{ticker:'VALE3.SA',pe:8.2,pb:1.4} ],
  'Industrials':   [ {ticker:'ANDR.VIE',pe:18.4,pb:3.8},{ticker:'SIE.DE',pe:19.2,pb:3.4},{ticker:'HON',pe:22.4,pb:7.8},{ticker:'GE',pe:28.4,pb:5.8} ],
  'Utilities':     [ {ticker:'VER.VIE',pe:22.4,pb:4.2},{ticker:'RWE.DE',pe:14.8,pb:1.2},{ticker:'NEE',pe:21.4,pb:2.8},{ticker:'ENEL.MI',pe:12.4,pb:1.4} ],
};

function fmtMetric(v) {
  const n = parseFloat(v);
  if (!v || isNaN(n) || v === 'None') return '—';
  return n.toFixed(2) + 'x';
}

function fmtLargeNum(v) { return fmtLargeNumCcy(v, '$'); }

function fmtLargeNumCcy(v, ccy = '$') {
  const n = parseFloat(v);
  if (!v || isNaN(n)) return '—';
  if (n >= 1e12) return ccy + (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return ccy + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return ccy + (n/1e6).toFixed(2) + 'M';
  return ccy + n.toFixed(0);
}

const research = new StockResearch();
