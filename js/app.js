/* App bootstrap — navigation, clock, market ticker */
class App {
  constructor() {
    this.currentSection  = 'portfolio';
    this._macroRendered  = false;
  }

  init() {
    portfolio.init();
    etfAnalyzer.init();
    research.init();
    mc.init();
    this.initNav();
    this.startClock();
    this.renderTicker();
    this.initSettings();
    this.checkApiKey();
    window.addEventListener('resize', () => {
      if (this.currentSection === 'montecarlo') mc.redraw();
    });
  }

  initNav() {
    document.querySelectorAll('.nav-item[data-section]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.navigate(el.dataset.section);
      });
    });

    // Mobile sidebar drawer
    const closeDrawer = () => document.body.classList.remove('sidebar-open');
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeDrawer);
  }

  navigate(section) {
    this.currentSection = section;
    document.body.classList.remove('sidebar-open');   // close mobile drawer on navigation

    document.querySelectorAll('.section').forEach(s => {
      const show = s.id === `section-${section}`;
      // CRITICAL: remove 'hidden' before setting display
      // (.hidden has display:none !important which overrides inline styles)
      s.classList.remove('hidden');
      s.classList.toggle('active', show);
      s.style.display = show ? 'block' : 'none';
    });

    document.querySelectorAll('.nav-item[data-section]').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });

    // Lazy-render macro charts (Chart.js needs visible canvas)
    if (section === 'macro' && !this._macroRendered) {
      this._macroRendered = true;
      setTimeout(() => macro.render(), 60);
    }

    // Re-render ETF charts whenever the section becomes visible
    // (Chart.js needs non-zero canvas dimensions; deferred render on portfolio load is unreliable)
    if (section === 'etf') {
      setTimeout(() => {
        if (etfAnalyzer.selected.length) etfAnalyzer._renderCharts();
      }, 80);
    }

    // Init MC canvas with placeholder
    if (section === 'montecarlo') {
      setTimeout(() => {
        const c = document.getElementById('mc-canvas');
        if (!c || mc.paths.length) return;
        c.width  = c.offsetWidth  * devicePixelRatio;
        c.height = c.offsetHeight * devicePixelRatio;
        const ctx = c.getContext('2d');
        ctx.scale(devicePixelRatio, devicePixelRatio);
        ctx.fillStyle = '#080e1a';
        ctx.fillRect(0, 0, c.offsetWidth, c.offsetHeight);
        ctx.fillStyle = '#1e3050';
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Configure parameters and click  ▶  Run Simulation', c.offsetWidth / 2, c.offsetHeight / 2);
      }, 60);
    }
  }

  startClock() {
    const update = () => {
      const now = new Date();
      setText('clock', now.toLocaleTimeString('de-DE', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }) + ' CET');
    };
    update();
    setInterval(update, 1000);
  }

  /* Live market ticker — Yahoo Finance via free CORS proxy (no API key).
     One spark request covers all symbols; cached 5 min and refreshed periodically. */
  renderTicker() {
    const num = (v, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    this._tickerSyms = [
      { sym: '^GSPC',    label: 'S&P 500',  fmt: v => num(v) },
      { sym: '^IXIC',    label: 'NASDAQ',   fmt: v => num(v) },
      { sym: '^GDAXI',   label: 'DAX',      fmt: v => num(v) },
      { sym: 'EURUSD=X', label: 'EUR/USD',  fmt: v => v.toFixed(4) },
      { sym: 'GC=F',     label: 'Gold',     fmt: v => '$' + num(v, 0) },
      { sym: 'CL=F',     label: 'WTI Öl',   fmt: v => '$' + v.toFixed(2) },
      { sym: 'BTC-USD',  label: 'BTC',      fmt: v => '$' + num(v, 0) },
      { sym: 'ETH-USD',  label: 'ETH',      fmt: v => '$' + num(v, 0) },
      { sym: '^VIX',     label: 'VIX',      fmt: v => v.toFixed(2) },
      { sym: '^TNX',     label: '10Y UST',  fmt: v => v.toFixed(2) + '%', chgAbs: true },
    ];

    const el = document.getElementById('market-ticker');
    // Immediate placeholders — labels only, never fake numbers
    el.innerHTML = this._tickerSyms.map(s => `
      <div class="ticker-item">
        <span class="ticker-sym">${s.label}</span>
        <span class="ticker-val" data-tval="${s.sym}">…</span>
        <span class="ticker-chg" data-tchg="${s.sym}"></span>
      </div>`).join('');

    // Show cached values instantly if fresh, then refresh live
    try {
      const c = JSON.parse(localStorage.getItem('ticker_cache') || 'null');
      if (c && Date.now() - c.t < 5 * 60 * 1000) this._paintTicker(c.d);
    } catch {}

    this._loadTicker();
    clearInterval(this._tickerTimer);
    this._tickerTimer = setInterval(() => this._loadTicker(), 5 * 60 * 1000);
  }

  async _loadTicker() {
    if (typeof proxyFetchJson !== 'function') return;
    const syms = this._tickerSyms.map(s => encodeURIComponent(s.sym)).join(',');
    const url  = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${syms}&range=1d&interval=5m`;
    const data = await proxyFetchJson(url);
    if (!data) return;

    // Spark may return a flat map {SYM:{close,chartPreviousClose}} or {spark:{result:[…]}}
    let flat = data;
    if (data.spark?.result) {
      flat = {};
      for (const r of data.spark.result) {
        const resp = r.response?.[0];
        if (!resp) continue;
        flat[r.symbol] = {
          close: resp.indicators?.quote?.[0]?.close || [resp.meta?.regularMarketPrice],
          chartPreviousClose: resp.meta?.chartPreviousClose ?? resp.meta?.previousClose,
        };
      }
    }
    this._paintTicker(flat);
    try { localStorage.setItem('ticker_cache', JSON.stringify({ t: Date.now(), d: flat })); } catch {}
  }

  _paintTicker(data) {
    const el = document.getElementById('market-ticker');
    if (!el) return;
    for (const s of this._tickerSyms) {
      const q = data[s.sym];
      if (!q) continue;
      const closes = Array.isArray(q.close) ? q.close.filter(x => x != null) : [];
      const price  = closes.length ? closes[closes.length - 1] : null;
      const prev   = q.chartPreviousClose ?? q.previousClose;
      if (price == null) continue;
      const chgAbs = prev ? price - prev : 0;
      const chgPct = prev ? (chgAbs / prev * 100) : 0;
      const pos    = chgAbs >= 0;
      const valEl = el.querySelector(`[data-tval="${CSS.escape(s.sym)}"]`);
      const chgEl = el.querySelector(`[data-tchg="${CSS.escape(s.sym)}"]`);
      if (valEl) valEl.textContent = s.fmt(price);
      if (chgEl) {
        chgEl.textContent = s.chgAbs
          ? `${pos ? '+' : ''}${chgAbs.toFixed(2)}`
          : `${pos ? '+' : ''}${chgPct.toFixed(2)}%`;
        chgEl.className = `ticker-chg ${pos ? 'green' : 'red'}`;
      }
    }
  }

  initSettings() {
    // Alpha Vantage key UI was removed — everything runs on free, no-key sources.
    // Kept as a guarded no-op so a stored key (if any) still works silently.
    const saveBtn = document.getElementById('save-av-btn');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', () => {
      const key = document.getElementById('av-key-input').value.trim();
      if (key) {
        localStorage.setItem('av_key', key);
        showToast('API key saved', 'success');
        this.checkApiKey();
      }
    });
  }

  checkApiKey() {
    const hasKey = !!localStorage.getItem('av_key');
    const badge  = document.getElementById('av-status-indicator');
    if (badge) {
      badge.textContent = hasKey ? 'Aktiv' : 'Optional';
      badge.className   = `badge ${hasKey ? 'badge-green' : 'badge-blue'}`;
    }
    if (hasKey) {
      const inp = document.getElementById('av-key-input');
      if (inp && !inp.value) inp.value = localStorage.getItem('av_key');
    }
  }
}

// Remove 'hidden' from all sections before the app starts.
// The .section CSS already hides them; .active shows the right one.
// We can't leave 'hidden' on sections because it uses !important which
// prevents inline style overrides in navigate().
document.querySelectorAll('.section').forEach(s => {
  s.classList.remove('hidden');
  s.style.display = s.classList.contains('active') ? 'block' : 'none';
});

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
