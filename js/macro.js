/* ── Macro Dashboard — live data via Alpha Vantage, ECB, ExchangeRate-API, CoinGecko ── */
class MacroDashboard {
  constructor() { this.charts = {}; }

  getApiKey() { return localStorage.getItem('av_key') || ''; }

  /* ─── LocalStorage cache ──────────────────────────────────── */
  _cget(k) {
    try {
      const raw = localStorage.getItem('macro_' + k);
      if (!raw) return null;
      const { ts, ttl, val } = JSON.parse(raw);
      return (Date.now() - ts < ttl) ? val : null;
    } catch { return null; }
  }
  _cset(k, val, ttl = 14_400_000) {   // default 4 h
    try { localStorage.setItem('macro_' + k, JSON.stringify({ ts: Date.now(), ttl, val })); } catch {}
  }
  _clearCache() {
    Object.keys(localStorage).filter(k => k.startsWith('macro_')).forEach(k => localStorage.removeItem(k));
  }

  /* ─── Alpha Vantage fetch with cache ─────────────────────── */
  async _av(params, cacheKey, ttl) {
    const hit = this._cget(cacheKey);
    if (hit !== null) return hit;
    const key = this.getApiKey();
    if (!key) return null;
    try {
      const url  = `https://www.alphavantage.co/query?${new URLSearchParams({ ...params, apikey: key })}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.Information || data.Note) {
        console.warn('[Macro] AV rate limit hit for', cacheKey);
        return null;
      }
      this._cset(cacheKey, data, ttl);
      return data;
    } catch (e) { console.warn('[Macro] AV fetch error:', cacheKey, e); return null; }
  }

  /* ─── Free APIs (no key needed) ─────────────────────────── */
  async _fetchECBRate() {
    const hit = this._cget('ecb_dfr');
    if (hit !== null) return hit;
    try {
      // ECB Deposit Facility Rate — free, CORS-allowed (SDMX-JSON)
      // FM key has 7 dimensions, so series key is "0:0:0:0:0:0:0" — use Object.values() to avoid key brittleness
      const url = 'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?format=jsondata&lastNObservations=2';
      const res = await fetch(url);
      const d   = await res.json();
      const seriesMap = d?.dataSets?.[0]?.series || {};
      const firstSeries = Object.values(seriesMap)[0];
      const obs = firstSeries?.observations;
      if (!obs) return null;
      const keys = Object.keys(obs).map(Number).sort((a, b) => b - a);
      const val  = parseFloat(obs[String(keys[0])][0]);
      if (isNaN(val)) return null;
      this._cset('ecb_dfr', val, 86_400_000);
      return val;
    } catch { return null; }
  }

  async _fetchBoERate() {
    const hit = this._cget('boe_rate');
    if (hit !== null) return hit;
    try {
      // BoE Official Bank Rate — Statistics CSV API (may be CORS-blocked; graceful fallback)
      const url = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/2024&Dateto=now&SeriesCodes=IUDBEDR&CSVF=CN&UsingCodes=Y';
      const res = await fetch(url);
      const text = await res.text();
      const rows = text.trim().split('\n').filter(r => r && !r.startsWith('"'));
      if (!rows.length) return null;
      const last = rows[rows.length - 1].split(',');
      const val  = parseFloat(last[1]);
      if (isNaN(val)) return null;
      const dateStr = (last[0] || '').replace(/"/g, '').trim();
      this._cset('boe_rate', { rate: val, date: dateStr }, 86_400_000);
      return { rate: val, date: dateStr };
    } catch { return null; }
  }

  async _fetchFX() {
    // open.er-api.com: free tier, no key, CORS-friendly
    // Returns rates relative to USD, including XAU (gold) and XAG (silver)
    const hit = this._cget('fx_all');
    if (hit !== null) return hit;
    try {
      const res  = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data.result !== 'success') return null;
      this._cset('fx_all', data.rates, 3_600_000);  // 1 h
      return data.rates;
    } catch { return null; }
  }

  async _fetchCrypto() {
    const hit = this._cget('crypto');
    if (hit !== null) return hit;
    try {
      const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
      const data = await res.json();
      this._cset('crypto', data, 3_600_000);  // 1 h
      return data;
    } catch { return null; }
  }

  async _fetchFearGreed() {
    const hit = this._cget('fng');
    if (hit !== null) return hit;
    try {
      const res  = await fetch('https://api.alternative.me/fng/?limit=2');
      const data = await res.json();
      if (!data?.data?.length) return null;
      this._cset('fng', data.data, 3_600_000);
      return data.data;
    } catch { return null; }
  }

  /* ─── Free, no-key, direct-CORS macro sources ──────────────────
     NY Fed (Fed funds), BLS (US CPI/unemployment/payrolls), ECB (Euro/DE HICP),
     World Bank (GDP growth). All official APIs with CORS — no proxy, no key. */

  async _fetchNYFedEFFR() {
    const hit = this._cget('nyfed_effr'); if (hit !== null) return hit;
    try {
      const r = await fetch('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json');
      const d = await r.json();
      const ref = d?.refRates?.[0];
      if (ref?.percentRate == null) return null;
      const val = { rate: ref.percentRate, date: ref.effectiveDate };
      this._cset('nyfed_effr', val, 86_400_000);
      return val;
    } catch { return null; }
  }

  /* BLS public API v1 — simple GET (no preflight, no key). Returns data array
     (latest first), each { year, period:'M05', value }. */
  async _fetchBLS(seriesId) {
    const hit = this._cget('bls_' + seriesId); if (hit !== null) return hit;
    try {
      const r = await fetch(`https://api.bls.gov/publicAPI/v1/timeseries/data/${seriesId}`);
      const d = await r.json();
      const data = d?.Results?.series?.[0]?.data;
      if (!Array.isArray(data) || !data.length) return null;
      const monthly = data.filter(x => /^M(0[1-9]|1[0-2])$/.test(x.period));
      this._cset('bls_' + seriesId, monthly, 86_400_000);
      return monthly;
    } catch { return null; }
  }

  /* ECB SDMX-JSON series → [{ date, value }] ascending. resource = "FLOW/KEY". */
  async _fetchECBSeries(resource, n = 24) {
    const ck = 'ecbs_' + resource;
    const hit = this._cget(ck); if (hit !== null) return hit;
    try {
      const r = await fetch(`https://data-api.ecb.europa.eu/service/data/${resource}?format=jsondata&lastNObservations=${n}`);
      const d = await r.json();
      const ds = d?.dataSets?.[0];
      const series = ds && Object.values(ds.series || {})[0];
      const obs = series?.observations;
      const times = d?.structure?.dimensions?.observation?.[0]?.values?.map(v => v.id);
      if (!obs || !times) return null;
      const arr = Object.keys(obs)
        .map(k => ({ date: times[+k], value: parseFloat(obs[k][0]) }))
        .filter(x => x.date && !isNaN(x.value))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!arr.length) return null;
      this._cset(ck, arr, 86_400_000);
      return arr;
    } catch { return null; }
  }

  /* World Bank annual GDP growth (NY.GDP.MKTP.KD.ZG) for USA, Euro area, Germany. */
  async _fetchWorldBankGDP() {
    const hit = this._cget('wb_gdp'); if (hit !== null) return hit;
    try {
      const r = await fetch('https://api.worldbank.org/v2/country/USA;EMU;DEU/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=400&mrv=9');
      const d = await r.json();
      if (!Array.isArray(d?.[1])) return null;
      const by = { USA: {}, EMU: {}, DEU: {} };
      for (const x of d[1]) if (x.value != null && by[x.countryiso3code]) by[x.countryiso3code][x.date] = x.value;
      this._cset('wb_gdp', by, 604_800_000);   // 7 days (annual data)
      return by;
    } catch { return null; }
  }

  /* Yahoo Finance multi-symbol quotes via the shared free CORS proxy (no key).
     Returns { SYMBOL: { price, chgPct } }. Used for live commodities & yields. */
  async _fetchYahooSpark(symbols, range = '1mo') {
    const cacheKey = 'yspark_' + range + '_' + symbols.join(',');
    const hit = this._cget(cacheKey);
    if (hit !== null) return hit;
    if (typeof proxyFetchJson !== 'function') return null;
    const url = 'https://query1.finance.yahoo.com/v8/finance/spark?symbols='
              + symbols.map(encodeURIComponent).join(',') + `&range=${range}&interval=1d`;
    const d = await proxyFetchJson(url);
    if (!d) return null;
    const out = {};
    for (const s of symbols) {
      let q = d[s];
      if (!q && d.spark?.result) {
        const r = d.spark.result.find(x => x.symbol === s)?.response?.[0];
        if (r) q = { close: r.indicators?.quote?.[0]?.close, chartPreviousClose: r.meta?.chartPreviousClose };
      }
      const closes = Array.isArray(q?.close) ? q.close.filter(x => x != null) : [];
      if (!closes.length) continue;
      const price = closes[closes.length - 1];
      const prev  = q.chartPreviousClose;
      out[s] = { price, chgPct: prev ? +((price / prev - 1) * 100).toFixed(1) : null };
    }
    if (!Object.keys(out).length) return null;
    this._cset(cacheKey, out, 14_400_000);   // 4 h
    return out;
  }

  /* ─── AV data accessor helpers ──────────────────────────── */
  _latest(data, count = 1) {
    if (!data?.data?.length) return count === 1 ? null : [];
    const sorted = [...data.data]
      .filter(d => d.value !== '.' && d.value !== '' && !isNaN(parseFloat(d.value)))
      .sort((a, b) => b.date.localeCompare(a.date));
    return count === 1 ? (sorted[0] || null) : sorted.slice(0, count);
  }

  _yoyFromLevels(data, months = 18) {
    if (!data?.data?.length) return { labels: [], values: [] };
    const sorted = [...data.data]
      .filter(d => d.value !== '.' && d.value !== '' && !isNaN(parseFloat(d.value)))
      .sort((a, b) => a.date.localeCompare(b.date));
    const labels = [], values = [];
    for (let i = 12; i < sorted.length; i++) {
      const curr = parseFloat(sorted[i].value);
      const prev = parseFloat(sorted[i - 12].value);
      if (prev === 0) continue;
      labels.push(sorted[i].date.substring(0, 7));
      values.push(+((curr / prev - 1) * 100).toFixed(2));
    }
    return { labels: labels.slice(-months), values: values.slice(-months) };
  }

  _qoqAnnualized(data, quarters = 10) {
    if (!data?.data?.length) return { labels: [], values: [] };
    const sorted = [...data.data]
      .filter(d => d.value !== '.' && d.value !== '' && !isNaN(parseFloat(d.value)))
      .sort((a, b) => a.date.localeCompare(b.date));
    const labels = [], values = [];
    for (let i = 1; i < sorted.length; i++) {
      const curr = parseFloat(sorted[i].value);
      const prev = parseFloat(sorted[i - 1].value);
      if (prev === 0) continue;
      labels.push(sorted[i].date.substring(0, 7));
      values.push(+((curr / prev - 1) * 4 * 100).toFixed(1));
    }
    return { labels: labels.slice(-quarters), values: values.slice(-quarters) };
  }

  /* ─── Main render ────────────────────────────────────────── */
  async render(forceRefresh = false) {
    if (forceRefresh) this._clearCache();

    // Skeleton loaders
    ['cb-rates', 'commodities-block', 'fx-block', 'sentiment-block', 'labor-block', 'calendar-block'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div class="macro-loading"><span class="macro-spinner"></span> Lade…</div>`;
    });

    const k          = this.getApiKey();
    const TTL_ECON   = 86_400_000;  // 24 h — economic indicators (monthly/quarterly releases)
    const TTL_MARKET = 14_400_000;  //  4 h — yields, commodity prices
    const TTL_FX     =  3_600_000;  //  1 h — exchange rates

    // Fire all fetches in parallel
    const COM_SYMS = ['GC=F','SI=F','CL=F','BZ=F','NG=F','HG=F','ZW=F','ZC=F'];
    const YLD_SYMS = ['^IRX','2YY=F','^FVX','^TNX','^TYX'];

    const [
      fedR, cpiR, gdpR, unemR, nfpR,
      y3m, y2y, y5y, y10y, y30y,
      wtiR, brentR, ngR, copperR, wheatR, cornR,
      fxR, cryptoR, ecbR, fngR, boeR,
      yComR, yYldR,
      effrR, blsCpiR, blsUnempR, blsNfpR, ecbCpiEuR, ecbCpiDeR, wbGdpR,
    ] = await Promise.allSettled([
      k ? this._av({ function: 'FEDERAL_FUNDS_RATE', interval: 'monthly' },   'fed_rate',    TTL_ECON) : Promise.resolve(null),
      k ? this._av({ function: 'CPI',                interval: 'monthly' },   'cpi',         TTL_ECON) : Promise.resolve(null),
      k ? this._av({ function: 'REAL_GDP',           interval: 'quarterly' }, 'gdp',         TTL_ECON) : Promise.resolve(null),
      k ? this._av({ function: 'UNEMPLOYMENT' },                               'unemployment',TTL_ECON) : Promise.resolve(null),
      k ? this._av({ function: 'NONFARM_PAYROLL' },                            'nfp',         TTL_ECON) : Promise.resolve(null),
      k ? this._av({ function: 'TREASURY_YIELD', interval: 'monthly', maturity: '3month' },  'y3m',  TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'TREASURY_YIELD', interval: 'monthly', maturity: '2year' },   'y2y',  TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'TREASURY_YIELD', interval: 'monthly', maturity: '5year' },   'y5y',  TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'TREASURY_YIELD', interval: 'monthly', maturity: '10year' },  'y10y', TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'TREASURY_YIELD', interval: 'monthly', maturity: '30year' },  'y30y', TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'WTI',          interval: 'monthly' }, 'com_wti',    TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'BRENT',        interval: 'monthly' }, 'com_brent',  TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'NATURAL_GAS',  interval: 'monthly' }, 'com_ng',     TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'COPPER',       interval: 'monthly' }, 'com_copper', TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'WHEAT',        interval: 'monthly' }, 'com_wheat',  TTL_MARKET) : Promise.resolve(null),
      k ? this._av({ function: 'CORN',         interval: 'monthly' }, 'com_corn',   TTL_MARKET) : Promise.resolve(null),
      this._fetchFX(),
      this._fetchCrypto(),
      this._fetchECBRate(),
      this._fetchFearGreed(),
      this._fetchBoERate(),   // optional — CORS may block; graceful fallback
      this._fetchYahooSpark(COM_SYMS, '1mo'),   // live commodities, no key
      this._fetchYahooSpark(YLD_SYMS, '1mo'),   // live yield curve, no key
      this._fetchNYFedEFFR(),                    // Fed funds (live, no key)
      this._fetchBLS('CUUR0000SA0'),             // US CPI index → YoY (live, no key)
      this._fetchBLS('LNS14000000'),             // US unemployment (live, no key)
      this._fetchBLS('CES0000000001'),           // US nonfarm payrolls (live, no key)
      this._fetchECBSeries('ICP/M.U2.N.000000.4.ANR', 24),  // Euro-area HICP YoY
      this._fetchECBSeries('ICP/M.DE.N.000000.4.ANR', 24),  // Germany HICP YoY
      this._fetchWorldBankGDP(),                 // US/EU/DE GDP growth (annual)
    ]);

    const v = r => r.status === 'fulfilled' ? r.value : null;

    const yCom = v(yComR), yYld = v(yYldR);
    const effr = v(effrR), blsCpi = v(blsCpiR), blsUnemp = v(blsUnempR), blsNfp = v(blsNfpR);
    const ecbCpiEu = v(ecbCpiEuR), ecbCpiDe = v(ecbCpiDeR), wbGdp = v(wbGdpR);

    this.renderCentralBankRates(v(fedR), v(ecbR), v(boeR), effr);
    this.renderCPI(v(cpiR), { blsCpi, ecbCpiEu, ecbCpiDe });
    this.renderYieldCurve({ y3m: v(y3m), y2y: v(y2y), y5y: v(y5y), y10y: v(y10y), y30y: v(y30y), yahoo: yYld });
    this.renderGDP(v(gdpR), wbGdp);
    this.renderLaborMarket(v(unemR), v(nfpR), { blsUnemp, blsNfp });
    this.renderCommodities({ wti: v(wtiR), brent: v(brentR), ng: v(ngR), copper: v(copperR), wheat: v(wheatR), corn: v(cornR), fx: v(fxR), yahoo: yCom });
    this.renderFX(v(fxR), v(cryptoR));
    this.renderSentiment(v(fngR));
    this.renderCalendar();
    this.renderCAPE();

    // Freshness badge — virtually everything is now live from free sources (no key).
    // Only the 4 minor reference rates (BoE/BoJ/SNB/RBA) lack a free CORS source.
    const ts = new Date().toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('macro-freshness');
    if (el) el.textContent = `📡 Live · ${ts}`;
  }

  /* ─── Central Bank Rates ─────────────────────────────────── */
  renderCentralBankRates(fedData, ecbRate, boeData, effr) {
    const fedLatest = this._latest(fedData);
    // Prefer NY Fed effective rate (live, no key) over Alpha Vantage
    const fedRate   = effr?.rate ?? (fedLatest ? parseFloat(fedLatest.value) : null);
    const fedDate   = effr?.date ? effr.date.substring(0, 7) : (fedLatest ? fedLatest.date.substring(0, 7) : null);

    // BoE: live if CORS succeeded, static fallback otherwise
    const boeRate = boeData?.rate ?? 3.75;
    const boeDate = boeData?.date ?? null;
    const boeLive = boeData !== null;

    // Reference values for banks without a free CORS-compatible live API
    // Updated based on latest known decisions (Jun 2026)
    const OTHER = [
      { name: 'Bank of Japan', rate: 0.75, date: 'Jun 2026', trend: '↑', col: 'var(--yellow)', note: 'Normalisierung' },
      { name: 'SNB',           rate: 0.25, date: 'Mär 2026', trend: '→', col: 'var(--text2)',  note: 'Nahe Nullgrenze' },
      { name: 'RBA (Australien)', rate: 3.85, date: 'Mai 2026', trend: '↓', col: 'var(--green)', note: 'Senkungszyklus' },
    ];

    const card = (name, rateStr, date, trend, col, note, live) => `
      <div class="rate-item">
        <div class="rate-country">${name}</div>
        <div class="rate-val">${rateStr}</div>
        <div class="rate-trend" style="color:${col}">${trend} ${note}</div>
        <div class="rate-label">${live ? `📡 Stand ${date}` : `Ref. ${date}`}</div>
      </div>`;

    const fedTrend = fedRate !== null ? (fedRate > 4.5 ? '↓' : fedRate > 2 ? '→' : '↓') : '—';
    const fedNote  = fedRate !== null ? (fedRate > 4 ? 'Restriktiv' : fedRate > 2 ? 'Neutral' : 'Akkommodativ') : '';

    const boeDateLabel = boeLive
      ? boeDate || 'live'
      : 'Jun 2026';

    document.getElementById('cb-rates').innerHTML = `<div class="rate-grid">
      ${card('Fed (USA)',         fedRate !== null ? fedRate.toFixed(2) + '%' : '—', fedDate || '—', fedTrend, 'var(--green)', fedNote, fedRate !== null)}
      ${card('EZB (Einlagesatz)',ecbRate  !== null ? ecbRate.toFixed(2) + '%' : '—', 'live', '↓', 'var(--green)', 'Senkungszyklus', ecbRate !== null)}
      ${card('Bank of England',   boeRate.toFixed(2) + '%', boeDateLabel, '↓', 'var(--green)', 'Senkungszyklus', boeLive)}
      ${OTHER.map(b => card(b.name, b.rate.toFixed(2) + '%', b.date, b.trend, b.col, b.note, false)).join('')}
    </div>`;
  }

  /* ─── CPI / Inflation Chart ──────────────────────────────── */
  renderCPI(cpiData, free = {}) {
    const ctx = document.getElementById('cpi-chart')?.getContext('2d');
    if (!ctx) return;
    if (this.charts.cpi) { this.charts.cpi.destroy(); this.charts.cpi = null; }

    // US YoY — prefer BLS (live, no key), else Alpha Vantage, else static
    let usLabels = [], usVals = [];
    const bls = free.blsCpi;
    if (Array.isArray(bls) && bls.length > 12) {
      const asc = [...bls].reverse();  // ascending by date
      for (let i = 12; i < asc.length; i++) {
        const c = +asc[i].value, p = +asc[i - 12].value;
        if (!p) continue;
        usLabels.push(`${asc[i].year}-${asc[i].period.slice(1)}`);
        usVals.push(+((c / p - 1) * 100).toFixed(1));
      }
    } else {
      const r = this._yoyFromLevels(cpiData, 24);
      usLabels = r.labels; usVals = r.values;
    }
    usLabels = usLabels.slice(-20); usVals = usVals.slice(-20);

    // Euro-area & Germany HICP (annual rate %) from ECB, keyed by 'YYYY-MM'
    const euMap = {}; (free.ecbCpiEu || []).forEach(o => euMap[o.date] = o.value);
    const deMap = {}; (free.ecbCpiDe || []).forEach(o => deMap[o.date] = o.value);

    // Static fallback only if nothing live at all
    const staticLabels = ['2023-01','2023-04','2023-07','2023-10','2024-01','2024-04','2024-07','2024-10','2025-01','2025-04'];
    let labels = usLabels.length ? usLabels
               : (Object.keys(euMap).length ? Object.keys(euMap).sort().slice(-20) : staticLabels);
    const n = labels.length;

    const usData = usVals.length ? usVals : [6.4,4.9,3.2,3.2,3.1,3.4,2.9,2.6,3.0,2.8].slice(-n);
    const euData = Object.keys(euMap).length ? labels.map(l => euMap[l] ?? null) : [8.6,7.0,5.3,2.9,2.8,2.4,2.6,2.3,2.4,2.2].slice(-n);
    const deData = Object.keys(deMap).length ? labels.map(l => deMap[l] ?? null) : [8.7,7.2,6.2,3.8,2.9,2.2,2.4,2.0,2.2,2.1].slice(-n);

    this.charts.cpi = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: usVals.length ? 'US CPI (live)' : 'US CPI', data: usData,
          borderColor: '#3b82f6', fill: false, tension: 0.3, pointRadius: 2, spanGaps: true },
        { label: 'Eurozone CPI', data: euData,
          borderColor: '#10c980', fill: false, tension: 0.3, pointRadius: 2, spanGaps: true },
        { label: 'DE CPI', data: deData,
          borderColor: '#f59e0b', fill: false, tension: 0.3, pointRadius: 2, borderDash: [3, 3], spanGaps: true },
        { label: '2% Ziel', data: Array(n).fill(2),
          borderColor: 'rgba(239,68,102,.5)', borderDash: [6, 3], pointRadius: 0, fill: false },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8899b8', boxWidth: 12, font: { size: 10 } } },
          tooltip: { backgroundColor: '#101828', callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } },
        },
        scales: {
          x: { ticks: { color: '#4a6080', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#1a2840' } },
        },
      },
    });
  }

  /* ─── US Yield Curve ─────────────────────────────────────── */
  renderYieldCurve({ y3m, y2y, y5y, y10y, y30y, yahoo }) {
    const ctx = document.getElementById('yield-chart')?.getContext('2d');
    if (!ctx) return;
    if (this.charts.yield) { this.charts.yield.destroy(); this.charts.yield = null; }

    const Y = yahoo || {};
    const yv = s => Y[s]?.price ?? null;
    const pick = d => { const l = this._latest(d); return l ? parseFloat(l.value) : null; };
    // Priority per maturity: Yahoo yield index (live, no key) → Alpha Vantage → static
    const yYahoo = [yv('^IRX'), yv('2YY=F'), yv('^FVX'), yv('^TNX'), yv('^TYX')];
    const yAv    = [pick(y3m), pick(y2y), pick(y5y), pick(y10y), pick(y30y)];
    const fb   = [5.28, 4.88, 4.42, 4.28, 4.34];   // static fallback
    const prev = [4.85, 4.72, 4.28, 4.08, 4.18];   // 1 year ago (reference)
    const hasLive = yYahoo.some(v => v !== null) || yAv.some(v => v !== null);
    const cur  = yYahoo.map((v, i) => v ?? yAv[i] ?? fb[i]);
    const labels = ['3M', '2J', '5J', '10J', '30J'];

    // Yield spread 10Y–2Y (key recession indicator)
    const spread = cur[3] - cur[1];
    const spreadCol   = spread < 0 ? 'var(--red)' : spread < 0.3 ? 'var(--yellow)' : 'var(--green)';
    const spreadLabel = spread < 0 ? '⚠ Invertiert — Rezessionsindikator' : spread < 0.3 ? 'Flache Kurve' : 'Normale Kurve';
    const spreadEl = document.getElementById('yield-spread');
    if (spreadEl) {
      spreadEl.innerHTML = `<span style="color:${spreadCol};font-weight:700">
        ${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%
      </span> <span style="color:var(--text3);font-size:10px">10J–2J Spread · ${spreadLabel}</span>`;
    }

    this.charts.yield = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: hasLive ? 'Aktuell (live)' : 'Aktuell', data: cur,
          borderColor: '#06c8d8', fill: false, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#06c8d8' },
        { label: 'Vor 1 Jahr', data: prev,
          borderColor: '#4a6080', fill: false, tension: 0.3, pointRadius: 2, borderDash: [4, 3] },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8899b8', boxWidth: 12, font: { size: 10 } } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}%` } },
        },
        scales: {
          x: { ticks: { color: '#4a6080', font: { size: 9 } }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font: { size: 10 }, callback: v => v.toFixed(1) + '%' }, grid: { color: '#1a2840' } },
        },
      },
    });
  }

  /* ─── GDP Growth Chart ───────────────────────────────────── */
  renderGDP(gdpData, wbGdp) {
    const ctx = document.getElementById('gdp-chart')?.getContext('2d');
    if (!ctx) return;
    if (this.charts.gdp) { this.charts.gdp.destroy(); this.charts.gdp = null; }

    let labels, usData, euData, deData, usLabel = 'USA';

    if (wbGdp?.USA && Object.keys(wbGdp.USA).length) {
      // World Bank annual GDP growth (live, no key) — auto-rolls forward each year
      const years = Object.keys(wbGdp.USA).sort().slice(-8);
      const r1 = v => v != null ? +(+v).toFixed(1) : null;
      labels = years;
      usData = years.map(y => r1(wbGdp.USA[y]));
      euData = years.map(y => r1(wbGdp.EMU?.[y]));
      deData = years.map(y => r1(wbGdp.DEU?.[y]));
      usLabel = 'USA (live)';
    } else {
      // Fallback: Alpha Vantage quarterly, else static
      const { labels: liveLabels, values: liveUS } = this._qoqAnnualized(gdpData, 10);
      const fbLabels = ['Q1 23','Q2 23','Q3 23','Q4 23','Q1 24','Q2 24','Q3 24','Q4 24','Q1 25'];
      const fbUS     = [2.2, 2.1, 4.9, 3.4, 1.6, 3.0, 2.8, 2.4, 1.6];
      labels = liveLabels.length ? liveLabels : fbLabels;
      usData = liveUS.length     ? liveUS     : fbUS;
      const n = labels.length;
      euData = [1.2, 0.6, 0.2, 0.2, 0.4, 0.8, 0.9, 0.9, 1.2].slice(-n);
      deData = [-0.4, -0.3, -0.1, -0.3, -0.2, 0.2, 0.1, -0.2, 0.4].slice(-n);
      usLabel = liveLabels.length ? 'USA (live)' : 'USA';
    }

    this.charts.gdp = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [
        { label: usLabel, data: usData,
          backgroundColor: usData.map(v => v >= 0 ? '#3b82f6' : 'rgba(59,130,246,.4)'), borderRadius: 3 },
        { label: 'Eurozone', data: euData,
          backgroundColor: euData.map(v => v >= 0 ? '#10c980' : 'rgba(16,201,128,.4)'), borderRadius: 3 },
        { label: 'Deutschland', data: deData,
          backgroundColor: deData.map(v => v >= 0 ? '#f59e0b' : 'rgba(245,158,11,.4)'), borderRadius: 3 },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#8899b8', boxWidth: 12, font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: '#4a6080', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#8899b8', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#1a2840' } },
        },
      },
    });
  }

  /* ─── Labor Market ───────────────────────────────────────── */
  renderLaborMarket(unemData, nfpData, free = {}) {
    let unem = null, unemDate = null, latestNFP = null, nfpDate = null, nfpAvg3m = null;

    const bu = free.blsUnemp, bn = free.blsNfp;
    if (Array.isArray(bu) && bu.length) {
      // BLS live (no key) — data is latest-first
      unem = parseFloat(bu[0].value);
      unemDate = `${bu[0].year}-${bu[0].period.slice(1)}`;
    } else {
      const unemRow = this._latest(unemData);
      unem = unemRow ? parseFloat(unemRow.value) : null;
      unemDate = unemRow ? unemRow.date.substring(0, 7) : null;
    }

    if (Array.isArray(bn) && bn.length > 1) {
      // BLS payroll level (thousands) → month-over-month change in jobs
      const chg = [];
      for (let i = 0; i < Math.min(4, bn.length - 1); i++) chg.push(Math.round((+bn[i].value - +bn[i + 1].value) * 1000));
      latestNFP = chg[0];
      nfpDate   = `${bn[0].year}-${bn[0].period.slice(1)}`;
      nfpAvg3m  = chg.length >= 3 ? Math.round((chg[0] + chg[1] + chg[2]) / 3) : null;
    } else {
      const nfpRows = this._latest(nfpData, 4);
      const nfpList = Array.isArray(nfpRows) ? nfpRows : (nfpRows ? [nfpRows] : []);
      latestNFP = nfpList[0] ? parseInt(nfpList[0].value) : null;
      nfpDate   = nfpList[0] ? nfpList[0].date.substring(0, 7) : null;
      nfpAvg3m  = nfpList.length >= 3
        ? Math.round(nfpList.slice(0, 3).reduce((s, d) => s + parseInt(d.value), 0) / 3)
        : null;
    }

    const unemColor = unem !== null ? (unem < 4.5 ? 'var(--green)' : unem < 6 ? 'var(--yellow)' : 'var(--red)') : 'var(--text2)';
    const nfpColor  = latestNFP !== null ? (latestNFP > 150000 ? 'var(--green)' : latestNFP > 75000 ? 'var(--yellow)' : 'var(--red)') : 'var(--text2)';

    document.getElementById('labor-block').innerHTML = `
      <div class="rate-grid">
        <div class="rate-item">
          <div class="rate-country">Arbeitslosenquote USA</div>
          <div class="rate-val" style="color:${unemColor}">${unem !== null ? unem.toFixed(1) + '%' : '—'}</div>
          <div class="rate-label">${unemDate ? `📡 Stand ${unemDate}` : 'Kein API-Key'}</div>
        </div>
        <div class="rate-item">
          <div class="rate-country">Nonfarm Payrolls</div>
          <div class="rate-val" style="font-size:18px;color:${nfpColor}">
            ${latestNFP !== null ? (latestNFP >= 0 ? '+' : '') + latestNFP.toLocaleString('de') : '—'}
          </div>
          <div class="rate-label">${nfpDate ? `📡 ${nfpDate}` : '—'} ${nfpAvg3m !== null ? `· Ø3M: ${nfpAvg3m >= 0 ? '+' : ''}${nfpAvg3m.toLocaleString('de')}` : ''}</div>
        </div>
      </div>`;
  }

  /* ─── Commodities ────────────────────────────────────────── */
  renderCommodities({ wti, brent, ng, copper, wheat, corn, fx, yahoo }) {
    // pct change: compare latest to N periods ago (Alpha Vantage series)
    const pct = (d, n = 1) => {
      if (!d?.data?.length) return null;
      const sorted = [...d.data]
        .filter(x => x.value !== '.' && x.value !== '' && !isNaN(parseFloat(x.value)))
        .sort((a, b) => b.date.localeCompare(a.date));
      if (sorted.length < n + 1) return null;
      const curr = parseFloat(sorted[0].value), prev = parseFloat(sorted[n].value);
      return prev === 0 ? null : +((curr / prev - 1) * 100).toFixed(1);
    };
    const pickV = d => { const l = this._latest(d); return l ? parseFloat(l.value) : null; };

    // Gold/Silver fallback from FX rates (XAU/XAG vs USD) if Yahoo unavailable
    const goldFx   = fx?.XAU ? +(1 / fx.XAU).toFixed(0)  : null;
    const silverFx = fx?.XAG ? +(1 / fx.XAG).toFixed(2)  : null;

    const Y = yahoo || {};
    const yv = s => Y[s]?.price ?? null;
    const yc = s => Y[s]?.chgPct ?? null;

    // Priority per row: Yahoo (live, no key) → Alpha Vantage → static fallback
    const items = [
      { label: 'Gold',    sym: 'GC=F', avVal: goldFx,        avChg: null },
      { label: 'Silber',  sym: 'SI=F', avVal: silverFx,      avChg: null },
      { label: 'WTI Öl',  sym: 'CL=F', avVal: pickV(wti),    avChg: pct(wti) },
      { label: 'Brent',   sym: 'BZ=F', avVal: pickV(brent),  avChg: pct(brent) },
      { label: 'Erdgas',  sym: 'NG=F', avVal: pickV(ng),     avChg: pct(ng) },
      { label: 'Kupfer',  sym: 'HG=F', avVal: pickV(copper), avChg: pct(copper) },
      { label: 'Weizen',  sym: 'ZW=F', avVal: pickV(wheat),  avChg: pct(wheat) },
      { label: 'Mais',    sym: 'ZC=F', avVal: pickV(corn),   avChg: pct(corn) },
    ];

    // Static fallbacks [price, chg%]
    const FB = { Gold:[2380,15.2], Silber:[29.5,22.1], 'WTI Öl':[79.8,-4.2], Brent:[84.2,-3.8],
                 Erdgas:[2.42,-28.4], Kupfer:[4.48,8.1], Weizen:[612,-12.2], Mais:[447,-18.4] };

    document.getElementById('commodities-block').innerHTML = `<div class="commodity-grid">
      ${items.map(d => {
        const val    = yv(d.sym) ?? d.avVal ?? FB[d.label]?.[0];
        const chgVal = yc(d.sym) ?? d.avChg ?? FB[d.label]?.[1];
        const live   = yv(d.sym) != null || d.avVal != null;
        const pos    = chgVal != null ? chgVal >= 0 : true;
        return `<div class="data-row">
          <div>
            <div class="label">${d.label}${live ? ' <span style="font-size:9px;color:var(--cyan)">●</span>' : ''}</div>
            <div class="val">${val != null ? '$' + (val > 100 ? Math.round(val).toLocaleString('en') : val.toFixed(2)) : '—'}</div>
          </div>
          <span class="chg ${pos ? 'green' : 'red'}">${chgVal != null ? (pos ? '+' : '') + chgVal.toFixed(1) + '%' : '—'}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ─── FX Rates ───────────────────────────────────────────── */
  renderFX(rates, crypto) {
    // rates from open.er-api.com (vs USD base)
    const fmt = (val, dec = 4) => val != null ? val.toFixed(dec) : '—';

    const eurusd  = rates?.EUR  ? +(1 / rates.EUR).toFixed(4)  : null;   // EUR/USD
    const usdjpy  = rates?.JPY  ? +rates.JPY.toFixed(2)         : null;  // USD/JPY
    const gbpusd  = rates?.GBP  ? +(1 / rates.GBP).toFixed(4)  : null;  // GBP/USD
    const usdchf  = rates?.CHF  ? +rates.CHF.toFixed(4)         : null;  // USD/CHF
    const eurchf  = (rates?.EUR && rates?.CHF) ? +(rates.CHF / rates.EUR).toFixed(4) : null; // EUR/CHF
    const btcUsd  = crypto?.bitcoin?.usd;
    const ethUsd  = crypto?.ethereum?.usd;
    const btcChg  = crypto?.bitcoin?.usd_24h_change;
    const ethChg  = crypto?.ethereum?.usd_24h_change;

    const liveStr = rates ? ' <span style="font-size:9px;color:var(--cyan)">●</span>' : '';
    const fxFb = { 'EUR/USD': 1.0842, 'USD/JPY': 157.82, 'GBP/USD': 1.2724, 'USD/CHF': 0.8914, 'EUR/CHF': 0.9640 };

    const fxItems = [
      { label: 'EUR/USD', val: eurusd  ?? fxFb['EUR/USD'], live: !!rates },
      { label: 'USD/JPY', val: usdjpy  ?? fxFb['USD/JPY'], live: !!rates },
      { label: 'GBP/USD', val: gbpusd  ?? fxFb['GBP/USD'], live: !!rates },
      { label: 'USD/CHF', val: usdchf  ?? fxFb['USD/CHF'], live: !!rates },
      { label: 'EUR/CHF', val: eurchf  ?? fxFb['EUR/CHF'], live: !!rates },
    ];

    document.getElementById('fx-block').innerHTML = `<div class="fx-grid">
      ${fxItems.map(d => `
        <div class="data-row">
          <div>
            <div class="label">${d.label}${d.live ? liveStr : ''}</div>
            <div class="val">${fmt(d.val, d.label === 'USD/JPY' ? 2 : 4)}</div>
          </div>
          <span class="chg" style="color:var(--text3);font-size:10px">${d.live ? '●live' : 'statisch'}</span>
        </div>`).join('')}
      <div class="data-row">
        <div>
          <div class="label">BTC/USD${btcUsd ? liveStr : ''}</div>
          <div class="val">${btcUsd ? '$' + Math.round(btcUsd).toLocaleString('en') : '—'}</div>
        </div>
        <span class="chg ${btcChg != null ? (btcChg >= 0 ? 'green' : 'red') : ''}">
          ${btcChg != null ? (btcChg >= 0 ? '+' : '') + btcChg.toFixed(1) + '%' : '—'}
        </span>
      </div>
      <div class="data-row">
        <div>
          <div class="label">ETH/USD${ethUsd ? liveStr : ''}</div>
          <div class="val">${ethUsd ? '$' + Math.round(ethUsd).toLocaleString('en') : '—'}</div>
        </div>
        <span class="chg ${ethChg != null ? (ethChg >= 0 ? 'green' : 'red') : ''}">
          ${ethChg != null ? (ethChg >= 0 ? '+' : '') + ethChg.toFixed(1) + '%' : '—'}
        </span>
      </div>
    </div>`;
  }

  /* ─── Market Sentiment (Fear & Greed) ────────────────────── */
  renderSentiment(fngData) {
    const entry = Array.isArray(fngData) ? fngData[0] : null;
    const value = entry ? parseInt(entry.value) : 58;
    const lbl   = entry ? entry.value_classification : 'Greed';
    const prev  = Array.isArray(fngData) && fngData[1] ? parseInt(fngData[1].value) : null;
    const delta = prev !== null ? value - prev : null;
    const color = value > 75 ? '#10c980' : value > 55 ? '#84cc16' : value > 45 ? '#f59e0b' : value > 25 ? '#f97316' : '#ef4466';
    const isLive = !!entry;

    document.getElementById('sentiment-block').innerHTML = `
      <div class="sentiment-gauge">
        <div class="gauge-value" style="color:${color}">${value}</div>
        <div class="gauge-label" style="color:${color}">${lbl || '—'}</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px">
          ${isLive ? '📡 Crypto Fear &amp; Greed (Alternative.me)' : 'Fear &amp; Greed Index (statisch)'}
          ${delta !== null ? `<span style="color:${delta >= 0 ? 'var(--green)' : 'var(--red)'}"> ${delta >= 0 ? '▲' : '▼'}${Math.abs(delta)} vs. gestern</span>` : ''}
        </div>
        <div class="gauge-bar"></div>
        <div class="gauge-pointer"><div class="gauge-needle" style="left:${value}%"></div></div>
        <div class="gauge-sublabels"><span>Angst</span><span>Neutral</span><span>Gier</span></div>
        <div style="margin-top:12px;font-size:10px;color:var(--text3)">
          Hinweis: Crypto F&amp;G-Index. Für Aktienmarkt: VIX &amp; Put/Call-Ratio.
        </div>
      </div>`;
  }

  /* ─── Economic Calendar ──────────────────────────────────── */
  renderCalendar() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Rule-based recurring US releases — generated for the coming months so the
    // calendar auto-rolls forward forever and never needs manual updates. These
    // releases follow fixed schedules (NFP = 1st Friday, CPI ≈ 2nd Wednesday,
    // GDP advance ≈ end of the month after each quarter).
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const monthName    = d => d.toLocaleDateString('de-AT', { month: 'long' });
    const firstWeekday = (y, m, wd) => { const d = new Date(y, m, 1); while (d.getDay() !== wd) d.setDate(d.getDate() + 1); return d; };
    const nthWeekday   = (y, m, wd, n) => { const d = firstWeekday(y, m, wd); d.setDate(d.getDate() + 7 * (n - 1)); return d; };

    const generated = [];
    for (let i = 0; i < 6; i++) {
      const base = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const y = base.getFullYear(), m = base.getMonth();
      const reported = monthName(new Date(y, m - 1, 1));   // a release covers the prior month
      generated.push({ date: iso(firstWeekday(y, m, 5)),   type: 'nfp', label: `NFP ${reported}`,    detail: 'US Arbeitsmarktbericht (Nonfarm Payrolls)', impact: 'high' });
      generated.push({ date: iso(nthWeekday(y, m, 3, 2)),  type: 'cpi', label: `US CPI ${reported}`, detail: 'US Verbraucherpreisindex (YoY)',            impact: 'high' });
      if ([0, 3, 6, 9].includes(m)) {
        const q = ((m + 9) % 12) / 3 + 1;                  // quarter that just ended
        generated.push({ date: iso(new Date(y, m, 28)), type: 'gdp', label: `US BIP Q${q} (1. Schätzung)`, detail: 'GDP Advance Estimate', impact: 'medium' });
      }
    }
    const events = generated
      .filter(e => new Date(e.date + 'T00:00:00') >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);

    const typeColor = { fomc: '#3b82f6', ecb: '#10c980', cpi: '#f59e0b', nfp: '#a78bfa', gdp: '#06c8d8', eu: '#4a6080' };
    const typeIcon  = { fomc: '🏦', ecb: '🇪🇺', cpi: '📊', nfp: '👷', gdp: '📈', eu: '🇦🇹' };
    const impactBadge = { high: 'badge-red', medium: 'badge-blue', low: '' };

    const el = document.getElementById('calendar-block');
    if (!el) return;
    el.innerHTML = events.length === 0
      ? `<div class="macro-loading">Keine anstehenden Events in den nächsten Wochen</div>`
      : `<div class="calendar-grid">
      ${events.map(e => {
        const dt     = new Date(e.date + 'T00:00:00');
        const daysTo = Math.round((dt - today) / 86_400_000);
        const daysLbl = daysTo === 0 ? '⭐ Heute' : daysTo === 1 ? 'Morgen' : `in ${daysTo}d`;
        return `<div class="calendar-event" style="border-left:3px solid ${typeColor[e.type]}">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:4px">
            <span style="font-size:11px;font-weight:600;color:${typeColor[e.type]}">${typeIcon[e.type]} ${e.label}</span>
            <span class="badge ${impactBadge[e.impact]} badge" style="font-size:9px;white-space:nowrap">${daysLbl}</span>
          </div>
          <div style="font-size:10px;color:var(--text2);margin-top:2px">${e.detail}</div>
          <div style="font-size:10px;color:var(--text3)">${dt.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ─── CAPE — Shiller P/E (static reference, annual data) ── */
  renderCAPE() {
    const ctx = document.getElementById('cape-chart')?.getContext('2d');
    if (!ctx) return;
    if (this.charts.cape) { this.charts.cape.destroy(); this.charts.cape = null; }

    // Shiller CAPE data — updated annually (no free real-time API)
    const labels = ['2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026*'];
    const sp500  = [27.9, 33.3, 28.4, 30.8, 32.6, 38.5, 28.4, 30.1, 34.2, 35.1, 36.4];
    const eu     = [17.1, 18.8, 15.9, 18.2, 22.1, 24.8, 16.2, 15.8, 17.1, 17.8, 18.2];
    const mean   = Array(labels.length).fill(17.0);

    this.charts.cape = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'S&P 500 CAPE', data: sp500, borderColor: '#06c8d8', fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#06c8d8' },
        { label: 'Europe CAPE',  data: eu,    borderColor: '#10c980', fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#10c980' },
        { label: 'Hist. Ø (17x)', data: mean, borderColor: '#4a6080', borderDash: [6, 3], pointRadius: 0, fill: false },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8899b8', boxWidth: 12, font: { size: 10 } } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}x` } },
        },
        scales: {
          x: { ticks: { color: '#4a6080', font: { size: 9 } }, grid: { color: '#1a2840' } },
          y: { ticks: { color: '#8899b8', font: { size: 10 }, callback: v => v + 'x' }, grid: { color: '#1a2840' } },
        },
      },
    });
  }
}

const macro = new MacroDashboard();
